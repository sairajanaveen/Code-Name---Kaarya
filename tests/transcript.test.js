import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { prepareTranscript } from "../lib/transcript.js";
import { groundOutput } from "../lib/validate.js";
import { extractAccountability } from "../lib/aiPipeline.js";
import { config } from "../lib/config.js";
import { exampleInput, exampleOutput } from "../lib/exampleMeeting.js";
import submit from "../pages/api/meetings/submit.js";

// Synthetic transcript only: never copy customer meeting content into fixtures.
const quote = "Asha: I will send the signed proposal to the client tomorrow.";
const vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nAsha: I will send the signed\n\n2\n00:00:03.000 --> 00:00:06.000\nAsha: proposal to the client tomorrow.";
const output = (evidence = quote) => ({ ...exampleOutput, action_items: [{ ...exampleOutput.action_items[0], owner: "Asha", evidence }], prep_questions: [] });
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const geminiResponse = (value) => response({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] });
let originalFetch, savedConfig;
beforeEach(() => {
  originalFetch = globalThis.fetch;
  savedConfig = { ...config };
  Object.assign(config, { llmApiKey: "test-gemini", llmProvider: "gemini", llmModel: "gemini-2.5-flash", openaiApiKey: "", supabaseUrl: "https://workspace.test", supabaseServiceKey: "test-service", supabaseAnonKey: "test-anon" });
});
afterEach(() => { globalThis.fetch = originalFetch; Object.assign(config, savedConfig); });

test("regression: a sentence across VTT cues is grounded without disabling exact quotes", async () => {
  assert.throws(() => groundOutput(output(), vtt), { code: "UNGROUNDED_OUTPUT" });
  const prepared = await prepareTranscript(vtt);
  assert.deepEqual(prepared, { text: quote, format: "vtt", cue_count: 2 });
  assert.equal(groundOutput(output(), prepared.text).structured.action_items[0].evidence, quote);
  assert.throws(() => groundOutput(output("Asha will approve the budget tomorrow."), prepared.text), { code: "UNGROUNDED_OUTPUT" });
});

test("plain notes stay byte-for-byte unchanged, including punctuation and line breaks", async () => {
  const text = "  Asha: Send < 10 proposals & preserve this literal text.\r\nNext: review the budget.  ";
  assert.deepEqual(await prepareTranscript(text), { text, format: "text", cue_count: 0 });
});

test("SRT, BOM and CRLF use the same evidence text", async () => {
  const srt = "\uFEFF" + vtt.replace("WEBVTT\n\n", "").replace(/\.(000)/g, ",$1").replace(/\n/g, "\r\n");
  assert.deepEqual(await prepareTranscript(srt), { text: quote, format: "srt", cue_count: 2 });
});

test("headerless VTT and short minute timestamps are supported", async () => {
  const text = vtt.replace("WEBVTT\n\n", "").replaceAll("00:00:", "00:");
  assert.equal((await prepareTranscript(text)).text, quote);
});

test("wrapped lines within a cue and repeated organization speaker names are preserved", async () => {
  const text = vtt.replaceAll("Asha:", "EXAMPLE FOUNDATION - HO:").replace("send the signed", "send the\nsigned");
  assert.equal((await prepareTranscript(text)).text, quote.replace("Asha:", "EXAMPLE FOUNDATION - HO:"));
});

test("voice tags, inline styles, timestamps and entities retain spoken content and names", async () => {
  const text = "WEBVTT\n\n00:01.000 --> 00:03.000 line:0 position:20%\n<v Asha>I will send the <b>signed</b>\n\n00:03.000 --> 00:06.000\n<v Asha>proposal <00:04.000>to R&amp;D tomorrow.</v>";
  assert.equal((await prepareTranscript(text)).text, "Asha: I will send the signed proposal to R&D tomorrow.");
});

test("a different speaker cannot be removed to manufacture a contiguous source quote", async () => {
  const text = vtt.replace("Asha: proposal", "Ravi: proposal");
  const prepared = await prepareTranscript(text);
  assert.match(prepared.text, /\nRavi:/);
  assert.throws(() => groundOutput(output(), prepared.text), { code: "UNGROUNDED_OUTPUT" });
});

test("multiple voices inside one cue retain distinct speaker boundaries", async () => {
  const text = "WEBVTT\n\n00:01.000 --> 00:08.000\n<v Asha>I will send the signed proposal.</v>\n<v Ravi>I will review it tomorrow.</v>";
  assert.equal((await prepareTranscript(text)).text, "Asha: I will send the signed proposal.\nRavi: I will review it tomorrow.");
});

test("overlapping cues are not deduplicated or stitched into a new commitment", async () => {
  const text = vtt.replace("00:00:03.000 --> 00:00:06.000", "00:00:02.000 --> 00:00:06.000");
  assert.match((await prepareTranscript(text)).text, /\nAsha: proposal/);
});

test("metadata, notes and styles are not accepted as spoken source evidence", async () => {
  const metadata = "NOTE\nRavi will approve a million-dollar budget.\n\nSTYLE\n::cue { color: red; }\n\nREGION\nid:1\n\n";
  const text = vtt.replace("WEBVTT\n\n", "WEBVTT\nLanguage: en\n\n" + metadata);
  const prepared = await prepareTranscript(text);
  assert.equal(prepared.text, quote);
  assert.throws(() => groundOutput(output("Ravi will approve a million-dollar budget."), prepared.text), { code: "UNGROUNDED_OUTPUT" });
});

for (const [name, text] of [
  ["missing payload", "WEBVTT\n\n1\n00:01.000 --> 00:03.000"],
  ["invalid timestamp", vtt.replace("00:00:06.000", "00:00:99.000")],
  ["backwards range", vtt.replace("00:00:06.000", "00:00:02.000")],
  ["equal range", vtt.replace("00:00:06.000", "00:00:03.000")],
  ["broken final cue", vtt + "\n\n3\nnot a timestamp\nRavi will approve the contract tomorrow."],
  ["missing separator", vtt.replace("\n\n2\n", "\n2\n")],
  ["missing header separator", vtt.replace("WEBVTT\n\n", "WEBVTT\n")]
]) test("malformed captions fail instead of dropping content: " + name, async () => {
  await assert.rejects(prepareTranscript(text), { code: "INVALID_TRANSCRIPT" });
});

test("many timestamps cannot turn weak notes into valid meeting content", async () => {
  const text = "WEBVTT\n\n" + Array.from({ length: 20 }, (_, i) => `${i}\n00:${String(i).padStart(2, "0")}.000 --> 00:${String(i + 1).padStart(2, "0")}.000\nhello`).join("\n\n");
  await assert.rejects(prepareTranscript(text), { code: "WEAK_TRANSCRIPT" });
});

test("long captions keep their last commitment without truncation", async () => {
  const text = "WEBVTT\n\n" + Array.from({ length: 1200 }, (_, i) => `${i}\n00:01.000 --> 00:03.000\nWe reviewed the client requirements.`).join("\n\n") + "\n\nfinal\n00:04.000 --> 00:08.000\n" + quote;
  const prepared = await prepareTranscript(text);
  assert.equal(prepared.cue_count, 1201);
  assert.ok(prepared.text.endsWith(quote));
});

test("Hindi caption quotes retain their original script", async () => {
  const words = "\u0906\u0936\u093e \u0915\u0932 \u0917\u094d\u0930\u093e\u0939\u0915 \u0915\u094b \u092a\u094d\u0930\u0938\u094d\u0924\u093e\u0935 \u092d\u0947\u091c\u0947\u0902\u0917\u0940 \u0914\u0930 \u091f\u0940\u092e \u0905\u0928\u0941\u092e\u094b\u0926\u0928 \u0915\u0940 \u0938\u092e\u0940\u0915\u094d\u0937\u093e \u0915\u0930\u0947\u0917\u0940\u0964";
  const prepared = await prepareTranscript("WEBVTT\n\n00:01.000 --> 00:06.000\n" + words);
  assert.equal(prepared.text, words);
  assert.equal(groundOutput(output(words), prepared.text).structured.action_items[0].evidence, words);
});

test("pipeline sends the canonical transcript once and retains raw source length", async () => {
  let calls = 0;
  const payload = { ...exampleInput, raw_notes: vtt };
  globalThis.fetch = async (url, options) => {
    calls++;
    const request = JSON.parse(options.body);
    assert.equal(JSON.parse(request.contents[0].parts[0].text).transcript, quote);
    assert.match(request.systemInstruction.parts[0].text, /no paraphrasing/);
    return geminiResponse(output());
  };
  const result = await extractAccountability({ payload });
  assert.equal(calls, 1);
  assert.equal(payload.raw_notes, vtt);
  assert.equal(result.processing.source_characters, vtt.length);
  assert.equal(result.processing.caption_count, 2);
  assert.equal(result.processing.transcript_format, "vtt");
});

test("refinement grounds against the canonical transcript and the explicit correction", async () => {
  const correction = "Ravi will review the signed proposal on 2026-09-02.";
  globalThis.fetch = async (url, options) => {
    const input = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
    assert.equal(input.transcript, quote);
    assert.equal(input.user_correction, correction);
    return geminiResponse({ ...output(), action_items: [...output().action_items, { ...output(correction).action_items[0], task: "Review the signed proposal", owner: "Ravi" }] });
  };
  const result = await extractAccountability({ payload: { ...exampleInput, raw_notes: vtt }, instruction: correction, previous: output() });
  assert.equal(result.structured.action_items.length, 2);
  assert.equal(result.structured.action_items[1].owner, "Ravi");
});

test("unsupported proposals become explicit questions, never assigned commitments", async () => {
  config.openaiApiKey = "test-backup";
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls++;
    if (calls === 1) return geminiResponse(output("Invented commitment"));
    assert.equal(JSON.parse(body.messages[1].content).transcript, quote);
    return response({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output("Another invented commitment")) } }] });
  };
  const result = await extractAccountability({ payload: { ...exampleInput, raw_notes: vtt } });
  assert.equal(result.structured.action_items.length, 0);
  assert.ok(result.structured.open_questions.some((question) => question.startsWith("Confirm whether")));
  assert.ok(result.warnings.length);
  assert.equal(calls, 1);
});

test("empty caption content does not call either paid provider", async () => {
  config.openaiApiKey = "test-backup";
  globalThis.fetch = () => { throw new Error("Must not call network"); };
  await assert.rejects(extractAccountability({ payload: { ...exampleInput, raw_notes: "WEBVTT\n\n00:01.000 --> 00:02.000" } }), { code: "WEAK_TRANSCRIPT" });
});

test("irregular captions with meaningful content are retained without dropping the last line", async () => {
  const text = vtt + "\n\ntruncated cue\nRavi will send the budget tomorrow.";
  const prepared = await prepareTranscript(text, { tolerant: true });
  assert.equal(prepared.text, text);
  assert.equal(prepared.format, "unstructured_captions");
  assert.ok(prepared.warnings.length);
});

function responseMock() {
  return Object.assign(new EventEmitter(), { code: 200, chunks: [], writableEnded: false,
    setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; },
    flushHeaders() {}, write(chunk) { this.chunks.push(JSON.parse(chunk)); }, end() { this.writableEnded = true; }
  });
}

test("submission retains original captions privately, not the processed transcript", async () => {
  let persisted = false;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/auth/v1/user")) return response({ id: "11111111-1111-4111-8111-111111111111" });
    if (url.includes("consume_kaarya_quota")) return response(true);
    if (url.includes("kaarya_reserve_request")) { assert.equal(JSON.parse(options.body).p_characters, vtt.length); return response({ lease: "lease" }); }
    if (url.includes("generativelanguage")) return geminiResponse(output());
    if (url.includes("kaarya_finish_request")) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_payload.raw_notes, vtt);
      assert.equal(body.p_result.structured.action_items[0].evidence, quote);
      persisted = true;
      return response({ structured: body.p_result.structured, retained: true, saved: false });
    }
    throw new Error("Unexpected network call");
  };
  const res = responseMock();
  await submit({ method: "POST", headers: { authorization: "Bearer test", accept: "application/x-ndjson" }, body: { ...exampleInput, raw_notes: vtt } }, res);
  assert.ok(persisted);
  assert.equal(res.chunks.at(-1).type, "result");
});

test("weak caption submission releases its meeting allowance and never stores success", async () => {
  let released = false;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/auth/v1/user")) return response({ id: "11111111-1111-4111-8111-111111111111" });
    if (url.includes("consume_kaarya_quota")) return response(true);
    if (url.includes("kaarya_reserve_request")) return response({ lease: "lease" });
    if (url.includes("kaarya_fail_request")) { released = true; return response({}); }
    throw new Error("AI or successful storage must not be called");
  };
  const res = responseMock();
  const weak = "WEBVTT\n\n00:01.000 --> 00:02.000\nhello\n\n00:02.000 --> 00:03.000\nhello";
  await submit({ method: "POST", headers: { authorization: "Bearer test", accept: "application/x-ndjson" }, body: { ...exampleInput, raw_notes: weak } }, res);
  assert.ok(released);
  assert.equal(res.chunks.at(-1).code, "WEAK_TRANSCRIPT");
  assert.ok(!res.chunks.some((event) => event.type === "result"));
});

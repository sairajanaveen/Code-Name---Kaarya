import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { assessNotes, validateMeetingPayload, validDate, validEmail, MAX_TRANSCRIPT_LENGTH } from "../lib/meetingInput.js";
import { validateStructuredOutput, groundOutput } from "../lib/validate.js";
import { normalizeIntakePayload } from "../lib/intake.js";
import { extractAccountability, parseJsonContent, geminiSchema, providerFailure } from "../lib/aiPipeline.js";
import { config, llmSettings } from "../lib/config.js";
import { requireUser } from "../lib/auth.js";
import { listMeetings, listTasks, consumeQuota, updateTaskByToken, saveReviewedDraft } from "../lib/supabase.js";
import { buildPostMeetingEmail, plainTextToHtml, buildMeetingWhatsApp } from "../lib/templates.js";
import { readDraftResponse } from "../lib/clientFlow.js";
import { exampleInput, exampleOutput, createExampleReview } from "../lib/exampleMeeting.js";
import { publicSupabaseConfig } from "../lib/publicConfig.js";
import { sendDirectEmail } from "../lib/email.js";
import submit from "../pages/api/meetings/submit.js";
import send from "../pages/api/messages/send.js";
import tasks from "../pages/api/dashboard/tasks.js";
import save from "../pages/api/meetings/save.js";
import { publishToNotion } from "../lib/publishers.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const userId = "11111111-1111-4111-8111-111111111111";
const meetingId = "22222222-2222-4222-8222-222222222222";
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
let originalFetch;
let savedConfig;
beforeEach(() => { originalFetch = globalThis.fetch; savedConfig = { ...config }; config.llmApiKey = "test-gemini"; config.llmProvider = "gemini"; config.llmModel = "gemini-2.5-flash"; config.openaiApiKey = ""; config.supabaseUrl = "https://workspace.test"; config.supabaseAnonKey = "test-anon"; config.supabaseServiceKey = "test-service"; config.resendApiKey = "test-resend"; });
afterEach(() => { globalThis.fetch = originalFetch; Object.assign(config, savedConfig); });

for (const value of ["", "hello", "test ".repeat(50), "!!!!!!!!!!!!!!!!!!!!!!!!!"]) test("blocks weak input: " + value.slice(0, 20), () => assert.ok(assessNotes(value)));
test("accepts a concise real commitment without 18-word friction", () => assert.equal(assessNotes("Asha will send the signed client proposal tomorrow."), ""));
test("date rejects invalid calendar dates", () => { assert.equal(validDate("2026-02-30"), false); assert.equal(validDate("2028-02-29"), true); });
test("email rejects malformed recipients", () => { assert.equal(validEmail("a@"), false); assert.equal(validEmail("a@b.com\nBCC:other@example.com"), false); assert.equal(validEmail("asha@example.com"), true); });
test("notes are the only required intake content", () => { const value = validateMeetingPayload({ raw_notes: exampleInput.raw_notes }); assert.equal(value.ok, true); assert.equal(value.payload.meeting_name, "Meeting notes"); assert.equal(value.payload.review_before_send, true); });
test("overlong input is rejected without silently truncating", () => { const raw_notes = "x".repeat(MAX_TRANSCRIPT_LENGTH + 1); const normalized = normalizeIntakePayload({ raw_notes }); assert.equal(normalized.raw_notes.length, raw_notes.length); assert.equal(validateMeetingPayload(normalized).ok, false); });
test("long transcripts are preserved end to end", () => { const raw_notes = exampleInput.raw_notes.repeat(100); const value = validateMeetingPayload(normalizeIntakePayload({ raw_notes })); assert.equal(value.ok, true); assert.equal(value.payload.raw_notes, raw_notes); });
test("audio URLs are not treated as transcribed input", () => assert.equal(validateMeetingPayload({ audio_url: "https://file.example/recording.webm" }).ok, false));
test("Tally and website normalize to the same notes", () => { const value = normalizeIntakePayload({ data: { fields: [{ label: "Meeting notes", value: exampleInput.raw_notes }, { label: "Meeting name", value: exampleInput.meeting_name }] } }); assert.equal(value.raw_notes, exampleInput.raw_notes); assert.equal(value.source, "tally"); assert.equal(value.review_before_send, true); });
test("malformed JSON is not replaced by an empty success", () => assert.throws(() => parseJsonContent("bad JSON"), /incomplete/));
test("strict output rejects unknown fields", () => assert.throws(() => validateStructuredOutput({ ...exampleOutput, invented: true }), /format/));
test("strict output rejects a decimal score", () => assert.throws(() => validateStructuredOutput({ ...exampleOutput, readiness_score: 0.7 }), /format/));
test("strict output rejects oversized tasks", () => { const output = clone(exampleOutput); output.action_items[0].task = "x".repeat(261); assert.throws(() => validateStructuredOutput(output), /format/); });
test("strict output rejects impossible dates", () => { const output = clone(exampleOutput); output.action_items[0].due_date = "2026-02-30"; assert.throws(() => validateStructuredOutput(output), /date/); });
test("a no-actions meeting is a valid result, without filler questions", () => { const output = { ...exampleOutput, action_items: [], prep_questions: [] }; assert.equal(groundOutput(output, exampleInput.raw_notes).structured.action_items.length, 0); });
test("source quotes are required for generated actions", () => { const output = clone(exampleOutput); output.action_items.forEach((item) => item.evidence = "Made up evidence"); assert.throws(() => groundOutput(output, exampleInput.raw_notes), /verify/); });
test("unsupported actions are removed and warnings shown", () => { const output = clone(exampleOutput); output.action_items[0].evidence = "Made up"; const result = groundOutput(output, exampleInput.raw_notes); assert.equal(result.structured.action_items.length, 2); assert.ok(result.warnings.length); });
test("unsupported owner becomes Unassigned", () => { const output = clone(exampleOutput); output.action_items[0].owner = "An invented person"; assert.equal(groundOutput(output, exampleInput.raw_notes).structured.action_items[0].owner, "Unassigned"); });
test("duplicate tasks are removed", () => { const output = clone(exampleOutput); output.action_items.push(output.action_items[0]); assert.equal(groundOutput(output, exampleInput.raw_notes).structured.action_items.length, 3); });
test("source completeness is deterministic", () => assert.equal(groundOutput(exampleOutput, exampleInput.raw_notes).structured.readiness_score, 83));

for (const [name, quote] of [
  ["Hindi", "आशा कल ग्राहक को प्रस्ताव भेजेंगी और टीम अनुमोदन की समीक्षा करेगी।"],
  ["Telugu", "ఆశ రేపు కస్టమర్ కు ప్రతిపాదన పంపుతుంది మరియు బృందం ఆమోదం సమీక్షిస్తుంది."],
  ["Tamil", "ஆஷா நாளை வாடிக்கையாளருக்கு முன்மொழிவை அனுப்புவார் மற்றும் குழு ஒப்புதலை மதிப்பாய்வு செய்யும்."],
  ["Kannada", "ಆಶಾ ನಾಳೆ ಗ್ರಾಹಕರಿಗೆ ಪ್ರಸ್ತಾವನೆಯನ್ನು ಕಳುಹಿಸುತ್ತಾರೆ ಮತ್ತು ತಂಡ ಅನುಮೋದನೆ ಪರಿಶೀಲಿಸುತ್ತದೆ."],
  ["Code mixed", "Asha kal client ko proposal bhejegi aur team approval review karegi."]
]) test(name + " input and evidence are preserved", () => { assert.equal(assessNotes(quote), ""); const output = { ...clone(exampleOutput), action_items: [{ ...exampleOutput.action_items[0], evidence: quote, owner: "Unassigned", due_date: "" }] }; assert.equal(groundOutput(output, quote).structured.action_items[0].evidence, quote); });

test("happy path uses a single provider call and a schema", async () => {
  let count = 0;
  globalThis.fetch = async (url, options) => { count++; assert.match(url, /generativelanguage/); assert.equal(options.headers["x-goog-api-key"], "test-gemini"); const body = JSON.parse(options.body); assert.equal(body.generationConfig.responseSchema.type, "OBJECT"); assert.equal(body.generationConfig.responseJsonSchema, undefined); return json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(exampleOutput) }] } }] }); };
  const events = []; const data = await extractAccountability({ payload: exampleInput, onStage: (stage) => events.push(stage) });
  assert.equal(count, 1); assert.equal(data.structured.action_items.length, 3); assert.deepEqual(events, ["extracting", "checking"]);
});
test("provider failure never becomes a sample success", async () => { globalThis.fetch = async () => json({}, 503); await assert.rejects(extractAccountability({ payload: exampleInput }), /could not create/); });
test("missing credentials fail clearly", async () => { config.llmApiKey = ""; await assert.rejects(extractAccountability({ payload: exampleInput }), /not configured/); });
test("one fallback uses OpenAI credentials and strict schema", async () => {
  config.openaiApiKey = "backup-key"; let count = 0;
  globalThis.fetch = async (url, options) => { count++; if (count === 1) return json({}, 429); assert.equal(options.headers.Authorization, "Bearer backup-key"); assert.equal(JSON.parse(options.body).response_format.json_schema.strict, true); return json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(exampleOutput) } }] }); };
  const data = await extractAccountability({ payload: exampleInput }); assert.equal(count, 2); assert.equal(data.processing.provider, "openai");
});
test("truncated output is rejected", async () => { globalThis.fetch = async () => json({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } }] }); await assert.rejects(extractAccountability({ payload: exampleInput }), /complete/); });
test("refinement includes original source and explicit correction", async () => {
  globalThis.fetch = async (url, options) => { const input = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text); assert.equal(input.transcript, exampleInput.raw_notes); assert.equal(input.user_correction, "Keep Priya blocked"); return json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(exampleOutput) }] } }] }); };
  await extractAccountability({ payload: exampleInput, instruction: "Keep Priya blocked", previous: exampleOutput });
});
test("authentication rejects missing bearer token without network calls", async () => { globalThis.fetch = () => { throw new Error("must not call"); }; await assert.rejects(requireUser({ headers: {} }), /Sign in/); });
test("authentication validates the token with Supabase", async () => { globalThis.fetch = async (url) => { assert.match(url, /auth\/v1\/user$/); return json({ id: userId }); }; assert.equal((await requireUser({ headers: { authorization: "Bearer session" } })).id, userId); });
test("history reads always filter by verified owner", async () => { const urls = []; globalThis.fetch = async (url) => { urls.push(url); return json([]); }; await listMeetings(userId); await listTasks(userId); assert.ok(urls.every((url) => url.includes("created_by=eq." + userId))); await assert.rejects(listMeetings(), /Sign in/); });
test("rate limit is durable and fails closed", async () => { globalThis.fetch = async () => json(false); await assert.rejects(consumeQuota(userId, "extract", 12), /hourly limit/); });
test("email contains compact tabular rows and latest edits", () => { const output = clone(exampleOutput); output.action_items[0].owner = "Edited owner"; const text = buildPostMeetingEmail({ meeting: { title: "Review" }, tasks: output.action_items }); assert.ok(text.includes("Action\tOwner\tDue\tStatus")); assert.ok(text.includes("Edited owner")); assert.ok(!text.includes("AI-generated")); });
test("rich copy escapes unsafe HTML and renders a real table", () => { const html = plainTextToHtml("Action\tOwner\n<script>alert(1)</script>\tAsha"); assert.ok(html.includes("<table")); assert.ok(html.includes("&lt;script&gt;")); assert.ok(!html.includes("<script>")); });
test("WhatsApp output is plain text without markdown tables", () => { const text = buildMeetingWhatsApp({ meeting: { title: "Review" }, tasks: exampleOutput.action_items }); assert.ok(text.includes("Asha")); assert.ok(!text.includes("\t")); });
test("scheduled email has idempotency key and matching text/HTML", async () => { globalThis.fetch = async (url, options) => { const body = JSON.parse(options.body); assert.equal(body.scheduled_at, "2026-09-01T12:00:00Z"); assert.equal(options.headers["Idempotency-Key"], "once"); assert.ok(body.text.includes("Agreed")); assert.ok(body.html.includes("Agreed")); return json({ id: "mail-id" }); }; const result = await sendDirectEmail({ to: "user@example.com", subject: "Review", text: "Agreed", scheduledAt: "2026-09-01T12:00:00Z", idempotencyKey: "once" }); assert.equal(result.scheduled, true); });

function responseMock() { const response = new EventEmitter(); Object.assign(response, { code: 200, headers: {}, chunks: [], writableEnded: false, setHeader(name, value) { this.headers[name] = value; }, status(value) { this.code = value; return this; }, json(value) { this.data = value; return this; }, flushHeaders() {}, write(value) { this.chunks.push(value); }, end() { this.writableEnded = true; } }); return response; }
test("submit rejects bad input before AI or storage", async () => { globalThis.fetch = () => { throw new Error("must not call"); }; const res = responseMock(); await submit({ method: "POST", headers: {}, body: { raw_notes: "hello" } }, res); assert.equal(res.code, 400); });
test("streamed draft never publishes or persists before review", async () => {
  const urls = []; globalThis.fetch = async (url) => { urls.push(url); if (url.endsWith("/auth/v1/user")) return json({ id: userId }); if (url.includes("consume_kaarya_quota")) return json(true); if (url.includes("generativelanguage")) return json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(exampleOutput) }] } }] }); throw new Error("Unexpected service"); };
  const res = responseMock(); await submit({ method: "POST", headers: { authorization: "Bearer test", accept: "application/x-ndjson" }, body: exampleInput }, res);
  const events = res.chunks.map((chunk) => JSON.parse(chunk)); assert.equal(events.at(-1).type, "result"); assert.equal(events.at(-1).data.saved, false); assert.ok(!urls.some((url) => /notion|resend|make\.com|rest\/v1\/meetings/.test(url)));
});
test("email API requires ownership before calling provider", async () => { const urls = []; globalThis.fetch = async (url) => { urls.push(url); return url.includes("auth/v1/user") ? json({ id: userId }) : json([]); }; const res = responseMock(); await send({ method: "POST", headers: { authorization: "Bearer test" }, body: { to: "x@example.com", meeting_id: meetingId, subject: "Hi", text: "Body" } }, res); assert.equal(res.code, 404); assert.ok(!urls.some((url) => url.includes("resend"))); });
test("stream parser handles split UTF-8 chunks", async () => { const text = JSON.stringify({ type: "stage", stage: "checking" }) + "\n" + JSON.stringify({ type: "result", data: { structured: { summary: "नमस्ते" } } }) + "\n"; const bytes = new TextEncoder().encode(text); const stream = new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); } }); const stages = []; const result = await readDraftResponse(new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } }), (value) => stages.push(value)); assert.equal(result.structured.summary, "नमस्ते"); assert.deepEqual(stages, ["checking"]); });
test("stream parser rejects interrupted progress-only response", async () => { await assert.rejects(readDraftResponse(new Response('{"type":"stage","stage":"extracting"}\n', { headers: { "Content-Type": "application/x-ndjson" } }), () => {}), /connection ended/); });

test("history opens fresh tasks scoped to the selected meeting", async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    if (url.endsWith("/auth/v1/user")) return json({ id: userId });
    if (url.includes("/meetings?")) return json([{ id: meetingId, created_by: userId, draft_revision: 3 }]);
    return json([{ id: "task", meeting_id: meetingId, status: "done" }]);
  };
  const res = responseMock();
  await tasks({ method: "GET", query: { meeting_id: meetingId }, headers: { authorization: "Bearer test" } }, res);
  assert.equal(res.data.meeting.draft_revision, 3);
  assert.equal(res.data.tasks[0].status, "done");
  assert.ok(urls.at(-1).includes("meeting_id=eq." + meetingId));
  assert.ok(urls.at(-1).includes("created_by=eq." + userId));
});
test("stakeholder update cannot overwrite the source quote or owner", async () => {
  globalThis.fetch = async (url, options) => {
    assert.match(url, /rpc\/update_kaarya_task$/);
    assert.deepEqual(JSON.parse(options.body), { p_token: "a".repeat(36), p_status: "done", p_note: "Proposal approved" });
    return json({ status: "done" });
  };
  await updateTaskByToken("a".repeat(36), { status: "done", update_note: "Proposal approved", evidence: "tampered", owner: "someone else" });
});
test("stakeholder update rejects invalid tokens and status before storage", async () => {
  globalThis.fetch = () => { throw new Error("must not call"); };
  await assert.rejects(updateTaskByToken("bad", {}), /not found/);
  await assert.rejects(updateTaskByToken("a".repeat(36), { status: "deleted", update_note: "" }), /valid status/);
});
test("stale reviewed saves are a conflict, not a silent overwrite", async () => {
  globalThis.fetch = async () => json({ message: "STALE_DRAFT" }, 400);
  await assert.rejects(saveReviewedDraft({ userId, meeting: { id: meetingId }, structured: exampleOutput, actionIds: [], revision: 1, saveId: userId, notes: "notes" }), (error) => error.status === 409);
});
test("save rejects duplicate action IDs before invoking the write RPC", async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(url); return json({ id: userId }); };
  const res = responseMock();
  await save({ method: "POST", headers: { authorization: "Bearer test" }, body: { meeting: { id: meetingId, title: "Review", meeting_date: "2026-08-27" }, structured: exampleOutput, action_ids: [userId, userId, userId], save_id: userId } }, res);
  assert.equal(res.code, 400); assert.equal(urls.length, 1);
});
test("send later rejects past or invalid times before delivery", async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(url); return url.includes("auth/v1/user") ? json({ id: userId }) : json([{ id: meetingId }]); };
  for (const scheduled_at of ["not a date", "2000-01-01T00:00:00Z"]) {
    const res = responseMock();
    await send({ method: "POST", headers: { authorization: "Bearer test" }, body: { meeting_id: meetingId, to: "person@example.com", subject: "Review", text: "Approved", scheduled_at } }, res);
    assert.equal(res.code, 400);
  }
  assert.ok(!urls.some((url) => url.includes("resend")));
});
test("Notion transport failure is reported as a failed item", async () => {
  config.notionToken = "test"; config.notionTasksDatabaseId = "test";
  globalThis.fetch = async () => { throw new Error("offline"); };
  const result = await publishToNotion({ meeting: { title: "Review" }, structured: { ...exampleOutput, action_items: [exampleOutput.action_items[0]] } });
  assert.equal(result.created[0].ok, false); assert.equal(result.created[0].status, 502);
});

test("explicit AI configuration takes precedence and normalizes provider/model", () => {
  const settings = llmSettings({ STRUCTURED_LLM_PROVIDER: " Gemini ", STRUCTURED_LLM_MODEL: "models/gemini-2.5-flash ", STRUCTURED_LLM_API_KEY: " configured ", GEMINI_API_KEY: "other" });
  assert.equal(settings.llmProvider, "gemini");
  assert.equal(settings.llmModel, "gemini-2.5-flash");
  assert.equal(settings.llmApiKey, "configured");
});
test("Gemini receives supported schema while local string limits stay intact", () => {
  const schema = { type: "object", properties: { task: { type: "string", minLength: 1, maxLength: 260 } }, required: ["task"], additionalProperties: false };
  assert.deepEqual(geminiSchema(schema).properties.task, { type: "STRING" });
  assert.equal(schema.properties.task.maxLength, 260);
  assert.equal(schema.additionalProperties, false);
  assert.equal(geminiSchema(schema).additionalProperties, undefined);
  assert.deepEqual(geminiSchema({ type: "array", maxItems: 5, items: { type: "integer", minimum: 0, maximum: 100 } }), { type: "ARRAY", maxItems: 5, items: { type: "INTEGER", minimum: 0, maximum: 100 } });
});
test("provider credentials, model, format and quota failures have safe specific errors", async () => {
  for (const [status, detail, code] of [
    [400, "API key not valid. Please pass a valid API key.", "AI_CREDENTIALS"],
    [400, "Your API key was reported as leaked. Please use another API key.", "AI_CREDENTIALS"],
    [401, "secret-token must not be returned", "AI_CREDENTIALS"],
    [404, "model missing", "AI_MODEL_UNAVAILABLE"],
    [400, "unsupported schema contains private text", "AI_REQUEST_REJECTED"],
    [429, "quota", "AI_QUOTA"]
  ]) {
    const error = await providerFailure(json({ error: { message: detail } }, status));
    assert.equal(error.code, code);
    assert.ok(!error.message.includes("secret-token"));
    assert.ok(!error.message.includes("private text"));
  }
});
test("provider diagnostics retain only known request field names", async () => {
  const error = await providerFailure(json({ error: { message: "Unknown response_json_schema. Private meeting and secret-key must not be logged." } }, 400));
  assert.deepEqual(error.requestFields, ["responseJsonSchema"]);
  assert.ok(!JSON.stringify(error).includes("secret-key"));
});

test("example opens a complete editable review without authentication or network", () => {
  globalThis.fetch = () => { throw new Error("Example must stay local"); };
  let id = 0;
  const review = createExampleReview(() => String(++id));
  assert.equal(review.example, true);
  assert.equal(review.saved, false);
  assert.equal(review.structured.action_items.length, 3);
  assert.equal(new Set(review.structured.action_items.map((task) => task.id)).size, 3);
  review.structured.action_items[0].owner = "Edited";
  assert.equal(exampleOutput.action_items[0].owner, "Asha");
});
test("browser auth supports publishable and legacy anon keys without a secret fallback", () => {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const old = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://workspace.test";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "legacy";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "never-in-browser";
    assert.equal(publicSupabaseConfig().key, "publishable");
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.equal(publicSupabaseConfig().key, "legacy");
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    assert.equal(publicSupabaseConfig().key, "");
  } finally {
    for (const key of keys) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; }
  }
});

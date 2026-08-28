import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { config } from "../lib/config.js";
import { processJobStep, digest } from "../lib/transcriptJobs.js";
import { exampleInput, exampleOutput } from "../lib/exampleMeeting.js";

let fetchBefore, configBefore;
const json = (value) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  fetchBefore = globalThis.fetch; configBefore = { ...config };
  config.supabaseUrl = "https://test.supabase.local"; config.supabaseServiceKey = "test-server-key";
});
afterEach(() => { globalThis.fetch = fetchBefore; Object.assign(config, configBefore); });

test("job preparation verifies upload integrity before paid inference", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return json(url.endsWith("claim") ? { status: "preparing", lease: "lease", raw_notes: exampleInput.raw_notes, payload: { source_hash: "wrong" } } : {});
  };
  await assert.rejects(processJobStep("owner", "job", () => { throw new Error("must not infer"); }), /did not match/);
  assert.ok(calls.at(-1).endsWith("release"));
  assert.ok(!calls.some((url) => url.endsWith("prepare")));
});

test("preparation preserves all transcript sections and existing review context", async () => {
  const raw = exampleInput.raw_notes.repeat(200);
  let prepared;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("claim")) return json({ status: "preparing", lease: "lease", raw_notes: raw, payload: { source_hash: digest(raw), structured: exampleOutput } });
    prepared = JSON.parse(options.body); return json({});
  };
  const result = await processJobStep("owner", "job", () => { throw new Error("must not infer"); });
  assert.equal(result.done, false);
  assert.ok(result.total_sections > 1);
  assert.equal(prepared.p_sections.at(-1).end, raw.length);
  assert.equal(prepared.p_sections.flatMap((part) => part.previous.action_items).length, 3);
});

test("one processing call checkpoints one section with its review context", async () => {
  let extracted, checkpoint;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("claim")) return json({ status: "processing", lease: "lease", position: 2, total: 4, content: exampleInput.raw_notes, payload: { ...exampleInput, kind: "refine", instruction: "Keep all confirmed actions." }, previous: exampleOutput });
    checkpoint = JSON.parse(options.body); return json({});
  };
  const result = await processJobStep("owner", "job", async (input) => { extracted = input; return { structured: exampleOutput }; });
  assert.equal(extracted.section.number, 3);
  assert.equal(extracted.previous.action_items.length, 3);
  assert.equal(checkpoint.p_position, 2);
  assert.equal(result.completed_sections, 3);
});

test("an inference failure releases the step lease without checkpointing success", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return json(url.endsWith("claim") ? { status: "processing", lease: "lease", position: 0, total: 1, content: exampleInput.raw_notes, payload: exampleInput } : {});
  };
  await assert.rejects(processJobStep("owner", "job", async () => { throw new Error("provider unavailable"); }), /provider unavailable/);
  assert.ok(calls.at(-1).endsWith("release"));
  assert.ok(!calls.some((url) => url.endsWith("checkpoint")));
});

test("completed jobs return their stored result without another model call", async () => {
  globalThis.fetch = async (url) => json(url.endsWith("claim") ? { status: "completed" } : [{ result: { structured: exampleOutput } }]);
  const result = await processJobStep("owner", "job", () => { throw new Error("must not infer"); });
  assert.equal(result.done, true);
  assert.equal(result.data.structured.minutes.length, 3);
});

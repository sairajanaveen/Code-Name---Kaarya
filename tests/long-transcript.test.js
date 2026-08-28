import test from "node:test";
import assert from "node:assert/strict";
import { uploadParts, transcriptSections, refinementSections, mergeSectionReports } from "../lib/longTranscript.js";
import { withActionIds } from "../lib/meetingReview.js";
import { assessNotes, MAX_TRANSCRIPT_BYTES, transcriptBytes } from "../lib/meetingInput.js";
import { exampleInput, exampleOutput } from "../lib/exampleMeeting.js";
import { validateStructuredOutput, groundOutput } from "../lib/validate.js";
import { buildPostMeetingEmail } from "../lib/templates.js";
import { composeLink } from "../lib/shareLinks.js";
import { runTranscriptJob } from "../lib/clientJobs.js";
import { PLANS } from "../lib/plans.js";

test("short but meaningful notes are accepted", () => {
  assert.equal(assessNotes("Ravi: send invoice tomorrow."), "");
  assert.ok(assessNotes("hello"));
});

test("sparse word boundaries still fit within the 350-section job capacity", () => {
  const text = ("x".repeat(28001) + " " + "y".repeat(11998)).repeat(210).slice(0, MAX_TRANSCRIPT_BYTES);
  const sections = transcriptSections(text);
  assert.ok(sections.length <= 350);
  assert.equal(sections.at(-1).end, text.length);
  assert.ok(sections.every((section) => section.text.length <= 40000));
});

test("refinement context keeps every previous row exactly once, including manual actions", () => {
  const previous = structuredClone(exampleOutput);
  previous.action_items.push({ ...previous.action_items[0], task: "A manually confirmed step", evidence: "" });
  const sections = refinementSections([{ text: previous.action_items[0].evidence }, { text: previous.action_items[1].evidence }], previous);
  assert.equal(sections.flatMap((section) => section.previous.action_items).length, previous.action_items.length);
  assert.ok(sections[0].previous.action_items.some((task) => task.task === "A manually confirmed step"));
  assert.ok(sections[1].previous.action_items.some((task) => task.owner === "Rohan"));
  assert.equal(sections.flatMap((section) => section.previous.minutes).length, previous.minutes.length);
  assert.equal(sections[1].previous.summary, "");
});

test("same-named actions keep distinct stable IDs after refinement", () => {
  const tasks = [{ ...exampleOutput.action_items[0], id: "one" }, { ...exampleOutput.action_items[0], owner: "Rohan", id: "two" }];
  const output = { ...exampleOutput, action_items: [tasks[1], tasks[0], { ...tasks[0], owner: "Priya" }] };
  const result = withActionIds(output, tasks, () => "new");
  assert.deepEqual(result.action_items.map((task) => task.id), ["two", "one", "new"]);
});

test("Free and Pro have identical transcript capacity, not a 20k character paywall", () => {
  assert.equal(PLANS.free.inputCharacters, PLANS.pro.inputCharacters);
  assert.ok(PLANS.free.inputCharacters >= 8000000);
  assert.equal(assessNotes(exampleInput.raw_notes.repeat(100)), "");
});

test("8 MiB text is uploaded losslessly in bounded pieces", () => {
  const text = ("Meeting review: shipping, support, project dates, costs and ownership.\n").repeat(130000).slice(0, MAX_TRANSCRIPT_BYTES);
  const parts = uploadParts(text);
  assert.equal(parts.join(""), text);
  assert.ok(parts.every((part) => part.length <= 128000));
  assert.throws(() => uploadParts(text + "x"), /8 MiB/);
});

test("UTF-8 byte limits do not confuse Indian scripts with character counts", () => {
  const text = "\u092d\u093e\u0930\u0924".repeat(800000);
  assert.ok(text.length < MAX_TRANSCRIPT_BYTES);
  assert.ok(transcriptBytes(text) > MAX_TRANSCRIPT_BYTES);
  assert.throws(() => uploadParts(text), /8 MiB/);
});

test("upload and section boundaries preserve Unicode surrogate pairs", () => {
  const text = "x".repeat(127999) + "\u{1F600}" + "y".repeat(90000);
  assert.equal(uploadParts(text).join(""), text);
  assert.ok(uploadParts(text).every((part) => !/[\uD800-\uDBFF]$/.test(part) && !/^[\uDC00-\uDFFF]/.test(part)));
});

test("section coverage is continuous, bounded and includes the final commitment", () => {
  const text = exampleInput.raw_notes.repeat(600) + "\nLAST: Mira will send the signed contract tomorrow.";
  const sections = transcriptSections(text);
  assert.ok(sections.length > 1);
  assert.equal(sections[0].start, 0);
  let last = 0; let restored = "";
  for (const section of sections) {
    assert.ok(section.start <= last);
    assert.ok(section.text.length <= 40000);
    assert.equal(section.text, text.slice(section.start, section.end));
    restored += section.text.slice(last - section.start); last = section.end;
  }
  assert.equal(restored, text);
  assert.ok(sections.at(-1).text.endsWith("signed contract tomorrow."));
});

test("all section minutes survive merging and repeated actions are deduplicated", () => {
  const first = { structured: structuredClone(exampleOutput), warnings: [] };
  const second = structuredClone(first);
  second.structured.minutes.push({ topic: "Final decision", discussion: "A final topic at the end of the meeting.", outcome: "Needs approval." });
  const merged = mergeSectionReports([first, second]);
  assert.equal(merged.structured.action_items.length, 3);
  assert.equal(merged.structured.minutes.length, 4);
  assert.ok(merged.structured.minutes.some((row) => row.topic === "Final decision"));
  validateStructuredOutput(merged.structured);
});

test("conflicting owners and dates are preserved with an explicit review warning", () => {
  const first = { structured: structuredClone(exampleOutput), warnings: [] };
  const second = structuredClone(first);
  second.structured.action_items[0].owner = "Rohan";
  const merged = mergeSectionReports([first, second]);
  assert.equal(merged.structured.action_items.length, 4);
  assert.ok(merged.warnings.some((warning) => warning.includes("Different owners")));
});

test("a partial processing result cannot masquerade as a complete report", () => {
  assert.throws(() => mergeSectionReports([{ structured: exampleOutput }, null]), /not ready/);
});

test("unverified proposals are not assigned; useful minutes remain available", () => {
  const result = structuredClone(exampleOutput);
  result.action_items = [{ ...result.action_items[0], evidence: "A nonexistent promise." }];
  const checked = groundOutput(result, exampleInput.raw_notes, "", { allowUnconfirmed: true });
  assert.equal(checked.structured.action_items.length, 0);
  assert.equal(checked.structured.minutes.length, 3);
  assert.ok(checked.structured.open_questions.some((q) => q.startsWith("Confirm whether")));
});

test("an owner name cannot match inside an unrelated word", () => {
  const result = structuredClone(exampleOutput);
  result.action_items = [{ ...result.action_items[0], owner: "Sam", evidence: "The same team will send the checklist." }];
  assert.equal(groundOutput(result, "The same team will send the checklist.").structured.action_items[0].owner, "Unassigned");
});

test("the email includes minutes, decisions, blockers, questions and task columns", () => {
  const text = buildPostMeetingEmail({ meeting: { title: "Launch", meeting_date: "2026-08-28" }, structured: exampleOutput, tasks: exampleOutput.action_items, prepQuestions: exampleOutput.prep_questions });
  for (const section of ["Minutes of meeting", "Pilot launch and onboarding", "Decisions", "Blockers", "Open questions", "Action\tOwner\tTeam\tDue\tStatus"]) assert.ok(text.includes(section));
  assert.ok(!/AI-generated|as an AI|```/.test(text));
});

test("WhatsApp opens the official share URL with exact Unicode text", () => {
  const text = "Launch & review\n\u092d\u093e\u0930\u0924 #1 + next step";
  const link = composeLink("whatsapp", { text });
  assert.equal(new URL(link.href).origin, "https://wa.me");
  assert.equal(new URL(link.href).searchParams.get("text"), text);
  assert.equal(link.needsPaste, false);
});

test("email compose links encode recipients, subjects and bodies safely", () => {
  const fields = { to: "one@example.com, two@example.com", subject: "Review & action\r\nBcc: no", text: "First line\nSecond line" };
  for (const channel of ["gmail", "outlook", "mailto"]) {
    const link = composeLink(channel, fields);
    assert.ok(!link.error); assert.ok(!link.href.includes("\r"));
    assert.equal(link.needsPaste, false);
  }
  assert.ok(composeLink("gmail", { to: "bad recipient" }).error);
  assert.ok(composeLink("gmail", { to: "a@example.com\nb@example.com" }).error);
});

test("overlong compose URLs use a full-message copy fallback, never clipped text", () => {
  for (const channel of ["gmail", "outlook", "mailto", "whatsapp"]) {
    const link = composeLink(channel, { text: "long meeting note ".repeat(4000) });
    assert.equal(link.needsPaste, true);
    assert.ok(!link.href.includes("long"));
  }
});

test("resuming a checkpointed job never uploads or reprocesses completed sections", async () => {
  const calls=[];
  const result = await runTranscriptJob({ payload: {}, resumeId: "test", request: async (url, body, method) => {
    calls.push(method);
    if (method === "GET") return { id: "test", status: "processing", total_sections: 2, completed_sections: 1 };
    return { done: true, data: { structured: exampleOutput } };
  } });
  assert.deepEqual(calls, ["GET", "POST"]);
  assert.equal(result.structured.action_items.length, 3);
});

test("resuming with a different file is rejected before replacing saved uploads", async () => {
  let calls=0;
  await assert.rejects(runTranscriptJob({ payload: { raw_notes: "Different notes" }, resumeId: "test", request: async () => {
    calls++; return { id: "test", status: "uploading", source_hash: "not-the-same", uploaded: [] };
  } }), /same transcript/);
  assert.equal(calls, 1);
});

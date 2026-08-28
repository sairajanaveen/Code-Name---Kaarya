import { parseText, tokenizeVTTCue } from "media-captions";
import { AppError } from "./http.js";
import { assessNotes, MAX_TRANSCRIPT_LENGTH } from "./meetingInput.js";

const invalidCaptions = () => new AppError("This caption transcript could not be read completely. Export it again as VTT/SRT or paste the plain transcript. Your original notes are unchanged.", 400, "INVALID_TRANSCRIPT");
const compact = (text) => text.replace(/\s+/g, " ").trim();

function cueText(nodes, depth = 0) {
  if (depth > 64) throw invalidCaptions();
  return nodes.map((node) => {
    if (node.type === "text") return node.data;
    const text = cueText(node.children || [], depth + 1);
    return node.type === "v" && node.voice ? "\n" + compact(node.voice) + ": " + text + "\n" : text;
  }).join("");
}

export async function prepareTranscript(rawNotes) {
  if (typeof rawNotes !== "string" || rawNotes.length > MAX_TRANSCRIPT_LENGTH) {
    throw new AppError("Use a transcript of at most 100,000 characters. Nothing has been cut off.", 400, "INVALID_TRANSCRIPT");
  }
  const text = rawNotes.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const hasHeader = /^WEBVTT\b/.test(text);
  const firstBlock = text.split(/\n[ \t]*\n/, 1)[0];
  const timingLine = firstBlock.split("\n").find((line) => /^\d+:\d{2}[^\n]*-->/.test(line));
  if (!hasHeader && !timingLine) return { text: rawNotes, format: "text", cue_count: 0 };

  const format = !hasHeader && timingLine.split("-->")[0].includes(",") ? "srt" : "vtt";
  const blocks = text.split(/\n[ \t]*\n/).map((block) => block.trim()).filter(Boolean);
  if (hasHeader) {
    const header = blocks.shift();
    if (!/^WEBVTT(?:[ \t][^\n]*)?(?:\n|$)/.test(header) || header.includes("-->")) throw invalidCaptions();
  }
  const cues = blocks.filter((block) => format !== "vtt" || !/^(?:NOTE(?:[ \t\n]|$)|(?:STYLE|REGION)(?:\n|$))/.test(block));
  // Guard parser coverage: never silently discard a malformed or truncated cue.
  for (const block of cues) {
    const lines = block.split("\n");
    const timing = lines.findIndex((line) => line.includes("-->"));
    if (timing < 0 || timing > 1 || lines.filter((line) => line.includes("-->")).length !== 1 || !lines.slice(timing + 1).some((line) => line.trim())) throw invalidCaptions();
  }
  let parsed;
  try {
    parsed = await parseText((format === "vtt" ? "WEBVTT\n\n" : "") + cues.join("\n\n"), { type: format, strict: true });
  } catch {
    throw invalidCaptions();
  }
  if (!parsed.cues.length || parsed.errors.length || parsed.cues.length !== cues.length) throw invalidCaptions();

  const turns = [];
  for (const [cueIndex, cue] of parsed.cues.entries()) {
    const lines = cueText(tokenizeVTTCue(cue)).split("\n").map(compact).filter(Boolean);
    if (!lines.length) throw invalidCaptions();
    for (const line of lines) {
      const label = line.match(/^([\p{L}\p{N}][\p{L}\p{M}\p{N} ._'()&-]{0,119}):\s+(.+)$/u);
      const previous = turns.at(-1);
      // Only collapse a repeated, identical speaker label on successive, non-overlapping cues.
      if ((!label && previous?.cueIndex === cueIndex) || (label && previous?.speaker === label[1] && previous.end <= cue.startTime)) {
        previous.text += " " + (label ? label[2] : line);
        previous.end = cue.endTime;
        previous.cueIndex = cueIndex;
      } else {
        turns.push({ text: line, speaker: label?.[1] || "", end: cue.endTime, cueIndex });
      }
    }
  }
  const transcript = turns.map((turn) => turn.text).join("\n");
  const weakInput = assessNotes(transcript);
  if (weakInput) throw new AppError(weakInput + " Caption timestamps do not count as meeting notes.", 400, "WEAK_TRANSCRIPT");
  return { text: transcript, format, cue_count: parsed.cues.length };
}

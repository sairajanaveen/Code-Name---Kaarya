import { config } from "./config";
import { validateStructuredOutput } from "./validate";

const fallbackResult = {
  summary: "Meeting captured. Configure Sarvam and structured LLM keys to run production extraction.",
  language: "unknown",
  readiness_score: 58,
  decisions: ["Dashboard-first accountability flow is the source of truth."],
  blockers: ["Production AI credentials are not configured yet."],
  action_items: [
    {
      task: "Connect Make scenario to Supabase intake and processing tables.",
      owner: "Automation Owner",
      team: "Platform",
      due_date: "",
      priority: "High",
      status: "pending",
      evidence: "V1 requires Make-led orchestration."
    }
  ],
  prep_questions: [
    {
      question: "Which owner will verify Make, Supabase, Notion, Teams, and Slack credentials before pilot launch?",
      intended_owner: "Platform",
      reason: "The next meeting should not start before integration ownership is clear.",
      next_meeting_date: ""
    }
  ]
};

const systemInstruction = [
  "You extract meeting accountability data for Kaarya.",
  "Return compact JSON only.",
  "Prefer table-ready action items over prose.",
  "Every task must have task, owner, team, due_date, priority, status, and evidence.",
  "Generate prep questions that make the next meeting harder to enter unprepared.",
  "Use this JSON shape exactly: summary, language, readiness_score, decisions, blockers, action_items, prep_questions."
].join(" ");

function buildExtractionInput({ meeting, payload, normalized }) {
  return {
    meeting_title: meeting.title || payload.meeting_name,
    meeting_date: payload.meeting_date,
    attendees: payload.attendees,
    agenda: payload.agenda,
    transcript: normalized.text
  };
}

function parseJsonContent(content) {
  const text = String(content || "{}").trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

async function extractWithGemini({ meeting, payload, normalized }) {
  const model = config.llmModel || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.llmApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify(buildExtractionInput({ meeting, payload, normalized }))
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) return validateStructuredOutput(fallbackResult);
  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "{}";
  return validateStructuredOutput(parseJsonContent(content));
}

async function extractWithOpenAI({ meeting, payload, normalized }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.llmApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.llmModel || "gpt-4.1-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemInstruction },
        {
          role: "user",
          content: JSON.stringify(buildExtractionInput({ meeting, payload, normalized }))
        }
      ]
    })
  });

  if (!response.ok) return validateStructuredOutput(fallbackResult);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return validateStructuredOutput(parseJsonContent(content));
}

export async function detectOrTranslateWithSarvam({ text, languageHint }) {
  if (!config.sarvamApiKey || !text) {
    return { text, language: languageHint || "unknown", provider: "not_configured" };
  }

  const response = await fetch("https://api.sarvam.ai/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": config.sarvamApiKey
    },
    body: JSON.stringify({
      input: text,
      source_language_code: languageHint || "auto",
      target_language_code: "en-IN",
      speaker_gender: "Male",
      mode: "formal",
      model: "mayura:v1"
    })
  });

  if (!response.ok) {
    return { text, language: languageHint || "unknown", provider: "sarvam_error" };
  }

  const data = await response.json();
  return {
    text: data.translated_text || text,
    language: data.source_language_code || languageHint || "unknown",
    provider: "sarvam"
  };
}

export async function extractAccountability({ meeting, payload }) {
  const normalized = await detectOrTranslateWithSarvam({
    text: payload.raw_notes,
    languageHint: payload.language_hint
  });

  if (!config.llmApiKey) {
    return validateStructuredOutput({
      ...fallbackResult,
      language: normalized.language
    });
  }

  if (config.llmProvider === "gemini") {
    return extractWithGemini({ meeting, payload, normalized });
  }

  return extractWithOpenAI({ meeting, payload, normalized });
}

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

const weakInputResult = {
  summary: "More meeting context is needed before Kaarya can create reliable action items.",
  language: "unknown",
  readiness_score: 20,
  decisions: [],
  blockers: ["The submitted notes are too short or vague to identify real owners, deadlines, and decisions."],
  action_items: [],
  prep_questions: [
    {
      question: "What decisions were made, who owns each next step, and by when?",
      intended_owner: "Meeting owner",
      reason: "Kaarya needs owners and deadlines to create an accountability board.",
      next_meeting_date: ""
    },
    {
      question: "Which blockers should be resolved before the next meeting starts?",
      intended_owner: "Meeting owner",
      reason: "Prepared meetings need visible blockers before the call.",
      next_meeting_date: ""
    },
    {
      question: "Which action items need named owners instead of team-level responsibility?",
      intended_owner: "Meeting owner",
      reason: "Unnamed ownership weakens follow-up quality.",
      next_meeting_date: ""
    }
  ]
};

const systemInstruction = [
  "You are Kaarya, a meeting accountability engine, not a generic summarizer.",
  "Return compact JSON only with this shape: summary, language, readiness_score, decisions, blockers, action_items, prep_questions.",
  "Write in a polished human business tone. Never mention AI, model, prompt, transcript extraction, or automation.",
  "Action items must be table-ready and use no more than 10 rows.",
  "Every action item must include task, owner, team, due_date, priority, status, and evidence.",
  "If exact due dates are missing, infer a practical date from meeting context or leave due_date empty.",
  "Always generate 4 to 7 prep_questions for the next meeting unless the input is too weak.",
  "Every prep question must be specific, directed to an owner/team, and make the next meeting harder to enter unprepared.",
  "Prep questions should cover unresolved tasks, missing decisions, blockers, proof needed, and owners who must report progress.",
  "Use readiness_score as a 0-100 integer: 80-100 clear owners and dates, 50-79 some ambiguity, 0-49 poor accountability or weak input.",
  "If notes are too short or vague, return no action_items, readiness_score below 30, and prep questions asking for missing context."
].join(" ");

function isWeakInput(text = "") {
  const trimmed = String(text || "").trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const actionSignals = /\b(will|by|before|owner|due|send|call|submit|review|finalize|prepare|blocked|decision|next|follow up|follow-up)\b/i;
  return words.length < 18 || (words.length < 35 && !actionSignals.test(trimmed));
}

function ensurePrepQuestions(structured, payload) {
  if (structured.prep_questions.length >= 4) return structured;
  const fallbackQuestions = [
    {
      question: "Which pending action items must be completed before the next meeting starts?",
      intended_owner: payload.attendees || "Meeting owner",
      reason: "The next meeting should begin with progress, not status discovery.",
      next_meeting_date: ""
    },
    {
      question: "Which blockers need a decision from leadership or another team?",
      intended_owner: "Meeting owner",
      reason: "Blockers should be surfaced before the meeting, not discovered inside it.",
      next_meeting_date: ""
    },
    {
      question: "Which owner is responsible for updating the dashboard before the follow-up reminder?",
      intended_owner: "Meeting owner",
      reason: "Accountability needs one person to keep the record current.",
      next_meeting_date: ""
    },
    {
      question: "What proof or document should each owner bring to show the task is complete?",
      intended_owner: payload.attendees || "Meeting owner",
      reason: "Prepared meetings need evidence, not only verbal updates.",
      next_meeting_date: ""
    }
  ];

  return {
    ...structured,
    prep_questions: [...structured.prep_questions, ...fallbackQuestions].slice(0, 7)
  };
}

function needsValidator(structured) {
  return Boolean(
    config.openaiApiKey &&
    (structured.readiness_score < 50 || structured.prep_questions.length < 4 || structured.action_items.some((item) => item.owner === "Unassigned"))
  );
}

async function validateWithOpenAI({ structured, meeting, payload }) {
  if (!needsValidator(structured)) return structured;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.validatorModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are Kaarya's senior meeting accountability reviewer.",
            "Improve the JSON while preserving facts.",
            "Make outputs more human, professional, and action-oriented.",
            "Add missing prep questions. Do not invent owners if evidence is absent; use team or Meeting owner."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({ meeting: buildExtractionInput({ meeting, payload, normalized: { text: payload.raw_notes } }), structured })
        }
      ]
    })
  });

  if (!response.ok) return structured;
  const data = await response.json();
  return ensurePrepQuestions(validateStructuredOutput(parseJsonContent(data.choices?.[0]?.message?.content || "{}")), payload);
}

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
  if (isWeakInput(payload.raw_notes) && !payload.audio_url && !payload.attachment_url) {
    return validateStructuredOutput({
      ...weakInputResult,
      language: payload.language_hint || "unknown"
    });
  }

  const normalized = await detectOrTranslateWithSarvam({
    text: payload.raw_notes,
    languageHint: payload.language_hint
  });

  if (!config.llmApiKey) {
    return ensurePrepQuestions(validateStructuredOutput({
      ...fallbackResult,
      language: normalized.language
    }), payload);
  }

  let structured;
  if (config.llmProvider === "gemini") {
    structured = await extractWithGemini({ meeting, payload, normalized });
  } else {
    structured = await extractWithOpenAI({ meeting, payload, normalized });
  }

  return validateWithOpenAI({ structured: ensurePrepQuestions(structured, payload), meeting, payload });
}

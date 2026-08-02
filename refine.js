import { config } from "../../lib/config";
import { validateStructuredOutput } from "../../lib/validate";

function parseJsonContent(content) {
  const text = String(content || "{}").trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

async function refineWithGemini({ instruction, structured }) {
  const model = config.llmModel || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.llmApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { temperature: 0.15, responseMimeType: "application/json" },
      systemInstruction: {
        parts: [{
          text: "You refine Kaarya meeting outputs. Return the same JSON shape. Keep it professional, human, concise, and free of AI wording."
        }]
      },
      contents: [{
        role: "user",
        parts: [{ text: JSON.stringify({ instruction, structured }) }]
      }]
    })
  });
  if (!response.ok) throw new Error("Refinement failed");
  const data = await response.json();
  return validateStructuredOutput(parseJsonContent(data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "{}"));
}

async function refineWithOpenAI({ instruction, structured }) {
  const apiKey = config.openaiApiKey || config.llmApiKey;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.validatorModel,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You refine Kaarya meeting outputs. Return the same JSON shape. Keep it professional, human, concise, and free of AI wording." },
        { role: "user", content: JSON.stringify({ instruction, structured }) }
      ]
    })
  });
  if (!response.ok) throw new Error("Refinement failed");
  const data = await response.json();
  return validateStructuredOutput(parseJsonContent(data.choices?.[0]?.message?.content || "{}"));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { instruction = "", structured = {}, provider = "auto" } = req.body || {};
  if (!instruction.trim()) return res.status(400).json({ error: "Instruction is required" });

  try {
    const refined = provider === "openai" && (config.openaiApiKey || config.llmApiKey)
      ? await refineWithOpenAI({ instruction, structured })
      : await refineWithGemini({ instruction, structured });
    return res.status(200).json({ structured: refined });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not refine output" });
  }
}

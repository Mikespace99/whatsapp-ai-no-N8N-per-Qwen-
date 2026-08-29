const OpenAI = require("openai");

let client = null;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Invoca il modello chiedendo esplicitamente SOLO un JSON come output,
 * lo pulisce da eventuali fence markdown e lo parsa.
 */
async function askForJSON({ system, prompt, maxTokens = 500 }) {
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim() || "";
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Impossibile parsare la risposta LLM come JSON:", text);
    throw err;
  }
}

module.exports = { askForJSON, MODEL };


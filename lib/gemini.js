// Gemini AI client initialization

require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

if (!process.env.GEMINI_API_KEY) {
  console.error("[error] GEMINI_API_KEY is missing in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Models used across the app
const MODELS = {
  TRANSCRIPTION: "gemini-3-flash-preview",
  QUERY: "gemini-3-flash-preview",
  VIDEO: "gemini-3-flash-preview",
  TTS: "gemini-2.5-flash-preview-tts",
};

// TTS voice configuration
const TTS_CONFIG = {
  voiceName: "Aoede",
};

// List available models at startup
async function listModels() {
  try {
    const models = await ai.models.list();
    console.log("[models] Available:");
    for await (const m of models) {
      console.log(`  - ${m.name}`);
    }
  } catch (err) {
    console.warn("[warn] Unable to list models:", err?.message || err);
  }
}

module.exports = { ai, MODELS, TTS_CONFIG, listModels };

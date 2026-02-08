// TTS audio generation via Gemini

const { ai, MODELS, TTS_CONFIG } = require("./gemini");

/**
 * Generate TTS audio from text using Gemini TTS model.
 * Returns base64-encoded audio or null on failure.
 */
async function generateTTS(text) {
  try {
    // Strip emojis and newlines for cleaner speech
    const cleanText = text
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}•]/gu, "")
      .replace(/\n/g, " ")
      .trim();

    if (!cleanText) return null;

    const response = await ai.models.generateContent({
      model: MODELS.TTS,
      contents: [{ role: "user", parts: [{ text: cleanText }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: TTS_CONFIG.voiceName,
            },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (audioData) {
      console.log("[tts] Audio generated");
      return audioData.data;
    }

    return null;
  } catch (err) {
    console.warn("[tts] Generation failed:", err?.message);
    return null;
  }
}

module.exports = { generateTTS };

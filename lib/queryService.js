// Audio query processing service — transcription, search, response generation

const { ai, MODELS } = require("./gemini");
const { searchTracebacks } = require("./tracebackRepository");
const { generateTTS } = require("./ttsService");

// ── Helpers ──────────────────────────────────────────────

function getDayPart(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function buildTimeContext(date) {
  return {
    date: date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    dayPart: getDayPart(date.getHours()),
  };
}

function computeRelativeDay(sentAt, recordedDate) {
  const eventDate = new Date(sentAt);
  const now = new Date();
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today - eventDay) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return `on ${recordedDate}`;
}

// ── Step 1 — Transcribe + topic check ────────────────────

async function transcribeAudio(fileUri, mimeType) {
  const prompt = `Listen to this audio recording and:
1. Transcribe what the user said verbatim
2. Determine if the topic is RELEVANT to a memory assistant app (questions about past actions, lost objects, forgotten events, what happened, where things are, memory recall, etc.)

Return ONLY this JSON:
{
  "transcription": "exact words spoken by the user",
  "is_relevant": true or false,
  "topic_category": "memory_query | lost_object | past_action | event_recall | off_topic"
}`;

  const response = await ai.models.generateContent({
    model: MODELS.TRANSCRIPTION,
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { mimeType, fileUri } },
          { text: prompt },
        ],
      },
    ],
    config: { responseMimeType: "application/json" },
  });

  try {
    return JSON.parse(response.text);
  } catch {
    return { transcription: response.text, is_relevant: false, topic_category: "unknown" };
  }
}

// ── Step 2 — Generate search parameters ──────────────────

async function generateSearchParams(transcription, timeContext) {
  const prompt = `You are the "Memory Retrieval Engine" for Trace. Transform this query into search parameters.

USER QUERY: "${transcription}"

CURRENT TIME CONTEXT:
- Today is: ${timeContext.date}
- Current time: ${timeContext.time}
- Part of day: ${timeContext.dayPart}

DATABASE SCHEMA:
{
  "action": "string",
  "actor": "you | others",
  "location": "string",
  "objects": ["string"],
  "summary": "string"
}

Return ONLY this JSON:
{
  "search_parameters": {
    "target_action": "action verb to search",
    "target_objects": ["objects to find"],
    "target_location": "location or null",
    "time_context": "today/morning/recent/unknown"
  }
}`;

  const response = await ai.models.generateContent({
    model: MODELS.QUERY,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json" },
  });

  try {
    const parsed = JSON.parse(response.text);
    return parsed.search_parameters || parsed;
  } catch {
    return { target_action: null, target_objects: [], target_location: null };
  }
}

// ── Step 3 — Build conversational response ───────────────

async function buildFoundResponse(transcription, bestMatch, timeContext) {
  const analysis = bestMatch.analysis || {};

  const recordedTime = bestMatch.sentAt
    ? new Date(bestMatch.sentAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    : null;
  const recordedDate = bestMatch.sentAt
    ? new Date(bestMatch.sentAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })
    : null;

  const relativeDay = bestMatch.sentAt ? computeRelativeDay(bestMatch.sentAt, recordedDate) : "";

  const facts = [];
  if (relativeDay && recordedTime) facts.push(`when: ${relativeDay} at ${recordedTime} (${recordedDate})`);
  else if (recordedDate && recordedTime) facts.push(`when: on ${recordedDate} at ${recordedTime}`);
  if (analysis.summary) facts.push(analysis.summary);
  if (analysis.location) facts.push(`location: ${analysis.location}`);
  if (analysis.objects?.length) facts.push(`objects: ${analysis.objects.join(", ")}`);

  const prompt = `You are Trace, a friendly personal memory assistant. The user asked: "${transcription}". I searched the database and found a likely match. Use the following facts to compose a warm, conversational reply. IMPORTANT: Always mention the time and relative date (e.g. "today around 2:30 PM", "yesterday at 9 AM", "3 days ago") so the user knows exactly when it happened. Do NOT use bullet lists or enumerations; write in full natural sentences like a real human conversation. Keep it short (2-4 sentences).

CURRENT TIME: ${timeContext.date} at ${timeContext.time}
FACTS: ${facts.join(" | ")}

Output only the assistant reply text.`;

  const resp = await ai.models.generateContent({
    model: MODELS.QUERY,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "text/plain" },
  });

  return resp?.text?.trim() || `I found a recording that looks relevant: ${facts.join("; ")}.`;
}

async function buildNotFoundResponse(transcription) {
  const prompt = `You are Trace, a compassionate personal memory assistant. The user asked: "${transcription}" but no matching recordings were found. Reply in a warm, human conversational tone without using bullet lists. Offer gentle, practical suggestions phrased as natural sentences (not a list). Keep the reply concise (2-4 sentences) and encouraging.`;

  const resp = await ai.models.generateContent({
    model: MODELS.QUERY,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "text/plain" },
  });

  return (
    resp?.text?.trim() ||
    "I understand you're looking for that memory. I don't have a recording of that specific moment yet, but try retracing your steps — and I'll keep listening for it."
  );
}

const OFF_TOPIC_TEXT =
  "I appreciate you reaching out! I'm Trace, your personal memory assistant. I'm here specifically to help you remember past activities, find lost objects, or recall events captured by your smart glasses. Feel free to ask me things like 'Where did I put my keys?' or 'What was I doing this morning?' I'm always here to help with your memories!";

// ── Main orchestrator ────────────────────────────────────

/**
 * Process a voice query end-to-end:
 *   upload → transcribe → relevance check → search → response → TTS
 *
 * @param {string} audioPath  Local file path of uploaded audio
 * @param {string} mimeType   Resolved MIME type
 * @param {string} originalName  Original file name
 * @returns {object} Full response payload for the client
 */
/**
 * Step A — upload audio to Gemini and transcribe.
 * Returns { transcription, is_relevant, topic_category, _fileRef } so the
 * route can stream the transcription to the client immediately.
 */
async function transcribeVoiceQuery(audioPath, mimeType, originalName) {
  console.log("[transcribe] Uploading audio to Gemini...");
  const uploadResult = await ai.files.upload({
    file: audioPath,
    config: { mimeType, displayName: originalName },
  });
  console.log(`[transcribe] Upload ok: ${uploadResult.name}`);

  // Wait for ACTIVE
  let file = await ai.files.get({ name: uploadResult.name });
  let attempts = 0;
  while (file.state === "PROCESSING" && attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    file = await ai.files.get({ name: uploadResult.name });
    attempts++;
  }
  if (file.state !== "ACTIVE") {
    throw new Error(`File processing failed: ${file.state}`);
  }

  const result = await transcribeAudio(file.uri, file.mimeType);
  console.log(`[transcribe] "${result.transcription}" | topic=${result.topic_category} relevant=${result.is_relevant}`);

  return {
    ...result,
    _fileRef: uploadResult.name, // keep ref for cleanup later
  };
}

/**
 * Step B — given a transcription result, search + build response + TTS.
 * Returns the full payload for the client.
 */
async function processTranscribedQuery(transcriptionResult) {
  const startTime = Date.now();
  const requestTime = new Date();
  const timeContext = buildTimeContext(requestTime);

  const cleanupRemote = async () => {
    if (transcriptionResult._fileRef) {
      try { await ai.files.delete({ name: transcriptionResult._fileRef }); } catch {}
    }
  };

  // Off-topic shortcut
  if (!transcriptionResult.is_relevant || transcriptionResult.topic_category === "off_topic") {
    await cleanupRemote();
    const audio = await generateTTS(OFF_TOPIC_TEXT);
    return buildPayload({
      startTime,
      requestTime,
      userQuery: transcriptionResult.transcription,
      responseText: OFF_TOPIC_TEXT,
      responseType: "off_topic",
      audio,
    });
  }

  // Search
  const searchParams = await generateSearchParams(transcriptionResult.transcription, timeContext);
  console.log("[search] Params:", searchParams);

  const searchResults = await searchTracebacks(searchParams);
  console.log(`[search] ${searchResults.length} matches`);
  await cleanupRemote();

  // Build response
  let responseText, responseType;
  if (searchResults.length > 0) {
    responseType = "found";
    responseText = await buildFoundResponse(transcriptionResult.transcription, searchResults[0].doc, timeContext);
  } else {
    responseType = "not_found";
    responseText = await buildNotFoundResponse(transcriptionResult.transcription);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[query] Processed in ${duration}s - ${responseType}`);

  // TTS
  console.log("[tts] Generating audio...");
  const audio = await generateTTS(responseText);

  return buildPayload({
    startTime,
    requestTime,
    userQuery: transcriptionResult.transcription,
    searchParams,
    matchCount: searchResults.length,
    responseText,
    responseType,
    audio,
  });
}

// ── Response builder ─────────────────────────────────────

function buildPayload({ startTime, requestTime, userQuery, searchParams, matchCount, responseText, responseType, audio }) {
  const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
  return {
    success: true,
    duration,
    timestamp: requestTime.toISOString(),
    userQuery,
    ...(searchParams && { searchParams }),
    ...(matchCount !== undefined && { matchCount }),
    response: {
      text: responseText,
      type: responseType,
      audio: audio || null,
    },
    conversation: {
      user: { text: userQuery, timestamp: requestTime.toISOString() },
      assistant: { text: responseText, type: responseType, timestamp: new Date().toISOString() },
    },
  };
}

module.exports = { transcribeVoiceQuery, processTranscribedQuery };

// Routes — voice query endpoint (SSE streaming)

const express = require("express");
const path = require("path");
const fs = require("fs");
const { audioUpload } = require("../lib/upload");
const { audioMimeTypes } = require("../lib/mimeTypes");
const { transcribeVoiceQuery, processTranscribedQuery } = require("../lib/queryService");

const router = express.Router();

// POST /api/query — process a voice query with SSE streaming
// Sends two events:
//   1. "transcription" — as soon as the text is extracted from audio
//   2. "response"      — full assistant response with audio
router.post("/", audioUpload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No audio file provided. Use field 'audio'." });
  }

  const requestTime = new Date();
  console.log(`\n[query] Audio received: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Resolve MIME type
    const ext = path.extname(req.file.originalname).toLowerCase();
    let mimeType = req.file.mimetype;
    if (mimeType === "application/octet-stream" && audioMimeTypes[ext]) {
      mimeType = audioMimeTypes[ext];
    }

    // Step 1 — transcribe (fast) then stream the text immediately
    const transcriptionResult = await transcribeVoiceQuery(req.file.path, mimeType, req.file.originalname);

    sendEvent("transcription", {
      success: true,
      userQuery: transcriptionResult.transcription,
      topicCategory: transcriptionResult.topic_category,
      isRelevant: transcriptionResult.is_relevant,
      timestamp: requestTime.toISOString(),
    });

    // Step 2 — search + response + TTS (slow)
    const result = await processTranscribedQuery(transcriptionResult);

    sendEvent("response", result);

    res.write("event: done\ndata: {}\n\n");
    res.end();
  } catch (error) {
    console.error("[query] Error:", error.message);
    sendEvent("error", {
      success: false,
      error: error.message,
      timestamp: requestTime.toISOString(),
    });
    res.end();
  } finally {
    // Cleanup uploaded audio file
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn("[query] Unable to delete audio file:", err.message);
      });
    }
  }
});

module.exports = router;

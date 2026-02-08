// Routes — video analysis endpoints

const express = require("express");
const fs = require("fs");
const path = require("path");
const { videoUpload } = require("../lib/upload");
const { ai } = require("../lib/gemini");
const { processVideoFile, processVideoPath, readVideoListFile, getSentAt } = require("../lib/videoService");
const { saveTraceback } = require("../lib/tracebackRepository");

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────

async function persistAnalysis(result) {
  if (result.success && result.analysis) {
    const docId = await saveTraceback({
      sentAt: result.sentAt,
      filename: result.filename,
      filesize: result.filesize,
      duration: result.duration,
      analysis: result.analysis,
    });
    result.tracebackId = docId;
  }
}

// ── POST /analyze — single video ─────────────────────────

router.post("/", videoUpload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No video file provided. Use field 'video'." });
  }

  console.log(`\n[analyze] File received: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);

  try {
    const payload = await processVideoFile(ai, req.file, { throwOnError: true });
    await persistAnalysis(payload);
    return res.json(payload);
  } catch (error) {
    console.error("[analyze] Error:", error.message);
    return res.status(500).json({
      success: false,
      sentAt: getSentAt(),
      error: error.message,
      details: error.stack,
    });
  }
});

// ── POST /analyze/batch — multiple videos ────────────────

router.post("/batch", videoUpload.array("videos", 10), async (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ success: false, error: "No video files provided. Use field 'videos'." });
  }

  const items = [];
  for (const file of req.files) {
    console.log(`\n[analyze] File received: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);
    const result = await processVideoFile(ai, file, { throwOnError: false });
    await persistAnalysis(result);
    items.push(result);
  }

  return res.json({ success: true, count: items.length, items });
});

// ── POST /analyze/batch-from-list — from video-list.txt ──

router.post("/batch-from-list", async (req, res) => {
  const listFilePath = path.join(__dirname, "..", "video-list.txt");

  if (!fs.existsSync(listFilePath)) {
    return res.status(400).json({ success: false, error: "List file not found. Expected video-list.txt" });
  }

  const paths = readVideoListFile(listFilePath);
  if (paths.length === 0) {
    return res.status(400).json({ success: false, error: "List file is empty." });
  }

  const items = [];
  for (const relativePath of paths) {
    const videoPath = path.resolve(__dirname, "..", relativePath);
    console.log(`\n[analyze] File from list: ${relativePath}`);

    if (!fs.existsSync(videoPath)) {
      items.push({ success: false, sentAt: getSentAt(), filename: path.basename(relativePath), error: "File not found on disk" });
      continue;
    }

    const result = await processVideoPath(ai, videoPath, { throwOnError: false, keepLocalFile: true });
    await persistAnalysis(result);
    items.push(result);
  }

  return res.json({ success: true, count: items.length, items });
});

module.exports = router;

// Trace — Express server entry point

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { listModels } = require("./lib/gemini");

// Routes
const analyzeRoutes = require("./routes/analyze");
const queryRoutes = require("./routes/query");

// ── App setup ────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────

app.use("/analyze", analyzeRoutes);
app.use("/api/query", queryRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Trace API", timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({
    message: "Trace API",
    version: "1.0.0",
    endpoints: {
      "POST /analyze": "Upload and analyze one video",
      "POST /analyze/batch": "Upload and analyze multiple videos",
      "POST /analyze/batch-from-list": "Analyze videos from video-list.txt",
      "POST /api/query": "Upload audio query and get AI response",
      "GET /health": "Check server status",
    },
  });
});

// ── Error handling ───────────────────────────────────────

app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    const msg = error.code === "LIMIT_FILE_SIZE" ? "File too large" : error.message;
    return res.status(400).json({ success: false, error: msg });
  }
  if (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
  next();
});

// ── Start ────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[server] Trace running on http://localhost:${PORT}`);
  listModels().catch(() => {});
});

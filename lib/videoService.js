// Shared video processing helpers

const fs = require("fs");
const path = require("path");
const { videoMimeTypes } = require("./mimeTypes");

// Resolve MIME type using extension when needed
function resolveMimeType(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  let mimeType = file.mimetype;
  if (mimeType === "application/octet-stream" && videoMimeTypes[ext]) {
    mimeType = videoMimeTypes[ext];
  }
  return { mimeType, ext };
}

// Return ISO timestamp for request time
function getSentAt() {
  return new Date().toISOString();
}

// Upload a local file to Gemini
async function uploadToGemini(ai, filePath, mimeType, displayName) {
  return ai.files.upload({
    file: filePath,
    config: { mimeType, displayName },
  });
}

// Wait until uploaded file is ACTIVE
async function waitForFileActive(ai, fileName) {
  console.log("[video] Waiting for file processing...");

  let file = await ai.files.get({ name: fileName });
  let attempts = 0;
  const maxAttempts = 60; // 3 minutes max

  while (file.state === "PROCESSING") {
    if (attempts >= maxAttempts) {
      throw new Error("Timeout: file took too long to process");
    }

    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    file = await ai.files.get({ name: fileName });
    attempts++;
  }

  console.log("");

  if (file.state === "FAILED") {
    throw new Error(`File processing failed: ${file.error?.message || "Unknown error"}`);
  }

  console.log("[video] File is ACTIVE");
  return file;
}

// Analyze a video with Gemini 3 Flash
async function analyzeVideo(ai, fileUri, mimeType) {
  const prompt = `You are an expert video analyst. The footage is captured from smart glasses, so the viewpoint is "you". Determine whether "you" are performing the main action or if other people are doing it. Return JSON with this structure:
{
  "summary": "You have... (short sentence describing what happens from first-person perspective)",
  "actions": ["main action verb", "secondary action if any"],
  "objects": ["list", "of", "visible", "objects"],
  "locations": ["the location or environment of the scene"],
  "context": {
    "before": "what likely happened before this scene",
    "after": "what will likely happen next"
  },
  "confidence": 0.85,
  "tags": ["relevant", "search", "tags"]
}

Return ONLY the JSON, no extra text.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              mimeType: mimeType,
              fileUri: fileUri,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text;

  try {
    return JSON.parse(text);
  } catch (parseError) {
    console.error("[video] JSON parse error, returning raw text");
    return { raw_response: text };
  }
}

// Analyze a previously uploaded file
async function analyzeUploadedFile(ai, uploadResult) {
  const activeFile = await waitForFileActive(ai, uploadResult.name);
  const analysis = await analyzeVideo(ai, activeFile.uri, activeFile.mimeType);
  return { activeFile, analysis };
}

// Remove a local file safely
function safeDeleteLocalFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Remove a remote file safely
async function safeDeleteRemoteFile(ai, fileName) {
  try {
    await ai.files.delete({ name: fileName });
  } catch (err) {
    console.warn("[video] Unable to delete remote file:", err && err.message ? err.message : err);
  }
}

// Process a single video file and return a response payload
async function processVideoFile(ai, file, { throwOnError, keepLocalFile = true }) {
  const startTime = Date.now();
  const sentAt = getSentAt();
  const filePath = file.path;
  const { mimeType } = resolveMimeType(file);
  let uploadResult;

  try {
    console.log("[video] Uploading to Google AI...");
    uploadResult = await uploadToGemini(ai, filePath, mimeType, file.originalname);
    console.log(`[video] Upload ok: ${uploadResult.name}`);

    console.log("[video] Analyzing with Gemini...");
    const { analysis } = await analyzeUploadedFile(ai, uploadResult);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    return {
      success: true,
      sentAt,
      duration: `${duration}s`,
      filename: file.originalname,
      filesize: `${(file.size / 1024).toFixed(2)} KB`,
      analysis,
    };
  } catch (error) {
    if (throwOnError) throw error;
    return {
      success: false,
      sentAt,
      filename: file.originalname,
      error: error && error.message ? error.message : String(error),
    };
  } finally {
    if (!keepLocalFile) {
      safeDeleteLocalFile(filePath);
    }
    if (uploadResult && uploadResult.name) {
      await safeDeleteRemoteFile(ai, uploadResult.name);
    }
  }
}

// Process a video by local file path
async function processVideoPath(ai, filePath, { throwOnError, keepLocalFile = true }) {
  const fileName = path.basename(filePath);
  const fakeFile = {
    path: filePath,
    originalname: fileName,
    mimetype: "application/octet-stream",
    size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
  };
  return processVideoFile(ai, fakeFile, { throwOnError, keepLocalFile });
}

// Read a list file and return non-empty paths
function readVideoListFile(listFilePath) {
  const content = fs.readFileSync(listFilePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

module.exports = {
  resolveMimeType,
  getSentAt,
  waitForFileActive,
  analyzeVideo,
  analyzeUploadedFile,
  processVideoFile,
  processVideoPath,
  readVideoListFile,
};

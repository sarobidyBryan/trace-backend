// Multer upload configuration for video and audio files

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { allowedMimes, videoMimeTypes, audioMimeTypes, allowedAudioMimes } = require("./mimeTypes");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Shared disk storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Video upload middleware
const videoUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isVideoExt = Object.prototype.hasOwnProperty.call(videoMimeTypes, ext);
    if (allowedMimes.includes(file.mimetype) || isVideoExt) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype} (${ext})`), false);
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// Audio upload middleware
const audioUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isAudioExt = Object.prototype.hasOwnProperty.call(audioMimeTypes, ext);
    if (allowedAudioMimes.includes(file.mimetype) || isAudioExt) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype} (${ext})`), false);
    }
  },
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

module.exports = { videoUpload, audioUpload };

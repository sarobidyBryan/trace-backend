// MIME type lists for video uploads

const videoMimeTypes = {
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".flv": "video/x-flv",
  ".webm": "video/webm",
  ".wmv": "video/x-ms-wmv",
  ".3gp": "video/3gpp",
  ".mkv": "video/x-matroska",
};

const allowedMimes = [
  "video/mp4",
  "video/mpeg",
  "video/mov",
  "video/avi",
  "video/x-flv",
  "video/mpg",
  "video/webm",
  "video/wmv",
  "video/3gpp",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-ms-wmv",
  "video/x-matroska",
  "application/octet-stream",
];

const audioMimeTypes = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm",
  ".weba": "audio/webm",
};

const allowedAudioMimes = [
  "audio/wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/mp4",
  "audio/webm",
  "application/octet-stream",
];

module.exports = { videoMimeTypes, allowedMimes, audioMimeTypes, allowedAudioMimes };

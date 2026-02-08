# Trace

> ***Traceback your memory.***

**Disclaimer:** Trace is an assistive productivity and organizational tool. It is **not** a medical device. It is not intended to diagnose, treat, cure, or prevent any medical condition, cognitive impairment, or disease. It should be used as a personal memory aid only.

**This repository contains the backend (API server).** The frontend companion is here: [Trace Frontend](https://github.com/sarobidyBryan/trace-frontend)

---

## The Vision: Wearable-First Intelligence

Trace is built for the next generation of **Always-On Wearables** (Smart Glasses, AI Pins, Body-cams). The app is designed to eventually run on mobile devices paired with wearable hardware, processing a continuous **Point-of-View** video stream. **It also works fully in a web browser today**, making it easy to demo and develop without any physical device.

**Simulated Experience:** To demonstrate the concept without hardware, the frontend app includes a **"Simulate Wearable"** button. This mimics a wearable device capturing a short burst of video and sending it to the cloud for immediate semantic indexing.

---

## Real-Life Scenario: "The Lost Wallet"

1. **Capture** -- You walk into a cafe, set your wallet on the counter, and tap "Simulate Wearable".
2. **Processing** -- The video is sent to this backend. Gemini identifies: *"User placed a black leather wallet on the marble counter near the espresso machine."*
3. **Indexing** -- This description is stored in Firestore with a timestamp.
4. **Retrieval** -- 20 minutes later, you ask via voice: *"Where did I leave my wallet?"*
5. **Voice Feedback** -- The system matches your question to the log and replies with TTS: *"You left it on the marble counter by the espresso machine."*

---

## Tech Stack & AI Models

| Component | Technology |
|---|---|
| Runtime | Node.js + Express |
| Database | Firebase Firestore (Cloud NoSQL) |
| File Uploads | Multer (disk storage) |
| Video Analysis | `gemini-3-flash-preview` |
| Audio Transcription | `gemini-3-flash-preview` |
| Semantic Query | `gemini-3-flash-preview` |
| Text-to-Speech | `gemini-2.5-flash-preview-tts` (voice: Aoede) |

---

## Project Structure

```
backend/
  server.js              # Express entry point (routes, CORS, error handling)
  lib/
    gemini.js            # Gemini AI client init & model constants
    firebase.js          # Firebase Admin initialization
    upload.js            # Multer middleware (video + audio)
    queryService.js      # Voice query pipeline (transcribe -> search -> respond -> TTS)
    ttsService.js        # TTS audio generation
    videoService.js      # Video upload, processing & analysis helpers
    tracebackRepository.js  # Firestore CRUD & search
    mimeTypes.js         # MIME type mappings
  routes/
    analyze.js           # POST /analyze, /analyze/batch, /analyze/batch-from-list
    query.js             # POST /api/query (SSE streaming)
  uploads/               # Temporary file storage (auto-cleaned)
  videos/                # Video files for batch-from-list analysis
```

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/analyze` | Upload and analyze a single video |
| `POST` | `/analyze/batch` | Upload and analyze multiple videos (max 10) |
| `POST` | `/analyze/batch-from-list` | Analyze videos listed in `video-list.txt` |
| `POST` | `/api/query` | Voice query (SSE stream: transcription, then response + TTS) |
| `GET` | `/health` | Health check |
| `GET` | `/` | API info |

The `/api/query` endpoint uses **Server-Sent Events** to stream results in two stages:
1. `transcription` event -- sent as soon as the user's speech is transcribed (instant feedback).
2. `response` event -- full assistant response with TTS audio (base64).

---

## Setup

### Prerequisites

- **Node.js** v18+
- A **Google AI Studio API Key** -- [Get one here](https://aistudio.google.com/apikey)
- A **Firebase project** with Firestore enabled
- A Firebase **service account JSON** file

### Installation

```bash
git clone https://github.com/sarobidyBryan/trace-backend.git
cd trace-backend
npm install
```

### Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_SERVICE_ACCOUNT_PATH=your-firebase-adminsdk.json
PORT=3000
```

Place your Firebase service account JSON file in the project root.

Alternatively, you can set Firebase credentials inline instead of using a JSON file:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Run

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

The server starts on `http://localhost:3000` by default.

---

## How It Works

### Video Analysis Flow
1. A video is uploaded via `/analyze`.
2. The file is sent to **Gemini** for semantic analysis (action, location, objects, actor).
3. The structured analysis is stored in **Firestore** with a timestamp.
4. The video file on disk is preserved; the remote Gemini copy is cleaned up.

### Voice Query Flow (SSE)
1. An audio recording is uploaded via `/api/query`.
2. The audio is transcribed by Gemini. The **transcription is streamed immediately** to the client.
3. If the query is relevant, search parameters are generated and Firestore is queried.
4. A conversational response is built by Gemini with time context (e.g., "yesterday at 2:30 PM").
5. TTS audio is generated and the full response is streamed as a second SSE event.
6. The uploaded audio file is cleaned up after processing.

---

## Contributing

1. Fork the project.
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request.


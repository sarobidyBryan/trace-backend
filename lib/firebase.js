// Firebase Admin initialization

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// Build service account from environment
function getServiceAccountFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

// Build service account from JSON file
function getServiceAccountFromFile() {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!filePath) return null;

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Firebase service account file not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  return JSON.parse(raw);
}

// Initialize Firebase Admin once
function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const serviceAccount = getServiceAccountFromEnv() || getServiceAccountFromFile();
  if (!serviceAccount) {
    throw new Error(
      "Missing Firebase config. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_PATH"
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin.firestore();
}

module.exports = { initFirebase };

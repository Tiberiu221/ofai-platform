/**
 * Firebase Admin SDK initialization for FCM push notifications.
 *
 * Production: reads FIREBASE_ADMINSDK_JSON env var (JSON string)
 * Local dev: reads firebase-adminsdk.json file from project root (if exists)
 *
 * Gracefully skips initialization if no credentials found (push will use Expo-only path).
 */

let admin;
let initialized = false;
let available = false;

function initializeFirebase() {
  if (initialized) return;
  initialized = true;

  try {
    admin = require("firebase-admin");

    if (process.env.FIREBASE_ADMINSDK_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_ADMINSDK_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      available = true;
      console.log("[Firebase] Initialized from FIREBASE_ADMINSDK_JSON env var");
    } else {
      try {
        const path = require("path");
        const serviceAccount = require(path.join(__dirname, "../../firebase-adminsdk.json"));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        available = true;
        console.log("[Firebase] Initialized from local firebase-adminsdk.json");
      } catch (_) {
        console.log("[Firebase] No credentials found — FCM push disabled (Expo-only mode)");
      }
    }
  } catch (err) {
    console.error("[Firebase] Initialization error:", err.message);
  }
}

function isAvailable() {
  return available;
}

function getMessaging() {
  if (!available) return null;
  return admin.messaging();
}

module.exports = { initializeFirebase, isAvailable, getMessaging };

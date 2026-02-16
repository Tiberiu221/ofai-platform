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
      console.log(`[Firebase] FIREBASE_ADMINSDK_JSON env var found (${process.env.FIREBASE_ADMINSDK_JSON.length} chars)`);
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_ADMINSDK_JSON);
      } catch (parseErr) {
        console.error("[Firebase] Failed to parse FIREBASE_ADMINSDK_JSON:", parseErr.message);
        console.error("[Firebase] First 50 chars:", process.env.FIREBASE_ADMINSDK_JSON.substring(0, 50));
        return;
      }
      // Validate required fields
      const requiredFields = ["project_id", "client_email", "private_key"];
      const missingFields = requiredFields.filter(f => !serviceAccount[f]);
      if (missingFields.length > 0) {
        console.error("[Firebase] Missing required fields:", missingFields.join(", "));
        return;
      }
      console.log(`[Firebase] Service account: project=${serviceAccount.project_id}, email=${serviceAccount.client_email}`);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      available = true;
      console.log("[Firebase] Initialized successfully from env var");
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

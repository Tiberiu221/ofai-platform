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
      let raw = process.env.FIREBASE_ADMINSDK_JSON;
      console.log(`[Firebase] FIREBASE_ADMINSDK_JSON env var found (${raw.length} chars)`);

      // Auto-fix: strip surrounding quotes if double-encoded
      if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.slice(1, -1);
        console.log("[Firebase] Stripped surrounding quotes from env var");
      }

      // Auto-fix: unescape double-escaped sequences (e.g., \\" → \")
      if (raw.includes('\\"')) {
        raw = raw.replace(/\\"/g, '"');
        console.log("[Firebase] Unescaped double-escaped quotes in env var");
      }

      let serviceAccount;
      try {
        serviceAccount = JSON.parse(raw);
      } catch (parseErr) {
        console.error("[Firebase] Failed to parse FIREBASE_ADMINSDK_JSON:", parseErr.message);
        console.error("[Firebase] First 80 chars:", raw.substring(0, 80));
        console.error("[Firebase] Last 30 chars:", raw.substring(raw.length - 30));
        return;
      }
      // Validate required fields
      const requiredFields = ["project_id", "client_email", "private_key"];
      const missingFields = requiredFields.filter(f => !serviceAccount[f]);
      if (missingFields.length > 0) {
        console.error("[Firebase] Missing required fields:", missingFields.join(", "));
        console.error("[Firebase] Available fields:", Object.keys(serviceAccount).join(", "));
        return;
      }

      // Auto-fix: ensure private_key has proper \n (sometimes gets mangled by env var UIs)
      if (serviceAccount.private_key && !serviceAccount.private_key.includes("\n")) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
        console.log("[Firebase] Fixed escaped newlines in private_key");
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

/**
 * Get diagnostic info about Firebase init status (for /push-tokens/health)
 */
function getDiagnostics() {
  const raw = process.env.FIREBASE_ADMINSDK_JSON;
  if (!raw) return { status: "no_env_var" };

  // Try to parse and report what fails
  let cleaned = raw;
  const fixes = [];

  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
    fixes.push("stripped_quotes");
  }
  if (cleaned.includes('\\"')) {
    cleaned = cleaned.replace(/\\"/g, '"');
    fixes.push("unescaped_quotes");
  }

  try {
    const obj = JSON.parse(cleaned);
    const fields = Object.keys(obj);
    const hasRequired = ["project_id", "client_email", "private_key"].every(f => !!obj[f]);
    return {
      status: available ? "initialized" : "parsed_but_init_failed",
      fixes,
      fields,
      hasRequired,
      projectId: obj.project_id || null,
    };
  } catch (e) {
    return {
      status: "parse_error",
      error: e.message,
      fixes,
      first50: raw.substring(0, 50),
      last30: raw.substring(raw.length - 30),
    };
  }
}

module.exports = { initializeFirebase, isAvailable, getMessaging, getDiagnostics };

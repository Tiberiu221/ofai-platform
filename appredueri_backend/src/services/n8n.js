/**
 * n8n Webhook Helper
 * Fire-and-forget pattern for triggering n8n workflows
 */
const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || "";

/**
 * Trigger an n8n webhook (non-blocking, fire-and-forget)
 * @param {string} webhookPath - e.g., "/webhook/new-review"
 * @param {object} payload - JSON data to send
 */
function triggerWebhook(webhookPath, payload) {
  if (!N8N_BASE_URL) return; // No n8n URL configured — skip silently
  // Ensure webhookPath starts with / and doesn't contain protocol
  if (!webhookPath.startsWith('/') || webhookPath.includes('://')) {
    console.error(`[n8n] Invalid webhook path: ${webhookPath}`);
    return;
  }
  const url = `${N8N_BASE_URL}${webhookPath}`;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error(`[n8n] Failed to trigger ${webhookPath}:`, err.message);
  });
}

module.exports = { triggerWebhook };

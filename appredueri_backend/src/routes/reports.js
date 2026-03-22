const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");

const VALID_REASONS = [
  "fake_offer",
  "misleading_price",
  "closed_business",
  "inappropriate_content",
  "spam",
  "other",
];

const VALID_TARGET_TYPES = ["offer", "business"];

const MAX_REPORTS_PER_DAY = 10;
const MAX_DETAILS_LENGTH = 500;

// ============================================
// POST /reports — Create a report
// ============================================
router.post("/", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { target_type, target_id, reason, details } = req.body;

  // Validate target_type
  if (!VALID_TARGET_TYPES.includes(target_type)) {
    return res.status(400).json({ message: "Tip invalid. Folosește 'offer' sau 'business'." });
  }

  // Validate target_id
  const tid = parseInt(target_id, 10);
  if (Number.isNaN(tid) || tid < 1) {
    return res.status(400).json({ message: "ID invalid." });
  }

  // Validate reason
  if (!VALID_REASONS.includes(reason)) {
    return res.status(400).json({ message: "Motiv invalid." });
  }

  // Validate details length
  const trimmedDetails = details ? String(details).trim().slice(0, MAX_DETAILS_LENGTH) : null;
  if (reason === "other" && (!trimmedDetails || trimmedDetails.length < 5)) {
    return res.status(400).json({ message: "Te rugăm să descrii problema (minim 5 caractere)." });
  }

  try {
    // Rate limit: max reports per day per user
    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) FROM reports WHERE reporter_id = $1 AND created_at > NOW() - INTERVAL '24 hours'",
      [userId]
    );
    if (parseInt(countRows[0].count) >= MAX_REPORTS_PER_DAY) {
      return res.status(429).json({ message: "Ai atins limita de rapoarte pentru astăzi. Încearcă mâine." });
    }

    // Check target exists — explicit lookup map to prevent SQL injection
    const TABLE_MAP = { offer: 'offers', business: 'businesses' };
    const targetTable = TABLE_MAP[target_type];
    if (!targetTable) return res.status(400).json({ message: "Tip invalid." });
    const { rows: targetRows } = await pool.query(
      `SELECT id, business_id FROM ${targetTable} WHERE id = $1`,
      [tid]
    );
    if (targetRows.length === 0) {
      return res.status(404).json({ message: "Resursa nu a fost găsită." });
    }

    // Prevent self-reporting (check if user owns the business)
    if (target_type === "offer") {
      const { rows: ownerRows } = await pool.query(
        "SELECT 1 FROM user_businesses WHERE user_id = $1 AND business_id = $2",
        [userId, targetRows[0].business_id]
      );
      if (ownerRows.length > 0) {
        return res.status(400).json({ message: "Nu poți raporta propria ofertă." });
      }
    } else {
      const { rows: ownerRows } = await pool.query(
        "SELECT 1 FROM user_businesses WHERE user_id = $1 AND business_id = $2",
        [userId, tid]
      );
      if (ownerRows.length > 0) {
        return res.status(400).json({ message: "Nu poți raporta propriul business." });
      }
    }

    // Insert report (unique constraint will catch duplicates)
    await pool.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, target_type, tid, reason, trimmedDetails]
    );

    // Auto-flag thresholds
    const { rows: flagRows } = await pool.query(
      "SELECT COUNT(DISTINCT reporter_id) FROM reports WHERE target_type = $1 AND target_id = $2 AND status = 'pending'",
      [target_type, tid]
    );
    const reportCount = parseInt(flagRows[0].count);

    if (target_type === "offer" && reportCount >= 10) {
      await pool.query("UPDATE offers SET is_active = false WHERE id = $1", [tid]);
      console.log(`[Reports] Auto-deactivated offer ${tid} (>= 10 reports)`);
    } else if (target_type === "business") {
      if (reportCount >= 3 && reportCount < 10) {
        // Notify admin via email (fire-and-forget)
        const { sendEmail } = require("../services/email");
        const { rows: adminRows } = await pool.query("SELECT email FROM users WHERE role = 'admin' LIMIT 1");
        if (adminRows.length > 0) {
          const { rows: bizRows } = await pool.query("SELECT name FROM businesses WHERE id = $1", [tid]);
          const bizName = bizRows[0]?.name || `#${tid}`;
          const safeBizName = String(bizName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          sendEmail({
            to: adminRows[0].email,
            subject: `[OFAI] Alerta: Business "${bizName}" are ${reportCount} rapoarte`,
            html: `<p>Business-ul <strong>${safeBizName}</strong> (ID: ${tid}) are <strong>${reportCount}</strong> rapoarte pending.</p><p>Verifica in <a href="https://ofai.ro/admin/reports">panoul admin</a>.</p>`,
          }).catch(err => console.error("[Reports] Admin notify failed:", err.message));
          console.log(`[Reports] Admin notified: business ${tid} has ${reportCount} reports`);
        }
      }
      if (reportCount >= 10) {
        await pool.query("UPDATE businesses SET is_active = false WHERE id = $1", [tid]);
        console.log(`[Reports] Auto-deactivated business ${tid} (>= 10 reports)`);
        const { sendEmail } = require("../services/email");
        const { rows: adminRows } = await pool.query("SELECT email FROM users WHERE role = 'admin' LIMIT 1");
        if (adminRows.length > 0) {
          const { rows: bizRows } = await pool.query("SELECT name FROM businesses WHERE id = $1", [tid]);
          sendEmail({
            to: adminRows[0].email,
            subject: `[OFAI] Business "${bizRows[0]?.name}" DEZACTIVAT automat (${reportCount} rapoarte)`,
            html: `<p>Business-ul a fost dezactivat automat deoarece are ${reportCount} rapoarte.</p>`,
          }).catch(() => {});
        }
      }
    }

    res.status(201).json({ message: "Raportul a fost trimis. Mulțumim!" });
  } catch (err) {
    // Unique constraint violation = already reported
    if (err.code === "23505") {
      return res.status(409).json({ message: "Ai raportat deja această resursă." });
    }
    console.error("[Reports] Create error:", err);
    res.status(500).json({ message: "Eroare la trimiterea raportului." });
  }
});

// ============================================
// GET /reports/mine — My reports
// ============================================
router.get("/mine", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, target_type, target_id, reason, details, status, created_at
       FROM reports WHERE reporter_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("[Reports] List mine error:", err);
    res.status(500).json({ message: "Eroare server." });
  }
});

// ============================================
// DELETE /reports/:id — Withdraw own report
// ============================================
router.delete("/:id", authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: "ID invalid." });

  try {
    const { rowCount } = await pool.query(
      "DELETE FROM reports WHERE id = $1 AND reporter_id = $2 AND status = 'pending'",
      [id, req.user.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ message: "Raportul nu a fost găsit sau a fost deja procesat." });
    }
    res.json({ message: "Raportul a fost retras." });
  } catch (err) {
    console.error("[Reports] Delete error:", err);
    res.status(500).json({ message: "Eroare server." });
  }
});

module.exports = router;

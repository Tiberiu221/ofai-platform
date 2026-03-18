# 02 - Report Auto-Flag Logic

## Context
In `reports.js:95-105` exista doar auto-deactivation pentru oferte la >=5 reports. Lipseste:
- Business: >=3 reports → notifica admin via email
- Business: >=10 reports → auto-dezactivare
- Offer threshold trebuie crescut de la 5 la 10

## Fisiere de modificat

### reports.js — POST handler
**Fisier:** `appredueri_backend/src/routes/reports.js`

**Pas A:** Import email service (dupa linia 4):
```javascript
const { sendEmail } = require("../services/email");
```

**Pas B:** Inlocuieste liniile 95-105 (auto-flag block) cu:
```javascript
// Count pending reports for this target
const { rows: flagRows } = await pool.query(
  "SELECT COUNT(*) FROM reports WHERE target_type = $1 AND target_id = $2 AND status = 'pending'",
  [target_type, tid]
);
const reportCount = parseInt(flagRows[0].count);

if (target_type === "offer") {
  if (reportCount >= 10) {
    await pool.query("UPDATE offers SET is_active = false WHERE id = $1", [tid]);
    console.log(`[Reports] Auto-deactivated offer ${tid} (>= 10 reports)`);
  }
} else if (target_type === "business") {
  if (reportCount >= 3 && reportCount < 10) {
    // Notify admin
    const { rows: adminRows } = await pool.query("SELECT email FROM users WHERE role = 'admin' LIMIT 1");
    if (adminRows.length > 0) {
      const { rows: bizRows } = await pool.query("SELECT name FROM businesses WHERE id = $1", [tid]);
      const bizName = bizRows[0]?.name || `#${tid}`;
      sendEmail({
        to: adminRows[0].email,
        subject: `[OFAI] Alerta: Business "${bizName}" are ${reportCount} rapoarte`,
        html: `<p>Business-ul <strong>${bizName}</strong> (ID: ${tid}) are ${reportCount} rapoarte pending. Verifica in <a href="https://ofai.ro/admin/reports">panoul admin</a>.</p>`,
      }).catch(err => console.error("[Reports] Admin notify failed:", err.message));
    }
  }
  if (reportCount >= 10) {
    await pool.query("UPDATE businesses SET is_active = false WHERE id = $1", [tid]);
    console.log(`[Reports] Auto-deactivated business ${tid} (>= 10 reports)`);
    // Notify admin about auto-deactivation
    const { rows: adminRows } = await pool.query("SELECT email FROM users WHERE role = 'admin' LIMIT 1");
    if (adminRows.length > 0) {
      const { rows: bizRows } = await pool.query("SELECT name FROM businesses WHERE id = $1", [tid]);
      sendEmail({
        to: adminRows[0].email,
        subject: `[OFAI] Business "${bizRows[0]?.name}" DEZACTIVAT automat`,
        html: `<p>Business-ul a fost dezactivat automat deoarece are ${reportCount} rapoarte.</p>`,
      }).catch(() => {});
    }
  }
}
```

## Verificare
1. Restart backend, creaza 3 reports pe un business → verifica log + email admin
2. Creaza 10 reports → verifica `is_active = false` in DB
3. Offer threshold: 10 (nu 5)

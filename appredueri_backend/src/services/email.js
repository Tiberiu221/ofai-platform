const { Resend } = require("resend");

// ============================================
// EMAIL SERVICE (Resend)
// ============================================

// Inițializează Resend doar dacă avem API key
// Folosim un placeholder dacă nu există pentru a evita crash-ul la import
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.FROM_EMAIL || "OFAI <noreply@ofai.ro>";
const APP_NAME = "OFAI";

/**
 * Trimite email de bun venit după înregistrare
 */
async function sendWelcomeEmail(to, firstName) {
  // Skip dacă nu avem API key configurat
  if (!resend) {
    console.log(`[Email] Skipping welcome email (no API key configured): ${to}`);
    return { success: false, reason: "no_api_key" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Bine ai venit în ${APP_NAME}! 🎉`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">🎉 Bine ai venit!</h1>
          </div>
          
          <p>Salut${firstName ? ` ${firstName}` : ""},</p>
          
          <p>Contul tău <strong>${APP_NAME}</strong> a fost creat cu succes!</p>
          
          <p>Acum poți:</p>
          <ul>
            <li>🔍 Descoperi oferte și reduceri în orașul tău</li>
            <li>❤️ Salva ofertele favorite</li>
            <li>🔔 Primi notificări pentru oferte noi</li>
            <li>⭐ Lăsa recenzii la business-uri</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://ofai.ro" style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Deschide aplicația
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Dacă ai întrebări, răspunde la acest email și te ajutăm cu plăcere.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. Toate drepturile rezervate.
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("[Email] Welcome email error:", error);
      return { success: false, error };
    }

    console.log(`[Email] Welcome email sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error("[Email] Welcome email exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Trimite email cu codul de resetare parolă
 */
async function sendPasswordResetEmail(to, resetCode, firstName) {
  // Skip dacă nu avem API key configurat
  if (!resend) {
    console.log(`[Email] Skipping reset email (no API key configured): ${to}`);
    console.log(`[Email] Reset code would be: ${resetCode}`);
    return { success: false, reason: "no_api_key" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Codul tău de resetare parolă - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">🔐 Resetare parolă</h1>
          </div>
          
          <p>Salut${firstName ? ` ${firstName}` : ""},</p>
          
          <p>Am primit o cerere de resetare a parolei pentru contul tău ${APP_NAME}.</p>
          
          <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">Codul tău de resetare:</p>
            <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">
              ${resetCode}
            </p>
          </div>
          
          <p style="color: #dc2626; font-weight: 500;">
            ⏰ Acest cod expiră în 15 minute.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            Dacă nu ai cerut resetarea parolei, poți ignora acest email în siguranță.
            Contul tău rămâne securizat.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. Toate drepturile rezervate.<br>
            Acest email a fost trimis automat. Te rugăm să nu răspunzi.
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("[Email] Password reset email error:", error);
      return { success: false, error };
    }

    console.log(`[Email] Password reset email sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error("[Email] Password reset email exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Trimite email generic (pentru alte use cases)
 */
async function sendEmail({ to, subject, html, text }) {
  if (!resend) {
    console.log(`[Email] Skipping email (no API key configured): ${to}`);
    return { success: false, reason: "no_api_key" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[Email] Send error:", error);
      return { success: false, error };
    }

    console.log(`[Email] Email sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error("[Email] Send exception:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmail,
};

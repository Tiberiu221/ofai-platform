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
      html: `<!DOCTYPE html>
<html lang="ro" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Bine ai venit in OFAI</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #06060a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #06060a;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%;">

          <!-- HEADER with ambient glow -->
          <tr>
            <td align="center" style="padding: 40px 32px 24px; background: radial-gradient(ellipse at center top, rgba(251, 146, 60, 0.12) 0%, rgba(6, 6, 10, 0) 70%); background-color: #0d0d12; border: 1px solid rgba(255, 255, 255, 0.06); border-bottom: none; border-radius: 16px 16px 0 0;">
              <!-- Logo mark -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" valign="middle" width="48" height="48" style="width: 48px; height: 48px; background: linear-gradient(135deg, #f97316, #fb923c); border-radius: 12px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 22px; font-weight: 800; color: #06060a; text-align: center; line-height: 48px;">O</td>
                </tr>
              </table>
              <p style="margin: 12px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 18px; font-weight: 700; color: #fafafa; letter-spacing: -0.02em;">OFAI</p>
            </td>
          </tr>

          <!-- MAIN CONTENT -->
          <tr>
            <td style="background-color: #0d0d12; border-left: 1px solid rgba(255, 255, 255, 0.06); border-right: 1px solid rgba(255, 255, 255, 0.06); padding: 0 32px;">

              <!-- Divider -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 0; line-height: 0; height: 1px;">&nbsp;</td></tr>
              </table>

              <!-- Heading -->
              <h1 style="margin: 32px 0 0 0; font-family: 'DM Serif Display', Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; color: #fafafa; text-align: center; line-height: 1.3;">Bine ai venit! &#127881;</h1>

              <!-- Greeting -->
              <p style="margin: 24px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 16px; color: #a1a1aa; line-height: 1.6;">Salut${firstName ? ` <span style="color: #fafafa; font-weight: 600;">${firstName}</span>` : ""},</p>

              <!-- Message -->
              <p style="margin: 12px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 16px; color: #a1a1aa; line-height: 1.6;">Contul t&#259;u <span style="color: #fb923c; font-weight: 600;">OFAI</span> a fost creat cu succes! Iat&#259; ce po&#539;i face:</p>

              <!-- Spacer -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="height: 24px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>

              <!-- Feature cards 2x2 -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="50%" valign="top" style="padding: 0 6px 12px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="background-color: #131318; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 20px 16px;">
                          <p style="margin: 0 0 8px 0; font-size: 24px; line-height: 1;">&#128269;</p>
                          <p style="margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: 500; color: #fafafa; line-height: 1.4;">Descover&#259; oferte</p>
                          <p style="margin: 4px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #71717a; line-height: 1.4;">&#206;n ora&#537;ul t&#259;u</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding: 0 0 12px 6px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="background-color: #131318; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 20px 16px;">
                          <p style="margin: 0 0 8px 0; font-size: 24px; line-height: 1;">&#10084;&#65039;</p>
                          <p style="margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: 500; color: #fafafa; line-height: 1.4;">Salveaz&#259; favorite</p>
                          <p style="margin: 4px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #71717a; line-height: 1.4;">Colec&#539;ia ta personal&#259;</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="50%" valign="top" style="padding: 0 6px 0 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="background-color: #131318; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 20px 16px;">
                          <p style="margin: 0 0 8px 0; font-size: 24px; line-height: 1;">&#128276;</p>
                          <p style="margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: 500; color: #fafafa; line-height: 1.4;">Notific&#259;ri instant</p>
                          <p style="margin: 4px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #71717a; line-height: 1.4;">Pentru oferte noi</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding: 0 0 0 6px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="background-color: #131318; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 20px 16px;">
                          <p style="margin: 0 0 8px 0; font-size: 24px; line-height: 1;">&#11088;</p>
                          <p style="margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: 500; color: #fafafa; line-height: 1.4;">Las&#259; recenzii</p>
                          <p style="margin: 4px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #71717a; line-height: 1.4;">La business-uri locale</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Spacer -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="height: 32px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://ofai.ro" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" fillcolor="#fb923c" stroke="f">
                      <w:anchorlock/>
                      <center style="color:#06060a;font-family:sans-serif;font-size:16px;font-weight:bold;">Descover&#259; oferte</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="https://ofai.ro" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f97316, #fb923c); color: #06060a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 40px; border-radius: 8px; letter-spacing: -0.01em;">Descover&#259; oferte</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Spacer -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="height: 32px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #0d0d12; border: 1px solid rgba(255, 255, 255, 0.06); border-top: none; border-radius: 0 0 16px 16px; padding: 24px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 0; line-height: 0; height: 1px;">&nbsp;</td></tr>
              </table>
              <p style="margin: 20px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #71717a; line-height: 1.6; text-align: center;">Dac&#259; ai &#238;ntreb&#259;ri, r&#259;spunde la acest email &#537;i te ajut&#259;m cu pl&#259;cere.</p>
              <p style="margin: 16px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #52525b; text-align: center; line-height: 1.5;">&copy; ${new Date().getFullYear()} OFAI. Toate drepturile rezervate.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
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

/**
 * Trimite email de notificare cand cererea de business a fost APROBATA
 */
async function sendBusinessApprovedEmail(to, firstName, businessName) {
  if (!resend) {
    console.log(`[Email] Skipping business approved email (no API key configured): ${to}`);
    return { success: false, reason: "no_api_key" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Business-ul tau "${businessName}" a fost aprobat! - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #16a34a; margin: 0;">Business aprobat!</h1>
          </div>

          <p>Salut${firstName ? ` ${firstName}` : ""},</p>

          <p>Cererea ta pentru business-ul <strong>${businessName}</strong> a fost <span style="color: #16a34a; font-weight: bold;">aprobata</span>!</p>

          <p>Ce poti face acum:</p>
          <ul>
            <li>Acceseaza <strong>Business Portal</strong> pentru a gestiona business-ul tau</li>
            <li>Adauga logo, cover si imagini pentru a atrage mai multi clienti</li>
            <li>Creeaza oferte si promotii pentru clientii tai</li>
            <li>Completeaza informatiile de contact (telefon, adresa, program)</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://ofai.ro/cont" style="background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Gestioneaza business-ul
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            Business-ul tau este acum vizibil pe platforma ${APP_NAME}. Cu cat completezi mai multe informatii, cu atat vei atrage mai multi clienti!
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            &copy; ${new Date().getFullYear()} ${APP_NAME}. Toate drepturile rezervate.
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("[Email] Business approved email error:", error);
      return { success: false, error };
    }

    console.log(`[Email] Business approved email sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error("[Email] Business approved email exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Trimite email de notificare cand cererea de business a fost RESPINSA
 */
async function sendBusinessRejectedEmail(to, firstName, businessName, reason) {
  if (!resend) {
    console.log(`[Email] Skipping business rejected email (no API key configured): ${to}`);
    return { success: false, reason: "no_api_key" };
  }

  const reasonBlock = reason
    ? `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 4px 0; font-weight: 600; color: #991b1b;">Motivul respingerii:</p>
        <p style="margin: 0; color: #7f1d1d;">${reason}</p>
      </div>
    `
    : `
      <p style="color: #666;">Nu a fost specificat un motiv detaliat.</p>
    `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Cererea pentru "${businessName}" nu a fost aprobata - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0;">Cerere respinsa</h1>
          </div>

          <p>Salut${firstName ? ` ${firstName}` : ""},</p>

          <p>Din pacate, cererea ta pentru business-ul <strong>${businessName}</strong> nu a fost aprobata.</p>

          ${reasonBlock}

          <p><strong>Ce poti face:</strong></p>
          <ul>
            <li>Verifica datele introduse si asigura-te ca sunt corecte si complete</li>
            <li>Adauga o descriere detaliata a business-ului tau</li>
            <li>Asigura-te ca numarul de telefon si website-ul sunt valide</li>
            <li>Trimite o noua cerere cu informatiile corectate</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://ofai.ro/pentru-business" style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Trimite o noua cerere
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            Daca ai intrebari, raspunde la acest email si te ajutam cu placere.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            &copy; ${new Date().getFullYear()} ${APP_NAME}. Toate drepturile rezervate.
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("[Email] Business rejected email error:", error);
      return { success: false, error };
    }

    console.log(`[Email] Business rejected email sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error("[Email] Business rejected email exception:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmail,
  sendBusinessApprovedEmail,
  sendBusinessRejectedEmail,
};

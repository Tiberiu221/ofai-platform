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
 * Escape HTML entities to prevent XSS in email templates
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
              <p style="margin: 24px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 16px; color: #a1a1aa; line-height: 1.6;">Salut${firstName ? ` <span style="color: #fafafa; font-weight: 600;">${escapeHtml(firstName)}</span>` : ""},</p>

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
                          <p style="margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: 500; color: #fafafa; line-height: 1.4;">Descoper&#259; oferte</p>
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
                      <center style="color:#06060a;font-family:sans-serif;font-size:16px;font-weight:bold;">Descoper&#259; oferte</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="https://ofai.ro" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f97316, #fb923c); color: #06060a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 40px; border-radius: 8px; letter-spacing: -0.01em;">Descoper&#259; oferte</a>
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
              <p style="margin: 20px 0 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #71717a; line-height: 1.6; text-align: center;">Acesta este un email automat. Pentru &#238;ntreb&#259;ri, contacteaz&#259;-ne la <a href="mailto:contact@ofai.ro" style="color: #fb923c; text-decoration: none;">contact@ofai.ro</a></p>
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
    if (process.env.NODE_ENV !== 'production') console.log(`[Email] Reset code would be: ${resetCode}`);
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
          
          <p>Salut${firstName ? ` ${escapeHtml(firstName)}` : ""},</p>

          <p>Am primit o cerere de resetare a parolei pentru contul tău ${APP_NAME}.</p>
          
          <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">Codul tău de resetare:</p>
            <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">
              ${escapeHtml(resetCode)}
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
      subject: `Business-ul tau "${escapeHtml(businessName)}" a fost aprobat! - ${APP_NAME}`,
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

          <p>Salut${firstName ? ` ${escapeHtml(firstName)}` : ""},</p>

          <p>Cererea ta pentru business-ul <strong>${escapeHtml(businessName)}</strong> a fost <span style="color: #16a34a; font-weight: bold;">aprobata</span>!</p>

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
        <p style="margin: 0; color: #7f1d1d;">${escapeHtml(reason)}</p>
      </div>
    `
    : `
      <p style="color: #666;">Nu a fost specificat un motiv detaliat.</p>
    `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Cererea pentru "${escapeHtml(businessName)}" nu a fost aprobata - ${APP_NAME}`,
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

          <p>Salut${firstName ? ` ${escapeHtml(firstName)}` : ""},</p>

          <p>Din pacate, cererea ta pentru business-ul <strong>${escapeHtml(businessName)}</strong> nu a fost aprobata.</p>

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

/**
 * Trimite email de notificare cand o OFERTA a fost APROBATA
 */
async function sendOfferApprovedEmail(to, firstName, offerTitle, businessName) {
  if (!resend) {
    console.log(`[Email] Skipping offer approved email (no API key configured): ${to}`);
    return { success: false, reason: "no_api_key" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Oferta ta "${escapeHtml(offerTitle)}" a fost aprobata! - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #16a34a; margin: 0;">Oferta aprobata!</h1>
          </div>

          <p>Salut${firstName ? ` ${escapeHtml(firstName)}` : ""},</p>

          <p>Oferta ta <strong>"${escapeHtml(offerTitle)}"</strong> pentru business-ul <strong>${escapeHtml(businessName)}</strong> a fost <span style="color: #16a34a; font-weight: bold;">aprobata</span> si este acum activa pe platforma!</p>

          <p>Ce inseamna asta:</p>
          <ul>
            <li>Oferta este acum <strong>vizibila</strong> pentru toti utilizatorii ${APP_NAME}</li>
            <li>Clientii pot vedea detaliile ofertei si pot profita de reducere</li>
            <li>Poti modifica oferta oricand din <strong>Business Portal</strong></li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://ofai.ro/cont" style="background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Vezi oferta in portal
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            Tine cont ca daca editezi oferta, aceasta va fi trimisa din nou la verificare.
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
      console.error("[Email] Offer approved email error:", error);
      return { success: false, error };
    }

    console.log(`[Email] Offer approved email sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error("[Email] Offer approved email exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Trimite email de notificare cand o OFERTA a fost RESPINSA
 */
async function sendOfferRejectedEmail(to, firstName, offerTitle, businessName, rejectionReason) {
  if (!resend) {
    console.log(`[Email] Skipping offer rejected email (no API key configured): ${to}`);
    return { success: false, reason: "no_api_key" };
  }

  const reasonBlock = rejectionReason
    ? `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 4px 0; font-weight: 600; color: #991b1b;">Motivul respingerii:</p>
        <p style="margin: 0; color: #7f1d1d;">${escapeHtml(rejectionReason)}</p>
      </div>
    `
    : `
      <p style="color: #666;">Nu a fost specificat un motiv detaliat.</p>
    `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Oferta ta "${escapeHtml(offerTitle)}" necesita modificari - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0;">Oferta necesita modificari</h1>
          </div>

          <p>Salut${firstName ? ` ${escapeHtml(firstName)}` : ""},</p>

          <p>Oferta ta <strong>"${escapeHtml(offerTitle)}"</strong> pentru business-ul <strong>${escapeHtml(businessName)}</strong> nu a putut fi aprobata in forma actuala.</p>

          ${reasonBlock}

          <p><strong>Ce poti face:</strong></p>
          <ul>
            <li>Acceseaza <strong>Business Portal</strong> si deschide oferta</li>
            <li>Editeaza oferta conform sugestiilor de mai sus</li>
            <li>Salveaza — oferta va fi trimisa automat la verificare din nou</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://ofai.ro/cont" style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Editeaza oferta
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
      console.error("[Email] Offer rejected email error:", error);
      return { success: false, error };
    }

    console.log(`[Email] Offer rejected email sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error("[Email] Offer rejected email exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Send Premium support welcome email when a business upgrades to Premium
 */
async function sendPremiumSupportWelcome(to, firstName, businessName) {
  if (!resend) {
    console.log(`[Email] Skipping premium support welcome (no API key): ${to}`);
    return { success: false, reason: 'no_api_key' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Suport Prioritar activat pentru "${escapeHtml(businessName)}" - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html lang="ro">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; background-color: #06060a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table role="presentation" width="100%" style="background-color: #06060a;">
            <tr>
              <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="600" style="max-width: 600px; width: 100%;">
                  <tr>
                    <td style="background: radial-gradient(ellipse at center top, rgba(167, 139, 250, 0.12) 0%, rgba(6, 6, 10, 0) 70%); background-color: #0d0d12; border: 1px solid rgba(167, 139, 250, 0.15); border-bottom: none; border-radius: 16px 16px 0 0; padding: 40px 32px 24px; text-align: center;">
                      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #a78bfa;">PREMIUM</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #0d0d12; border-left: 1px solid rgba(167, 139, 250, 0.15); border-right: 1px solid rgba(167, 139, 250, 0.15); padding: 0 32px 32px;">
                      <h1 style="font-family: 'DM Serif Display', Georgia, serif; font-size: 24px; font-weight: 400; color: #fafafa; text-align: center; margin: 32px 0 16px;">Suport Prioritar Activat</h1>
                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Salut${firstName ? ` <strong style="color: #fafafa;">${escapeHtml(firstName)}</strong>` : ''},
                      </p>
                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Business-ul <strong style="color: #a78bfa;">${escapeHtml(businessName)}</strong> beneficiaza acum de suport prioritar. Iata cum ne poti contacta:
                      </p>
                      <table role="presentation" width="100%" style="margin: 24px 0;">
                        <tr>
                          <td style="background: rgba(167, 139, 250, 0.06); border: 1px solid rgba(167, 139, 250, 0.12); border-radius: 12px; padding: 20px;">
                            <p style="margin: 0 0 12px; font-size: 14px; color: #a78bfa; font-weight: 600;">Contact Prioritar:</p>
                            <p style="margin: 0 0 8px; font-size: 14px; color: #fafafa;">
                              Email: <a href="mailto:premium@ofai.ro" style="color: #a78bfa; text-decoration: none;">premium@ofai.ro</a>
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #fafafa;">
                              WhatsApp: <a href="https://wa.me/40700000000" style="color: #22c55e; text-decoration: none;">+40 700 000 000</a>
                            </p>
                            <p style="margin: 12px 0 0; font-size: 13px; color: #71717a;">
                              Timp mediu de raspuns: sub 4 ore (zilele lucratoare)
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #0d0d12; border: 1px solid rgba(167, 139, 250, 0.15); border-top: none; border-radius: 0 0 16px 16px; padding: 20px 32px 32px; text-align: center;">
                      <p style="font-size: 12px; color: #52525b;">&copy; ${new Date().getFullYear()} ${APP_NAME}. Toate drepturile rezervate.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Premium support welcome error:', error);
      return { success: false, error };
    }
    console.log(`[Email] Premium support welcome sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error('[Email] Premium support welcome exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Notifică admin-ul (Tiberiu) despre o nouă cerere de onboarding concierge.
 */
async function sendAdminOnboardingEmail(businessId, businessName, requestType, message) {
  const adminEmail = process.env.ADMIN_EMAIL || 'tiberiu@ofai.ro';
  if (!resend) {
    console.log(`[Email] Skipping admin onboarding email (no API key): business ${businessId}`);
    return { success: false, error: 'No API key' };
  }

  const typeLabels = { catalog: 'Catalog', hours: 'Program de lucru', full_setup: 'Setup complet' };
  const typeLabel = typeLabels[requestType] || requestType;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `[OFAI Concierge] Cerere nouă: ${escapeHtml(businessName)} — ${typeLabel}`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px;">
          <h2 style="color: #18181b; margin-top: 0;">Cerere Concierge nouă</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; color: #71717a; width: 120px;">Business:</td><td style="padding: 8px 0; font-weight: 600;">${escapeHtml(businessName)} (#${businessId})</td></tr>
            <tr><td style="padding: 8px 0; color: #71717a;">Tip cerere:</td><td style="padding: 8px 0;">${escapeHtml(typeLabel)}</td></tr>
          </table>
          ${message ? `<div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 20px;"><p style="margin: 0; color: #27272a; white-space: pre-wrap;">${escapeHtml(message)}</p></div>` : ''}
          <a href="https://ofai.ro/admin/onboarding" style="display: inline-block; background: #fb923c; color: #fff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Vezi în admin</a>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Admin onboarding email error:', error);
      return { success: false, error: error.message };
    }
    console.log(`[Email] Admin onboarding email sent: ${data?.id}`);
    return { success: true, emailId: data?.id };
  } catch (err) {
    console.error('[Email] Admin onboarding email exception:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmail,
  sendBusinessApprovedEmail,
  sendBusinessRejectedEmail,
  sendOfferApprovedEmail,
  sendOfferRejectedEmail,
  sendPremiumSupportWelcome,
  sendAdminOnboardingEmail,
};

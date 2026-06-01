import nodemailer from "nodemailer";

export const DEFAULT_FROM = "support@talkeo.fr";
export const DEFAULT_FROM_NAME = "Talkeo";

function mailConfig() {
  const host = process.env.TALKEO_SMTP_HOST ?? "";
  const user = process.env.TALKEO_SMTP_USER ?? process.env.TALKEO_MAIL_FROM ?? DEFAULT_FROM;
  const pass = process.env.TALKEO_SMTP_PASS ?? "";
  if (!host || !pass) return null;

  const port = Number(process.env.TALKEO_SMTP_PORT ?? 465);
  const mode = String(process.env.TALKEO_SMTP_SECURE ?? "").toLowerCase();

  /** IONOS : 465 SSL/TLS ou 587 STARTTLS (smtp.ionos.fr) */
  let secure = port === 465;
  let requireTLS = false;
  if (mode === "starttls" || mode === "tls" || port === 587) {
    secure = false;
    requireTLS = true;
  } else if (mode === "true" || mode === "ssl") {
    secure = true;
    requireTLS = false;
  } else if (mode === "false") {
    secure = false;
  }

  return {
    host,
    port,
    secure,
    requireTLS,
    auth: { user, pass },
  };
}

let transporter = null;

function getTransporter() {
  const cfg = mailConfig();
  if (!cfg) return null;
  if (!transporter) transporter = nodemailer.createTransport(cfg);
  return transporter;
}

function fromHeader() {
  const addr = process.env.TALKEO_MAIL_FROM ?? DEFAULT_FROM;
  const name = process.env.TALKEO_MAIL_FROM_NAME ?? DEFAULT_FROM_NAME;
  return `"${name}" <${addr}>`;
}

function buildHtml({ displayName, code, purpose }) {
  const greeting = displayName ? `Bonjour ${displayName},` : "Bonjour,";
  const intro =
    purpose === "email-change"
      ? "Voici le code pour confirmer votre nouvelle adresse e-mail sur Talkeo :"
      : "Voici votre code de vérification pour activer votre compte Talkeo :";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;max-width:480px;margin:0 auto;padding:24px">
  <p style="margin:0 0 16px">${greeting}</p>
  <p style="margin:0 0 20px">${intro}</p>
  <p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:0.2em;color:#5b21b6">${code}</p>
  <p style="margin:0 0 8px;font-size:14px;color:#64748b">Ce code expire dans 15 minutes.</p>
  <p style="margin:0;font-size:14px;color:#64748b">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
  <hr style="margin:28px 0;border:none;border-top:1px solid #e2e8f0">
  <p style="margin:0;font-size:12px;color:#94a3b8">Talkeo — ${DEFAULT_FROM}</p>
</body>
</html>`;
}

/**
 * @param {{ to: string; code: string; displayName?: string; purpose?: 'verification' | 'email-change' }} opts
 */
export async function sendVerificationCodeMail({ to, code, displayName = "", purpose = "verification" }) {
  const norm = String(to).trim().toLowerCase();
  const from = fromHeader();
  const subject =
    purpose === "email-change"
      ? "Confirmez votre nouvel e-mail — Talkeo"
      : "Votre code de vérification Talkeo";

  const text = `${displayName ? `Bonjour ${displayName},\n\n` : ""}${
    purpose === "email-change"
      ? "Code pour confirmer votre nouvel e-mail Talkeo"
      : "Code de vérification Talkeo"
  } : ${code}\n\nValable 15 minutes.\n\n— Talkeo (${DEFAULT_FROM})`;

  const html = buildHtml({ displayName, code, purpose });
  const transport = getTransporter();

  if (!transport) {
    console.info(`[Talkeo mail] SMTP non configuré — code pour ${norm}: ${code}`);
    return { sent: false, devCode: code };
  }

  await transport.sendMail({
    from,
    to: norm,
    replyTo: process.env.TALKEO_MAIL_REPLY_TO ?? DEFAULT_FROM,
    subject,
    text,
    html,
  });

  console.info(`[Talkeo mail] Code envoyé à ${norm} depuis ${from}`);
  return { sent: true };
}

export function isMailConfigured() {
  return Boolean(mailConfig());
}

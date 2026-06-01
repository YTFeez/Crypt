import { sendVerificationCodeMail } from "./mail.js";
import { rateLimit, clientIp } from "./rate-limit.js";
import { normalizeEmail, isValidEmail } from "./security.js";

const mailIpLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyFn: (req) => `mail:${clientIp(req)}`,
});

const mailEmailLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyFn: (req) => `mail:${normalizeEmail(req.body?.email)}`,
});

export function registerSendVerificationRoute(app) {
  app.post("/api/send-verification", mailIpLimit, mailEmailLimit, async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const code = String(req.body?.code ?? "").trim();
      const displayName = String(req.body?.displayName ?? "").trim();
      const purpose = req.body?.purpose === "email-change" ? "email-change" : "verification";

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "E-mail invalide." });
      }
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: "Code invalide." });
      }

      const result = await sendVerificationCodeMail({
        to: email,
        code,
        displayName,
        purpose,
      });

      res.json({
        ok: true,
        sent: result.sent,
        from: process.env.TALKEO_MAIL_FROM ?? "support@talkeo.fr",
        devCode: result.devCode,
      });
    } catch (e) {
      console.error("[Talkeo mail]", e);
      res.status(500).json({ error: "Impossible d'envoyer l'e-mail." });
    }
  });
}

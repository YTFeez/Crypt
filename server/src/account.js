import {
  hashPassword,
  verifyPassword,
  generateVerificationCode,
  hashCode,
} from "./crypto.js";
import {
  validatePassword,
  normalizeEmail,
  isValidEmail,
  normalizePhone,
} from "./security.js";

export function registerAccountRoutes(app, { db, auth, requireAuth }) {
  app.patch("/api/account/profile", requireAuth, (req, res) => {
    try {
      const { display_name, org_name, phone } = req.body ?? {};
      const updates = [];
      const params = [];

      if (display_name !== undefined) {
        const name = String(display_name).trim();
        if (!name) return res.status(400).json({ error: "Nom affiché requis." });
        updates.push("display_name = ?");
        params.push(name);
      }
      if (org_name !== undefined) {
        updates.push("org_name = ?");
        params.push(org_name ? String(org_name).trim() : null);
      }
      if (phone !== undefined) {
        const norm = phone === "" || phone === null ? null : normalizePhone(phone);
        if (phone && !norm) {
          return res.status(400).json({ error: "Numéro invalide (8 à 15 chiffres)." });
        }
        updates.push("phone = ?");
        params.push(norm);
      }

      if (!updates.length) return res.status(400).json({ error: "Aucune modification." });

      params.push(req.userId);
      db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...params);

      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
      res.json({ ok: true, user: userPublic(user) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur mise à jour profil." });
    }
  });

  app.post("/api/account/change-password", requireAuth, async (req, res) => {
    try {
      const current = String(req.body?.currentPassword ?? "");
      const next = String(req.body?.newPassword ?? "");
      const err = validatePassword(next);
      if (err) return res.status(400).json({ error: err });

      const user = req.user;
      const valid = await verifyPassword(current, user.password_salt, user.password_hash);
      if (!valid) return res.status(401).json({ error: "Mot de passe actuel incorrect." });

      const cred = await hashPassword(next);
      db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").run(
        cred.hash,
        cred.salt,
        req.userId
      );
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur changement mot de passe." });
    }
  });

  app.post("/api/account/request-email-change", requireAuth, async (req, res) => {
    try {
      const newEmail = normalizeEmail(req.body?.newEmail);
      const password = String(req.body?.password ?? "");
      if (!isValidEmail(newEmail)) {
        return res.status(400).json({ error: "Nouvel e-mail invalide." });
      }

      const user = req.user;
      if (newEmail === user.email.toLowerCase()) {
        return res.status(400).json({ error: "C'est déjà votre e-mail." });
      }

      const valid = await verifyPassword(password, user.password_salt, user.password_hash);
      if (!valid) return res.status(401).json({ error: "Mot de passe incorrect." });

      const taken = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(newEmail, req.userId);
      if (taken) return res.status(409).json({ error: "Cet e-mail est déjà utilisé." });

      const code = generateVerificationCode();
      const expires = Date.now() + 15 * 60 * 1000;
      db.prepare(
        `INSERT INTO email_verifications (email, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, user_id=excluded.user_id`
      ).run(newEmail, req.userId, hashCode(code), expires);

      console.info(`[Talkeo] Changement e-mail → ${newEmail} : ${code}`);
      res.json({
        ok: true,
        devCode: process.env.NODE_ENV !== "production" ? code : undefined,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur demande changement e-mail." });
    }
  });

  app.post("/api/account/confirm-email-change", requireAuth, async (req, res) => {
    try {
      const newEmail = normalizeEmail(req.body?.newEmail);
      const code = String(req.body?.code ?? "").trim();
      const row = db.prepare("SELECT * FROM email_verifications WHERE email = ?").get(newEmail);
      if (!row || row.user_id !== req.userId) {
        return res.status(400).json({ error: "Aucune demande en cours pour cet e-mail." });
      }
      if (Date.now() > row.expires_at) {
        db.prepare("DELETE FROM email_verifications WHERE email = ?").run(newEmail);
        return res.status(400).json({ error: "Code expiré." });
      }
      if (hashCode(code) !== row.code_hash) {
        return res.status(400).json({ error: "Code incorrect." });
      }

      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(newEmail, req.userId);
      db.prepare("DELETE FROM email_verifications WHERE email = ?").run(newEmail);

      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
      const token = await auth.signToken(user.id, user.email);
      res.json({ ok: true, token, email: newEmail });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur confirmation e-mail." });
    }
  });

  app.delete("/api/account", requireAuth, async (req, res) => {
    try {
      const password = String(req.body?.password ?? "");
      const confirm = String(req.body?.confirm ?? "");
      if (confirm !== "SUPPRIMER") {
        return res.status(400).json({ error: 'Tapez "SUPPRIMER" pour confirmer.' });
      }

      const user = req.user;
      const valid = await verifyPassword(password, user.password_salt, user.password_hash);
      if (!valid) return res.status(401).json({ error: "Mot de passe incorrect." });

      db.prepare("DELETE FROM users WHERE id = ?").run(req.userId);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur suppression compte." });
    }
  });
}

function userPublic(row) {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    handle: row.handle,
    email_verified: !!row.email_verified,
    org_name: row.org_name,
    phone: row.phone ?? null,
    created_at: row.created_at,
    vaultMeta: row.vault_salt
      ? {
          salt: row.vault_salt,
          verifier: row.vault_verifier,
          userId: row.id,
          kdf: row.vault_kdf ?? "argon2id",
          v: row.vault_v ?? 4,
        }
      : null,
  };
}

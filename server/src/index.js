import express from "express";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, seedDemoUser } from "./db.js";
import { createAuth, authMiddleware, adminMiddleware } from "./auth.js";
import {
  hashPassword,
  verifyPassword,
  generateVerificationCode,
  hashCode,
  decryptVaultPayload,
} from "./crypto.js";
import { rateLimit, clientIp } from "./rate-limit.js";
import { validatePassword, normalizeEmail, isValidEmail } from "./security.js";
import { registerAccountRoutes } from "./account.js";
import { sendVerificationCodeMail } from "./mail.js";
import { registerSendVerificationRoute } from "./send-verification-route.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.TALKEO_API_PORT ?? 8787);
const DB_PATH = process.env.TALKEO_DATABASE_PATH ?? "/opt/crypt/data/talkeo.db";
const JWT_SECRET = process.env.TALKEO_JWT_SECRET ?? "";
const ADMIN_KEY = process.env.TALKEO_ADMIN_KEY ?? "";

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("ERREUR: définissez TALKEO_JWT_SECRET (min. 32 caractères aléatoires)");
  process.exit(1);
}

const db = openDatabase(DB_PATH);
await seedDemoUser(db);
const auth = createAuth(JWT_SECRET);

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);
app.use(express.json({ limit: "12mb" }));

const authIpLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  keyFn: (req) => `ip:${clientIp(req)}`,
});
const authEmailLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  keyFn: (req) => `email:${normalizeEmail(req.body?.email)}`,
});

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

function uniqueHandle(base) {
  let handle = base.replace(/[^a-z0-9_]/g, "") || "user";
  let n = 0;
  while (db.prepare("SELECT 1 FROM users WHERE handle = ?").get(handle)) {
    n++;
    handle = `${base.replace(/[^a-z0-9_]/g, "") || "user"}${n}`;
  }
  return handle;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "talkeo-api", db: DB_PATH });
});

app.post("/api/auth/register", authIpLimit, authEmailLimit, async (req, res) => {
  try {
    const { email, password, displayName, vaultMeta, vault } = req.body ?? {};
    const norm = normalizeEmail(email);
    if (!isValidEmail(norm)) {
      return res.status(400).json({ error: "E-mail invalide." });
    }
    const pwdErr = validatePassword(password);
    if (pwdErr) return res.status(400).json({ error: pwdErr });
    if (!displayName?.trim()) {
      return res.status(400).json({ error: "Nom requis." });
    }
    if (!vaultMeta?.salt || !vaultMeta?.verifier || !vault?.data) {
      return res.status(400).json({ error: "Coffre chiffré requis." });
    }

    const existing = db.prepare("SELECT id, email_verified FROM users WHERE email = ?").get(norm);
    if (existing?.email_verified) {
      return res.status(409).json({ error: "Cet e-mail est déjà utilisé." });
    }

    const cred = await hashPassword(String(password));
    const id = existing?.id ?? crypto.randomUUID();
    const handle = uniqueHandle(norm.split("@")[0]);
    const now = new Date().toISOString();
    const code = generateVerificationCode();
    const codeHash = hashCode(code);
    const expires = Date.now() + 15 * 60 * 1000;

    if (existing) {
      db.prepare(
        `UPDATE users SET password_hash=?, password_salt=?, display_name=?, handle=?,
         vault_salt=?, vault_verifier=?, vault_kdf=?, vault_v=?, email_verified=0 WHERE id=?`
      ).run(
        cred.hash,
        cred.salt,
        displayName.trim(),
        handle,
        vaultMeta.salt,
        vaultMeta.verifier,
        vaultMeta.kdf ?? "argon2id",
        vaultMeta.v ?? 4,
        id
      );
    } else {
      db.prepare(
        `INSERT INTO users (id, email, password_hash, password_salt, display_name, handle,
         email_verified, vault_salt, vault_verifier, vault_kdf, vault_v, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
      ).run(
        id,
        norm,
        cred.hash,
        cred.salt,
        displayName.trim(),
        handle,
        vaultMeta.salt,
        vaultMeta.verifier,
        vaultMeta.kdf ?? "argon2id",
        vaultMeta.v ?? 4,
        now
      );
    }

    db.prepare(
      `INSERT INTO vaults (user_id, data, iv, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, iv=excluded.iv, updated_at=excluded.updated_at`
    ).run(id, vault.data, vault.iv ?? "", now);

    db.prepare(
      `INSERT INTO email_verifications (email, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, user_id=excluded.user_id`
    ).run(norm, id, codeHash, expires);

    const mail = await sendVerificationCodeMail({
      to: norm,
      code,
      displayName: displayName.trim(),
      purpose: "verification",
    });
    if (!mail.sent) console.info(`[Talkeo] Code vérif ${norm}: ${code}`);
    res.status(201).json({
      userId: id,
      email: norm,
      needsVerification: true,
      devCode: mail.devCode ?? (process.env.NODE_ENV !== "production" ? code : undefined),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur inscription." });
  }
});

app.post("/api/auth/login", authIpLimit, authEmailLimit, async (req, res) => {
  try {
    const norm = normalizeEmail(req.body?.email);
    const password = String(req.body?.password ?? "");
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(norm);
    if (!user) return res.status(401).json({ error: "E-mail ou mot de passe incorrect." });

    const valid = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!valid) return res.status(401).json({ error: "E-mail ou mot de passe incorrect." });
    if (!user.email_verified) {
      return res.status(403).json({ error: "E-mail non vérifié.", code: "EMAIL_NOT_VERIFIED" });
    }

    const token = await auth.signToken(user.id, user.email);
    res.json({ token, user: userPublic(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur connexion." });
  }
});

app.post("/api/auth/verify-email", async (req, res) => {
  try {
    const norm = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    const code = String(req.body?.code ?? "").trim();
    const row = db.prepare("SELECT * FROM email_verifications WHERE email = ?").get(norm);
    if (!row) return res.status(400).json({ error: "Aucune vérification en cours." });
    if (Date.now() > row.expires_at) {
      db.prepare("DELETE FROM email_verifications WHERE email = ?").run(norm);
      return res.status(400).json({ error: "Code expiré." });
    }
    const check = hashCode(code);
    if (check !== row.code_hash) {
      return res.status(400).json({ error: "Code incorrect." });
    }
    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(row.user_id);
    db.prepare("DELETE FROM email_verifications WHERE email = ?").run(norm);
    res.json({ ok: true, userId: row.user_id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur vérification." });
  }
});

app.post("/api/auth/resend-code", async (req, res) => {
  try {
    const norm = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(norm);
    if (!user) return res.status(404).json({ error: "Compte introuvable." });
    if (user.email_verified) return res.status(400).json({ error: "E-mail déjà vérifié." });

    const code = generateVerificationCode();
    db.prepare(
      `INSERT INTO email_verifications (email, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at`
    ).run(norm, user.id, hashCode(code), Date.now() + 15 * 60 * 1000);

    const mail = await sendVerificationCodeMail({
      to: norm,
      code,
      displayName: user.display_name,
      purpose: "verification",
    });
    if (!mail.sent) console.info(`[Talkeo] Code renvoyé ${norm}: ${code}`);
    res.json({
      ok: true,
      devCode: mail.devCode ?? (process.env.NODE_ENV !== "production" ? code : undefined),
    });
  } catch (e) {
    res.status(500).json({ error: "Erreur envoi." });
  }
});

const requireAuth = authMiddleware(auth, db);

registerSendVerificationRoute(app);
registerAccountRoutes(app, { db, auth, requireAuth });

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: userPublic(req.user) });
});

app.put("/api/auth/vault-meta", requireAuth, (req, res) => {
  const { salt, verifier, kdf, v } = req.body ?? {};
  if (!salt || !verifier) return res.status(400).json({ error: "Meta invalide." });
  db.prepare(
    `UPDATE users SET vault_salt=?, vault_verifier=?, vault_kdf=?, vault_v=? WHERE id=?`
  ).run(salt, verifier, kdf ?? "argon2id", v ?? 4, req.userId);
  res.json({ ok: true });
});

app.get("/api/vault", requireAuth, (req, res) => {
  const row = db.prepare("SELECT data, iv, updated_at FROM vaults WHERE user_id = ?").get(req.userId);
  if (!row) return res.json({ data: "{}", iv: "" });
  res.json(row);
});

app.put("/api/vault", requireAuth, (req, res) => {
  const { data, iv } = req.body ?? {};
  if (typeof data !== "string") return res.status(400).json({ error: "Données invalides." });
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO vaults (user_id, data, iv, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, iv=excluded.iv, updated_at=excluded.updated_at`
  ).run(req.userId, data, iv ?? "", now);
  res.json({ ok: true, updated_at: now });
});

app.get("/api/profiles/search", requireAuth, (req, res) => {
  const q = String(req.query.q ?? "")
    .trim()
    .toLowerCase();
  if (!q) return res.json([]);
  const rows = db
    .prepare(
      `SELECT id, email, display_name, handle, avatar_url, public_key, org_name, created_at
       FROM users WHERE email_verified = 1 AND id != ? AND (LOWER(handle) LIKE ? OR LOWER(display_name) LIKE ?)
       LIMIT 12`
    )
    .all(req.userId, `%${q}%`, `%${q}%`);
  res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      display_name: r.display_name,
      handle: r.handle,
      avatar_url: r.avatar_url ?? null,
      public_key: r.public_key ?? "",
      org_name: r.org_name ?? null,
      created_at: r.created_at,
    }))
  );
});

app.get("/api/admin/users", adminMiddleware(ADMIN_KEY), (_req, res) => {
  const rows = db
    .prepare("SELECT id, email, display_name, handle, email_verified, created_at FROM users ORDER BY created_at")
    .all();
  res.json(rows);
});

app.post("/api/admin/decrypt-vault", adminMiddleware(ADMIN_KEY), async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const norm = String(email ?? "")
      .trim()
      .toLowerCase();
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(norm);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

    const valid = await verifyPassword(String(password), user.password_salt, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Mot de passe incorrect." });

    const vault = db.prepare("SELECT data, iv FROM vaults WHERE user_id = ?").get(user.id);
    if (!vault) return res.status(404).json({ error: "Coffre absent." });

    if (!vault.iv) {
      return res.json({ plaintext: JSON.parse(vault.data) });
    }
    if (!user.vault_salt) {
      return res.status(400).json({ error: "Meta coffre absente." });
    }

    const plain = await decryptVaultPayload(String(password), { salt: user.vault_salt }, vault.data, vault.iv);
    res.json({ plaintext: JSON.parse(plain) });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Déchiffrement impossible (mot de passe ou données corrompues)." });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Talkeo API écoute sur 127.0.0.1:${PORT}`);
  console.log(`Base : ${DB_PATH}`);
});

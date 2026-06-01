#!/usr/bin/env node
/**
 * Outil administrateur Talkeo — déchiffre un coffre utilisateur stocké sur le VPS.
 *
 * Usage :
 *   node decrypt.mjs --db /opt/crypt/data/talkeo.db --email user@corp.fr --password "secret"
 *   node decrypt.mjs --db /opt/crypt/data/talkeo.db --list
 *   node decrypt.mjs --api https://votredomaine.fr --admin-key CLE --email user@corp.fr --password "secret"
 */
import Database from "better-sqlite3";
import { gcm } from "@noble/ciphers/aes.js";
import { argon2idAsync } from "@noble/hashes/argon2.js";
import fs from "node:fs";

const ARGON2 = { t: 3, m: 12288, p: 1, dkLen: 32 };

function parseArgs(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") o.list = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      o[key.replace(/-/g, "_")] = argv[++i];
    }
  }
  return o;
}

function b64ToU8(b64) {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function verifyPassword(password, saltB64, expectedHash) {
  const key = await argon2idAsync(new TextEncoder().encode(password), b64ToU8(saltB64), ARGON2);
  const hash = Buffer.from(key).toString("base64");
  return hash === expectedHash;
}

async function decryptVault(password, user, vault) {
  if (!vault.iv) {
    return JSON.parse(vault.data);
  }
  if (!user.vault_salt) throw new Error("Meta coffre (vault_salt) absente.");
  const master = await argon2idAsync(new TextEncoder().encode(password), b64ToU8(user.vault_salt), ARGON2);
  const aes = gcm(master, b64ToU8(vault.iv));
  const plain = aes.decrypt(b64ToU8(vault.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function fromDb(dbPath, email, password) {
  if (!fs.existsSync(dbPath)) throw new Error(`Base introuvable : ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });
  const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);
  if (!user) throw new Error("Utilisateur introuvable.");
  const valid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!valid) throw new Error("Mot de passe incorrect.");
  const vault = db.prepare("SELECT data, iv FROM vaults WHERE user_id = ?").get(user.id);
  if (!vault) throw new Error("Coffre absent.");
  return decryptVault(password, user, vault);
}

async function fromApi(apiUrl, adminKey, email, password) {
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/admin/decrypt-vault`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Talkeo-Admin": adminKey,
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.plaintext;
}

function listUsers(dbPath) {
  const db = new Database(dbPath, { readonly: true });
  const rows = db
    .prepare("SELECT email, display_name, handle, email_verified, created_at FROM users ORDER BY created_at")
    .all();
  console.table(rows);
}

const args = parseArgs(process.argv);

if (args.list) {
  if (!args.db) {
    console.error("Indiquez --db /opt/crypt/data/talkeo.db");
    process.exit(1);
  }
  listUsers(args.db);
  process.exit(0);
}

const email = args.email;
const password = args.password;
if (!email || !password) {
  console.log(`
Talkeo — déchiffrement coffre (administration)

  --list --db PATH              Lister les comptes
  --db PATH --email E --password P   Déchiffrer via SQLite locale
  --api URL --admin-key KEY --email E --password P   Via API (sans accès SSH au fichier .db)

Le mot de passe sert à vérifier le compte ET à dériver la clé AES du coffre (zero-knowledge).
`);
  process.exit(1);
}

try {
  let data;
  if (args.api && args.admin_key) {
    data = await fromApi(args.api, args.admin_key, email, password);
  } else if (args.db) {
    data = await fromDb(args.db, email, password);
  } else {
    throw new Error("Indiquez --db ou --api + --admin-key");
  }
  const out = args.out ?? "talkeo-export.json";
  fs.writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
  console.log(`Export déchiffré : ${out}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

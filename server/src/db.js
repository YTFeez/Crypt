import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./crypto.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  handle TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  vault_salt TEXT,
  vault_verifier TEXT,
  vault_kdf TEXT DEFAULT 'argon2id',
  vault_v INTEGER DEFAULT 4,
  org_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  public_key TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vaults (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_verifications (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
`;

function migrateColumns(db) {
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!cols.includes("phone")) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
  }
}

export function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  migrateColumns(db);
  return db;
}

export async function seedDemoUser(db) {
  const row = db
    .prepare("SELECT id, vault_salt FROM users WHERE email = ?")
    .get("demo@talkeo.app");

  const now = new Date().toISOString();
  const demoId = row?.id ?? crypto.randomUUID();

  if (!row) {
    /* Première installation : créer le compte démo complet */
    const cred = await hashPassword("demo1234");
    const vaultCred = await hashPassword("demo1234");

    db.prepare(
      `INSERT INTO users (id, email, password_hash, password_salt, display_name, handle,
       email_verified, vault_salt, vault_verifier, vault_kdf, vault_v, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'argon2id', 4, ?)`
    ).run(
      demoId,
      "demo@talkeo.app",
      cred.hash,
      cred.salt,
      "Alex Demo",
      "alex",
      vaultCred.salt,
      vaultCred.hash,
      now
    );

    const demoVault = JSON.stringify({
      profiles: [
        {
          id: demoId,
          email: "demo@talkeo.app",
          display_name: "Alex Demo",
          handle: "alex",
          avatar_url: null,
          public_key: "",
          org_name: "Talkeo",
          created_at: now,
        },
      ],
      friendships: [],
      conversations: [],
      conversation_members: [],
      messages: [],
      folders: [],
      folder_members: [],
      folder_items: [],
      boards: [],
      board_members: [],
      designs: [],
      design_members: [],
      calls: [],
    });

    db.prepare(
      `INSERT INTO vaults (user_id, data, iv, updated_at) VALUES (?, ?, '', ?)`
    ).run(demoId, demoVault, now);
  } else if (!row.vault_salt) {
    /* Migration : compte démo existant sans vault_salt → on lui en ajoute un */
    const vaultCred = await hashPassword("demo1234");
    db.prepare(
      `UPDATE users SET vault_salt=?, vault_verifier=?, vault_kdf='argon2id', vault_v=4 WHERE id=?`
    ).run(vaultCred.salt, vaultCred.hash, demoId);
    console.log("[Talkeo] Compte démo migré avec vault_salt.");
  }
}

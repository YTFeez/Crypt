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
  const row = db.prepare("SELECT id FROM users WHERE email = ?").get("demo@talkeo.app");
  if (row) return;

  const id = crypto.randomUUID();
  const cred = await hashPassword("demo1234");
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, email, password_hash, password_salt, display_name, handle, email_verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, "demo@talkeo.app", cred.hash, cred.salt, "Alex Demo", "alex", now);

  const emptyVault = JSON.stringify({
    profiles: [
      {
        id,
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

  db.prepare(`INSERT INTO vaults (user_id, data, iv, updated_at) VALUES (?, ?, '', ?)`).run(
    id,
    emptyVault,
    now
  );
}

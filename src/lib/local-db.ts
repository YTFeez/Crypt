import type {
  Profile,
  Friendship,
  Conversation,
  ConversationMember,
  Message,
  Folder,
  FolderItem,
  Board,
  Call,
} from "./types";
import { emitRealtime } from "./realtime";
import { hashPassword, verifyPassword, unlockVault, lockVault, clearVaultMeta, reencryptVaultIfNeeded } from "./crypto";
import { loadVault, patchVault, migrateLegacyStorage, invalidateVaultCache } from "./storage";

const SESSION_KEY = "crypt-session-v1";
const USERS_KEY = "crypt-users-v2";
const SEED_FLAG = "crypt-seeded-v3";

export type LocalUser = {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  display_name: string;
  handle: string;
};

export type Db = {
  profiles: Profile[];
  friendships: Friendship[];
  conversations: Conversation[];
  conversation_members: ConversationMember[];
  messages: Message[];
  folders: Folder[];
  folder_members: { folder_id: string; user_id: string; permission: string }[];
  folder_items: FolderItem[];
  boards: Board[];
  board_members: { board_id: string; user_id: string }[];
  calls: Call[];
};

function emptyDb(): Db {
  return {
    profiles: [],
    friendships: [],
    conversations: [],
    conversation_members: [],
    messages: [],
    folders: [],
    folder_members: [],
    folder_items: [],
    boards: [],
    board_members: [],
    calls: [],
  };
}

export function uid() {
  return crypto.randomUUID();
}

async function readDb(): Promise<Db> {
  const raw = await loadVault<Db>();
  return { ...emptyDb(), ...raw };
}

export function getLocalUsers(): LocalUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]") as LocalUser[];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: LocalUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function ensureLocalSeed(): Promise<void> {
  await migrateLegacyStorage();
  if (localStorage.getItem(SEED_FLAG)) return;

  const db = emptyDb();
  const demoId = uid();
  const marieId = uid();
  const now = new Date().toISOString();
  const demoCred = await hashPassword("demo1234");

  const demo: Profile = {
    id: demoId,
    email: "demo@crypt.app",
    display_name: "Alex Demo",
    handle: "alex",
    avatar_url: null,
    public_key: "",
    org_name: "Crypt",
    created_at: now,
  };
  const marie: Profile = {
    id: marieId,
    email: "marie@crypt.app",
    display_name: "Marie Martin",
    handle: "marie",
    avatar_url: null,
    public_key: "",
    org_name: "Crypt",
    created_at: now,
  };
  db.profiles.push(demo, marie);

  saveLocalUsers([
    {
      id: demoId,
      email: demo.email,
      passwordHash: demoCred.hash,
      passwordSalt: demoCred.salt,
      display_name: demo.display_name,
      handle: demo.handle,
    },
    {
      id: marieId,
      email: marie.email,
      passwordHash: demoCred.hash,
      passwordSalt: demoCred.salt,
      display_name: marie.display_name,
      handle: marie.handle,
    },
  ]);

  const convId = uid();
  db.conversations.push({
    id: convId,
    type: "dm",
    name: null,
    avatar_url: null,
    created_by: demoId,
    created_at: now,
  });
  db.conversation_members.push(
    { conversation_id: convId, user_id: demoId, role: "owner" },
    { conversation_id: convId, user_id: marieId, role: "member" }
  );
  db.friendships.push({
    id: uid(),
    requester_id: demoId,
    addressee_id: marieId,
    status: "accepted",
    created_at: now,
  });

  await patchVault((v) => Object.assign(v, db));
  localStorage.setItem(SEED_FLAG, "1");
}

export async function localRegister(
  email: string,
  password: string,
  displayName: string
): Promise<{ error: string | null; userId?: string }> {
  await ensureLocalSeed();
  const users = getLocalUsers();
  const norm = email.trim().toLowerCase();
  if (users.some((u) => u.email.toLowerCase() === norm)) {
    return { error: "Cet e-mail est déjà utilisé." };
  }

  const db = await readDb();
  const id = uid();
  let baseHandle = norm.split("@")[0].replace(/[^a-z0-9_]/g, "") || "user";
  let handle = baseHandle;
  let n = 0;
  while (db.profiles.some((p) => p.handle === handle)) {
    n++;
    handle = baseHandle + n;
  }

  const cred = await hashPassword(password);
  const profile: Profile = {
    id,
    email: norm,
    display_name: displayName.trim(),
    handle,
    avatar_url: null,
    public_key: "",
    org_name: null,
    created_at: new Date().toISOString(),
  };

  await patchVault((v) => {
    const d = { ...emptyDb(), ...v } as Db;
    d.profiles.push(profile);
    Object.assign(v, d);
  });

  users.push({
    id,
    email: norm,
    passwordHash: cred.hash,
    passwordSalt: cred.salt,
    display_name: displayName.trim(),
    handle,
  });
  saveLocalUsers(users);

  clearVaultMeta();
  const unlock = await unlockVault(password, { userId: id, create: true });
  if (!unlock.ok) return { error: unlock.error ?? "Impossible d'initialiser le chiffrement." };
  await reencryptVaultIfNeeded();

  localStorage.setItem(SESSION_KEY, id);
  return { error: null, userId: id };
}

async function legacyHash(password: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const u8 = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

export async function localLogin(
  email: string,
  password: string
): Promise<{ error: string | null; userId?: string }> {
  await ensureLocalSeed();
  const norm = email.trim().toLowerCase();
  const users = getLocalUsers();
  let user = users.find((u) => u.email.toLowerCase() === norm);
  if (!user) return { error: "E-mail ou mot de passe incorrect." };

  let valid = user.passwordSalt
    ? await verifyPassword(password, user.passwordSalt, user.passwordHash)
    : false;
  if (!valid && !user.passwordSalt) {
    valid = (await legacyHash(password)) === user.passwordHash;
    if (valid) {
      const cred = await hashPassword(password);
      user = { ...user, passwordHash: cred.hash, passwordSalt: cred.salt };
      saveLocalUsers(users.map((u) => (u.id === user!.id ? user! : u)));
    }
  }
  if (!valid) return { error: "E-mail ou mot de passe incorrect." };

  clearVaultMeta();
  invalidateVaultCache();
  const unlock = await unlockVault(password, { userId: user.id, create: true });
  if (!unlock.ok) return { error: unlock.error ?? "Erreur de déverrouillage du coffre." };
  await reencryptVaultIfNeeded();

  localStorage.setItem(SESSION_KEY, user.id);
  return { error: null, userId: user.id };
}

export function localLogout() {
  localStorage.removeItem(SESSION_KEY);
  lockVault();
  invalidateVaultCache();
}

export function getLocalSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export async function loadDb(): Promise<Db> {
  return readDb();
}

export async function patchDb(mutate: (db: Db) => void) {
  await patchVault((v) => {
    const db = { ...emptyDb(), ...v } as Db;
    mutate(db);
    Object.assign(v, db);
  });
}

export function attachProfiles(friendships: Friendship[], db: Db): Friendship[] {
  return friendships.map((f) => ({
    ...f,
    requester: db.profiles.find((p) => p.id === f.requester_id),
    addressee: db.profiles.find((p) => p.id === f.addressee_id),
  }));
}

export function notify(channel: string) {
  emitRealtime(channel);
}

/** Accès immédiat via compte démo */
export async function enterGuestSession(): Promise<{ error: string | null; userId?: string }> {
  return localLogin("demo@crypt.app", "demo1234");
}

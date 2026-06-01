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
import type { DesignDoc } from "./design/types";
import { emitRealtime } from "./realtime";
import {
  hashPassword,
  verifyPassword,
  unlockVault,
  lockVault,
  clearVaultMeta,
  sha256B64,
} from "./crypto";
import { randomUuid } from "./secure-random";
import {
  loadVault,
  patchVault,
  saveVault,
  migrateLegacyStorage,
  invalidateVaultCache,
} from "./storage";
import { upsertPublicProfile, listPublicProfiles } from "./profile-index";
import {
  createPendingVerification,
  generateVerificationCode,
  sendVerificationEmail,
} from "./email-verify";
import { isServerMode } from "./server-mode";
import { getApiToken } from "./server-api";
import * as srv from "./server-store";

const SESSION_KEY = "crypt-session-v1";
const USERS_KEY = "crypt-users-v2";
const SEED_FLAG = "crypt-seeded-v4";

export type LocalUser = {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  display_name: string;
  handle: string;
  /** Absent ou true = compte actif ; false = en attente de vérification e-mail */
  emailVerified?: boolean;
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
  designs: DesignDoc[];
  design_members: { design_id: string; user_id: string }[];
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
    designs: [],
    design_members: [],
    calls: [],
  };
}

export function uid() {
  return randomUuid();
}

export function getLocalSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function requireSessionId(): string {
  const id = getLocalSessionUserId();
  if (!id) throw new Error("Session requise");
  return id;
}

export async function readDb(userId?: string): Promise<Db> {
  const id = userId ?? requireSessionId();
  const raw = await loadVault<Db>(id);
  return { ...emptyDb(), ...raw };
}

export async function patchDb(mutate: (db: Db) => void, userId?: string) {
  const id = userId ?? requireSessionId();
  await patchVault(id, (v) => {
    const db = { ...emptyDb(), ...(v as Db) };
    mutate(db);
    Object.assign(v, db);
  });
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
  if (isServerMode()) {
    await srv.ensureServerReady();
    return;
  }
  await migrateLegacyStorage();
  if (localStorage.getItem(SEED_FLAG)) return;

  const db = emptyDb();
  const demoId = uid();
  const marieId = uid();
  const now = new Date().toISOString();
  const demoCred = await hashPassword("demo1234");

  const demo: Profile = {
    id: demoId,
    email: "demo@talkeo.app",
    display_name: "Alex Demo",
    handle: "alex",
    avatar_url: null,
    public_key: "",
    org_name: "Talkeo",
    created_at: now,
  };
  const marie: Profile = {
    id: marieId,
    email: "marie@talkeo.app",
    display_name: "Marie Martin",
    handle: "marie",
    avatar_url: null,
    public_key: "",
    org_name: "Talkeo",
    created_at: now,
  };
  db.profiles.push(demo, marie);
  upsertPublicProfile(demo);
  upsertPublicProfile(marie);

  saveLocalUsers([
    {
      id: demoId,
      email: demo.email,
      passwordHash: demoCred.hash,
      passwordSalt: demoCred.salt,
      display_name: demo.display_name,
      handle: demo.handle,
      emailVerified: true,
    },
    {
      id: marieId,
      email: marie.email,
      passwordHash: demoCred.hash,
      passwordSalt: demoCred.salt,
      display_name: marie.display_name,
      handle: marie.handle,
      emailVerified: true,
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

  await saveVault(demoId, db, true);
  localStorage.setItem(SEED_FLAG, "1");
}

function isEmailVerified(user: LocalUser): boolean {
  return user.emailVerified !== false;
}

export function isLocalUserEmailVerifiedById(userId: string): boolean {
  if (isServerMode()) {
    return getLocalSessionUserId() === userId && Boolean(getApiToken());
  }
  const user = getLocalUsers().find((u) => u.id === userId);
  if (!user) return false;
  return isEmailVerified(user);
}

export function isLocalUserEmailVerifiedByEmail(email: string): boolean {
  const norm = email.trim().toLowerCase();
  const user = getLocalUsers().find((u) => u.email.toLowerCase() === norm);
  if (!user) return false;
  return isEmailVerified(user);
}

export async function localRegister(
  email: string,
  password: string,
  displayName: string
): Promise<{ error: string | null; userId?: string; needsVerification?: boolean; devCode?: string }> {
  if (isServerMode()) return srv.serverRegister(email, password, displayName);
  try {
    await ensureLocalSeed();
    const users = getLocalUsers();
    const norm = email.trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === norm);
    if (existing) {
      if (!isEmailVerified(existing)) {
        const code = generateVerificationCode();
        createPendingVerification(norm, existing.id, code);
        const mail = await sendVerificationEmail(norm, code, existing.display_name);
        return {
          error: null,
          userId: existing.id,
          needsVerification: true,
          devCode: mail.devCode,
        };
      }
      return { error: "Cet e-mail est déjà utilisé." };
    }

    const id = uid();
    const allProfiles = listPublicProfiles();
    let baseHandle = norm.split("@")[0].replace(/[^a-z0-9_]/g, "") || "user";
    let handle = baseHandle;
    let n = 0;
    while (allProfiles.some((p) => p.handle === handle)) {
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

    upsertPublicProfile(profile);
    users.push({
      id,
      email: norm,
      passwordHash: cred.hash,
      passwordSalt: cred.salt,
      display_name: displayName.trim(),
      handle,
      emailVerified: false,
    });
    saveLocalUsers(users);

    const code = generateVerificationCode();
    createPendingVerification(norm, id, code);
    const mail = await sendVerificationEmail(norm, code, displayName.trim());

    return {
      error: null,
      userId: id,
      needsVerification: true,
      devCode: mail.devCode,
    };
  } catch (e) {
    console.error("[Talkeo] inscription", e);
    return {
      error: e instanceof Error ? e.message : "Erreur lors de l'inscription. Réessayez.",
    };
  }
}

function legacyHash(password: string): string {
  return sha256B64(password);
}

export async function localLogin(
  email: string,
  password: string
): Promise<{ error: string | null; userId?: string }> {
  if (isServerMode()) return srv.serverLogin(email, password);
  try {
    await ensureLocalSeed();
    const norm = email.trim().toLowerCase();
    const users = getLocalUsers();
    let user = users.find((u) => u.email.toLowerCase() === norm);
    if (!user) return { error: "E-mail ou mot de passe incorrect." };

    let valid = user.passwordSalt
      ? await verifyPassword(password, user.passwordSalt, user.passwordHash)
      : false;
    if (!valid && !user.passwordSalt) {
      valid = legacyHash(password) === user.passwordHash;
      if (valid) {
        const cred = await hashPassword(password);
        user = { ...user, passwordHash: cred.hash, passwordSalt: cred.salt };
        saveLocalUsers(users.map((u) => (u.id === user!.id ? user! : u)));
      }
    }
    if (!valid) return { error: "E-mail ou mot de passe incorrect." };

    if (!isEmailVerified(user)) {
      return {
        error: "E-mail non vérifié. Consultez votre boîte mail ou saisissez le code reçu.",
      };
    }

    clearVaultMeta();
    invalidateVaultCache();

    const unlock = await unlockVault(password, { userId: user.id });
    if (!unlock.ok) {
      const created = await unlockVault(password, { userId: user.id, create: true });
      if (!created.ok) return { error: created.error ?? "Erreur de déverrouillage." };
    }

    const existing = await loadVault<Db>(user.id);
    if (!existing.profiles?.length) {
      const pub = listPublicProfiles().find((p) => p.id === user!.id);
      if (pub) await saveVault(user.id, { ...emptyDb(), profiles: [pub] });
    }

    localStorage.setItem(SESSION_KEY, user.id);
    return { error: null, userId: user.id };
  } catch (e) {
    console.error("[Talkeo] connexion", e);
    return { error: e instanceof Error ? e.message : "Erreur de connexion." };
  }
}

export function localLogout() {
  if (isServerMode()) {
    srv.clearServerSession();
    return;
  }
  const id = getLocalSessionUserId();
  localStorage.removeItem(SESSION_KEY);
  lockVault();
  if (id) invalidateVaultCache(id);
}

export async function loadDb(): Promise<Db> {
  return readDb();
}

export function attachProfiles(friendships: Friendship[], db: Db): Friendship[] {
  const directory = new Map(listPublicProfiles().map((p) => [p.id, p]));
  return friendships.map((f) => ({
    ...f,
    requester: directory.get(f.requester_id) ?? db.profiles.find((p) => p.id === f.requester_id),
    addressee: directory.get(f.addressee_id) ?? db.profiles.find((p) => p.id === f.addressee_id),
  }));
}

export function notify(channel: string) {
  emitRealtime(channel);
}

export async function completeLocalEmailVerification(
  userId: string,
  password: string
): Promise<{ error: string | null }> {
  if (isServerMode()) return srv.serverCompleteVerification(userId, password);
  const users = getLocalUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return { error: "Compte introuvable." };

  const user = users[idx]!;
  if (isEmailVerified(user)) return { error: null };

  clearVaultMeta();
  invalidateVaultCache();

  const unlock = await unlockVault(password, { userId, create: true });
  if (!unlock.ok) {
    return { error: unlock.error ?? "Impossible d'initialiser le chiffrement." };
  }

  const profile = listPublicProfiles().find((p) => p.id === userId);
  if (profile) {
    await saveVault(userId, { ...emptyDb(), profiles: [profile] });
  }

  users[idx] = { ...user, emailVerified: true };
  saveLocalUsers(users);
  localStorage.setItem(SESSION_KEY, userId);
  return { error: null };
}

export function markLocalEmailVerifiedByEmail(email: string): boolean {
  const norm = email.trim().toLowerCase();
  const users = getLocalUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === norm);
  if (idx < 0) return false;
  if (isEmailVerified(users[idx]!)) return true;
  users[idx] = { ...users[idx]!, emailVerified: true };
  saveLocalUsers(users);
  return true;
}

/** Déconnecte et invalide la session si l'e-mail n'est pas vérifié */
export function enforceVerifiedSession(): { ok: true } | { ok: false; email: string } {
  if (isServerMode()) {
    const r = srv.enforceServerVerifiedSession();
    if (!r.ok) return { ok: false, email: "" };
    return { ok: true };
  }
  const id = getLocalSessionUserId();
  if (!id) return { ok: true };
  if (isLocalUserEmailVerifiedById(id)) return { ok: true };
  const user = getLocalUsers().find((u) => u.id === id);
  const email = user?.email ?? "";
  localLogout();
  return { ok: false, email };
}

export async function resendLocalVerificationCode(
  email: string
): Promise<{ error: string | null; devCode?: string }> {
  if (isServerMode()) return srv.serverResendCode(email);
  const norm = email.trim().toLowerCase();
  const user = getLocalUsers().find((u) => u.email.toLowerCase() === norm);
  if (!user) return { error: "Aucun compte pour cet e-mail." };
  if (isEmailVerified(user)) return { error: "Cet e-mail est déjà vérifié. Connectez-vous." };

  const code = generateVerificationCode();
  createPendingVerification(norm, user.id, code);
  const mail = await sendVerificationEmail(norm, code, user.display_name);
  return { error: null, devCode: mail.devCode };
}

export async function enterGuestSession(): Promise<{ error: string | null; userId?: string }> {
  if (isServerMode()) return srv.serverLogin("demo@talkeo.app", "demo1234");
  let res = await localLogin("demo@talkeo.app", "demo1234");
  if (res.error) res = await localLogin("demo@crypt.app", "demo1234");
  return res;
}

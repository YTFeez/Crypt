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

const DB_KEY = "crypt-db-v1";
const SESSION_KEY = "crypt-session-v1";
const USERS_KEY = "crypt-users-v1";
const SEED_FLAG = "crypt-seeded-v2";

export type LocalUser = {
  id: string;
  email: string;
  passwordHash: string;
  display_name: string;
  handle: string;
};

type Db = {
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
  fileBlobs: Record<string, string>;
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
    fileBlobs: {},
  };
}

export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDb();
    return { ...emptyDb(), ...JSON.parse(raw) };
  } catch {
    return emptyDb();
  }
}

export function saveDb(db: Db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function uid() {
  return crypto.randomUUID();
}

export async function ensureLocalSeed(): Promise<void> {
  if (localStorage.getItem(SEED_FLAG)) return;

  const db = emptyDb();
  const demoId = uid();
  const marieId = uid();
  const now = new Date().toISOString();
  const demoHash = await hashPassword("demo1234");

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
    { id: demoId, email: demo.email, passwordHash: demoHash, display_name: demo.display_name, handle: demo.handle },
    { id: marieId, email: marie.email, passwordHash: demoHash, display_name: marie.display_name, handle: marie.handle },
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
  db.messages.push({
    id: uid(),
    conversation_id: convId,
    sender_id: marieId,
    kind: "text",
    ciphertext: "Bienvenue sur Crypt ! Connectez-vous avec demo@crypt.app / demo1234",
    iv: "",
    meta: {},
    created_at: now,
  });

  saveDb(db);
  localStorage.setItem(SEED_FLAG, "1");
}

export function getLocalUsers(): LocalUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]") as LocalUser[];
  } catch {
    return [];
  }
}

export function saveLocalUsers(users: LocalUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function localRegister(
  email: string,
  password: string,
  displayName: string
): Promise<{ error: string | null; userId?: string }> {
  await ensureLocalSeed();
  const users = getLocalUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { error: "Cet e-mail est déjà utilisé." };
  }
  const db = loadDb();
  const id = uid();
  let baseHandle = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") || "user";
  let handle = baseHandle;
  let n = 0;
  while (db.profiles.some((p) => p.handle === handle)) {
    n++;
    handle = baseHandle + n;
  }
  const profile: Profile = {
    id,
    email,
    display_name: displayName,
    handle,
    avatar_url: null,
    public_key: "",
    org_name: null,
    created_at: new Date().toISOString(),
  };
  db.profiles.push(profile);
  saveDb(db);
  users.push({
    id,
    email,
    passwordHash: await hashPassword(password),
    display_name: displayName,
    handle,
  });
  saveLocalUsers(users);
  return { error: null, userId: id };
}

export async function localLogin(
  email: string,
  password: string
): Promise<{ error: string | null; userId?: string }> {
  await ensureLocalSeed();
  const hash = await hashPassword(password);
  const user = getLocalUsers().find((u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash);
  if (!user) return { error: "E-mail ou mot de passe incorrect." };
  localStorage.setItem(SESSION_KEY, user.id);
  return { error: null, userId: user.id };
}

export function localLogout() {
  localStorage.removeItem(SESSION_KEY);
}

export function getLocalSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function attachProfiles(friendships: Friendship[], db: Db): Friendship[] {
  return friendships.map((f) => ({
    ...f,
    requester: db.profiles.find((p) => p.id === f.requester_id),
    addressee: db.profiles.find((p) => p.id === f.addressee_id),
  }));
}

export function patchDb(mutate: (db: Db) => void) {
  const db = loadDb();
  mutate(db);
  saveDb(db);
}

export function notify(channel: string) {
  emitRealtime(channel);
}

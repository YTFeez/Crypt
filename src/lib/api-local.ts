import { encryptText, decryptText } from "./crypto";
import { loadDb, patchDb, notify, attachProfiles, uid, type Db } from "./local-db";
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

const MAX_MESSAGES = 150;

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const db = await loadDb();
  return db.profiles.find((p) => p.id === userId) ?? null;
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  await patchDb((db) => {
    const i = db.profiles.findIndex((p) => p.id === userId);
    if (i >= 0) db.profiles[i] = { ...db.profiles[i], ...patch };
  });
  return { error: null };
}

export async function searchProfiles(query: string, excludeId: string): Promise<Profile[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const db = await loadDb();
  return db.profiles
    .filter(
      (p) =>
        p.id !== excludeId &&
        (p.handle.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q))
    )
    .slice(0, 12);
}

export async function getFriendships(userId: string): Promise<Friendship[]> {
  const db = await loadDb();
  const list = db.friendships.filter((f) => f.requester_id === userId || f.addressee_id === userId);
  return attachProfiles(list, db);
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  const db = await loadDb();
  const exists = db.friendships.some(
    (f) =>
      (f.requester_id === requesterId && f.addressee_id === addresseeId) ||
      (f.requester_id === addresseeId && f.addressee_id === requesterId)
  );
  if (exists) return { error: { message: "Demande déjà envoyée." } };
  await patchDb((d) => {
    d.friendships.unshift({
      id: uid(),
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: "pending",
      created_at: new Date().toISOString(),
    });
  });
  notify("friends");
  return { error: null };
}

export async function respondFriendship(id: string, status: "accepted" | "blocked") {
  await patchDb((db) => {
    const f = db.friendships.find((x) => x.id === id);
    if (f) f.status = status;
  });
  notify("friends");
  return { error: null };
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const db = await loadDb();
  const ids = new Set(
    db.conversation_members.filter((m) => m.user_id === userId).map((m) => m.conversation_id)
  );
  return db.conversations
    .filter((c) => ids.has(c.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getConversationMembers(conversationId: string): Promise<ConversationMember[]> {
  const db = await loadDb();
  return db.conversation_members
    .filter((m) => m.conversation_id === conversationId)
    .map((m) => ({ ...m, profile: db.profiles.find((p) => p.id === m.user_id) }));
}

export async function createDm(userId: string, friendId: string): Promise<string | null> {
  const db = await loadDb();
  for (const m of db.conversation_members.filter((x) => x.user_id === userId)) {
    const conv = db.conversations.find((c) => c.id === m.conversation_id && c.type === "dm");
    if (!conv) continue;
    const members = db.conversation_members
      .filter((x) => x.conversation_id === conv.id)
      .map((x) => x.user_id);
    if (members.length === 2 && members.includes(friendId)) return conv.id;
  }
  const convId = uid();
  await patchDb((d) => {
    d.conversations.push({
      id: convId,
      type: "dm",
      name: null,
      avatar_url: null,
      created_by: userId,
      created_at: new Date().toISOString(),
    });
    d.conversation_members.push(
      { conversation_id: convId, user_id: userId, role: "owner" },
      { conversation_id: convId, user_id: friendId, role: "member" }
    );
  });
  notify("conversations");
  return convId;
}

export async function createGroup(userId: string, name: string, memberIds: string[]): Promise<string | null> {
  const convId = uid();
  await patchDb((d) => {
    d.conversations.push({
      id: convId,
      type: "group",
      name,
      avatar_url: null,
      created_by: userId,
      created_at: new Date().toISOString(),
    });
    d.conversation_members.push({ conversation_id: convId, user_id: userId, role: "owner" });
    for (const id of memberIds) {
      d.conversation_members.push({ conversation_id: convId, user_id: id, role: "member" });
    }
  });
  notify("conversations");
  return convId;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const db = await loadDb();
  const msgs = db.messages
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-MAX_MESSAGES);
  const out: Message[] = [];
  for (const m of msgs) {
    out.push({
      ...m,
      sender: db.profiles.find((p) => p.id === m.sender_id),
      plain: await decryptText(m.ciphertext, m.iv),
    });
  }
  return out;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  plain: string,
  kind: Message["kind"] = "text",
  meta: Record<string, unknown> = {}
) {
  const { ciphertext, iv } = await encryptText(plain);
  const msg: Message = {
    id: uid(),
    conversation_id: conversationId,
    sender_id: senderId,
    kind,
    ciphertext,
    iv,
    meta,
    created_at: new Date().toISOString(),
  };
  await patchDb((db) => {
    db.messages.push(msg);
    if (db.messages.length > 5000) db.messages = db.messages.slice(-4000);
  });
  notify(`messages:${conversationId}`);
  return { error: null };
}

export async function uploadFile(
  userId: string,
  file: File,
  _bucket: "attachments" | "voice"
): Promise<{ path: string } | null> {
  const path = `${userId}/${uid()}`;
  const { ciphertext, iv } = await encryptText(
    JSON.stringify({
      name: file.name,
      mime: file.type,
      size: file.size,
      // Fichiers petits uniquement — limite mémoire ~512 Ko
      data:
        file.size <= 512_000
          ? await file.arrayBuffer().then((b) => {
              const u8 = new Uint8Array(b);
              let s = "";
              for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
              return btoa(s);
            })
          : null,
    })
  );
  await patchDb((db) => {
    const d = db as Db & { fileVault?: Record<string, { ciphertext: string; iv: string }> };
    if (!d.fileVault) d.fileVault = {};
    d.fileVault[path] = { ciphertext, iv };
  });
  return { path };
}

export async function getFolders(userId: string): Promise<Folder[]> {
  const db = await loadDb();
  const sharedIds = db.folder_members.filter((m) => m.user_id === userId).map((m) => m.folder_id);
  const map = new Map<string, Folder>();
  db.folders.filter((f) => f.owner_id === userId || sharedIds.includes(f.id)).forEach((f) => map.set(f.id, f));
  return [...map.values()];
}

export async function createFolder(userId: string, name: string, parentId: string | null, isShared: boolean) {
  const folder: Folder = {
    id: uid(),
    owner_id: userId,
    parent_id: parentId,
    name,
    is_shared: isShared,
    created_at: new Date().toISOString(),
  };
  await patchDb((db) => db.folders.push(folder));
  notify("folders");
  return { data: folder, error: null };
}

export async function getFolderItems(folderId: string): Promise<FolderItem[]> {
  const db = await loadDb();
  return db.folder_items.filter((i) => i.folder_id === folderId);
}

export async function addFolderItem(folderId: string, file: File, userId: string) {
  const up = await uploadFile(userId, file, "attachments");
  if (!up) return null;
  const item: FolderItem = {
    id: uid(),
    folder_id: folderId,
    name: file.name,
    storage_path: up.path,
    mime: file.type,
    size_bytes: file.size,
    created_at: new Date().toISOString(),
  };
  await patchDb((db) => db.folder_items.push(item));
  notify("folders");
  return { error: null };
}

export async function shareFolder(folderId: string, userId: string, permission: "read" | "write" = "read") {
  await patchDb((db) => {
    const i = db.folder_members.findIndex((m) => m.folder_id === folderId && m.user_id === userId);
    const row = { folder_id: folderId, user_id: userId, permission };
    if (i >= 0) db.folder_members[i] = row;
    else db.folder_members.push(row);
  });
  notify("folders");
  return { error: null };
}

export async function getBoards(userId: string): Promise<Board[]> {
  const db = await loadDb();
  const shared = new Set(db.board_members.filter((m) => m.user_id === userId).map((m) => m.board_id));
  return db.boards
    .filter((b) => b.owner_id === userId || shared.has(b.id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function createBoard(userId: string, name: string, conversationId?: string) {
  const board: Board = {
    id: uid(),
    owner_id: userId,
    conversation_id: conversationId ?? null,
    name,
    strokes: [],
    is_shared: Boolean(conversationId),
    updated_at: new Date().toISOString(),
  };
  await patchDb((db) => db.boards.unshift(board));
  notify("boards");
  return { data: board, error: null };
}

export async function saveBoardStrokes(boardId: string, strokes: Board["strokes"]) {
  await patchDb((db) => {
    const b = db.boards.find((x) => x.id === boardId);
    if (b) {
      b.strokes = strokes.length > 800 ? strokes.slice(-800) : strokes;
      b.updated_at = new Date().toISOString();
    }
  });
  notify(`board:${boardId}`);
  return { error: null };
}

export async function getActiveCalls(userId: string): Promise<Call[]> {
  const db = await loadDb();
  const convIds = new Set(
    db.conversation_members.filter((m) => m.user_id === userId).map((m) => m.conversation_id)
  );
  return db.calls
    .filter((c) => convIds.has(c.conversation_id) && (c.status === "ringing" || c.status === "active"))
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export async function startCall(conversationId: string, userId: string, kind: Call["kind"]) {
  const call: Call = {
    id: uid(),
    conversation_id: conversationId,
    started_by: userId,
    kind,
    status: "ringing",
    room_token: crypto.randomUUID(),
    started_at: new Date().toISOString(),
    ended_at: null,
  };
  await patchDb((db) => db.calls.unshift(call));
  notify("calls");
  return { data: call, error: null };
}

export async function endCall(callId: string) {
  await patchDb((db) => {
    const c = db.calls.find((x) => x.id === callId);
    if (c) {
      c.status = "ended";
      c.ended_at = new Date().toISOString();
    }
  });
  notify("calls");
  return { error: null };
}

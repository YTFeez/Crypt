import { supabase } from "./supabase";
import { encryptText, decryptText } from "./crypto";
import { randomUuid } from "./secure-random";
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

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data as Profile;
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  return supabase.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", userId);
}

export async function searchProfiles(query: string, excludeId: string): Promise<Profile[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", excludeId)
    .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(12);
  return (data ?? []) as Profile[];
}

export async function getFriendships(userId: string): Promise<Friendship[]> {
  const { data } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Friendship[];
  const ids = [...new Set(rows.flatMap((f) => [f.requester_id, f.addressee_id]))];
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
  const map = new Map((profiles ?? []).map((p) => [(p as Profile).id, p as Profile]));
  return rows.map((f) => ({
    ...f,
    requester: map.get(f.requester_id),
    addressee: map.get(f.addressee_id),
  }));
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  return supabase.from("friendships").insert({ requester_id: requesterId, addressee_id: addresseeId });
}

export async function respondFriendship(id: string, status: "accepted" | "blocked") {
  return supabase.from("friendships").update({ status }).eq("id", id);
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  const ids = (memberships ?? []).map((m) => m.conversation_id);
  if (!ids.length) return [];
  const { data } = await supabase.from("conversations").select("*").in("id", ids).order("created_at", { ascending: false });
  return (data ?? []) as Conversation[];
}

export async function getConversationMembers(conversationId: string): Promise<ConversationMember[]> {
  const { data: members } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("conversation_id", conversationId);
  const rows = (members ?? []) as ConversationMember[];
  const userIds = rows.map((m) => m.user_id);
  if (!userIds.length) return rows;
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
  const map = new Map((profiles ?? []).map((p) => [(p as Profile).id, p as Profile]));
  return rows.map((m) => ({ ...m, profile: map.get(m.user_id) }));
}

export async function createDm(userId: string, friendId: string): Promise<string | null> {
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  for (const m of memberships ?? []) {
    const { data: conv } = await supabase.from("conversations").select("type").eq("id", m.conversation_id).single();
    if (conv?.type !== "dm") continue;
    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", m.conversation_id);
    const ids = (members ?? []).map((x) => x.user_id).sort();
    if (ids.length === 2 && ids.includes(friendId)) return m.conversation_id;
  }

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ type: "dm", created_by: userId })
    .select("id")
    .single();
  if (error || !conv) return null;
  await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: userId, role: "owner" },
    { conversation_id: conv.id, user_id: friendId, role: "member" },
  ]);
  return conv.id;
}

export async function createGroup(userId: string, name: string, memberIds: string[]): Promise<string | null> {
  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ type: "group", name, created_by: userId })
    .select("id")
    .single();
  if (error || !conv) return null;
  await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: userId, role: "owner" },
    ...memberIds.map((id) => ({ conversation_id: conv.id, user_id: id, role: "member" })),
  ]);
  return conv.id;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  const msgs = (data ?? []) as Message[];
  const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", senderIds);
  const map = new Map((profiles ?? []).map((p) => [(p as Profile).id, p as Profile]));
  return Promise.all(
    msgs.map(async (m) => ({
      ...m,
      sender: map.get(m.sender_id),
      plain: await decryptText(m.ciphertext, m.iv),
    }))
  );
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  plain: string,
  kind: Message["kind"] = "text",
  meta: Record<string, unknown> = {}
) {
  const { ciphertext, iv } = await encryptText(plain);
  return supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    kind,
    ciphertext,
    iv,
    meta,
  });
}

export async function uploadFile(
  userId: string,
  file: File,
  bucket: "attachments" | "voice"
): Promise<{ path: string } | null> {
  const path = `${userId}/${randomUuid()}-${file.name}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) return null;
  return { path };
}

export async function getFolders(userId: string): Promise<Folder[]> {
  const { data: owned } = await supabase.from("folders").select("*").eq("owner_id", userId);
  const { data: shared } = await supabase.from("folder_members").select("folder_id").eq("user_id", userId);
  const sharedIds = (shared ?? []).map((s) => s.folder_id);
  let sharedFolders: Folder[] = [];
  if (sharedIds.length) {
    const { data } = await supabase.from("folders").select("*").in("id", sharedIds);
    sharedFolders = (data ?? []) as Folder[];
  }
  const map = new Map<string, Folder>();
  [...(owned ?? []), ...sharedFolders].forEach((f) => map.set((f as Folder).id, f as Folder));
  return [...map.values()];
}

export async function createFolder(userId: string, name: string, parentId: string | null, isShared: boolean) {
  return supabase.from("folders").insert({ owner_id: userId, name, parent_id: parentId, is_shared: isShared }).select().single();
}

export async function getFolderItems(folderId: string): Promise<FolderItem[]> {
  const { data } = await supabase.from("folder_items").select("*").eq("folder_id", folderId).order("created_at");
  return (data ?? []) as FolderItem[];
}

export async function addFolderItem(folderId: string, file: File, userId: string) {
  const up = await uploadFile(userId, file, "attachments");
  if (!up) return null;
  return supabase.from("folder_items").insert({
    folder_id: folderId,
    name: file.name,
    storage_path: up.path,
    mime: file.type,
    size_bytes: file.size,
    uploaded_by: userId,
  });
}

export async function shareFolder(folderId: string, userId: string, permission: "read" | "write" = "read") {
  return supabase.from("folder_members").upsert({ folder_id: folderId, user_id: userId, permission });
}

export async function getBoards(userId: string): Promise<Board[]> {
  const { data: memberRows } = await supabase.from("board_members").select("board_id").eq("user_id", userId);
  const memberIds = (memberRows ?? []).map((r) => r.board_id);
  let q = supabase.from("boards").select("*").eq("owner_id", userId);
  const { data: owned } = await q.order("updated_at", { ascending: false });
  let shared: Board[] = [];
  if (memberIds.length) {
    const { data } = await supabase.from("boards").select("*").in("id", memberIds);
    shared = (data ?? []) as Board[];
  }
  const map = new Map<string, Board>();
  [...(owned ?? []), ...shared].forEach((b) => map.set((b as Board).id, b as Board));
  return [...map.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function createBoard(userId: string, name: string, conversationId?: string) {
  return supabase
    .from("boards")
    .insert({ owner_id: userId, name, conversation_id: conversationId ?? null, is_shared: Boolean(conversationId) })
    .select()
    .single();
}

export async function saveBoardStrokes(boardId: string, strokes: Board["strokes"]) {
  return supabase.from("boards").update({ strokes, updated_at: new Date().toISOString() }).eq("id", boardId);
}

export async function getActiveCalls(userId: string): Promise<Call[]> {
  const { data: memberships } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", userId);
  const ids = (memberships ?? []).map((m) => m.conversation_id);
  if (!ids.length) return [];
  const { data } = await supabase
    .from("calls")
    .select("*")
    .in("conversation_id", ids)
    .in("status", ["ringing", "active"])
    .order("started_at", { ascending: false });
  return (data ?? []) as Call[];
}

export async function startCall(conversationId: string, userId: string, kind: Call["kind"]) {
  const roomToken = randomUuid();
  return supabase
    .from("calls")
    .insert({ conversation_id: conversationId, started_by: userId, kind, status: "ringing", room_token: roomToken })
    .select()
    .single();
}

export async function endCall(callId: string) {
  return supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callId);
}

import { supabase } from "./supabase";
import { encryptText, decryptText } from "./crypto";
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
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data as Profile | null;
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
    .select("*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  return (data ?? []) as Friendship[];
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  return supabase.from("friendships").insert({ requester_id: requesterId, addressee_id: addresseeId });
}

export async function respondFriendship(id: string, status: "accepted" | "blocked") {
  return supabase.from("friendships").update({ status }).eq("id", id);
}

export async function getConversations(userId: string): Promise<(Conversation & { members?: ConversationMember[] })[]> {
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
  const { data } = await supabase
    .from("conversation_members")
    .select("*, profile:profiles(*)")
    .eq("conversation_id", conversationId);
  return (data ?? []) as ConversationMember[];
}

export async function createDm(userId: string, friendId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("conversation_members")
    .select("conversation_id, conversations!inner(type)")
    .eq("user_id", userId);
  for (const row of existing ?? []) {
    const conv = row as unknown as { conversation_id: string; conversations: { type: string } | { type: string }[] };
    const convType = Array.isArray(conv.conversations) ? conv.conversations[0]?.type : conv.conversations?.type;
    if (convType !== "dm") continue;
    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conv.conversation_id);
    const ids = (members ?? []).map((m) => m.user_id).sort();
    if (ids.length === 2 && ids.includes(friendId)) return conv.conversation_id;
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
  const rows = [{ conversation_id: conv.id, user_id: userId, role: "owner" }, ...memberIds.map((id) => ({
    conversation_id: conv.id,
    user_id: id,
    role: "member",
  }))];
  await supabase.from("conversation_members").insert(rows);
  return conv.id;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data } = await supabase
    .from("messages")
    .select("*, sender:profiles(*)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  const msgs = (data ?? []) as Message[];
  return Promise.all(
    msgs.map(async (m) => ({
      ...m,
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
  const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) return null;
  return { path };
}

export async function getFolders(userId: string): Promise<Folder[]> {
  const { data: owned } = await supabase.from("folders").select("*").eq("owner_id", userId);
  const { data: shared } = await supabase
    .from("folder_members")
    .select("folder:folders(*)")
    .eq("user_id", userId);
  const sharedFolders = (shared ?? [])
    .map((s) => {
      const row = s as { folder: Folder | Folder[] };
      return Array.isArray(row.folder) ? row.folder[0] : row.folder;
    })
    .filter((f): f is Folder => Boolean(f));
  const map = new Map<string, Folder>();
  [...(owned ?? []), ...sharedFolders].forEach((f) => map.set(f.id, f));
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
  const { data } = await supabase
    .from("boards")
    .select("*")
    .or(`owner_id.eq.${userId},id.in.(${await boardMemberIds(userId)})`)
    .order("updated_at", { ascending: false });
  return (data ?? []) as Board[];
}

async function boardMemberIds(userId: string): Promise<string> {
  const { data } = await supabase.from("board_members").select("board_id").eq("user_id", userId);
  const ids = (data ?? []).map((b) => b.board_id);
  return ids.length ? ids.join(",") : "00000000-0000-0000-0000-000000000000";
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
  const roomToken = crypto.randomUUID();
  return supabase
    .from("calls")
    .insert({ conversation_id: conversationId, started_by: userId, kind, status: "ringing", room_token: roomToken })
    .select()
    .single();
}

export async function endCall(callId: string) {
  return supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callId);
}

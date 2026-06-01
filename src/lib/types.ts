export type Profile = {
  id: string;
  email: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  public_key: string;
  org_name: string | null;
  created_at: string;
};

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  requester?: Profile;
  addressee?: Profile;
};

export type ConversationType = "dm" | "group";

export type Conversation = {
  id: string;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
};

export type ConversationMember = {
  conversation_id: string;
  user_id: string;
  role: string;
  profile?: Profile;
};

export type MessageKind = "text" | "voice" | "file" | "system";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: MessageKind;
  ciphertext: string;
  iv: string;
  meta: Record<string, unknown>;
  created_at: string;
  sender?: Profile;
  plain?: string;
};

export type Folder = {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  is_shared: boolean;
  created_at: string;
};

export type FolderItem = {
  id: string;
  folder_id: string;
  name: string;
  storage_path: string;
  mime: string | null;
  size_bytes: number;
  created_at: string;
  archived_at?: string | null;
};

export type Board = {
  id: string;
  owner_id: string;
  conversation_id: string | null;
  name: string;
  strokes: Stroke[];
  is_shared: boolean;
  updated_at: string;
};

export type Stroke = {
  points: number[];
  color: string;
  width: number;
  mode: "draw" | "erase";
};

export type Call = {
  id: string;
  conversation_id: string;
  started_by: string;
  kind: "audio" | "video";
  status: "ringing" | "active" | "ended";
  room_token: string | null;
  started_at: string;
  ended_at: string | null;
};

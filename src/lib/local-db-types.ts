import type { DesignDoc } from "./design/types";
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

export function emptyDbShape(): Db {
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

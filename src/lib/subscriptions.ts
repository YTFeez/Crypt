import { isCloudMode, supabase } from "./supabase";
import { subscribeRealtime } from "./realtime";

export function subscribeMessages(conversationId: string, onUpdate: () => void): () => void {
  if (!conversationId) return () => undefined;
  if (isCloudMode()) {
    const channel = supabase
      .channel(`msgs-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        onUpdate
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }
  return subscribeRealtime(`messages:${conversationId}`, onUpdate);
}

export function subscribeBoard(boardId: string, onUpdate: () => void): () => void {
  if (!boardId) return () => undefined;
  if (isCloudMode()) {
    const channel = supabase
      .channel(`board-${boardId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "boards", filter: `id=eq.${boardId}` },
        onUpdate
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }
  return subscribeRealtime(`board:${boardId}`, onUpdate);
}

export function subscribeDesign(designId: string, onUpdate: () => void): () => void {
  if (!designId) return () => undefined;
  if (isCloudMode()) {
    const channel = supabase
      .channel(`design-${designId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "designs", filter: `id=eq.${designId}` },
        onUpdate
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }
  return subscribeRealtime(`design:${designId}`, onUpdate);
}

export function subscribeCalls(onUpdate: () => void): () => void {
  if (isCloudMode()) {
    const channel = supabase
      .channel("calls-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, onUpdate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }
  return subscribeRealtime("calls", onUpdate);
}

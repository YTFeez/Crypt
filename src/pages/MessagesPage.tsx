import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  getConversations,
  getConversationMembers,
  getMessages,
  sendMessage,
  uploadFile,
} from "../lib/api";
import { subscribeMessages } from "../lib/subscriptions";
import type { Conversation, Message } from "../lib/types";
import { IconLock } from "../components/Icons";

export function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const list = await getConversations(user.id);
    setConversations(list);
    const lbl: Record<string, string> = {};
    for (const c of list) {
      if (c.type === "group") {
        lbl[c.id] = c.name ?? "Groupe";
      } else {
        const members = await getConversationMembers(c.id);
        const other = members.find((m) => m.user_id !== user.id);
        lbl[c.id] = other?.profile?.display_name ?? other?.profile?.handle ?? "Conversation";
      }
    }
    setLabels(lbl);
    if (!activeId && list[0]) setActiveId(list[0].id);
  }, [user, activeId]);

  const loadMessages = useCallback(async () => {
    if (!activeId) return;
    setMessages(await getMessages(activeId));
  }, [activeId]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!activeId) return;
    return subscribeMessages(activeId, () => void loadMessages());
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!user || !activeId || !text.trim()) return;
    await sendMessage(activeId, user.id, text.trim());
    setText("");
    await loadMessages();
  }

  async function onFile(kind: "file" | "voice", file: File) {
    if (!user || !activeId) return;
    const bucket = kind === "voice" ? "voice" : "attachments";
    const up = await uploadFile(user.id, file, bucket);
    if (!up) return;
    const label = kind === "voice" ? `Message vocal : ${file.name}` : `Fichier : ${file.name}`;
    await sendMessage(activeId, user.id, label, kind, { path: up.path, mime: file.type, size: file.size });
    await loadMessages();
  }

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="page-inner" style={{ paddingTop: 0, maxWidth: "100%" }}>
      <div className="split-messenger">
        <aside className="conv-sidebar">
          <div className="conv-sidebar-header">Discussions</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0.35rem" }}>
            {conversations.length === 0 ? (
              <div className="empty-state" style={{ padding: "2rem 1rem" }}>
                <p>Aucune conversation.</p>
                <Link to="/app/amis" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }}>
                  Ajouter un contact
                </Link>
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`list-item${c.id === activeId ? " active" : ""}`}
                  onClick={() => setActiveId(c.id)}
                >
                  <span className="avatar sm">{labels[c.id]?.[0]?.toUpperCase() ?? "?"}</span>
                  <span className="list-item-text">
                    <strong>{labels[c.id] ?? "…"}</strong>
                    <span>{c.type === "group" ? "Groupe · actif" : "Messenger"}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="messages-area">
          {active ? (
            <>
              <div className="chat-header">
                <span className="avatar sm">{labels[active.id]?.[0]?.toUpperCase()}</span>
                <span style={{ flex: 1 }}>{labels[active.id]}</span>
                <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <IconLock size={12} /> Chiffré
                </span>
              </div>
              <div className="messages-scroll">
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                      <div className={`msg-bubble ${mine ? "mine" : "theirs"}`}>{m.plain ?? "…"}</div>
                      <div className="msg-meta">
                        {!mine && m.sender ? `${m.sender.display_name} · ` : ""}
                        {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form className="compose-bar" onSubmit={onSend}>
                <input type="file" ref={fileRef} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile("file", f); e.target.value = ""; }} />
                <input type="file" ref={voiceRef} hidden accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile("voice", f); e.target.value = ""; }} />
                <button type="button" className="compose-icon" title="Fichier" onClick={() => fileRef.current?.click()} aria-label="Joindre un fichier">📎</button>
                <button type="button" className="compose-icon" title="Vocal" onClick={() => voiceRef.current?.click()} aria-label="Message vocal">🎤</button>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Aa" autoComplete="off" />
                <button type="submit" className="compose-icon" style={{ background: "var(--primary)", color: "#fff" }} aria-label="Envoyer">➤</button>
              </form>
            </>
          ) : (
            <div className="empty-state" style={{ margin: "auto" }}>
              <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text)" }}>Vos messages</p>
              <p className="muted">Sélectionnez une conversation pour commencer.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

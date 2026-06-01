import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { getConversations, getActiveCalls, startCall, endCall } from "../lib/api";
import type { Call, Conversation } from "../lib/types";
import { subscribeCalls } from "../lib/subscriptions";

export function CallsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedConv, setSelectedConv] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    const [convs, active] = await Promise.all([getConversations(user.id), getActiveCalls(user.id)]);
    setConversations(convs);
    setCalls(active);
    if (!selectedConv && convs[0]) setSelectedConv(convs[0].id);
  }, [user, selectedConv]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => subscribeCalls(() => void reload()), [reload]);

  async function launch(kind: Call["kind"]) {
    if (!user || !selectedConv) return;
    await startCall(selectedConv, user.id, kind);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video",
      });
      setLocalStream(stream);
    } catch {
      alert("Autorisez le micro (et la caméra pour la vidéo) dans le navigateur.");
    }
    await reload();
  }

  async function hangup(callId: string) {
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    await endCall(callId);
    await reload();
  }

  return (
    <>
      <header className="page-header">
        <h1>Appels</h1>
        <p>Lancez des appels audio ou vidéo avec vos contacts.</p>
      </header>

      <div className="split" style={{ minHeight: "auto" }}>
        <div className="panel">
          <div className="panel-header"><strong>Démarrer un appel</strong></div>
          <div className="panel-body stack">
            <select
              value={selectedConv}
              onChange={(e) => setSelectedConv(e.target.value)}
              style={{ padding: "0.65rem", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
            >
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? (c.type === "dm" ? "Conversation directe" : "Groupe")}
                </option>
              ))}
            </select>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => void launch("audio")}>
                📞 Appel audio
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void launch("video")}>
                📹 Visioconférence
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><strong>Appels en cours</strong></div>
          <div className="panel-body">
            {calls.length === 0 ? (
              <p className="muted">Aucun appel actif.</p>
            ) : (
              calls.map((c) => (
                <div key={c.id} className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <span className="badge">{c.status}</span>
                    <span style={{ marginLeft: 8 }}>{c.kind === "video" ? "Vidéo" : "Audio"}</span>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      Salon : {c.room_token?.slice(0, 8)}…
                    </div>
                  </div>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void hangup(c.id)}>
                    Raccrocher
                  </button>
                </div>
              ))
            )}
            {localStream ? (
              <div style={{ marginTop: "1rem" }}>
                <video
                  autoPlay
                  muted
                  playsInline
                  ref={(el) => {
                    if (el) el.srcObject = localStream;
                  }}
                  style={{ width: "100%", maxWidth: 320, borderRadius: "var(--radius)", marginTop: 8 }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

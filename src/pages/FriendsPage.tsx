import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  getFriendships,
  searchProfiles,
  sendFriendRequest,
  respondFriendship,
  createDm,
} from "../lib/api";
import type { Friendship, Profile } from "../lib/types";
import { useNavigate } from "react-router-dom";

export function FriendsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setFriendships(await getFriendships(user.id));
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!user || query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      void searchProfiles(query, user.id).then(setResults);
    }, 300);
    return () => clearTimeout(t);
  }, [query, user]);

  async function addFriend(id: string) {
    if (!user) return;
    const res = await sendFriendRequest(user.id, id);
    const err = res && typeof res === "object" && "error" in res ? res.error : null;
    const msg =
      err && typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: string }).message)
        : err
          ? "Erreur"
          : null;
    setMsg(msg ?? "Demande envoyée.");
    await reload();
  }

  async function accept(id: string) {
    await respondFriendship(id, "accepted");
    await reload();
  }

  async function openChat(friendId: string) {
    if (!user) return;
    const convId = await createDm(user.id, friendId);
    if (convId) navigate("/app/messages");
  }

  const accepted = friendships.filter((f) => f.status === "accepted");
  const pending = friendships.filter((f) => f.status === "pending");

  return (
    <>
      <header className="page-header">
        <h1>Contacts</h1>
        <p>Ajoutez des collègues et démarrez des conversations privées chiffrées.</p>
      </header>

      {msg ? <div className="alert alert-info">{msg}</div> : null}

      <div className="split" style={{ minHeight: "auto" }}>
        <div className="panel">
          <div className="panel-header"><strong>Rechercher</strong></div>
          <div className="panel-body stack">
            <input
              placeholder="Handle ou nom…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: "100%", padding: "0.65rem", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
            />
            {results.map((p) => (
              <div key={p.id} className="row" style={{ justifyContent: "space-between" }}>
                <div className="row">
                  <span className="avatar">{p.display_name[0]?.toUpperCase()}</span>
                  <div>
                    <div>{p.display_name}</div>
                    <span className="muted">@{p.handle}</span>
                  </div>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void addFriend(p.id)}>
                  Ajouter
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-header"><strong>Demandes en attente</strong></div>
            <div className="panel-body">
              {pending.length === 0 ? (
                <p className="muted">Aucune demande.</p>
              ) : (
                pending.map((f) => {
                  const other =
                    f.requester_id === user?.id
                      ? f.addressee
                      : f.requester;
                  const incoming = f.addressee_id === user?.id;
                  return (
                    <div key={f.id} className="row" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
                      <div className="row">
                        <span className="avatar">{other?.display_name[0]}</span>
                        <span>@{other?.handle}</span>
                        <span className={`badge ${incoming ? "pending" : ""}`}>
                          {incoming ? "Reçue" : "Envoyée"}
                        </span>
                      </div>
                      {incoming ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => void accept(f.id)}>
                          Accepter
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><strong>Mes contacts</strong></div>
            <div className="panel-body">
              {accepted.length === 0 ? (
                <p className="muted">Aucun contact pour l'instant.</p>
              ) : (
                accepted.map((f) => {
                  const friendId = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
                  const friend = f.requester_id === user?.id ? f.addressee : f.requester;
                  return (
                    <div key={f.id} className="row" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
                      <div className="row">
                        <span className="avatar lg">{friend?.display_name[0]}</span>
                        <div>
                          <strong>{friend?.display_name}</strong>
                          <div className="muted">@{friend?.handle}</div>
                        </div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void openChat(friendId)}>
                        Message
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

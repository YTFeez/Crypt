import { FormEvent, useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthProvider";
import { getFriendships, createGroup } from "../lib/api";
import type { Friendship } from "../lib/types";
import { useNavigate } from "react-router-dom";

export function GroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const all = await getFriendships(user.id);
    setFriends(all.filter((f) => f.status === "accepted"));
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const ids = [...selected];
    if (!ids.length) {
      setError("Sélectionnez au moins un membre.");
      return;
    }
    const convId = await createGroup(user.id, name.trim(), ids);
    if (!convId) setError("Impossible de créer le groupe.");
    else navigate("/app/messages");
  }

  return (
    <>
      <header className="page-header">
        <h1>Groupes</h1>
        <p>Créez des espaces d'équipe avec messagerie de groupe chiffrée.</p>
      </header>

      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="panel-header"><strong>Nouveau groupe</strong></div>
        <form className="panel-body stack" onSubmit={onSubmit}>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <div className="field">
            <label htmlFor="gname">Nom du groupe</label>
            <input id="gname" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Équipe marketing" />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>Membres (contacts acceptés)</p>
          {friends.length === 0 ? (
            <p className="muted">Ajoutez des contacts d'abord.</p>
          ) : (
            friends.map((f) => {
              const fid = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
              const prof = f.requester_id === user?.id ? f.addressee : f.requester;
              return (
                <label key={f.id} className="row" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={selected.has(fid)} onChange={() => toggle(fid)} />
                  <span className="avatar">{prof?.display_name[0]}</span>
                  <span>{prof?.display_name} (@{prof?.handle})</span>
                </label>
              );
            })
          )}
          <button type="submit" className="btn btn-primary" disabled={!friends.length}>
            Créer le groupe
          </button>
        </form>
      </div>
    </>
  );
}

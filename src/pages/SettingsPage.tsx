import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { updateProfile } from "../lib/api";

export function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [orgName, setOrgName] = useState(profile?.org_name ?? "");
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    await updateProfile(user.id, {
      display_name: displayName,
      org_name: orgName || null,
    });
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <>
      <header className="page-header">
        <h1>Paramètres</h1>
        <p>Profil, organisation et sécurité du compte.</p>
      </header>

      <div className="panel" style={{ maxWidth: 480 }}>
        <div className="panel-header"><strong>Mon profil</strong></div>
        <form className="panel-body stack" onSubmit={onSubmit}>
          {saved ? <div className="alert alert-success">Profil enregistré.</div> : null}
          <div className="field">
            <label>E-mail</label>
            <input value={profile?.email ?? ""} disabled />
          </div>
          <div className="field">
            <label>Handle</label>
            <input value={`@${profile?.handle ?? ""}`} disabled />
          </div>
          <div className="field">
            <label htmlFor="dname">Nom affiché</label>
            <input id="dname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="org">Organisation / entreprise</label>
            <input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Veragrow SAS" />
          </div>
          <button type="submit" className="btn btn-primary">Enregistrer</button>
        </form>
      </div>

      <div className="panel" style={{ maxWidth: 480, marginTop: "1.25rem" }}>
        <div className="panel-header"><strong>Sécurité</strong></div>
        <div className="panel-body">
          <ul className="muted" style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.95rem" }}>
            <li>Chiffrement AES-GCM côté client pour les messages</li>
            <li>Clé maître dérivée du mot de passe (PBKDF2, 120k itérations)</li>
            <li>Row Level Security activée sur toutes les tables Supabase</li>
            <li>Fichiers stockés dans des buckets privés Supabase Storage</li>
          </ul>
        </div>
      </div>
    </>
  );
}

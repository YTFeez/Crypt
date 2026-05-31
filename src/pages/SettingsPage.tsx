import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { updateProfile } from "../lib/api";
import { isCloudMode } from "../lib/supabase";

export function SettingsPage() {
  const { user, profile, refreshProfile, mode } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [orgName, setOrgName] = useState(profile?.org_name ?? "");

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setOrgName(profile?.org_name ?? "");
  }, [profile]);
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
        <p>
          Mode : <span className="badge">{mode === "cloud" ? "Supabase cloud" : "Local (navigateur)"}</span>
          {!isCloudMode() ? " — ajoutez VITE_SUPABASE_* sur le VPS pour la synchro cloud." : null}
        </p>
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
            {mode === "cloud" ? (
              <>
                <li>Row Level Security Supabase</li>
                <li>Fichiers dans Supabase Storage</li>
              </>
            ) : (
              <li>Données stockées localement dans ce navigateur</li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}

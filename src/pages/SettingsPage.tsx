import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { updateProfile } from "../lib/api";
import {
  updateAccountProfile,
  changeAccountPassword,
  requestEmailChange,
  confirmEmailChange,
  deleteAccount,
  getStoredPhone,
  validateClientPassword,
  PASSWORD_MIN,
} from "../lib/account";
import { isServerMode } from "../lib/server-mode";
import { apiFetch } from "../lib/server-api";
import { LoadingSpinner } from "../components/LoadingSpinner";

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [orgName, setOrgName] = useState(profile?.org_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? getStoredPhone(user?.id ?? "") ?? "");
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailStep, setEmailStep] = useState<"idle" | "code">("idle");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailDevCode, setEmailDevCode] = useState<string | undefined>();
  const [emailLoading, setEmailLoading] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setOrgName(profile?.org_name ?? "");
    setPhone(profile?.phone ?? getStoredPhone(user?.id ?? "") ?? "");
  }, [profile, user?.id]);

  useEffect(() => {
    if (!isServerMode() || !user) return;
    void apiFetch<{ user: { phone: string | null } }>("/api/auth/me").then((res) => {
      if (res.data?.user.phone) setPhone(res.data.user.phone);
    });
  }, [user?.id]);

  async function onProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (isServerMode()) {
      const res = await updateAccountProfile(user.id, {
        display_name: displayName,
        org_name: orgName || null,
        phone: phone.trim() || null,
      });
      if (res.error) {
        setProfileSaved(false);
        alert(res.error);
        return;
      }
    } else {
      await updateProfile(user.id, {
        display_name: displayName,
        org_name: orgName || null,
      });
      await updateAccountProfile(user.id, { phone: phone.trim() || null });
    }
    await refreshProfile();
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setPwdMsg(null);
    if (newPassword !== confirmPassword) {
      setPwdMsg("Les mots de passe ne correspondent pas.");
      return;
    }
    const err = validateClientPassword(newPassword);
    if (err) {
      setPwdMsg(err);
      return;
    }
    setPwdLoading(true);
    const res = await changeAccountPassword(user.id, currentPassword, newPassword);
    setPwdLoading(false);
    if (res.error) {
      setPwdMsg(res.error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwdMsg("Mot de passe mis à jour. Votre coffre a été re-chiffré.");
  }

  async function onRequestEmailChange(e: FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    setEmailDevCode(undefined);
    setEmailLoading(true);
    const res = await requestEmailChange(newEmail, emailPassword);
    setEmailLoading(false);
    if (res.error) {
      setEmailMsg(res.error);
      return;
    }
    setEmailStep("code");
    setEmailDevCode(res.devCode);
    setEmailMsg("Code envoyé au nouvel e-mail. Saisissez-le ci-dessous.");
  }

  async function onConfirmEmailChange(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setEmailLoading(true);
    const res = await confirmEmailChange(user.id, newEmail, emailCode);
    setEmailLoading(false);
    if (res.error) {
      setEmailMsg(res.error);
      return;
    }
    setEmailStep("idle");
    setEmailCode("");
    setEmailPassword("");
    setEmailMsg("E-mail mis à jour.");
    await refreshProfile();
  }

  async function onDeleteAccount(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!window.confirm("Cette action est définitive. Toutes vos données seront supprimées.")) {
      return;
    }
    setDeleteLoading(true);
    const res = await deleteAccount(user.id, deletePassword, deleteConfirm);
    setDeleteLoading(false);
    if (res.error) {
      setDeleteMsg(res.error);
      return;
    }
    await signOut();
    navigate("/connexion", { replace: true });
  }

  return (
    <div className="page-inner">
      <header className="page-header">
        <h1>Paramètres</h1>
        <p>Gérez votre profil, la sécurité et votre compte Talkeo.</p>
      </header>

      <div className="settings-layout">
        <div className="panel">
          <div className="panel-header"><strong>Mon profil</strong></div>
          <form className="panel-body stack" onSubmit={onProfileSubmit}>
            {profileSaved ? <div className="alert alert-success">Profil enregistré.</div> : null}
            <div className="field">
              <label>E-mail actuel</label>
              <input value={profile?.email ?? ""} disabled />
            </div>
            <div className="field">
              <label>Handle</label>
              <input value={`@${profile?.handle ?? ""}`} disabled />
            </div>
            <div className="field">
              <label htmlFor="dname">Nom affiché</label>
              <input id="dname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="org">Organisation</label>
              <input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Mon entreprise" />
            </div>
            <div className="field">
              <label htmlFor="phone">Téléphone</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                autoComplete="tel"
              />
            </div>
            <button type="submit" className="btn btn-primary">Enregistrer le profil</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header"><strong>Sécurité</strong></div>
          <form className="panel-body stack" onSubmit={onPasswordSubmit}>
            <p className="settings-hint">
              Coffre chiffré de bout en bout. Le changement de mot de passe re-chiffre vos données
              ({PASSWORD_MIN} caractères min., lettre + chiffre).
            </p>
            {pwdMsg ? (
              <div className={pwdMsg.includes("mis à jour") ? "alert alert-success" : "alert alert-error"}>
                {pwdMsg}
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="cur-pwd">Mot de passe actuel</label>
              <input
                id="cur-pwd"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="new-pwd">Nouveau mot de passe</label>
              <input
                id="new-pwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={PASSWORD_MIN}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="conf-pwd">Confirmer</label>
              <input
                id="conf-pwd"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-secondary" disabled={pwdLoading}>
              {pwdLoading ? <LoadingSpinner size="sm" /> : null}
              Changer le mot de passe
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header"><strong>Changer d&apos;e-mail</strong></div>
          <div className="panel-body stack">
            <p className="settings-hint">
              Un code à 6 chiffres sera envoyé à votre nouvelle adresse pour confirmer le changement.
            </p>
            {emailMsg ? (
              <div className={emailMsg.includes("mis à jour") ? "alert alert-success" : "alert alert-info"}>
                {emailMsg}
                {emailDevCode ? (
                  <p style={{ margin: "0.5rem 0 0", fontFamily: "monospace" }}>Code dev : {emailDevCode}</p>
                ) : null}
              </div>
            ) : null}
            {emailStep === "idle" ? (
              <form className="stack" onSubmit={onRequestEmailChange}>
                <div className="field">
                  <label htmlFor="new-email">Nouvel e-mail</label>
                  <input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="email-pwd">Mot de passe (confirmation)</label>
                  <input
                    id="email-pwd"
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-secondary" disabled={emailLoading}>
                  Envoyer le code
                </button>
              </form>
            ) : (
              <form className="stack" onSubmit={onConfirmEmailChange}>
                <div className="field">
                  <label htmlFor="email-code">Code reçu</label>
                  <input
                    id="email-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={emailLoading}>
                  Confirmer le nouvel e-mail
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setEmailStep("idle");
                    setEmailMsg(null);
                  }}
                >
                  Annuler
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="panel settings-danger-zone">
          <div className="panel-header"><strong>Supprimer le compte</strong></div>
          <form className="panel-body stack" onSubmit={onDeleteAccount}>
            <p className="settings-hint">
              Action irréversible. Votre coffre, messages et créations seront effacés du serveur.
            </p>
            {deleteMsg ? <div className="alert alert-error">{deleteMsg}</div> : null}
            <div className="field">
              <label htmlFor="del-pwd">Mot de passe</label>
              <input
                id="del-pwd"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="del-confirm">Tapez SUPPRIMER</label>
              <input
                id="del-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="SUPPRIMER"
                required
              />
            </div>
            <button type="submit" className="btn btn-danger" disabled={deleteLoading}>
              {deleteLoading ? <LoadingSpinner size="sm" /> : null}
              Supprimer définitivement mon compte
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

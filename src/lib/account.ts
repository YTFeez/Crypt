import { isServerMode } from "./server-mode";
import { apiFetch, setApiToken } from "./server-api";
import {
  clearVaultMeta,
  exportVaultMeta,
  hashPassword,
  isVaultUnlocked,
  lockVault,
  unlockVault,
  verifyPassword,
} from "./crypto";
import { loadVault, saveVault, invalidateVaultCache } from "./storage";
import { patchDb, getLocalUsers, updateLocalUser, deleteLocalUser } from "./local-db";
import type { Db } from "./local-db";
import { upsertPublicProfile } from "./profile-index";
import type { Profile } from "./types";
import { updateProfile } from "./api";
import {
  createPendingVerification,
  generateVerificationCode,
  sendVerificationEmail,
  verifyCodeAgainstPending,
} from "./email-verify";

export const PASSWORD_MIN = 8;

export function validateClientPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Minimum ${PASSWORD_MIN} caractères.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Au moins une lettre et un chiffre.";
  }
  return null;
}

export async function syncAccountProfile(
  userId: string,
  patch: { display_name?: string; org_name?: string | null; phone?: string | null; email?: string }
): Promise<void> {
  await patchDb((db) => {
    const i = db.profiles.findIndex((p) => p.id === userId);
    if (i >= 0) {
      db.profiles[i] = { ...db.profiles[i]!, ...patch };
      upsertPublicProfile(db.profiles[i]!);
    }
  }, userId);
}

export async function updateAccountProfile(
  userId: string,
  data: { display_name?: string; org_name?: string | null; phone?: string | null }
): Promise<{ error: string | null }> {
  if (isServerMode()) {
    const res = await apiFetch<{ user: { display_name: string; org_name: string | null; phone: string | null } }>(
      "/api/account/profile",
      { method: "PATCH", body: JSON.stringify(data) }
    );
    if (res.error) return { error: res.error };
    await syncAccountProfile(userId, {
      display_name: res.data?.user.display_name,
      org_name: res.data?.user.org_name,
      phone: res.data?.user.phone,
    });
    return { error: null };
  }

  await updateProfile(userId, data as Partial<Profile>);
  if (data.phone !== undefined) {
    localStorage.setItem(`crypt-phone-${userId}`, data.phone ?? "");
  }
  return { error: null };
}

export function getStoredPhone(userId: string): string | null {
  return localStorage.getItem(`crypt-phone-${userId}`);
}

export async function changeAccountPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ error: string | null }> {
  const pwdErr = validateClientPassword(newPassword);
  if (pwdErr) return { error: pwdErr };

  if (!isVaultUnlocked()) {
    const u = await unlockVault(currentPassword);
    if (!u.ok) return { error: u.error ?? "Session expirée — reconnectez-vous." };
  }

  const db = await loadVault<Db>(userId);

  if (isServerMode()) {
    const res = await apiFetch<{ ok: boolean }>("/api/account/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.error) return { error: res.error };
  } else {
    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx < 0) return { error: "Compte introuvable." };
    const cred = await hashPassword(newPassword);
    updateLocalUser(userId, { passwordHash: cred.hash, passwordSalt: cred.salt });
  }

  const meta = exportVaultMeta();
  if (!meta) return { error: "Meta coffre introuvable." };

  lockVault();
  clearVaultMeta();

  const created = await unlockVault(newPassword, { userId, create: true });
  if (!created.ok) return { error: created.error ?? "Erreur re-chiffrement." };

  await saveVault(userId, db);

  if (isServerMode()) {
    const newMeta = exportVaultMeta();
    if (newMeta) {
      await apiFetch("/api/auth/vault-meta", {
        method: "PUT",
        body: JSON.stringify({
          salt: newMeta.salt,
          verifier: newMeta.verifier,
          kdf: newMeta.kdf,
          v: newMeta.v,
        }),
      });
    }
  }

  invalidateVaultCache(userId);
  return { error: null };
}

export async function requestEmailChange(
  newEmail: string,
  password: string
): Promise<{ error: string | null; devCode?: string }> {
  const norm = newEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) {
    return { error: "E-mail invalide." };
  }

  if (isServerMode()) {
    const res = await apiFetch<{ devCode?: string }>("/api/account/request-email-change", {
      method: "POST",
      body: JSON.stringify({ newEmail: norm, password }),
    });
    if (res.error) return { error: res.error };
    return { error: null, devCode: res.data?.devCode };
  }

  const users = getLocalUsers();
  const sessionId = localStorage.getItem("crypt-session-v1");
  const user = users.find((u) => u.id === sessionId);
  if (!user) return { error: "Session invalide." };
  if (users.some((u) => u.email.toLowerCase() === norm && u.id !== user.id)) {
    return { error: "Cet e-mail est déjà utilisé." };
  }

  const code = generateVerificationCode();
  createPendingVerification(`change:${norm}`, user.id, code);
  const mail = await sendVerificationEmail(norm, code, user.display_name, "email-change");
  return { error: null, devCode: mail.devCode };
}

export async function confirmEmailChange(
  userId: string,
  newEmail: string,
  code: string
): Promise<{ error: string | null; newEmail?: string }> {
  const norm = newEmail.trim().toLowerCase();

  if (isServerMode()) {
    const res = await apiFetch<{ token: string; email: string }>("/api/account/confirm-email-change", {
      method: "POST",
      body: JSON.stringify({ newEmail: norm, code }),
    });
    if (res.error) return { error: res.error };
    if (res.data?.token) setApiToken(res.data.token);
    await syncAccountProfile(userId, { email: norm });
    return { error: null, newEmail: norm };
  }

  const check = verifyCodeAgainstPending(`change:${norm}`, code);
  if (!check.ok || check.userId !== userId) {
    return { error: check.ok ? "Session invalide." : check.error };
  }

  if (!updateLocalUser(userId, { email: norm })) {
    return { error: "Compte introuvable." };
  }
  await syncAccountProfile(userId, { email: norm });
  return { error: null, newEmail: norm };
}

export async function deleteAccount(
  userId: string,
  password: string,
  confirm: string
): Promise<{ error: string | null }> {
  if (confirm !== "SUPPRIMER") {
    return { error: 'Tapez "SUPPRIMER" pour confirmer.' };
  }

  if (isServerMode()) {
    const u = await unlockVault(password);
    if (!u.ok) return { error: u.error ?? "Mot de passe incorrect." };
    const res = await apiFetch<{ ok: boolean }>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ password, confirm }),
    });
    if (res.error) return { error: res.error };
  } else {
    const user = getLocalUsers().find((u) => u.id === userId);
    if (!user) return { error: "Compte introuvable." };
    const valid = await verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!valid) return { error: "Mot de passe incorrect." };
    if (!deleteLocalUser(userId)) return { error: "Compte introuvable." };
  }

  lockVault();
  clearVaultMeta();
  localStorage.removeItem("crypt-session-v1");
  localStorage.removeItem("crypt-api-token");
  localStorage.removeItem(`crypt-phone-${userId}`);
  invalidateVaultCache(userId);
  return { error: null };
}

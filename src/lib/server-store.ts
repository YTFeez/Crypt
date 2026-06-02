import type { Profile } from "./types";
import { randomUuid } from "./secure-random";
import {
  unlockVault,
  lockVault,
  clearVaultMeta,
  importVaultMeta,
  exportVaultMeta,
  encryptPayload,
} from "./crypto";
import { emptyDbShape, type Db } from "./local-db-types";
import { loadVault, invalidateVaultCache } from "./storage";
import { apiFetch, setApiToken, getApiToken } from "./server-api";
import { upsertPublicProfile } from "./profile-index";

const SESSION_KEY = "crypt-session-v1";

export function getServerSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(userId: string) {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearServerSession() {
  localStorage.removeItem(SESSION_KEY);
  setApiToken(null);
  lockVault();
  invalidateVaultCache();
}

export function isServerUserVerified(userId: string): boolean {
  void userId;
  return Boolean(getApiToken());
}

export async function ensureServerReady(): Promise<void> {
  const res = await apiFetch<{ ok: boolean }>("/api/health", { auth: false });
  if (res.error) throw new Error("API Talkeo injoignable. Vérifiez VITE_API_URL.");
}

export async function serverRegister(
  email: string,
  password: string,
  displayName: string
): Promise<{ error: string | null; userId?: string; needsVerification?: boolean; devCode?: string }> {
  const norm = email.trim().toLowerCase();
  const userId = randomUuid();
  const handle = norm.split("@")[0].replace(/[^a-z0-9_]/g, "") || "user";

  clearVaultMeta();
  invalidateVaultCache();

  let meta: ReturnType<typeof exportVaultMeta>;
  let enc: Awaited<ReturnType<typeof encryptPayload>>;
  try {
    const unlock = await unlockVault(password, { userId, create: true });
    if (!unlock.ok) return { error: unlock.error ?? "Erreur initialisation du coffre." };
    meta = exportVaultMeta();
    if (!meta) return { error: "Meta coffre manquante après initialisation." };
    const profile: Profile = {
      id: userId,
      email: norm,
      display_name: displayName.trim(),
      handle,
      avatar_url: null,
      public_key: "",
      org_name: null,
      created_at: new Date().toISOString(),
    };
    const dbPayload = { ...emptyDbShape(), profiles: [profile] };
    enc = await encryptPayload(dbPayload);
  } catch (e) {
    lockVault();
    clearVaultMeta();
    return { error: e instanceof Error ? e.message : "Erreur lors de la préparation du compte." };
  }

  lockVault();
  clearVaultMeta();

  const res = await apiFetch<{
    userId: string;
    needsVerification: boolean;
    devCode?: string;
  }>("/api/auth/register", {
    auth: false,
    method: "POST",
    body: JSON.stringify({
      email: norm,
      password,
      displayName: displayName.trim(),
      handle,
      vaultMeta: meta,
      vault: enc,
    }),
  });

  if (res.error) return { error: res.error };
  return {
    error: null,
    userId: res.data!.userId,
    needsVerification: true,
    devCode: res.data!.devCode,
  };
}

export async function serverLogin(
  email: string,
  password: string
): Promise<{ error: string | null; userId?: string }> {
  const norm = email.trim().toLowerCase();
  const res = await apiFetch<{
    token: string;
    user: {
      id: string;
      email: string;
      display_name: string;
      handle: string;
      email_verified: boolean;
      vaultMeta: {
        salt: string;
        verifier: string;
        userId: string;
        kdf?: string;
        v?: number;
      } | null;
    };
  }>("/api/auth/login", {
    auth: false,
    method: "POST",
    body: JSON.stringify({ email: norm, password }),
  });

  if (res.error) {
    if (res.status === 403) return { error: "E-mail non vérifié. Validez votre compte." };
    return { error: res.error };
  }

  const { token, user } = res.data!;
  if (!user.vaultMeta) return { error: "Coffre non configuré sur le serveur." };

  clearVaultMeta();
  invalidateVaultCache();
  importVaultMeta({
    ...user.vaultMeta,
    kdf: (user.vaultMeta.kdf ?? "argon2id") as "argon2id",
  });

  const unlock = await unlockVault(password);
  if (!unlock.ok) return { error: unlock.error ?? "Impossible de déverrouiller le coffre." };

  setApiToken(token);
  setSession(user.id);
  const db = await loadVault<Db>(user.id);
  const prof = db.profiles.find((p) => p.id === user.id);
  if (prof) upsertPublicProfile(prof);
  else {
    upsertPublicProfile({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      handle: user.handle,
      avatar_url: null,
      public_key: "",
      org_name: null,
      created_at: new Date().toISOString(),
    });
  }

  return { error: null, userId: user.id };
}

export async function serverCompleteVerification(
  userId: string,
  password: string
): Promise<{ error: string | null }> {
  const unlock = await unlockVault(password, { userId, create: true });
  if (!unlock.ok) return { error: unlock.error ?? "Erreur coffre." };
  setSession(userId);
  return { error: null };
}

export async function serverVerifyEmailCode(email: string, code: string): Promise<{ error: string | null }> {
  const res = await apiFetch<{ ok: boolean; userId: string }>("/api/auth/verify-email", {
    auth: false,
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
  });
  if (res.error) return { error: res.error };
  return { error: null };
}

export async function serverResendCode(
  email: string
): Promise<{ error: string | null; devCode?: string }> {
  const res = await apiFetch<{ devCode?: string }>("/api/auth/resend-code", {
    auth: false,
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (res.error) return { error: res.error };
  return { error: null, devCode: res.data?.devCode };
}

export function enforceServerVerifiedSession(): { ok: true } | { ok: false; email: string } {
  const id = getServerSessionUserId();
  if (!id || !getApiToken()) {
    clearServerSession();
    return { ok: false, email: "" };
  }
  return { ok: true };
}

export async function serverRestoreSession(password?: string): Promise<boolean> {
  const id = getServerSessionUserId();
  const token = getApiToken();
  if (!id || !token) return false;

  const me = await apiFetch<{
    user: { email_verified: boolean; vaultMeta: import("./crypto").VaultMetaExport | null };
  }>("/api/auth/me");
  if (me.error || !me.data?.user.email_verified) {
    clearServerSession();
    return false;
  }
  if (me.data.user.vaultMeta) importVaultMeta(me.data.user.vaultMeta);
  if (password) {
    const u = await unlockVault(password);
    if (!u.ok) return false;
  }
  return true;
}

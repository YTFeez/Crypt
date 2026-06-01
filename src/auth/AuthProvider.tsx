import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isCloudMode } from "../lib/supabase";
import { lockVault, clearVaultMeta, restoreSessionKey } from "../lib/crypto";
import { getMyProfile } from "../lib/api";
import { getDataMode } from "../lib/api-router";
import {
  ensureLocalSeed,
  getLocalSessionUserId,
  localLogin,
  localLogout,
  localRegister,
  enterGuestSession,
  completeLocalEmailVerification,
  resendLocalVerificationCode,
  markLocalEmailVerifiedByEmail,
} from "../lib/local-db";
import { verifyCodeAgainstPending } from "../lib/email-verify";
import type { Profile } from "../lib/types";

export type SignUpResult =
  | { ok: true; needsVerification: true; email: string; devCode?: string }
  | { ok: true; needsVerification: false }
  | { ok: false; error: string };

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  mode: "cloud" | "local";
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>;
  verifyEmailWithCode: (email: string, code: string, password: string) => Promise<string | null>;
  resendVerificationEmail: (email: string) => Promise<{ error: string | null; devCode?: string }>;
  confirmEmailFromAuthCallback: () => Promise<string | null>;
  signInAsGuest: () => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function localUserStub(id: string, email: string): User {
  return { id, email } as User;
}

function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

async function applyLocalSession(userId: string, email: string) {
  const p = await getMyProfile(userId);
  return { user: localUserStub(userId, p?.email ?? email), profile: p };
}

function mapSupabaseAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed") || m.includes("not confirmed")) {
    return "E-mail non vérifié. Consultez votre boîte mail et cliquez sur le lien, ou saisissez le code.";
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mode = getDataMode();
  const cloud = isCloudMode();

  const user = localUser ?? (cloud ? session?.user ?? null : null);

  const refreshProfile = useCallback(async () => {
    const uid = user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    setProfile(await getMyProfile(uid));
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureLocalSeed();
      const id = getLocalSessionUserId();
      if (id && !cancelled) {
        const restored = await restoreSessionKey();
        if (!restored) {
          localLogout();
        } else {
          const p = await getMyProfile(id);
          if (p) {
            setLocalUser(localUserStub(id, p.email));
            setProfile(p);
          }
        }
      }
      if (cloud && !cancelled) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user && !id) {
          setSession(data.session);
        }
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
          if (s?.user && !getLocalSessionUserId()) setSession(s);
        });
        if (!cancelled) setLoading(false);
        return () => sub.subscription.unsubscribe();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cloud]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const trimmed = email.trim();
      if (!trimmed || !password) return "Renseignez e-mail et mot de passe.";

      const localRes = await localLogin(trimmed, password);
      if (!localRes.error && localRes.userId) {
        const applied = await applyLocalSession(localRes.userId, trimmed);
        setLocalUser(applied.user);
        setProfile(applied.profile);
        if (cloud) {
          const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
          if (!error) {
            const { data } = await supabase.auth.getSession();
            setSession(data.session);
          }
        } else {
          setSession(null);
        }
        return null;
      }

      if (localRes.error?.includes("non vérifié")) {
        return localRes.error;
      }

      if (cloud) {
        const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
        if (!error) {
          const { data } = await supabase.auth.getSession();
          const confirmed = data.session?.user.email_confirmed_at ?? data.session?.user.confirmed_at;
          if (!confirmed) {
            await supabase.auth.signOut();
            return "E-mail non vérifié. Consultez votre boîte mail.";
          }
          markLocalEmailVerifiedByEmail(trimmed);
          setSession(data.session);
          setLocalUser(null);
          return null;
        }
        return mapSupabaseAuthError(error.message);
      }

      return localRes.error ?? "Connexion impossible.";
    },
    [cloud]
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string): Promise<SignUpResult> => {
      const trimmed = email.trim();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { ok: false, error: "Adresse e-mail invalide." };
      }
      if (!password || password.length < 6) {
        return { ok: false, error: "Mot de passe minimum 6 caractères." };
      }
      if (!displayName.trim()) return { ok: false, error: "Indiquez votre nom." };

      let localRes: Awaited<ReturnType<typeof localRegister>>;
      try {
        localRes = await localRegister(trimmed, password, displayName.trim());
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Erreur lors de l'inscription." };
      }
      if (localRes.error) return { ok: false, error: localRes.error };

      if (cloud) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: trimmed,
            password,
            options: {
              data: { display_name: displayName.trim(), local_user_id: localRes.userId },
              emailRedirectTo: `${appOrigin()}/auth/callback`,
            },
          });
          if (error && !localRes.needsVerification) {
            return { ok: false, error: error.message };
          }
          const needsSupabaseConfirm = !data.session && data.user && !data.user.email_confirmed_at;
          if (needsSupabaseConfirm || localRes.needsVerification) {
            return {
              ok: true,
              needsVerification: true,
              email: trimmed,
              devCode: localRes.devCode,
            };
          }
        } catch {
          /* cloud optionnel */
        }
      }

      if (localRes.needsVerification) {
        return {
          ok: true,
          needsVerification: true,
          email: trimmed,
          devCode: localRes.devCode,
        };
      }

      if (localRes.userId) {
        const loginRes = await localLogin(trimmed, password);
        if (!loginRes.error && loginRes.userId) {
          const applied = await applyLocalSession(loginRes.userId, trimmed);
          setLocalUser(applied.user);
          setProfile(applied.profile);
        }
      }
      return { ok: true, needsVerification: false };
    },
    [cloud]
  );

  const verifyEmailWithCode = useCallback(
    async (email: string, code: string, password: string) => {
      const trimmed = email.trim();
      const check = verifyCodeAgainstPending(trimmed, code);
      if (!check.ok) return check.error;

      const done = await completeLocalEmailVerification(check.userId, password);
      if (done.error) return done.error;

      if (cloud) {
        await supabase.auth.signInWithPassword({ email: trimmed, password });
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      }

      const applied = await applyLocalSession(check.userId, trimmed);
      setLocalUser(applied.user);
      setProfile(applied.profile);
      return null;
    },
    [cloud]
  );

  const resendVerificationEmail = useCallback(
    async (email: string) => {
      const trimmed = email.trim();
      const local = await resendLocalVerificationCode(trimmed);
      if (local.error) return { error: local.error };

      if (cloud) {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: trimmed,
          options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
        });
        if (error) return { error: error.message, devCode: local.devCode };
      }

      return { error: null, devCode: local.devCode };
    },
    [cloud]
  );

  const confirmEmailFromAuthCallback = useCallback(async () => {
    if (!cloud) return "Mode cloud non configuré.";

    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type") as "signup" | "email" | "recovery" | null;

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type === "signup" ? "signup" : type,
      });
      if (error) return mapSupabaseAuthError(error.message);
    }

    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) return error.message;
      }
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      return "Lien invalide ou expiré. Demandez un nouvel e-mail de vérification.";
    }

    const email = data.session.user.email;
    if (email) markLocalEmailVerifiedByEmail(email);
    await supabase.auth.signOut();
    return null;
  }, [cloud]);

  const signInAsGuest = useCallback(async () => {
    const res = await enterGuestSession();
    if (res.error || !res.userId) return res.error ?? "Accès invité indisponible.";
    const applied = await applyLocalSession(res.userId, "demo@talkeo.app");
    setLocalUser(applied.user);
    setProfile(applied.profile);
    setSession(null);
    return null;
  }, []);

  const signOut = useCallback(async () => {
    lockVault();
    clearVaultMeta();
    localLogout();
    setLocalUser(null);
    setProfile(null);
    if (cloud) {
      await supabase.auth.signOut();
      setSession(null);
    }
  }, [cloud]);

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      mode,
      signIn,
      signUp,
      verifyEmailWithCode,
      resendVerificationEmail,
      confirmEmailFromAuthCallback,
      signInAsGuest,
      signOut,
      refreshProfile,
    }),
    [
      session,
      user,
      profile,
      loading,
      mode,
      signIn,
      signUp,
      verifyEmailWithCode,
      resendVerificationEmail,
      confirmEmailFromAuthCallback,
      signInAsGuest,
      signOut,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth hors AuthProvider");
  return ctx;
}

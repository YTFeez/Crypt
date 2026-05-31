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
} from "../lib/local-db";
import type { Profile } from "../lib/types";

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  mode: "cloud" | "local";
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, displayName: string) => Promise<string | null>;
  signInAsGuest: () => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function localUserStub(id: string, email: string): User {
  return { id, email } as User;
}

async function applyLocalSession(userId: string, email: string) {
  const p = await getMyProfile(userId);
  return { user: localUserStub(userId, p?.email ?? email), profile: p };
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
        setSession(null);
        return null;
      }

      if (cloud) {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (!error) {
          const { data } = await supabase.auth.getSession();
          setSession(data.session);
          setLocalUser(null);
          return null;
        }
        return localRes.error ?? error.message;
      }

      return localRes.error ?? "Connexion impossible.";
    },
    [cloud]
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const trimmed = email.trim();
      if (!trimmed || !password || password.length < 6) {
        return "Mot de passe minimum 6 caractères.";
      }
      if (!displayName.trim()) return "Indiquez votre nom.";

      const localRes = await localRegister(trimmed, password, displayName.trim());
      if (localRes.error) return localRes.error;
      if (localRes.userId) {
        const applied = await applyLocalSession(localRes.userId, trimmed);
        setLocalUser(applied.user);
        setProfile(applied.profile);
        setSession(null);
      }

      if (cloud) {
        await supabase.auth.signUp({
          email: trimmed,
          password,
          options: { data: { display_name: displayName.trim() } },
        });
      }
      return null;
    },
    [cloud]
  );

  const signInAsGuest = useCallback(async () => {
    const res = await enterGuestSession();
    if (res.error || !res.userId) return res.error ?? "Accès invité indisponible.";
    const applied = await applyLocalSession(res.userId, "demo@crypt.app");
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
      signInAsGuest,
      signOut,
      refreshProfile,
    }),
    [session, user, profile, loading, mode, signIn, signUp, signInAsGuest, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth hors AuthProvider");
  return ctx;
}

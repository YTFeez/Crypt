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
import { ensureMasterKey, clearMasterKey } from "../lib/crypto";
import { getMyProfile } from "../lib/api";
import { getDataMode } from "../lib/api-router";
import {
  ensureLocalSeed,
  getLocalSessionUserId,
  localLogin,
  localLogout,
  localRegister,
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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function localUserStub(id: string, email: string): User {
  return { id, email } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mode = getDataMode();
  const cloud = isCloudMode();

  const user = cloud ? session?.user ?? null : localUser;

  const refreshProfile = useCallback(async () => {
    const uid = cloud ? session?.user?.id : localUser?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    setProfile(await getMyProfile(uid));
  }, [cloud, session?.user?.id, localUser?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cloud) {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          setSession(data.session);
          setLoading(false);
        }
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
          setSession(s);
          setLoading(false);
        });
        return () => {
          cancelled = true;
          sub.subscription.unsubscribe();
        };
      }
      await ensureLocalSeed();
      const id = getLocalSessionUserId();
      if (!cancelled) {
        if (id) {
          const p = await getMyProfile(id);
          setLocalUser(localUserStub(id, p?.email ?? ""));
        }
        setLoading(false);
      }
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
      await ensureMasterKey(password);
      if (cloud) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      }
      const res = await localLogin(email, password);
      if (res.error) return res.error;
      if (res.userId) {
        const p = await getMyProfile(res.userId);
        setLocalUser(localUserStub(res.userId, email));
        setProfile(p);
      }
      return null;
    },
    [cloud]
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      await ensureMasterKey(password);
      if (cloud) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        return error?.message ?? null;
      }
      const res = await localRegister(email, password, displayName);
      if (res.error) return res.error;
      if (res.userId) {
        localStorage.setItem("crypt-session-v1", res.userId);
        setLocalUser(localUserStub(res.userId, email));
        await refreshProfile();
      }
      return null;
    },
    [cloud, refreshProfile]
  );

  const signOut = useCallback(async () => {
    clearMasterKey();
    if (cloud) {
      await supabase.auth.signOut();
      setSession(null);
    } else {
      localLogout();
      setLocalUser(null);
    }
    setProfile(null);
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
      signOut,
      refreshProfile,
    }),
    [session, user, profile, loading, mode, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth hors AuthProvider");
  return ctx;
}

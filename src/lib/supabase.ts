import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/** Cloud uniquement si projet Supabase valide (évite VPS avec fausses clés) */
export function isCloudMode(): boolean {
  return (
    url.includes(".supabase.co") &&
    key.startsWith("eyJ") &&
    key.length > 80 &&
    !url.includes("xxxx")
  );
}

export const supabase: SupabaseClient = isCloudMode()
  ? createClient(url, key)
  : (null as unknown as SupabaseClient);

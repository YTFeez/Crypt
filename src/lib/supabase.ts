import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export function isCloudMode(): boolean {
  return Boolean(url && key && url.startsWith("https://") && key.length > 20);
}

export const supabase: SupabaseClient = isCloudMode()
  ? createClient(url, key)
  : (null as unknown as SupabaseClient);

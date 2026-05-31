import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key && !url.includes("VOTRE_PROJET"));

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(url!, key!)
  : (null as unknown as SupabaseClient);

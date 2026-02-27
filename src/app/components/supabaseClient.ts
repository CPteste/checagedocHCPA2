import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

// In production (Vercel), use VITE_ env vars; in Figma Make, use info.tsx
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey;

// Singleton Supabase client
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}

// KV helpers - direct frontend access to Supabase
const TABLE = "kv_store_a86ed2e4";

export async function kvSet(key: string, value: unknown): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).upsert({ key, value });
  if (error) {
    console.error(`[kvSet] Error setting key "${key}":`, error);
    throw new Error(`kvSet failed: ${error.message}`);
  }
}

export async function kvGet(key: string): Promise<unknown | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.error(`[kvGet] Error getting key "${key}":`, error);
    throw new Error(`kvGet failed: ${error.message}`);
  }
  return data?.value ?? null;
}

export async function kvDel(key: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq("key", key);
  if (error) {
    console.error(`[kvDel] Error deleting key "${key}":`, error);
    throw new Error(`kvDel failed: ${error.message}`);
  }
}

export async function kvGetByPrefix(prefix: string): Promise<{ key: string; value: unknown }[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("key, value")
    .like("key", `${prefix}%`);
  if (error) {
    console.error(`[kvGetByPrefix] Error querying prefix "${prefix}":`, error);
    throw new Error(`kvGetByPrefix failed: ${error.message}`);
  }
  return data ?? [];
}

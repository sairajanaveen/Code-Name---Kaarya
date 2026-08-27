export function publicSupabaseConfig() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
    key: (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()
  };
}

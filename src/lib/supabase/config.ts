// Public Supabase settings. The publishable (anon) key is designed to be used
// in browsers; Row Level Security protects the data. Never put the service
// role key in a NEXT_PUBLIC_ variable.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

// Local demo mode stores fictional data in this browser only. It is enabled
// by default in development and can be turned off with NEXT_PUBLIC_ENABLE_DEMO=false.
export const isDemoEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO !== "false";
export const DEMO_COOKIE = "mindcraft-demo";

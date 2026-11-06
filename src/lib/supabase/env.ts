/**
 * Supabase settings. Accepts both the names in .env.example and the names the
 * Vercel ⇄ Supabase integration creates (older "anon/service_role" or newer
 * "publishable/secret" keys), so connecting through Vercel works with no renaming.
 */
export const supabaseUrl = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

export const supabaseAnonKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

export const supabaseServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

export const supabaseConfigured = () => Boolean(supabaseUrl() && supabaseAnonKey());

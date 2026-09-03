import { createClient } from '@supabase/supabase-js';

// Read Supabase configuration strictly from the current environment variables (Vercel / Vite / Platform)
const supabaseUrl = 
  (import.meta as any).env?.VITE_SUPABASE_URL || 
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL || 
  (import.meta as any).env?.SUPABASE_URL ||
  '';

const supabaseAnonKey = 
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  (import.meta as any).env?.SUPABASE_PUBLISHABLE_KEY ||
  (import.meta as any).env?.SUPABASE_ANON_KEY ||
  '';

// Supabase is active when environment configuration provides a valid URL and public key
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key'
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase Configuration] Current environment variables for Supabase are missing or incomplete. Please ensure your environment/secrets provide the current Supabase URL and public/publishable key.'
  );
}

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    }) 
  : null;




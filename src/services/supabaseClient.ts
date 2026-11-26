import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (typeof __SUPABASE_URL__ !== 'undefined' && __SUPABASE_URL__ ? __SUPABASE_URL__ : undefined);
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (typeof __SUPABASE_ANON_KEY__ !== 'undefined' && __SUPABASE_ANON_KEY__ ? __SUPABASE_ANON_KEY__ : undefined);

// Normalize in case a REST endpoint URL (/rest/v1/) was provided instead of the project base URL
const supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '') : undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = (): boolean => Boolean(supabase);

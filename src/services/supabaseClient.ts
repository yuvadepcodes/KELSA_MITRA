import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Normalize in case a REST endpoint URL (/rest/v1/) was provided instead of the project base URL
const supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '') : undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = (): boolean => Boolean(supabase);

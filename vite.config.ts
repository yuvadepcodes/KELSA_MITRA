import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const supabaseUrl = (
    env.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();

  const supabaseAnonKey = (
    env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey),
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
    },
  };
});

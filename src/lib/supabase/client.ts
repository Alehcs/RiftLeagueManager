'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser Supabase client. Returns null when env is not configured, which keeps
// the app in mock mode. The data layer (lib/store) never hard-depends on this.
export function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || process.env.NEXT_PUBLIC_FORCE_MOCK === 'true') return null;
  return createBrowserClient(url, anon);
}

export const supabaseConfigured = (): boolean =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_FORCE_MOCK !== 'true';

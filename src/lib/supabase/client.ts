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

export type SupabaseStatus = 'mock' | 'supabase' | 'misconfigured';

export interface SupabaseDiagnostics {
  status: SupabaseStatus;
  hasUrl: boolean;
  hasKey: boolean;
  forceMock: boolean;
  urlHost: string | null; // host only (public, safe to show)
  keyHint: string | null; // masked: prefix + length, never the full key
}

function maskKey(key: string): string {
  const trimmed = key.trim();
  return `${trimmed.slice(0, 8)}…(${trimmed.length})`;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

// Safe, non-secret view of how Supabase env is configured. NEXT_PUBLIC_* values
// must be referenced statically so Next.js can inline them into the client.
export function getSupabaseDiagnostics(): SupabaseDiagnostics {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  const forceMock = process.env.NEXT_PUBLIC_FORCE_MOCK === 'true';
  const hasUrl = url.length > 0;
  const hasKey = key.length > 0;
  let status: SupabaseStatus;
  if (forceMock) status = 'mock';
  else if (hasUrl && hasKey) status = 'supabase';
  else if (hasUrl || hasKey) status = 'misconfigured';
  else status = 'mock';
  return {
    status,
    hasUrl,
    hasKey,
    forceMock,
    urlHost: hasUrl ? safeHost(url) : null,
    keyHint: hasKey ? maskKey(key) : null,
  };
}

'use client';

import { useStore } from './store';
import type { Database, GuestSession, League } from '@/lib/types';
import { leagueByIdOrSlug } from './selectors';

// Subscribe to mutations (rev) and return the live, in-place-mutated db.
export function useDb(): Database {
  // Subscribing to rev forces a re-render on every commit; we then read the
  // current db snapshot (mutated in place for performance).
  useStore((s) => s.rev);
  return useStore.getState().db;
}

export function useReady(): boolean {
  return useStore((s) => s.ready);
}

export function useDataStatus(): { loading: boolean; saving: boolean; error: string | null } {
  return useStore((s) => ({ loading: s.loading, saving: s.saving, error: s.error }));
}

// Resolve a league by id or slug from the live db.
export function useLeague(key: string): League | undefined {
  const db = useDb();
  return leagueByIdOrSlug(db, key);
}

export function useMode(): 'mock' | 'supabase' {
  return useStore((s) => s.mode);
}

export function useSupabaseStatus() {
  const status = useStore((s) => s.supabaseStatus);
  const diagnostics = useStore((s) => s.supabaseDiagnostics);
  const error = useStore((s) => s.error);
  return { status, diagnostics, error };
}

export function useCurrentGuestId(): string {
  return useStore((s) => s.currentGuestId);
}

export function useCurrentGuest(): GuestSession | undefined {
  const db = useDb();
  const guestId = useCurrentGuestId();
  return db.guest_sessions.find((guest) => guest.id === guestId);
}

// Role of the current user in a league (owner/admin/manager/viewer).
export function useLeagueRole(leagueId: string | undefined): 'owner' | 'admin' | 'manager' | 'viewer' {
  useStore((s) => s.rev);
  if (!leagueId) return 'viewer';
  const { db, currentGuestId } = useStore.getState();
  if (db.leagues.some((league) => league.id === leagueId && league.owner_guest_id === currentGuestId)) return 'owner';
  const a = db.league_admins.find((x) => x.league_id === leagueId && x.guest_id === currentGuestId);
  return a?.role ?? 'viewer';
}

export function canManage(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

export function canAdminister(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

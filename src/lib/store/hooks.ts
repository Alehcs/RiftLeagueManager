'use client';

import { useStore } from './store';
import type { AdminRole, Database, GuestSession, League } from '@/lib/types';
import { leagueByIdOrSlug, managedTeamId, roleInLeague } from './selectors';

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
export function useLeagueRole(leagueId: string | undefined): AdminRole {
  useStore((s) => s.rev);
  if (!leagueId) return 'viewer';
  const { db, currentGuestId } = useStore.getState();
  return roleInLeague(db, leagueId, currentGuestId);
}

// The team the current guest manages in this league (null if none).
export function useManagedTeamId(leagueId: string | undefined): string | null {
  useStore((s) => s.rev);
  if (!leagueId) return null;
  const { db, currentGuestId } = useStore.getState();
  return managedTeamId(db, leagueId, currentGuestId);
}

export function canManage(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

export function canAdminister(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

// Whether the current guest may mutate a specific team's data.
export function canManageTeam(role: AdminRole, managedTeam: string | null, teamId: string | null | undefined): boolean {
  if (role === 'owner' || role === 'admin') return true;
  if (role === 'manager') return !!teamId && managedTeam === teamId;
  return false;
}

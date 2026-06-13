'use client';

import { useStore } from './store';
import type { Database, League } from '@/lib/types';
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

// Resolve a league by id or slug from the live db.
export function useLeague(key: string): League | undefined {
  const db = useDb();
  return leagueByIdOrSlug(db, key);
}

export function useMode(): 'mock' | 'supabase' {
  return useStore((s) => s.mode);
}

export function useCurrentUserId(): string {
  return useStore((s) => s.currentUserId);
}

// Role of the current user in a league (owner/admin/manager/viewer).
export function useLeagueRole(leagueId: string | undefined): 'owner' | 'admin' | 'manager' | 'viewer' {
  useStore((s) => s.rev);
  if (!leagueId) return 'viewer';
  const { db, currentUserId } = useStore.getState();
  const a = db.league_admins.find((x) => x.league_id === leagueId && x.user_id === currentUserId);
  return a?.role ?? 'viewer';
}

export function canManage(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

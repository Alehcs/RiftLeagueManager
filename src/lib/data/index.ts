'use client';

import type { Database, GuestSession } from '@/lib/types';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { MockAdapter } from './mockAdapter';
import { SupabaseAdapter } from './supabaseAdapter';

export type DataMode = 'mock' | 'supabase';

export interface DataEvent {
  kind: 'match' | 'trade' | 'roster' | 'import' | 'info' | 'success' | 'error';
  message: string;
}

export interface DataSnapshot {
  db: Database;
  currentGuestId: string;
}

export interface DataAdapter {
  readonly mode: DataMode;
  loadDatabase(): Promise<DataSnapshot>;
  saveDatabase(previous: Database, next: Database, event?: DataEvent, options?: { system?: boolean }): Promise<void>;
  setGuestId(guestId: string | null): void;
  resetGuestIdentity(): Promise<void>;
  recoverAdmin(roomCode: string, recoveryCode: string, guestId: string): Promise<string>;
  // A league member claims an unclaimed team as its manager.
  claimTeam(leagueId: string, teamId: string, guestId: string): Promise<void>;
  // Execute an accepted trade across both teams (server-side under RLS).
  acceptTrade(tradeId: string, guestId: string): Promise<void>;
  trackPresence(
    leagueId: string,
    guest: GuestSession,
    onChange: (guests: GuestSession[]) => void,
    onError: (error: Error) => void,
  ): () => void;
  subscribe(
    onChange: (snapshot: DataSnapshot, event?: DataEvent) => void,
    onError: (error: Error) => void,
  ): () => void;
  dispose(): void;
}

export function createDataAdapter(): DataAdapter {
  const client = getSupabaseBrowser();
  return client ? new SupabaseAdapter(client) : new MockAdapter();
}

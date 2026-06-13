'use client';

import type { Database } from '@/lib/types';
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
  currentUserId: string;
}

export interface DataAdapter {
  readonly mode: DataMode;
  loadDatabase(): Promise<DataSnapshot>;
  saveDatabase(previous: Database, next: Database, event?: DataEvent): Promise<void>;
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

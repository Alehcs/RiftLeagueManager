'use client';

import { buildSeedDatabase } from '@/data/seed';
import { BROADCAST_CHANNEL, DEMO_USER_ID, STORAGE_KEY } from '@/lib/constants';
import { EMPTY_DB, type Database } from '@/lib/types';
import type { DataAdapter, DataEvent, DataSnapshot } from './index';

interface BroadcastMessage {
  origin: string;
  db: Database;
  event?: DataEvent;
}

export class MockAdapter implements DataAdapter {
  readonly mode = 'mock' as const;
  private readonly origin = Math.random().toString(36).slice(2);
  private channel: BroadcastChannel | null = null;

  async loadDatabase(): Promise<DataSnapshot> {
    const existing = this.readLocalDatabase();
    const db = existing ?? buildSeedDatabase();
    if (!existing) this.writeLocalDatabase(db);
    return { db, currentUserId: DEMO_USER_ID };
  }

  async saveDatabase(_previous: Database, next: Database, event?: DataEvent): Promise<void> {
    this.writeLocalDatabase(next);
    this.channel?.postMessage({
      origin: this.origin,
      db: structuredClone(next),
      event,
    } satisfies BroadcastMessage);
  }

  subscribe(
    onChange: (snapshot: DataSnapshot, event?: DataEvent) => void,
    onError: (error: Error) => void,
  ): () => void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return () => undefined;
    this.channel = new BroadcastChannel(BROADCAST_CHANNEL);
    this.channel.onmessage = (message: MessageEvent<BroadcastMessage>) => {
      try {
        if (!message.data || message.data.origin === this.origin) return;
        onChange({ db: message.data.db, currentUserId: DEMO_USER_ID }, message.data.event);
      } catch (error) {
        onError(asError(error));
      }
    };
    return () => this.dispose();
  }

  dispose(): void {
    this.channel?.close();
    this.channel = null;
  }

  private readLocalDatabase(): Database | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Database;
      if (!parsed || !Array.isArray(parsed.leagues)) return null;
      return { ...structuredClone(EMPTY_DB), ...parsed };
    } catch {
      return null;
    }
  }

  private writeLocalDatabase(db: Database): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (error) {
      throw new Error(`Unable to persist mock data: ${asError(error).message}`);
    }
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

'use client';

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { EMPTY_DB, type Database } from '@/lib/types';
import type { DataAdapter, DataEvent, DataSnapshot } from './index';

type TableName = keyof Database;
type Row = Database[TableName][number];

const TABLES = Object.keys(EMPTY_DB) as TableName[];
const UPSERT_ORDER: TableName[] = [
  'profiles',
  'leagues',
  'teams',
  'league_admins',
  'players',
  'coaches',
  'matches',
  'games',
  'trades',
  'trade_items',
  'transfer_history',
  'import_sources',
  'import_jobs',
  'audit_logs',
];
const DELETE_ORDER: TableName[] = [
  'leagues',
  'audit_logs',
  'import_jobs',
  'transfer_history',
  'trade_items',
  'trades',
  'games',
  'matches',
  'coaches',
  'players',
  'teams',
  'league_admins',
  'import_sources',
  'profiles',
];
const REALTIME_TABLES: TableName[] = [
  'matches',
  'games',
  'teams',
  'players',
  'coaches',
  'trades',
  'trade_items',
  'transfer_history',
  'audit_logs',
];

export class SupabaseAdapter implements DataAdapter {
  readonly mode = 'supabase' as const;
  private currentUserId = '';
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private activeWrites = 0;
  private reloadAfterWrite = false;
  private anonymousAttempted = false;
  private realtimeReload: (() => void) | null = null;

  constructor(private readonly client: SupabaseClient) {}

  async loadDatabase(): Promise<DataSnapshot> {
    const user = await this.getAuthenticatedUser(true);
    this.currentUserId = user?.id ?? '';
    if (user) await this.ensureProfile(user);

    const entries = await Promise.all(TABLES.map(async (table) => [table, await this.readTable(table)] as const));
    const db = structuredClone(EMPTY_DB);
    for (const [table, rows] of entries) {
      (db[table] as Row[]) = rows;
    }
    return { db, currentUserId: this.currentUserId };
  }

  async saveDatabase(previous: Database, next: Database, _event?: DataEvent): Promise<void> {
    const user = await this.getAuthenticatedUser(true);
    this.currentUserId = user?.id ?? '';
    if (!user) throw new Error('Sign in to Supabase before changing league data.');
    this.assertAuthorized(previous, next, user.id);

    this.activeWrites++;
    try {
      for (const table of DELETE_ORDER) {
        const ids = deletedIds(previous[table] as Row[], next[table] as Row[]);
        await this.deleteRows(table, ids);
      }
      for (const table of UPSERT_ORDER) {
        const rows = changedRows(previous[table] as Row[], next[table] as Row[]);
        await this.upsertRows(table, rows);
      }
    } finally {
      this.activeWrites--;
      if (this.activeWrites === 0 && this.reloadAfterWrite) {
        this.reloadAfterWrite = false;
        this.realtimeReload?.();
      }
    }
  }

  subscribe(
    onChange: (snapshot: DataSnapshot, event?: DataEvent) => void,
    onError: (error: Error) => void,
  ): () => void {
    const channel = this.client.channel('rift-league-data');
    const reload = () => {
      if (this.activeWrites > 0) {
        this.reloadAfterWrite = true;
        return;
      }
      if (this.reloadTimer) clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => {
        void this.loadDatabase().then((snapshot) => onChange(snapshot)).catch((error) => onError(asError(error)));
      }, 250);
    };
    this.realtimeReload = reload;

    for (const table of REALTIME_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, reload);
    }
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError(new Error(`Supabase Realtime connection failed: ${status.toLowerCase()}`));
      }
    });

    const { data: authListener } = this.client.auth.onAuthStateChange(() => reload());
    return () => {
      if (this.reloadTimer) clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
      this.realtimeReload = null;
      authListener.subscription.unsubscribe();
      void this.client.removeChannel(channel);
    };
  }

  dispose(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = null;
  }

  private async getAuthenticatedUser(createAnonymous = false): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error && !error.message.toLowerCase().includes('session')) throw error;
    if (data.user || !createAnonymous || this.anonymousAttempted) return data.user;

    this.anonymousAttempted = true;
    const anonymous = await this.client.auth.signInAnonymously();
    if (anonymous.error) return null;
    return anonymous.data.user;
  }

  private async ensureProfile(user: User): Promise<void> {
    const username =
      (typeof user.user_metadata?.username === 'string' && user.user_metadata.username) ||
      user.email?.split('@')[0] ||
      'User';
    const { error } = await this.client.from('profiles').upsert(
      {
        id: user.id,
        email: user.email ?? `${user.id}@local.invalid`,
        username,
        avatar_url: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  private async readTable(table: TableName): Promise<Row[]> {
    const pageSize = 1000;
    const rows: Row[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await this.client.from(table).select('*').range(from, from + pageSize - 1);
      if (error) throw new Error(`Unable to load ${table}: ${error.message}`);
      const page = (data ?? []).map((row) => fromSupabaseRow(table, row as Record<string, unknown>));
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }

  private async deleteRows(table: TableName, ids: string[]): Promise<void> {
    for (const batch of chunks(ids, 200)) {
      const { error } = await this.client.from(table).delete().in('id', batch);
      if (error) throw new Error(`Unable to delete ${table}: ${error.message}`);
    }
  }

  private async upsertRows(table: TableName, rows: Row[]): Promise<void> {
    for (const batch of chunks(rows, 200)) {
      const payload = batch.map((row) => toSupabaseRow(table, row));
      const { error } = await this.client.from(table).upsert(payload, { onConflict: 'id' });
      if (error) throw new Error(`Unable to save ${table}: ${error.message}`);
    }
  }

  private assertAuthorized(previous: Database, next: Database, userId: string): void {
    const editable = new Set<string>();
    for (const db of [previous, next]) {
      db.leagues.filter((league) => league.owner_user_id === userId).forEach((league) => editable.add(league.id));
      db.league_admins
        .filter((admin) => admin.user_id === userId && (admin.role === 'owner' || admin.role === 'admin'))
        .forEach((admin) => editable.add(admin.league_id));
    }

    const touched = touchedLeagueIds(previous, next);
    const unauthorized = [...touched].filter((leagueId) => !editable.has(leagueId));
    if (unauthorized.length) throw new Error('You need league owner or admin access to make this change.');

    const changedProfiles = changedRows(previous.profiles, next.profiles);
    if (changedProfiles.some((profile) => profile.id !== userId)) {
      throw new Error('You can only update your own profile.');
    }
  }
}

function changedRows<T extends { id: string }>(previous: T[], next: T[]): T[] {
  const before = new Map(previous.map((row) => [row.id, JSON.stringify(row)]));
  return next.filter((row) => before.get(row.id) !== JSON.stringify(row));
}

function deletedIds<T extends { id: string }>(previous: T[], next: T[]): string[] {
  const remaining = new Set(next.map((row) => row.id));
  return previous.filter((row) => !remaining.has(row.id)).map((row) => row.id);
}

function touchedLeagueIds(previous: Database, next: Database): Set<string> {
  const result = new Set<string>();
  const directTables = [
    'leagues',
    'league_admins',
    'teams',
    'players',
    'coaches',
    'matches',
    'trades',
    'transfer_history',
    'audit_logs',
  ] as const;

  for (const table of directTables) {
    for (const db of [previous, next]) {
      const other = db === previous ? next : previous;
      const currentRows = db[table] as Row[];
      const otherRows = other[table] as Row[];
      const rows = [...changedRows(otherRows, currentRows), ...deletedRows(otherRows, currentRows)];
      for (const row of rows) {
        result.add(table === 'leagues' ? row.id : (row as Row & { league_id: string }).league_id);
      }
    }
  }

  for (const db of [previous, next]) {
    const other = db === previous ? next : previous;
    for (const game of [...changedRows(other.games, db.games), ...deletedRows(other.games, db.games)]) {
      const match = db.matches.find((item) => item.id === game.match_id) ?? other.matches.find((item) => item.id === game.match_id);
      if (match) result.add(match.league_id);
    }
    for (const item of [...changedRows(other.trade_items, db.trade_items), ...deletedRows(other.trade_items, db.trade_items)]) {
      const trade = db.trades.find((entry) => entry.id === item.trade_id) ?? other.trades.find((entry) => entry.id === item.trade_id);
      if (trade) result.add(trade.league_id);
    }
    for (const job of [...changedRows(other.import_jobs, db.import_jobs), ...deletedRows(other.import_jobs, db.import_jobs)]) {
      if (job.league_id) result.add(job.league_id);
    }
  }
  return result;
}

function deletedRows<T extends { id: string }>(previous: T[], next: T[]): T[] {
  const remaining = new Set(next.map((row) => row.id));
  return previous.filter((row) => !remaining.has(row.id));
}

function fromSupabaseRow(table: TableName, row: Record<string, unknown>): Row {
  if (table !== 'audit_logs') return row as unknown as Row;
  return {
    ...row,
    before_json: row.before_json == null ? null : JSON.stringify(row.before_json),
    after_json: row.after_json == null ? null : JSON.stringify(row.after_json),
  } as Row;
}

function toSupabaseRow(table: TableName, row: Row): Record<string, unknown> {
  const payload = { ...row } as Record<string, unknown>;
  if (table === 'audit_logs') {
    payload.before_json = parseJson(payload.before_json);
    payload.after_json = parseJson(payload.after_json);
  }
  return payload;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

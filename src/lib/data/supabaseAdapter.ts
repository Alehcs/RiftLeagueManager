'use client';

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { GUEST_STORAGE_KEY } from '@/lib/constants';
import { nowISO } from '@/lib/utils';
import { EMPTY_DB, type Database, type GuestSession } from '@/lib/types';
import type { DataAdapter, DataEvent, DataSnapshot } from './index';

type TableName = keyof Database;
type Row = Database[TableName][number];

const TABLES = Object.keys(EMPTY_DB) as TableName[];
const UPSERT_ORDER: TableName[] = [
  'profiles',
  'guest_sessions',
  'leagues',
  'season_circuits',
  'teams',
  'league_admins',
  'league_members',
  'players',
  'coaches',
  'matches',
  'games',
  'trades',
  'trade_items',
  'transfer_history',
  'market_offers',
  'match_simulations',
  'import_sources',
  'import_jobs',
  'audit_logs',
];
const DELETE_ORDER: TableName[] = [
  'leagues',
  'season_circuits',
  'audit_logs',
  'import_jobs',
  'transfer_history',
  'market_offers',
  'match_simulations',
  'trade_items',
  'trades',
  'games',
  'matches',
  'coaches',
  'players',
  'teams',
  'league_members',
  'league_admins',
  'guest_sessions',
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
  'market_offers',
  'match_simulations',
  'audit_logs',
  'league_members',
  'season_circuits',
];

export class SupabaseAdapter implements DataAdapter {
  readonly mode = 'supabase' as const;
  private currentGuestId = '';
  private authUserId = '';
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private activeWrites = 0;
  private reloadAfterWrite = false;
  private lastAuthError = '';
  private realtimeReload: (() => void) | null = null;

  constructor(private readonly client: SupabaseClient) {}

  async loadDatabase(): Promise<DataSnapshot> {
    const user = await this.getAuthenticatedUser(true);
    this.authUserId = user?.id ?? '';
    this.currentGuestId = this.readGuestId();
    const boundGuest = await this.client.rpc('current_guest_id');
    if (boundGuest.error) throw new Error(boundGuest.error.message);
    const boundGuestId = boundGuest.data ? String(boundGuest.data) : '';
    if (boundGuestId && (!this.currentGuestId || this.currentGuestId === boundGuestId)) this.setGuestId(boundGuestId);
    else if (this.currentGuestId !== boundGuestId) this.setGuestId(null);

    const entries = await Promise.all(TABLES.map(async (table) => [table, await this.readTable(table)] as const));
    const db = structuredClone(EMPTY_DB);
    for (const [table, rows] of entries) {
      (db[table] as Row[]) = rows;
    }
    if (this.currentGuestId && db.guest_sessions.some((guest) => guest.id === this.currentGuestId)) {
      await this.client.from('guest_sessions').update({ last_seen_at: nowISO() }).eq('id', this.currentGuestId);
    } else {
      this.setGuestId(null);
    }
    return { db, currentGuestId: this.currentGuestId };
  }

  async saveDatabase(previous: Database, next: Database, _event?: DataEvent, _options?: { system?: boolean }): Promise<void> {
    const user = await this.getAuthenticatedUser(true);
    this.authUserId = user?.id ?? '';
    if (!user) {
      throw new Error(
        this.lastAuthError
          ? `Unable to start the guest session: ${this.lastAuthError}. Enable Anonymous Sign-Ins in Supabase Authentication.`
          : 'Unable to start the guest session. Enable Anonymous Sign-Ins in Supabase Authentication.',
      );
    }
    if (!this.currentGuestId) this.currentGuestId = this.readGuestId();
    this.assertAuthorized(previous, next, this.currentGuestId);

    this.activeWrites++;
    try {
      for (const table of DELETE_ORDER) {
        const ids = deletedIds(previous[table] as Row[], next[table] as Row[]);
        await this.deleteRows(table, ids);
      }
      for (const table of UPSERT_ORDER) {
        const rows = changedRows(previous[table] as Row[], next[table] as Row[]);
        const existingIds = new Set((previous[table] as Row[]).map((row) => row.id));
        await this.insertRows(table, rows.filter((row) => !existingIds.has(row.id)));
        await this.updateRows(table, rows.filter((row) => existingIds.has(row.id)));
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

  setGuestId(guestId: string | null): void {
    this.currentGuestId = guestId ?? '';
    if (typeof window === 'undefined') return;
    if (guestId) window.localStorage.setItem(GUEST_STORAGE_KEY, guestId);
    else window.localStorage.removeItem(GUEST_STORAGE_KEY);
  }

  async resetGuestIdentity(): Promise<void> {
    this.setGuestId(null);
    this.lastAuthError = '';
    this.authUserId = '';
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  async recoverAdmin(roomCode: string, recoveryCode: string, guestId: string): Promise<string> {
    const { data, error } = await this.client.rpc('recover_league_admin', {
      target_room_code: roomCode.trim().toUpperCase(),
      recovery_code: recoveryCode,
      target_guest_id: guestId,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Invalid room or recovery code.');
    return String(data);
  }

  async claimTeam(leagueId: string, teamId: string, guestId: string): Promise<void> {
    const { error } = await this.client.rpc('claim_team', {
      target_league_id: leagueId,
      target_team_id: teamId,
      target_guest_id: guestId,
    });
    if (error) throw new Error(error.message);
  }

  async acceptTrade(tradeId: string, guestId: string): Promise<void> {
    const { error } = await this.client.rpc('accept_trade', {
      target_trade_id: tradeId,
      target_guest_id: guestId,
    });
    if (error) throw new Error(error.message);
  }

  trackPresence(
    leagueId: string,
    guest: GuestSession,
    onChange: (guests: GuestSession[]) => void,
    onError: (error: Error) => void,
  ): () => void {
    const channel = this.client.channel(`league-presence:${leagueId}`, { config: { presence: { key: guest.id } } });
    const sync = () => {
      const state = channel.presenceState<GuestSession>();
      const unique = new Map<string, GuestSession>();
      for (const entries of Object.values(state)) {
        for (const entry of entries) unique.set(entry.id, entry);
      }
      onChange([...unique.values()]);
    };
    channel.on('presence', { event: 'sync' }, sync);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ ...guest, last_seen_at: nowISO() }).catch((error) => onError(asError(error)));
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError(new Error(`Presence connection failed: ${status.toLowerCase()}`));
      }
    });
    return () => {
      void channel.untrack();
      void this.client.removeChannel(channel);
    };
  }

  private async getAuthenticatedUser(createAnonymous = false): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error && !error.message.toLowerCase().includes('session')) throw error;
    if (data.user || !createAnonymous) return data.user;

    const anonymous = await this.client.auth.signInAnonymously();
    if (anonymous.error) {
      this.lastAuthError = anonymous.error.message;
      return null;
    }
    this.lastAuthError = '';
    return anonymous.data.user;
  }

  private readGuestId(): string {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(GUEST_STORAGE_KEY) ?? '';
  }

  private async readTable(table: TableName): Promise<Row[]> {
    const pageSize = 1000;
    const rows: Row[] = [];
    for (let from = 0; ; from += pageSize) {
      const response = table === 'guest_sessions'
        ? await this.client.from('guest_sessions').select('id, display_name, avatar_color, created_at, last_seen_at').range(from, from + pageSize - 1)
        : table === 'leagues'
          ? await this.client.from('leagues').select('id, name, slug, region, tier, season, logo_url, external_url, source_name, source_url, format, owner_guest_id, owner_user_id, room_code, is_seed, last_imported_at, run_phase, starting_budget, preparation_weeks, bot_teams_enabled, bot_team_count, friendlies_affect_development, market_rules, free_agent_offer_window_hours, current_run_week, run_seed, run_started_at, run_completed_at, competition_mode, created_at, updated_at').range(from, from + pageSize - 1)
          : await this.client.from(table).select('*').range(from, from + pageSize - 1);
      const { data, error } = response;
      if (error) throw new Error(dbError('load', table, error.message));
      const page = (data ?? []).map((row) => fromSupabaseRow(table, row as unknown as Record<string, unknown>));
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }

  private async deleteRows(table: TableName, ids: string[]): Promise<void> {
    for (const batch of chunks(ids, 200)) {
      const { error } = await this.client.from(table).delete().in('id', batch);
      if (error) throw new Error(dbError('delete', table, error.message));
    }
  }

  private async insertRows(table: TableName, rows: Row[]): Promise<void> {
    for (const batch of chunks(rows, 200)) {
      const payload = await Promise.all(batch.map((row) => this.toSupabaseRow(table, row)));
      const { error } = await this.client.from(table).insert(payload);
      if (!error) continue;
      // Writes are full-row snapshots diffed against a client snapshot that can
      // lag the server: a burst of writes (e.g. creating a league + its teams)
      // can race the realtime reload and re-attempt a row an earlier queued write
      // already inserted. On a primary-key conflict, re-apply the snapshot as an
      // upsert so the batch converges instead of aborting and skipping later
      // writes. Plain insert is kept for the normal path so RLS insert policies
      // (which upsert's ON CONFLICT DO UPDATE would also gate on UPDATE) still apply.
      if (error.code === '23505') {
        const { error: upsertError } = await this.client.from(table).upsert(payload);
        if (upsertError) throw new Error(dbError('insert', table, upsertError.message));
        continue;
      }
      throw new Error(dbError('insert', table, error.message));
    }
  }

  private async updateRows(table: TableName, rows: Row[]): Promise<void> {
    for (const row of rows) {
      const payload = await this.toSupabaseRow(table, row);
      delete payload.id;
      const { error } = await this.client.from(table).update(payload).eq('id', row.id);
      if (error) throw new Error(dbError('update', table, error.message));
    }
  }

  private async toSupabaseRow(table: TableName, row: Row): Promise<Record<string, unknown>> {
    const payload = { ...row } as Record<string, unknown>;
    if (table === 'audit_logs') {
      payload.before_json = parseJson(payload.before_json);
      payload.after_json = parseJson(payload.after_json);
    }
    if (table === 'match_simulations') {
      payload.event_timeline = parseJson(payload.event_timeline);
      payload.final_result = parseJson(payload.final_result);
      payload.player_stats = parseJson(payload.player_stats);
      payload.team_stats = parseJson(payload.team_stats);
    }
    if (table === 'season_circuits') {
      payload.calendar_json = parseJson(payload.calendar_json);
      payload.competitions_json = parseJson(payload.competitions_json);
      payload.qualification_rules_json = parseJson(payload.qualification_rules_json);
      payload.qualification_results_json = parseJson(payload.qualification_results_json);
    }
    if (table === 'matches') {
      for (const key of ['blue_team_id', 'red_team_id', 'winner_team_id', 'feeds_winner_to', 'feeds_loser_to']) {
        if (payload[key] === '') payload[key] = null;
      }
    }
    if (table === 'market_offers') {
      // `reason`/`from_team_id` are client-only display fields on bot offers and
      // have no Postgres columns; drop them so inserts/updates don't 400.
      delete payload.reason;
      delete payload.from_team_id;
    }
    if (table === 'guest_sessions') payload.auth_user_id = this.authUserId;
    if (table === 'leagues' && typeof payload.admin_code_hash === 'string' && payload.admin_code_hash.startsWith('plain:')) {
      payload.admin_code_hash = await sha256(payload.admin_code_hash.slice(6));
    }
    return payload;
  }

  private assertAuthorized(previous: Database, next: Database, guestId: string): void {
    if (!guestId) throw new Error('Choose a nickname before changing league data.');
    const editable = new Set<string>();
    const administrable = new Set<string>();
    for (const db of [previous, next]) {
      db.leagues
        .filter((league) => league.owner_guest_id === guestId)
        .forEach((league) => {
          editable.add(league.id);
          administrable.add(league.id);
        });
      db.league_admins
        .filter((admin) => admin.guest_id === guestId && ['owner', 'admin', 'manager'].includes(admin.role))
        .forEach((admin) => editable.add(admin.league_id));
      db.league_admins
        .filter((admin) => admin.guest_id === guestId && ['owner', 'admin'].includes(admin.role))
        .forEach((admin) => administrable.add(admin.league_id));
      // Team managers are stored in league_members.
      db.league_members
        .filter((member) => member.guest_id === guestId && ['owner', 'admin', 'manager'].includes(member.role))
        .forEach((member) => editable.add(member.league_id));
      db.league_members
        .filter((member) => member.guest_id === guestId && ['owner', 'admin'].includes(member.role))
        .forEach((member) => administrable.add(member.league_id));
    }

    const restricted = restrictedLeagueIds(previous, next);
    if ([...restricted].some((leagueId) => !administrable.has(leagueId))) {
      throw new Error('Only a league owner or admin can change league settings or permissions.');
    }
    const touched = touchedLeagueIds(previous, next);
    const unauthorized = [...touched].filter((leagueId) => !editable.has(leagueId));
    if (unauthorized.length) throw new Error('You need manager, admin, or owner access to make this change.');
    assertMemberChangesAuthorized(previous, next, guestId, administrable);

    const changedGuests = changedRows(previous.guest_sessions, next.guest_sessions);
    if (changedGuests.some((guest) => guest.id !== guestId)) {
      throw new Error('You can only update your own guest profile.');
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
    'market_offers',
    'match_simulations',
    'season_circuits',
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

function restrictedLeagueIds(previous: Database, next: Database): Set<string> {
  const result = new Set<string>();
  for (const league of [...changedRows(previous.leagues, next.leagues), ...deletedRows(previous.leagues, next.leagues)]) {
    result.add(league.id);
  }
  for (const admin of [
    ...changedRows(previous.league_admins, next.league_admins),
    ...deletedRows(previous.league_admins, next.league_admins),
  ]) {
    result.add(admin.league_id);
  }
  return result;
}

function assertMemberChangesAuthorized(
  previous: Database,
  next: Database,
  guestId: string,
  administrable: Set<string>,
): void {
  const before = new Map(previous.league_members.map((member) => [member.id, member]));
  const after = new Map(next.league_members.map((member) => [member.id, member]));
  const changed = new Set([
    ...changedRows(previous.league_members, next.league_members).map((member) => member.id),
    ...deletedRows(previous.league_members, next.league_members).map((member) => member.id),
  ]);
  for (const id of changed) {
    const oldMember = before.get(id);
    const newMember = after.get(id);
    const leagueId = newMember?.league_id ?? oldMember?.league_id ?? '';
    if (administrable.has(leagueId)) continue;
    const isSelfViewer = [oldMember, newMember]
      .filter((member): member is NonNullable<typeof member> => Boolean(member))
      .every((member) => member.guest_id === guestId && member.role === 'viewer' && member.league_id === leagueId);
    if (!isSelfViewer) throw new Error('Only a league owner or admin can change member permissions.');
  }
}

function deletedRows<T extends { id: string }>(previous: T[], next: T[]): T[] {
  const remaining = new Set(next.map((row) => row.id));
  return previous.filter((row) => !remaining.has(row.id));
}

function fromSupabaseRow(table: TableName, row: Record<string, unknown>): Row {
  if (table === 'match_simulations') {
    return {
      ...row,
      event_timeline: JSON.stringify(row.event_timeline ?? []),
      final_result: JSON.stringify(row.final_result ?? {}),
      player_stats: JSON.stringify(row.player_stats ?? []),
      team_stats: JSON.stringify(row.team_stats ?? {}),
    } as Row;
  }
  if (table === 'season_circuits') {
    return {
      ...row,
      calendar_json: JSON.stringify(row.calendar_json ?? []),
      competitions_json: JSON.stringify(row.competitions_json ?? []),
      qualification_rules_json: JSON.stringify(row.qualification_rules_json ?? []),
      qualification_results_json: JSON.stringify(row.qualification_results_json ?? []),
    } as Row;
  }
  if (table === 'matches') {
    return {
      ...row,
      blue_team_id: row.blue_team_id ?? '',
      red_team_id: row.red_team_id ?? '',
    } as Row;
  }
  if (table !== 'audit_logs') return row as unknown as Row;
  return {
    ...row,
    before_json: row.before_json == null ? null : JSON.stringify(row.before_json),
    after_json: row.after_json == null ? null : JSON.stringify(row.after_json),
  } as Row;
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

// Surface the exact Postgres message, with an actionable hint when the roles
// are missing table grants (re-run the migration).
function dbError(action: string, table: TableName, message: string): string {
  const base = `Unable to ${action} ${table}: ${message}`;
  if (/permission denied/i.test(message)) {
    return `${base}. Re-run supabase/migrations/0001_init.sql to grant the anon/authenticated roles table access.`;
  }
  return base;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

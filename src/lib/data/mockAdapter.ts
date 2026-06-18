'use client';

import { buildSeedDatabase } from '@/data/seed';
import { BROADCAST_CHANNEL, GUEST_STORAGE_KEY, STORAGE_KEY } from '@/lib/constants';
import { createRoomCode, nowISO, uid } from '@/lib/utils';
import { EMPTY_DB, type Database, type GuestSession } from '@/lib/types';
import { managedTeamId, roleInLeague } from '@/lib/store/selectors';
import { runPhase } from '@/services/run';
import type { DataAdapter, DataEvent, DataSnapshot } from './index';

type MockRow = Database[keyof Database][number];

interface BroadcastMessage {
  origin: string;
  db: Database;
  event?: DataEvent;
}

interface PresenceMessage {
  type: 'join' | 'heartbeat' | 'leave';
  instanceId: string;
  leagueId: string;
  guest: GuestSession;
  seenAt: number;
}

export class MockAdapter implements DataAdapter {
  readonly mode = 'mock' as const;
  private readonly origin = Math.random().toString(36).slice(2);
  private channel: BroadcastChannel | null = null;
  private presenceChannel: BroadcastChannel | null = null;
  private currentGuestId = '';

  async loadDatabase(): Promise<DataSnapshot> {
    const existing = this.readLocalDatabase();
    const db = normalizeMockDatabase(existing ?? buildSeedDatabase());
    this.writeLocalDatabase(db);
    this.currentGuestId = this.readGuestId();
    return { db, currentGuestId: this.currentGuestId };
  }

  async saveDatabase(_previous: Database, next: Database, event?: DataEvent, options?: { system?: boolean }): Promise<void> {
    if (!options?.system) this.assertAuthorized(_previous, next);
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
        onChange({ db: normalizeMockDatabase(message.data.db), currentGuestId: this.readGuestId() }, message.data.event);
      } catch (error) {
        onError(asError(error));
      }
    };
    return () => this.dispose();
  }

  dispose(): void {
    this.channel?.close();
    this.channel = null;
    this.presenceChannel?.close();
    this.presenceChannel = null;
  }

  setGuestId(guestId: string | null): void {
    this.currentGuestId = guestId ?? '';
    if (typeof window === 'undefined') return;
    if (guestId) window.localStorage.setItem(GUEST_STORAGE_KEY, guestId);
    else window.localStorage.removeItem(GUEST_STORAGE_KEY);
  }

  async resetGuestIdentity(): Promise<void> {
    this.setGuestId(null);
  }

  async recoverAdmin(roomCode: string, recoveryCode: string, guestId: string): Promise<string> {
    const db = this.readLocalDatabase() ?? normalizeMockDatabase(buildSeedDatabase());
    const league = db.leagues.find((item) => item.room_code === roomCode.trim().toUpperCase());
    if (!league || league.admin_code_hash !== `plain:${recoveryCode}`) throw new Error('Invalid room or recovery code.');
    if (!db.league_admins.some((admin) => admin.league_id === league.id && admin.guest_id === guestId)) {
      db.league_admins.push({ id: uid('admin'), league_id: league.id, guest_id: guestId, role: 'admin', team_id: null });
    }
    const member = db.league_members.find((item) => item.league_id === league.id && item.guest_id === guestId);
    if (member) member.role = 'admin';
    else db.league_members.push({ id: uid('member'), league_id: league.id, guest_id: guestId, role: 'admin', joined_at: nowISO() });
    this.writeLocalDatabase(db);
    this.channel?.postMessage({ origin: this.origin, db, event: { kind: 'success', message: 'Admin access recovered' } } satisfies BroadcastMessage);
    return league.id;
  }

  async claimTeam(leagueId: string, teamId: string, guestId: string): Promise<void> {
    const db = this.readLocalDatabase() ?? normalizeMockDatabase(buildSeedDatabase());
    const team = db.teams.find((t) => t.id === teamId && t.league_id === leagueId);
    if (!team) throw new Error('Team not found in this league.');
    const league = db.leagues.find((item) => item.id === leagueId);
    if (!league || runPhase(league) !== 'team_selection') throw new Error('Teams can only be claimed during team selection.');
    if (team.is_bot) throw new Error('That team is assigned to a bot.');
    const taken = db.league_members.find(
      (m) => m.league_id === leagueId && m.role === 'manager' && m.team_id === teamId && m.guest_id !== guestId,
    );
    if (taken) throw new Error('That team already has a manager.');
    if (managedTeamId(db, leagueId, guestId) && managedTeamId(db, leagueId, guestId) !== teamId) {
      throw new Error('You already manage another team in this league.');
    }
    const member = db.league_members.find((m) => m.league_id === leagueId && m.guest_id === guestId);
    if (member) { member.role = 'manager'; member.team_id = teamId; }
    else db.league_members.push({ id: uid('member'), league_id: leagueId, guest_id: guestId, role: 'manager', team_id: teamId, joined_at: nowISO() });
    this.writeLocalDatabase(db);
    this.channel?.postMessage({ origin: this.origin, db: structuredClone(db), event: { kind: 'roster', message: `${team.short_name} claimed` } } satisfies BroadcastMessage);
  }

  async acceptTrade(tradeId: string, guestId: string): Promise<void> {
    const db = this.readLocalDatabase() ?? normalizeMockDatabase(buildSeedDatabase());
    const trade = db.trades.find((t) => t.id === tradeId);
    if (!trade) throw new Error('Trade not found.');
    if (trade.status !== 'pending') throw new Error('This trade is no longer pending.');
    const role = roleInLeague(db, trade.league_id, guestId);
    const isAdmin = role === 'owner' || role === 'admin';
    const reviewerTeam = managedTeamId(db, trade.league_id, guestId);
    if (!isAdmin && reviewerTeam !== trade.to_team_id) {
      throw new Error("Only the receiving team's manager or an admin can accept this trade.");
    }
    const items = db.trade_items.filter((ti) => ti.trade_id === tradeId);
    for (const ti of items) {
      const p = db.players.find((x) => x.id === ti.player_id);
      if (p) {
        p.team_id = ti.to_team_id;
        p.status = 'active';
        p.updated_at = nowISO();
        db.transfer_history.push({ id: uid('th'), league_id: p.league_id, player_id: p.id, from_team_id: ti.from_team_id, to_team_id: ti.to_team_id, transfer_type: 'trade', amount: 0, created_at: nowISO() });
      }
    }
    const fromTeam = db.teams.find((t) => t.id === trade.from_team_id);
    const toTeam = db.teams.find((t) => t.id === trade.to_team_id);
    if (fromTeam) fromTeam.budget += trade.money_to_team - trade.money_from_team;
    if (toTeam) toTeam.budget += trade.money_from_team - trade.money_to_team;
    trade.status = 'accepted';
    trade.reviewed_at = nowISO();
    trade.reviewed_by_guest_id = guestId;
    this.writeLocalDatabase(db);
    this.channel?.postMessage({ origin: this.origin, db: structuredClone(db), event: { kind: 'trade', message: 'Trade accepted' } } satisfies BroadcastMessage);
  }

  trackPresence(
    leagueId: string,
    guest: GuestSession,
    onChange: (guests: GuestSession[]) => void,
    onError: (error: Error) => void,
  ): () => void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      onChange([guest]);
      return () => undefined;
    }
    const instanceId = uid('presence');
    const entries = new Map<string, PresenceMessage>();
    const channel = new BroadcastChannel(`${BROADCAST_CHANNEL}.presence.${leagueId}`);
    this.presenceChannel = channel;
    const publish = () => {
      const active = [...entries.values()].filter((entry) => Date.now() - entry.seenAt < 20_000);
      const unique = new Map(active.map((entry) => [entry.guest.id, entry.guest]));
      unique.set(guest.id, guest);
      onChange([...unique.values()]);
    };
    const send = (type: PresenceMessage['type']) => {
      const message: PresenceMessage = { type, instanceId, leagueId, guest, seenAt: Date.now() };
      if (type === 'leave') entries.delete(instanceId);
      else entries.set(instanceId, message);
      channel.postMessage(message);
      publish();
    };
    channel.onmessage = (event: MessageEvent<PresenceMessage>) => {
      try {
        const message = event.data;
        if (!message || message.leagueId !== leagueId) return;
        if (message.type === 'leave') entries.delete(message.instanceId);
        else entries.set(message.instanceId, message);
        publish();
      } catch (error) {
        onError(asError(error));
      }
    };
    send('join');
    const heartbeat = window.setInterval(() => send('heartbeat'), 8_000);
    return () => {
      window.clearInterval(heartbeat);
      send('leave');
      channel.close();
      if (this.presenceChannel === channel) this.presenceChannel = null;
    };
  }

  private readLocalDatabase(): Database | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Database;
      if (!parsed || !Array.isArray(parsed.leagues)) return null;
      return normalizeMockDatabase(parsed);
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

  private assertAuthorized(previous: Database, next: Database): void {
    const guestId = this.currentGuestId || this.readGuestId();
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
    const unauthorized = [...touchedLeagueIds(previous, next)].filter((leagueId) => !editable.has(leagueId));
    if (unauthorized.length) throw new Error('You need manager, admin, or owner access to make this change.');
    assertMemberChangesAuthorized(previous, next, guestId, administrable);
    const changedGuests = changedRows(previous.guest_sessions, next.guest_sessions);
    if (changedGuests.some((guest) => guest.id !== guestId)) throw new Error('You can only update your own guest profile.');
  }

  private readGuestId(): string {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(GUEST_STORAGE_KEY) ?? '';
  }
}

function normalizeMockDatabase(input: Database): Database {
  const db = { ...structuredClone(EMPTY_DB), ...input } as Database;
  db.leagues = db.leagues.map((league) => ({
    ...league,
    owner_guest_id: league.owner_guest_id || league.owner_user_id || '',
    room_code: league.room_code || createRoomCode(),
    admin_code_hash: league.admin_code_hash ?? null,
    run_phase: league.run_phase ?? 'lobby',
    starting_budget: league.starting_budget ?? 5_000_000,
    preparation_weeks: league.preparation_weeks ?? 3,
    bot_teams_enabled: league.bot_teams_enabled ?? false,
    bot_team_count: league.bot_team_count ?? 0,
    friendlies_affect_development: league.friendlies_affect_development ?? true,
    market_rules: league.market_rules ?? 'Open offers during preseason and between official weeks.',
    free_agent_offer_window_hours: league.free_agent_offer_window_hours ?? 24,
    current_run_week: league.current_run_week ?? 0,
    run_seed: league.run_seed ?? null,
    run_started_at: league.run_started_at ?? null,
    run_completed_at: league.run_completed_at ?? null,
  }));
  db.teams = db.teams.map((team) => ({
    ...team,
    is_bot: team.is_bot ?? false,
    bot_manager_name: team.bot_manager_name ?? null,
    run_active: team.run_active ?? true,
    morale: team.morale ?? 50,
    synergy: team.synergy ?? 50,
  }));
  db.league_admins = db.league_admins.map((admin) => ({
    ...admin,
    guest_id: admin.guest_id || admin.user_id || '',
  }));
  return db;
}

function changedRows<T extends { id: string }>(previous: T[], next: T[]): T[] {
  const before = new Map(previous.map((row) => [row.id, JSON.stringify(row)]));
  return next.filter((row) => before.get(row.id) !== JSON.stringify(row));
}

function deletedRows<T extends { id: string }>(previous: T[], next: T[]): T[] {
  const remaining = new Set(next.map((row) => row.id));
  return previous.filter((row) => !remaining.has(row.id));
}

function touchedLeagueIds(previous: Database, next: Database): Set<string> {
  const result = new Set<string>();
  const direct = ['leagues', 'league_admins', 'teams', 'players', 'coaches', 'matches', 'trades', 'transfer_history', 'market_offers', 'match_simulations', 'audit_logs'] as const;
  for (const table of direct) {
    const before = previous[table] as MockRow[];
    const after = next[table] as MockRow[];
    const rows = [...changedRows(before, after), ...deletedRows(before, after)];
    for (const row of rows) result.add(table === 'leagues' ? row.id : (row as MockRow & { league_id: string }).league_id);
  }
  for (const game of [...changedRows(previous.games, next.games), ...deletedRows(previous.games, next.games)]) {
    const match = next.matches.find((item) => item.id === game.match_id) ?? previous.matches.find((item) => item.id === game.match_id);
    if (match) result.add(match.league_id);
  }
  for (const item of [...changedRows(previous.trade_items, next.trade_items), ...deletedRows(previous.trade_items, next.trade_items)]) {
    const trade = next.trades.find((entry) => entry.id === item.trade_id) ?? previous.trades.find((entry) => entry.id === item.trade_id);
    if (trade) result.add(trade.league_id);
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

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

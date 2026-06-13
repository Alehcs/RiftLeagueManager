'use client';

import { create } from 'zustand';
import type {
  AdminRole,
  Coach,
  Database,
  Game,
  GuestSession,
  ImportJob,
  League,
  LeagueFormat,
  Match,
  Player,
  Role,
  Team,
  TradeStatus,
} from '@/lib/types';
import { EMPTY_DB } from '@/lib/types';
import { avatarColor, createRoomCode, nowISO, uid } from '@/lib/utils';
import { createDataAdapter, type DataAdapter, type DataEvent } from '@/lib/data';
import { buildLeagueEntities, buildSeedDatabase } from '@/data/seed';
import type { RawLeague } from '@/data/rosters';
import { computeTeamStrength } from '@/services/strength';
import { simulateMatch as simMatch } from '@/services/simulation';
import { applyStandings, standingsTable } from '@/services/standings';
import {
  generateDoubleElim,
  generateNextSwissRound,
  generateSchedule,
  generateSingleElim,
  formatForLeague,
} from '@/services/schedule';
import { canAfford } from '@/services/transfers';
import { generatePlayerRatings, playerSalary, playerValue } from '@/services/ratings';
import { buildLeagueExport, reidLeagueExport, isLeagueExport } from '@/services/leagueIO';
import { normalizeRole, num, toObjects } from '@/services/csv';

export interface Toast {
  id: string;
  kind: 'match' | 'trade' | 'roster' | 'import' | 'info' | 'success' | 'error';
  message: string;
  ts: number;
}

interface CommitOpts {
  toast?: { kind: Toast['kind']; message: string };
  broadcast?: boolean;
  audit?: { leagueId: string; action: string; entity: string; entityId: string; before?: unknown; after?: unknown };
  system?: boolean;
}

interface StoreState {
  db: Database;
  rev: number;
  ready: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  mode: 'mock' | 'supabase';
  currentGuestId: string;
  onlineGuests: Record<string, GuestSession[]>;
  toasts: Toast[];

  init: () => void;
  refresh: () => void;
  createGuest: (displayName: string) => string;
  updateGuest: (displayName: string) => void;
  resetGuest: () => Promise<void>;
  joinLeagueByRoomCode: (roomCode: string, recoveryCode?: string) => Promise<string | null>;
  startPresence: (leagueId: string) => () => void;
  reseed: () => void;
  hardReset: () => void;

  // toasts
  pushToast: (t: { kind: Toast['kind']; message: string }) => void;
  dismissToast: (id: string) => void;

  // leagues
  createLeague: (input: Partial<League> & { name: string; format: LeagueFormat; region: string; tier: League['tier']; season: string; adminCode?: string }) => string;
  importRawLeague: (raw: RawLeague, opts?: { presimulate?: boolean }) => string;
  importLeagueBundle: (json: string) => string | null;
  cloneLeague: (leagueId: string) => string | null;
  updateLeague: (id: string, patch: Partial<League>) => void;
  deleteLeague: (id: string) => void;
  resetLeagueResults: (id: string) => void;
  regenerateSchedule: (id: string, format?: LeagueFormat) => void;

  // teams
  createTeam: (leagueId: string, input: Partial<Team> & { name: string; short_name: string }) => string;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  deleteTeam: (id: string) => void;

  // players
  createPlayer: (leagueId: string, input: Partial<Player> & { nickname: string; role: Role }) => string;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  deletePlayer: (id: string) => void;
  signPlayer: (playerId: string, teamId: string) => void;
  releasePlayer: (playerId: string) => void;
  sellPlayer: (playerId: string, price?: number) => void;
  setPlayerStatus: (playerId: string, status: Player['status']) => void;

  // coaches
  createCoach: (leagueId: string, input: Partial<Coach> & { nickname: string }) => string;
  updateCoach: (id: string, patch: Partial<Coach>) => void;
  deleteCoach: (id: string) => void;
  signCoach: (coachId: string, teamId: string) => void;
  releaseCoach: (coachId: string) => void;

  // matches / simulation
  simulateMatch: (matchId: string) => void;
  resetMatch: (matchId: string) => void;
  setMatchResult: (matchId: string, blueScore: number, redScore: number) => void;
  simulateWeek: (leagueId: string, week: number) => void;
  simulateRegularSeason: (leagueId: string) => void;
  simulatePlayoffs: (leagueId: string) => void;
  simulateFullTournament: (leagueId: string) => void;

  // playoffs
  generatePlayoffs: (leagueId: string, opts: { type: 'single' | 'double'; size: number }) => void;

  // trades
  proposeTrade: (input: {
    leagueId: string;
    fromTeamId: string;
    toTeamId: string;
    playersFrom: string[];
    playersTo: string[];
    moneyFromTeam: number;
    moneyToTeam: number;
  }) => string;
  setTradeStatus: (tradeId: string, status: TradeStatus) => void;

  // admins
  setLeagueAdmin: (leagueId: string, guestId: string, role: AdminRole, teamId?: string | null) => void;
  removeLeagueAdmin: (leagueId: string, guestId: string) => void;

  // bulk csv import
  importCsv: (leagueId: string, type: 'players' | 'coaches' | 'teams' | 'matches', text: string) => { ok: number; failed: number };

  // import jobs
  addImportJob: (job: Omit<ImportJob, 'id' | 'created_at'>) => string;
  updateImportJob: (id: string, patch: Partial<ImportJob>) => void;

}

// ---------------------------------------------------------------------------
// Adapter lifecycle
// ---------------------------------------------------------------------------
let adapter: DataAdapter | null = null;
let unsubscribeAdapter: (() => void) | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let pendingWrites = 0;
let syncEpoch = 0;

export const useStore = create<StoreState>((set, get) => {
  function addToast(event: DataEvent): void {
    const toast: Toast = { id: uid('toast'), ts: Date.now(), ...event };
    set({ toasts: [...get().toasts, toast].slice(-6) });
  }

  function reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    set({ error: message });
    addToast({ kind: 'error', message });
  }

  function loadFromAdapter(): void {
    if (!adapter || get().loading) return;
    set({ loading: true, error: null });
    void adapter
      .loadDatabase()
      .then(({ db, currentGuestId }) => {
        set({ db, currentGuestId, ready: true, loading: false, rev: get().rev + 1 });
      })
      .catch((error) => {
        set({ db: structuredClone(EMPTY_DB), ready: true, loading: false });
        reportError(error);
      });
  }

  function persistChange(previous: Database, next: Database, event?: DataEvent, system = false): void {
    if (!adapter) return;
    const epoch = syncEpoch;
    pendingWrites++;
    set({ saving: true, error: null });
    writeQueue = writeQueue
      .catch(() => undefined)
      .then(() => (epoch === syncEpoch ? adapter!.saveDatabase(previous, next, event, { system }) : undefined))
      .catch(async (error) => {
        syncEpoch++;
        reportError(error);
        if (adapter) {
          const snapshot = await adapter.loadDatabase();
          set({ db: snapshot.db, currentGuestId: snapshot.currentGuestId, rev: get().rev + 1 });
        }
      })
      .catch(reportError)
      .finally(() => {
        pendingWrites--;
        set({ saving: pendingWrites > 0 });
      });
  }

  function commit(mutate: () => void, opts: CommitOpts = {}) {
    const previous = structuredClone(get().db);
    mutate();
    const db = get().db;
    // audit log
    if (opts.audit) {
      db.audit_logs.push({
        id: uid('al'),
        league_id: opts.audit.leagueId,
        actor_guest_id: get().currentGuestId,
        action_type: opts.audit.action,
        entity_type: opts.audit.entity,
        entity_id: opts.audit.entityId,
        before_json: opts.audit.before ? JSON.stringify(opts.audit.before) : null,
        after_json: opts.audit.after ? JSON.stringify(opts.audit.after) : null,
        created_at: nowISO(),
      });
    }
    let toast: Toast | undefined;
    if (opts.toast) {
      toast = { id: uid('toast'), ts: Date.now(), ...opts.toast };
      const toasts = [...get().toasts, toast].slice(-6);
      set({ toasts });
    }
    const next = structuredClone(db);
    set({ db: next, rev: get().rev + 1 });
    persistChange(previous, next, opts.broadcast === false ? undefined : opts.toast, opts.system);
  }

  // helpers operating on the live db -----------------------------------------
  const recomputeStandings = (leagueId: string) => {
    const db = get().db;
    const teams = db.teams.filter((t) => t.league_id === leagueId);
    const matches = db.matches.filter((m) => m.league_id === leagueId);
    const updated = applyStandings(teams, matches);
    for (const ut of updated) {
      const t = db.teams.find((x) => x.id === ut.id);
      if (t) Object.assign(t, ut);
    }
  };

  const strengthOf = (teamId: string) => {
    const db = get().db;
    const team = db.teams.find((t) => t.id === teamId)!;
    return computeTeamStrength(team, db.players, db.coaches);
  };

  const teamShort = (teamId: string | null) =>
    get().db.teams.find((t) => t.id === teamId)?.short_name ?? '—';

  // Apply a single match result + advance bracket links + create games.
  const playMatch = (m: Match, makeGames = true) => {
    const db = get().db;
    if (!m.blue_team_id || !m.red_team_id) return;
    const blue = strengthOf(m.blue_team_id);
    const red = strengthOf(m.red_team_id);
    const res = simMatch(m.format, blue, red, {
      blueName: teamShort(m.blue_team_id),
      redName: teamShort(m.red_team_id),
      seed: m.id + ':' + Date.now(),
    });
    m.status = 'completed';
    m.blue_score = res.blue_score;
    m.red_score = res.red_score;
    m.winner_team_id = res.winner === 'blue' ? m.blue_team_id : m.red_team_id;
    m.updated_at = nowISO();
    // games
    db.games = db.games.filter((g) => g.match_id !== m.id);
    if (makeGames) {
      for (const g of res.games) {
        db.games.push({
          id: uid('g'),
          match_id: m.id,
          game_number: g.game_number,
          blue_team_id: m.blue_team_id,
          red_team_id: m.red_team_id,
          winner_team_id: g.winner === 'blue' ? m.blue_team_id : m.red_team_id,
          duration_minutes: g.duration_minutes,
          blue_kills: g.blue_kills,
          red_kills: g.red_kills,
          blue_gold: g.blue_gold,
          red_gold: g.red_gold,
          notes: g.notes,
        });
      }
    }
    advanceBracket(m);
  };

  const advanceBracket = (m: Match) => {
    const db = get().db;
    if (!m.winner_team_id) return;
    const loserId = m.winner_team_id === m.blue_team_id ? m.red_team_id : m.blue_team_id;
    const fill = (targetId: string | null | undefined, teamId: string) => {
      if (!targetId) return;
      const target = db.matches.find((x) => x.id === targetId);
      if (!target) return;
      if (!target.blue_team_id) target.blue_team_id = teamId;
      else if (!target.red_team_id) target.red_team_id = teamId;
      target.updated_at = nowISO();
    };
    fill(m.feeds_winner_to, m.winner_team_id);
    if (m.feeds_loser_to && loserId) fill(m.feeds_loser_to, loserId);
  };

  return {
    db: EMPTY_DB,
    rev: 0,
    ready: false,
    loading: false,
    saving: false,
    error: null,
    mode: 'mock',
    currentGuestId: '',
    onlineGuests: {},
    toasts: [],

    init() {
      if (adapter || get().loading || get().ready) return;
      adapter = createDataAdapter();
      set({ mode: adapter.mode });
      unsubscribeAdapter?.();
      unsubscribeAdapter = adapter.subscribe(
        ({ db, currentGuestId }, event) => {
          set({ db, currentGuestId, error: null, rev: get().rev + 1 });
          if (event) addToast(event);
        },
        reportError,
      );
      loadFromAdapter();
    },

    refresh() {
      loadFromAdapter();
    },

    createGuest(displayName) {
      const name = displayName.trim().slice(0, 32);
      if (name.length < 2) {
        reportError(new Error('Nickname must be at least 2 characters.'));
        return '';
      }
      const id = uid('guest');
      const ts = nowISO();
      const guest: GuestSession = { id, display_name: name, avatar_color: avatarColor(id), created_at: ts, last_seen_at: ts };
      adapter?.setGuestId(id);
      set({ currentGuestId: id });
      commit(() => get().db.guest_sessions.push(guest), { toast: { kind: 'success', message: `Welcome, ${name}` }, broadcast: false });
      return id;
    },

    updateGuest(displayName) {
      const name = displayName.trim().slice(0, 32);
      if (name.length < 2) {
        reportError(new Error('Nickname must be at least 2 characters.'));
        return;
      }
      commit(() => {
        const guest = get().db.guest_sessions.find((item) => item.id === get().currentGuestId);
        if (guest) Object.assign(guest, { display_name: name, last_seen_at: nowISO() });
      }, { toast: { kind: 'success', message: 'Nickname updated' } });
    },

    async resetGuest() {
      try {
        await adapter?.resetGuestIdentity();
        set({ currentGuestId: '', onlineGuests: {}, rev: get().rev + 1 });
      } catch (error) {
        reportError(error);
      }
    },

    async joinLeagueByRoomCode(roomCode, recoveryCode) {
      const code = roomCode.trim().toUpperCase();
      const guestId = get().currentGuestId;
      if (!guestId) {
        reportError(new Error('Choose a nickname before joining a room.'));
        return null;
      }
      const league = get().db.leagues.find((item) => item.room_code === code);
      if (!league) {
        reportError(new Error('Room code not found.'));
        return null;
      }
      try {
        if (recoveryCode?.trim()) {
          const leagueId = await adapter!.recoverAdmin(code, recoveryCode.trim(), guestId);
          const snapshot = await adapter!.loadDatabase();
          set({ db: snapshot.db, currentGuestId: snapshot.currentGuestId, rev: get().rev + 1 });
          addToast({ kind: 'success', message: 'Admin access recovered' });
          return leagueId;
        }
        if (!get().db.league_members.some((member) => member.league_id === league.id && member.guest_id === guestId)) {
          commit(() => get().db.league_members.push({ id: uid('member'), league_id: league.id, guest_id: guestId, role: 'viewer', joined_at: nowISO() }), {
            toast: { kind: 'success', message: `Joined ${league.name}` },
          });
        }
        return league.id;
      } catch (error) {
        reportError(error);
        return null;
      }
    },

    startPresence(leagueId) {
      const guest = get().db.guest_sessions.find((item) => item.id === get().currentGuestId);
      if (!adapter || !guest) return () => undefined;
      return adapter.trackPresence(
        leagueId,
        guest,
        (guests) => set({ onlineGuests: { ...get().onlineGuests, [leagueId]: guests } }),
        reportError,
      );
    },

    reseed() {
      if (adapter?.mode === 'supabase') {
        reportError(new Error('Demo reseeding is only available in mock mode.'));
        return;
      }
      const db = buildSeedDatabase();
      const guest = get().db.guest_sessions.find((item) => item.id === get().currentGuestId);
      if (guest) db.guest_sessions.push(guest);
      commit(() => set({ db }), { toast: { kind: 'success', message: 'Demo data reloaded' }, system: true });
    },

    hardReset() {
      if (adapter?.mode === 'supabase') {
        reportError(new Error('Local data reset is only available in mock mode.'));
        return;
      }
      const db = buildSeedDatabase();
      const guest = get().db.guest_sessions.find((item) => item.id === get().currentGuestId);
      if (guest) db.guest_sessions.push(guest);
      commit(() => set({ db }), { toast: { kind: 'success', message: 'Local data reset' }, system: true });
    },

    pushToast(t) {
      const toast: Toast = { id: uid('toast'), ts: Date.now(), ...t };
      set({ toasts: [...get().toasts, toast].slice(-6) });
    },
    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },

    // -- leagues --------------------------------------------------------------
    createLeague(input) {
      const id = uid('lg');
      const ts = nowISO();
      let roomCode = input.room_code?.trim().toUpperCase() || createRoomCode();
      while (get().db.leagues.some((item) => item.room_code === roomCode)) roomCode = createRoomCode();
      const league: League = {
        id,
        name: input.name,
        slug: input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        region: input.region,
        tier: input.tier,
        season: input.season,
        logo_url: input.logo_url ?? null,
        external_url: input.external_url ?? null,
        source_name: input.source_name ?? 'Manual',
        source_url: input.source_url ?? null,
        format: input.format,
        owner_guest_id: get().currentGuestId,
        room_code: roomCode,
        admin_code_hash: input.adminCode?.trim() ? `plain:${input.adminCode.trim()}` : null,
        is_seed: false,
        last_imported_at: null,
        created_at: ts,
        updated_at: ts,
      };
      commit(
        () => {
          const db = get().db;
          db.leagues.push(league);
          db.league_admins.push({ id: uid('la'), league_id: id, guest_id: get().currentGuestId, role: 'owner', team_id: null });
          db.league_members.push({ id: uid('member'), league_id: id, guest_id: get().currentGuestId, role: 'owner', joined_at: ts });
        },
        { toast: { kind: 'success', message: `Created league "${league.name}"` }, audit: { leagueId: id, action: 'create', entity: 'league', entityId: id, after: league } },
      );
      return id;
    },

    importRawLeague(raw, opts) {
      const slices = buildLeagueEntities(raw, { ownerId: get().currentGuestId, presimulate: opts?.presimulate });
      const id = slices.leagues[0].id;
      commit(
        () => {
          const db = get().db;
          db.leagues.push(...slices.leagues);
          db.league_admins.push(...slices.league_admins);
          db.league_members.push({ id: uid('member'), league_id: id, guest_id: get().currentGuestId, role: 'owner', joined_at: nowISO() });
          db.teams.push(...slices.teams);
          db.players.push(...slices.players);
          db.coaches.push(...slices.coaches);
          db.matches.push(...slices.matches);
          db.games.push(...slices.games);
        },
        { toast: { kind: 'import', message: `Imported ${raw.name} (${slices.teams.length} teams, ${slices.players.length} players)` }, audit: { leagueId: id, action: 'import', entity: 'league', entityId: id } },
      );
      return id;
    },

    importLeagueBundle(json) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        get().pushToast({ kind: 'error', message: 'Invalid JSON' });
        return null;
      }
      if (!isLeagueExport(parsed)) {
        get().pushToast({ kind: 'error', message: 'Not a Rift League export bundle' });
        return null;
      }
      const slices = reidLeagueExport(parsed, { ownerId: get().currentGuestId });
      const id = slices.leagues[0].id;
      commit(
        () => {
          const db = get().db;
          db.leagues.push(...slices.leagues);
          db.league_admins.push(...slices.league_admins);
          db.league_members.push({ id: uid('member'), league_id: id, guest_id: get().currentGuestId, role: 'owner', joined_at: nowISO() });
          db.teams.push(...slices.teams);
          db.players.push(...slices.players);
          db.coaches.push(...slices.coaches);
          db.matches.push(...slices.matches);
          db.games.push(...slices.games);
          db.trades.push(...slices.trades);
          db.trade_items.push(...slices.trade_items);
          db.transfer_history.push(...slices.transfer_history);
        },
        { toast: { kind: 'import', message: `Imported league "${slices.leagues[0].name}" from JSON` } },
      );
      return id;
    },

    cloneLeague(leagueId) {
      const bundle = buildLeagueExport(get().db, leagueId);
      if (!bundle) return null;
      const slices = reidLeagueExport(bundle, {
        ownerId: get().currentGuestId,
        name: `${bundle.league.name} (Copy)`,
        slug: `${bundle.league.slug}-copy-${Math.random().toString(36).slice(2, 6)}`,
      });
      const id = slices.leagues[0].id;
      commit(
        () => {
          const db = get().db;
          db.leagues.push(...slices.leagues);
          db.league_admins.push(...slices.league_admins);
          db.league_members.push({ id: uid('member'), league_id: id, guest_id: get().currentGuestId, role: 'owner', joined_at: nowISO() });
          db.teams.push(...slices.teams);
          db.players.push(...slices.players);
          db.coaches.push(...slices.coaches);
          db.matches.push(...slices.matches);
          db.games.push(...slices.games);
          db.trades.push(...slices.trades);
          db.trade_items.push(...slices.trade_items);
          db.transfer_history.push(...slices.transfer_history);
        },
        { toast: { kind: 'success', message: `Cloned "${bundle.league.name}"` } },
      );
      return id;
    },

    updateLeague(id, patch) {
      commit(
        () => {
          const l = get().db.leagues.find((x) => x.id === id);
          if (l) Object.assign(l, patch, { updated_at: nowISO() });
        },
        { audit: { leagueId: id, action: 'update', entity: 'league', entityId: id, after: patch } },
      );
    },

    deleteLeague(id) {
      const name = get().db.leagues.find((l) => l.id === id)?.name ?? 'League';
      commit(
        () => {
          const db = get().db;
          const matchIds = new Set(db.matches.filter((m) => m.league_id === id).map((m) => m.id));
          const tradeIds = new Set(db.trades.filter((t) => t.league_id === id).map((t) => t.id));
          db.leagues = db.leagues.filter((l) => l.id !== id);
          db.league_admins = db.league_admins.filter((a) => a.league_id !== id);
          db.league_members = db.league_members.filter((member) => member.league_id !== id);
          db.teams = db.teams.filter((t) => t.league_id !== id);
          db.players = db.players.filter((p) => p.league_id !== id);
          db.coaches = db.coaches.filter((c) => c.league_id !== id);
          db.matches = db.matches.filter((m) => m.league_id !== id);
          db.games = db.games.filter((g) => !matchIds.has(g.match_id));
          db.trades = db.trades.filter((t) => t.league_id !== id);
          db.trade_items = db.trade_items.filter((ti) => !tradeIds.has(ti.trade_id));
          db.transfer_history = db.transfer_history.filter((th) => th.league_id !== id);
        },
        { toast: { kind: 'info', message: `Deleted "${name}"` } },
      );
    },

    resetLeagueResults(id) {
      commit(
        () => {
          const db = get().db;
          const leagueMatches = db.matches.filter((m) => m.league_id === id);
          const ids = new Set(leagueMatches.map((m) => m.id));
          db.games = db.games.filter((g) => !ids.has(g.match_id));
          for (const m of leagueMatches) {
            // bracket matches: clear advanced participants too
            const isBracket = !['regular_season', 'group_stage', 'swiss'].includes(m.stage);
            m.status = 'scheduled';
            m.blue_score = 0;
            m.red_score = 0;
            m.winner_team_id = null;
            if (isBracket && (m.feeds_winner_to || m.bracket_slot?.includes('R') || m.bracket_slot === 'GF')) {
              // only clear sides that were populated by advancement (kept simple: clear non-seed rounds)
              if (m.week > 1) {
                m.blue_team_id = '';
                m.red_team_id = '';
              }
            }
            m.updated_at = nowISO();
          }
          recomputeStandings(id);
        },
        { toast: { kind: 'info', message: 'League results reset' } },
      );
    },

    regenerateSchedule(id, format) {
      commit(
        () => {
          const db = get().db;
          const league = db.leagues.find((l) => l.id === id);
          if (!league) return;
          if (format) league.format = format;
          const teams = db.teams.filter((t) => t.league_id === id);
          const oldIds = new Set(db.matches.filter((m) => m.league_id === id).map((m) => m.id));
          db.games = db.games.filter((g) => !oldIds.has(g.match_id));
          db.matches = db.matches.filter((m) => m.league_id !== id);
          const fresh = generateSchedule(league, teams, { start: new Date() });
          db.matches.push(...fresh);
          recomputeStandings(id);
        },
        { toast: { kind: 'success', message: 'Schedule regenerated' } },
      );
    },

    // -- teams ----------------------------------------------------------------
    createTeam(leagueId, input) {
      const id = uid('t');
      const league = get().db.leagues.find((l) => l.id === leagueId);
      const ts = nowISO();
      const team: Team = {
        id,
        league_id: leagueId,
        name: input.name,
        short_name: input.short_name,
        region: input.region ?? league?.region ?? '',
        country: input.country ?? '',
        tier: input.tier ?? league?.tier ?? 'custom',
        logo_url: input.logo_url ?? null,
        banner_url: input.banner_url ?? null,
        external_url: input.external_url ?? null,
        source_name: input.source_name ?? 'Manual',
        source_url: input.source_url ?? null,
        confidence: 1,
        budget: input.budget ?? 2_000_000,
        wins: 0, losses: 0, games_won: 0, games_lost: 0, points: 0, form: '',
        generated: false,
        created_at: ts,
        updated_at: ts,
      };
      commit(() => get().db.teams.push(team), { toast: { kind: 'success', message: `Added team ${team.name}` }, audit: { leagueId, action: 'create', entity: 'team', entityId: id, after: team } });
      return id;
    },
    updateTeam(id, patch) {
      const before = get().db.teams.find((t) => t.id === id);
      commit(
        () => {
          const t = get().db.teams.find((x) => x.id === id);
          if (t) Object.assign(t, patch, { updated_at: nowISO() });
        },
        { audit: before ? { leagueId: before.league_id, action: 'update', entity: 'team', entityId: id, after: patch } : undefined },
      );
    },
    deleteTeam(id) {
      commit(() => {
        const db = get().db;
        db.players.filter((p) => p.team_id === id).forEach((p) => (p.team_id = null));
        db.coaches.filter((c) => c.team_id === id).forEach((c) => (c.team_id = null));
        db.teams = db.teams.filter((t) => t.id !== id);
      }, { toast: { kind: 'info', message: 'Team removed' } });
    },

    // -- players --------------------------------------------------------------
    createPlayer(leagueId, input) {
      const id = uid('p');
      const ts = nowISO();
      const role = input.role;
      const ratings = generatePlayerRatings(`${leagueId}:${input.nickname}:${role}`, {
        strength: 3,
        tier: get().db.leagues.find((l) => l.id === leagueId)?.tier ?? 'custom',
        role,
      });
      const overall = input.rating_overall ?? ratings.rating_overall;
      const value = input.value ?? playerValue(overall, role, input.age ?? 21);
      const player: Player = {
        id,
        league_id: leagueId,
        team_id: input.team_id ?? null,
        real_name: input.real_name ?? '',
        nickname: input.nickname,
        role,
        nationality: input.nationality ?? '',
        age: input.age ?? null,
        image_url: input.image_url ?? null,
        external_url: input.external_url ?? null,
        source_name: input.source_name ?? 'Manual',
        source_url: input.source_url ?? null,
        confidence: 1,
        value,
        salary: input.salary ?? playerSalary(value),
        contract_until: input.contract_until ?? null,
        rating_overall: overall,
        rating_laning: input.rating_laning ?? ratings.rating_laning,
        rating_teamfighting: input.rating_teamfighting ?? ratings.rating_teamfighting,
        rating_macro: input.rating_macro ?? ratings.rating_macro,
        rating_mechanics: input.rating_mechanics ?? ratings.rating_mechanics,
        rating_consistency: input.rating_consistency ?? ratings.rating_consistency,
        status: input.status ?? (input.team_id ? 'active' : 'free_agent'),
        generated: false,
        created_at: ts,
        updated_at: ts,
      };
      commit(() => get().db.players.push(player), { toast: { kind: 'success', message: `Added player ${player.nickname}` }, audit: { leagueId, action: 'create', entity: 'player', entityId: id, after: player } });
      return id;
    },
    updatePlayer(id, patch) {
      const before = get().db.players.find((p) => p.id === id);
      commit(
        () => {
          const p = get().db.players.find((x) => x.id === id);
          if (p) Object.assign(p, patch, { updated_at: nowISO() });
        },
        { audit: before ? { leagueId: before.league_id, action: 'update', entity: 'player', entityId: id, before, after: patch } : undefined },
      );
    },
    deletePlayer(id) {
      commit(() => { get().db.players = get().db.players.filter((p) => p.id !== id); }, { toast: { kind: 'info', message: 'Player removed' } });
    },
    signPlayer(playerId, teamId) {
      commit(
        () => {
          const db = get().db;
          const p = db.players.find((x) => x.id === playerId);
          const t = db.teams.find((x) => x.id === teamId);
          if (!p || !t) return;
          const from = p.team_id;
          p.team_id = teamId;
          p.status = 'active';
          p.updated_at = nowISO();
          db.transfer_history.push({ id: uid('th'), league_id: p.league_id, player_id: playerId, from_team_id: from, to_team_id: teamId, transfer_type: from ? 'trade' : 'signing', amount: 0, created_at: nowISO() });
        },
        { toast: { kind: 'success', message: `${teamShort(teamId)} signed ${get().db.players.find((p) => p.id === playerId)?.nickname}` } },
      );
    },
    releasePlayer(playerId) {
      commit(
        () => {
          const db = get().db;
          const p = db.players.find((x) => x.id === playerId);
          if (!p) return;
          const from = p.team_id;
          p.team_id = null;
          p.status = 'free_agent';
          p.updated_at = nowISO();
          db.transfer_history.push({ id: uid('th'), league_id: p.league_id, player_id: playerId, from_team_id: from, to_team_id: null, transfer_type: 'release', amount: 0, created_at: nowISO() });
        },
        { toast: { kind: 'info', message: `${get().db.players.find((p) => p.id === playerId)?.nickname} released to free agency` } },
      );
    },
    sellPlayer(playerId, price) {
      commit(() => {
        const db = get().db;
        const p = db.players.find((x) => x.id === playerId);
        if (!p) return;
        const from = p.team_id;
        const amount = price ?? p.value;
        const t = db.teams.find((x) => x.id === from);
        if (t) t.budget += amount;
        p.team_id = null;
        p.status = 'free_agent';
        p.updated_at = nowISO();
        db.transfer_history.push({ id: uid('th'), league_id: p.league_id, player_id: playerId, from_team_id: from, to_team_id: null, transfer_type: 'sale', amount, created_at: nowISO() });
      }, { toast: { kind: 'success', message: `Sold ${get().db.players.find((p) => p.id === playerId)?.nickname}` } });
    },
    setPlayerStatus(playerId, status) {
      get().updatePlayer(playerId, { status });
    },

    // -- coaches --------------------------------------------------------------
    createCoach(leagueId, input) {
      const id = uid('c');
      const ts = nowISO();
      const coach: Coach = {
        id,
        league_id: leagueId,
        team_id: input.team_id ?? null,
        real_name: input.real_name ?? '',
        nickname: input.nickname,
        nationality: input.nationality ?? '',
        age: input.age ?? null,
        image_url: input.image_url ?? null,
        external_url: input.external_url ?? null,
        source_name: input.source_name ?? 'Manual',
        source_url: input.source_url ?? null,
        confidence: 1,
        rating_draft: input.rating_draft ?? 65,
        rating_macro: input.rating_macro ?? 65,
        rating_development: input.rating_development ?? 65,
        rating_leadership: input.rating_leadership ?? 65,
        salary: input.salary ?? 120_000,
        contract_until: input.contract_until ?? null,
        status: input.status ?? (input.team_id ? 'active' : 'free_agent'),
        generated: false,
        created_at: ts,
        updated_at: ts,
      };
      commit(() => get().db.coaches.push(coach), { toast: { kind: 'success', message: `Added coach ${coach.nickname}` } });
      return id;
    },
    updateCoach(id, patch) {
      commit(() => {
        const c = get().db.coaches.find((x) => x.id === id);
        if (c) Object.assign(c, patch, { updated_at: nowISO() });
      });
    },
    deleteCoach(id) {
      commit(() => { get().db.coaches = get().db.coaches.filter((c) => c.id !== id); }, { toast: { kind: 'info', message: 'Coach removed' } });
    },
    signCoach(coachId, teamId) {
      commit(() => {
        const c = get().db.coaches.find((x) => x.id === coachId);
        if (c) { c.team_id = teamId; c.status = 'active'; c.updated_at = nowISO(); }
      }, { toast: { kind: 'success', message: `${teamShort(teamId)} hired a coach` } });
    },
    releaseCoach(coachId) {
      commit(() => {
        const c = get().db.coaches.find((x) => x.id === coachId);
        if (c) { c.team_id = null; c.status = 'free_agent'; c.updated_at = nowISO(); }
      }, { toast: { kind: 'info', message: 'Coach released' } });
    },

    // -- simulation -----------------------------------------------------------
    simulateMatch(matchId) {
      const m = get().db.matches.find((x) => x.id === matchId);
      if (!m) return;
      commit(
        () => {
          const match = get().db.matches.find((x) => x.id === matchId)!;
          playMatch(match);
          recomputeStandings(match.league_id);
        },
        { toast: { kind: 'match', message: resultToast(get().db, matchId) } },
      );
    },
    resetMatch(matchId) {
      commit(() => {
        const db = get().db;
        const m = db.matches.find((x) => x.id === matchId);
        if (!m) return;
        db.games = db.games.filter((g) => g.match_id !== matchId);
        m.status = 'scheduled';
        m.blue_score = 0;
        m.red_score = 0;
        m.winner_team_id = null;
        m.updated_at = nowISO();
        recomputeStandings(m.league_id);
      }, { toast: { kind: 'info', message: 'Match reset' } });
    },
    setMatchResult(matchId, blueScore, redScore) {
      commit(
        () => {
          const db = get().db;
          const m = db.matches.find((x) => x.id === matchId);
          if (!m) return;
          m.blue_score = blueScore;
          m.red_score = redScore;
          m.status = 'completed';
          m.winner_team_id = blueScore > redScore ? m.blue_team_id : redScore > blueScore ? m.red_team_id : null;
          m.updated_at = nowISO();
          if (m.winner_team_id) advanceBracket(m);
          recomputeStandings(m.league_id);
        },
        { toast: { kind: 'match', message: `Result saved: ${resultToast(get().db, matchId)}` } },
      );
    },
    simulateWeek(leagueId, week) {
      commit(
        () => {
          const db = get().db;
          const toPlay = db.matches.filter((m) => m.league_id === leagueId && m.week === week && m.status !== 'completed' && m.blue_team_id && m.red_team_id);
          toPlay.forEach((m) => playMatch(m));
          recomputeStandings(leagueId);
        },
        { toast: { kind: 'match', message: `Week ${week} simulated` } },
      );
    },
    simulateRegularSeason(leagueId) {
      commit(
        () => {
          const db = get().db;
          const league = db.leagues.find((l) => l.id === leagueId)!;
          // regular/group: play all
          db.matches
            .filter((m) => m.league_id === leagueId && ['regular_season', 'group_stage'].includes(m.stage) && m.status !== 'completed' && m.blue_team_id && m.red_team_id)
            .forEach((m) => playMatch(m));
          // swiss: iteratively play + generate next rounds (cap 5 rounds)
          if (league.format === 'swiss') {
            const teams = db.teams.filter((t) => t.league_id === leagueId).map((t) => t.id);
            for (let r = 0; r < 6; r++) {
              const swiss = db.matches.filter((m) => m.league_id === leagueId && m.stage === 'swiss');
              const pending = swiss.filter((m) => m.status !== 'completed');
              if (pending.length) pending.forEach((m) => playMatch(m));
              const maxRound = Math.max(0, ...swiss.map((m) => m.week));
              if (maxRound >= 5) break;
              const next = generateNextSwissRound(leagueId, teams, db.matches.filter((m) => m.league_id === leagueId && m.stage === 'swiss'), 'BO1', new Date());
              if (!next.length) break;
              db.matches.push(...next);
            }
          }
          recomputeStandings(leagueId);
        },
        { toast: { kind: 'match', message: 'Regular season simulated' } },
      );
    },
    simulatePlayoffs(leagueId) {
      commit(
        () => {
          const db = get().db;
          // play bracket matches in passes until stable
          for (let pass = 0; pass < 12; pass++) {
            const ready = db.matches.filter((m) => m.league_id === leagueId && ['playoffs', 'final'].includes(m.stage) && m.status !== 'completed' && m.blue_team_id && m.red_team_id);
            if (!ready.length) break;
            ready.sort((a, b) => a.week - b.week || a.match_day - b.match_day);
            ready.forEach((m) => playMatch(m));
          }
          recomputeStandings(leagueId);
        },
        { toast: { kind: 'match', message: 'Playoffs simulated' } },
      );
    },
    simulateFullTournament(leagueId) {
      get().simulateRegularSeason(leagueId);
      get().simulatePlayoffs(leagueId);
      get().pushToast({ kind: 'success', message: 'Full tournament simulated' });
    },

    // -- playoffs generation --------------------------------------------------
    generatePlayoffs(leagueId, opts) {
      commit(
        () => {
          const db = get().db;
          const league = db.leagues.find((l) => l.id === leagueId);
          if (!league) return;
          const teams = db.teams.filter((t) => t.league_id === leagueId);
          const matches = db.matches.filter((m) => m.league_id === leagueId);
          const table = standingsTable(teams, matches);
          const seeds = table.slice(0, opts.size).map((r) => r.team.id);
          // clear existing bracket matches
          const bracketIds = new Set(db.matches.filter((m) => m.league_id === leagueId && ['playoffs', 'final'].includes(m.stage)).map((m) => m.id));
          db.games = db.games.filter((g) => !bracketIds.has(g.match_id));
          db.matches = db.matches.filter((m) => !bracketIds.has(m.id));
          const fmt = formatForLeague(league.format) === 'BO1' ? 'BO5' : formatForLeague(league.format);
          const fresh =
            opts.type === 'double'
              ? generateDoubleElim(leagueId, seeds, fmt, new Date())
              : generateSingleElim(leagueId, seeds, fmt, new Date());
          db.matches.push(...fresh);
        },
        { toast: { kind: 'success', message: `${opts.type === 'double' ? 'Double' : 'Single'}-elim playoffs generated (top ${opts.size})` } },
      );
    },

    // -- trades ---------------------------------------------------------------
    proposeTrade(input) {
      const id = uid('tr');
      const ts = nowISO();
      commit(
        () => {
          const db = get().db;
          db.trades.push({
            id,
            league_id: input.leagueId,
            from_team_id: input.fromTeamId,
            to_team_id: input.toTeamId,
            money_from_team: input.moneyFromTeam,
            money_to_team: input.moneyToTeam,
            status: 'pending',
            proposed_by_guest_id: get().currentGuestId,
            reviewed_by_guest_id: null,
            created_at: ts,
            reviewed_at: null,
          });
          input.playersFrom.forEach((pid) => db.trade_items.push({ id: uid('ti'), trade_id: id, player_id: pid, from_team_id: input.fromTeamId, to_team_id: input.toTeamId }));
          input.playersTo.forEach((pid) => db.trade_items.push({ id: uid('ti'), trade_id: id, player_id: pid, from_team_id: input.toTeamId, to_team_id: input.fromTeamId }));
        },
        { toast: { kind: 'trade', message: `Trade proposed: ${teamShort(input.fromTeamId)} ⇄ ${teamShort(input.toTeamId)}` } },
      );
      return id;
    },
    setTradeStatus(tradeId, status) {
      const trade = get().db.trades.find((t) => t.id === tradeId);
      if (!trade) return;
      if (status === 'accepted') {
        const db = get().db;
        const items = db.trade_items.filter((ti) => ti.trade_id === tradeId);
        const fromTeam = db.teams.find((t) => t.id === trade.from_team_id);
        const toTeam = db.teams.find((t) => t.id === trade.to_team_id);
        // budget validation
        if (fromTeam && toTeam) {
          const fromNet = trade.money_to_team - trade.money_from_team;
          const toNet = trade.money_from_team - trade.money_to_team;
          if (!canAfford(fromTeam, -fromNet) || !canAfford(toTeam, -toNet)) {
            get().pushToast({ kind: 'error', message: 'Trade rejected: insufficient budget' });
            return;
          }
        }
        commit(
          () => {
            items.forEach((ti) => {
              const p = db.players.find((x) => x.id === ti.player_id);
              if (p) { p.team_id = ti.to_team_id; p.status = 'active'; p.updated_at = nowISO(); db.transfer_history.push({ id: uid('th'), league_id: p.league_id, player_id: p.id, from_team_id: ti.from_team_id, to_team_id: ti.to_team_id, transfer_type: 'trade', amount: 0, created_at: nowISO() }); }
            });
            if (fromTeam) fromTeam.budget += trade.money_to_team - trade.money_from_team;
            if (toTeam) toTeam.budget += trade.money_from_team - trade.money_to_team;
            trade.status = 'accepted';
            trade.reviewed_at = nowISO();
            trade.reviewed_by_guest_id = get().currentGuestId;
          },
          { toast: { kind: 'trade', message: 'Trade accepted' } },
        );
      } else {
        commit(() => {
          trade.status = status;
          trade.reviewed_at = nowISO();
          trade.reviewed_by_guest_id = get().currentGuestId;
        }, { toast: { kind: 'trade', message: `Trade ${status}` } });
      }
    },

    // -- admins ---------------------------------------------------------------
    setLeagueAdmin(leagueId, guestId, role, teamId = null) {
      commit(() => {
        const db = get().db;
        const existing = db.league_admins.find((a) => a.league_id === leagueId && a.guest_id === guestId);
        if (existing) { existing.role = role; existing.team_id = teamId; }
        else db.league_admins.push({ id: uid('la'), league_id: leagueId, guest_id: guestId, role, team_id: teamId });
        const member = db.league_members.find((item) => item.league_id === leagueId && item.guest_id === guestId);
        if (member) member.role = role;
        else db.league_members.push({ id: uid('member'), league_id: leagueId, guest_id: guestId, role, joined_at: nowISO() });
      }, { toast: { kind: 'info', message: `Set ${role} role` } });
    },
    removeLeagueAdmin(leagueId, guestId) {
      commit(() => {
        get().db.league_admins = get().db.league_admins.filter((a) => !(a.league_id === leagueId && a.guest_id === guestId));
        const member = get().db.league_members.find((item) => item.league_id === leagueId && item.guest_id === guestId);
        if (member) member.role = 'viewer';
      });
    },

    // -- CSV import -----------------------------------------------------------
    importCsv(leagueId, type, text) {
      let ok = 0;
      let failed = 0;
      const db = get().db;
      const league = db.leagues.find((l) => l.id === leagueId);
      const teamByShort = (s: string) => db.teams.find((t) => t.league_id === leagueId && t.short_name.toLowerCase() === s.toLowerCase());
      const rows = toObjects(text);
      commit(
        () => {
          for (const r of rows) {
            try {
              if (type === 'teams') {
                const ts = nowISO();
                db.teams.push({
                  id: uid('t'), league_id: leagueId, name: r.name, short_name: r.short_name,
                  region: r.region || league?.region || '', country: r.country || '', tier: (r.tier as Team['tier']) || league?.tier || 'custom',
                  logo_url: r.logo_url || null, banner_url: null, external_url: r.external_url || null,
                  source_name: 'CSV', source_url: null, confidence: 0.8, budget: num(r.budget, 2_000_000),
                  wins: 0, losses: 0, games_won: 0, games_lost: 0, points: 0, form: '', generated: false, created_at: ts, updated_at: ts,
                });
                ok++;
              } else if (type === 'players') {
                const team = teamByShort(r.team_short_name);
                const role = normalizeRole(r.role);
                const overall = num(r.rating_overall, 65);
                const value = num(r.value) || playerValue(overall, role, num(r.age, 21));
                const ts = nowISO();
                db.players.push({
                  id: uid('p'), league_id: leagueId, team_id: team?.id ?? null, real_name: r.real_name || '', nickname: r.nickname,
                  role, nationality: r.nationality || '', age: r.age ? num(r.age) : null, image_url: r.image_url || null, external_url: r.external_url || null,
                  source_name: 'CSV', source_url: null, confidence: 0.8, value, salary: num(r.salary) || playerSalary(value), contract_until: null,
                  rating_overall: overall, rating_laning: num(r.rating_laning, overall), rating_teamfighting: num(r.rating_teamfighting, overall),
                  rating_macro: num(r.rating_macro, overall), rating_mechanics: num(r.rating_mechanics, overall), rating_consistency: num(r.rating_consistency, overall),
                  status: team ? 'active' : 'free_agent', generated: false, created_at: ts, updated_at: ts,
                });
                ok++;
              } else if (type === 'coaches') {
                const team = teamByShort(r.team_short_name);
                const ts = nowISO();
                db.coaches.push({
                  id: uid('c'), league_id: leagueId, team_id: team?.id ?? null, real_name: r.real_name || '', nickname: r.nickname,
                  nationality: r.nationality || '', age: r.age ? num(r.age) : null, image_url: r.image_url || null, external_url: r.external_url || null,
                  source_name: 'CSV', source_url: null, confidence: 0.8,
                  rating_draft: num(r.rating_draft, 65), rating_macro: num(r.rating_macro, 65), rating_development: num(r.rating_development, 65), rating_leadership: num(r.rating_leadership, 65),
                  salary: num(r.salary, 120_000), contract_until: null, status: team ? 'active' : 'free_agent', generated: false, created_at: ts, updated_at: ts,
                });
                ok++;
              } else if (type === 'matches') {
                const blue = teamByShort(r.blue_team_short_name);
                const red = teamByShort(r.red_team_short_name);
                if (!blue || !red) { failed++; continue; }
                const winner = r.winner_team_short_name ? teamByShort(r.winner_team_short_name) : null;
                const ts = nowISO();
                db.matches.push({
                  id: uid('m'), league_id: leagueId, stage: (r.stage as Match['stage']) || 'regular_season', week: num(r.week, 1), match_day: num(r.match_day, 1),
                  date_time: r.date_time || ts, blue_team_id: blue.id, red_team_id: red.id, format: (r.format as Match['format']) || 'BO1',
                  status: (r.status as Match['status']) || 'scheduled', winner_team_id: winner?.id ?? null, blue_score: num(r.blue_score), red_score: num(r.red_score),
                  patch: r.patch || null, venue_text: r.venue_text || null, stream_url: r.stream_url || null, external_url: r.external_url || null,
                  source_name: 'CSV', source_url: null, bracket_slot: null, feeds_winner_to: null, feeds_loser_to: null, created_at: ts, updated_at: ts,
                });
                ok++;
              }
            } catch {
              failed++;
            }
          }
          if (type === 'matches' || type === 'players') recomputeStandings(leagueId);
        },
        { toast: { kind: 'import', message: `CSV import: ${ok} ${type} added${failed ? `, ${failed} failed` : ''}` } },
      );
      return { ok, failed };
    },

    // -- import jobs ----------------------------------------------------------
    addImportJob(job) {
      const id = uid('job');
      commit(() => { get().db.import_jobs.push({ id, created_at: nowISO(), ...job }); }, { broadcast: true });
      return id;
    },
    updateImportJob(id, patch) {
      commit(() => {
        const j = get().db.import_jobs.find((x) => x.id === id);
        if (j) Object.assign(j, patch);
      });
    },

  };
});

function resultToast(db: Database, matchId: string): string {
  const m = db.matches.find((x) => x.id === matchId);
  if (!m || !m.winner_team_id) return 'Match completed';
  const winner = db.teams.find((t) => t.id === m.winner_team_id);
  const loserId = m.winner_team_id === m.blue_team_id ? m.red_team_id : m.blue_team_id;
  const loser = db.teams.find((t) => t.id === loserId);
  const hi = Math.max(m.blue_score, m.red_score);
  const lo = Math.min(m.blue_score, m.red_score);
  return `${winner?.short_name ?? 'Winner'} defeated ${loser?.short_name ?? 'opponent'} ${hi}-${lo}`;
}

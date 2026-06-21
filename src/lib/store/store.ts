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
  LeagueRunPhase,
  MarketOffer,
  Match,
  Player,
  RolePromise,
  Role,
  Team,
  TradeStatus,
} from '@/lib/types';
import { EMPTY_DB } from '@/lib/types';
import { avatarColor, createRoomCode, nowISO, uid } from '@/lib/utils';
import { createDataAdapter, type DataAdapter, type DataEvent } from '@/lib/data';
import { getSupabaseDiagnostics, type SupabaseDiagnostics, type SupabaseStatus } from '@/lib/supabase/client';
import { buildLeagueEntities, buildSeedDatabase } from '@/data/seed';
import type { RawLeague } from '@/data/rosters';
import { computeTeamStrength } from '@/services/strength';
import { simulateMatch as simMatch } from '@/services/simulation';
import { applyStandings, standingsTable } from '@/services/standings';
import {
  generateDoubleElim,
  generateNextSwissRound,
  generateRoundRobin,
  generateSchedule,
  generateSingleElim,
  formatForLeague,
} from '@/services/schedule';
import { canAfford } from '@/services/transfers';
import { runBotMarket } from '@/services/market';
import {
  applySeasonRewards,
  applyPlayerDevelopment,
  applySeasonRecovery,
  applyRetirements,
  seasonRecap,
  nextSeasonKey,
  resetTeamForNewSeason,
} from '@/services/season';
import { roleInLeague, managedTeamId as managedTeamIdSel } from './selectors';
import { generatePlayerRatings, playerSalary, playerValue } from '@/services/ratings';
import { buildLeagueExport, reidLeagueExport, isLeagueExport } from '@/services/leagueIO';
import { normalizeRole, num, toObjects } from '@/services/csv';
import {
  applyMatchConsequences,
  botManagerName,
  buildSimulation,
  generateFreeAgents,
  generateRunSquad,
  isPreseason,
  nextRunPhase,
  offerScore,
  playerCategory,
  revertMatchConsequences,
  runPhase,
} from '@/services/run';
import {
  buildRegionQualificationRules,
  createSeasonCircuit,
  parseQualificationResults,
  phaseCompetitionKey,
  syncSeasonCircuit,
  tagCompetitionMatches,
} from '@/services/competition';

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
  supabaseStatus: SupabaseStatus;
  supabaseDiagnostics: SupabaseDiagnostics;
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
  updateRunSetup: (leagueId: string, patch: Partial<Pick<League, 'starting_budget' | 'preparation_weeks' | 'bot_teams_enabled' | 'bot_team_count' | 'format' | 'friendlies_affect_development' | 'market_rules' | 'free_agent_offer_window_hours'>>) => void;
  advanceRunPhase: (leagueId: string) => void;
  startRun: (leagueId: string) => void;
  startNextSeason: (leagueId: string) => void;

  // teams
  createTeam: (leagueId: string, input: Partial<Team> & { name: string; short_name: string }) => string;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  setBotTeam: (teamId: string, enabled: boolean) => void;
  randomFillBots: (leagueId: string, count?: number) => void;

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
  playFriendly: (leagueId: string, opponentTeamId: string) => void;

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

  // free-agent offers
  submitMarketOffer: (input: { leagueId: string; playerId: string; teamId: string; transferFee: number; salary: number; rolePromise: RolePromise }) => string;
  cancelMarketOffer: (offerId: string) => void;
  resolveMarketOffers: (leagueId: string, force?: boolean) => void;
  // bot market
  runMarketTick: (leagueId: string) => void;
  respondToMarketOffer: (offerId: string, accept: boolean) => void;

  // admins
  setLeagueAdmin: (leagueId: string, guestId: string, role: AdminRole, teamId?: string | null) => void;
  removeLeagueAdmin: (leagueId: string, guestId: string) => void;

  // team managers (multiplayer)
  claimTeam: (leagueId: string, teamId: string) => Promise<boolean>;
  assignManager: (leagueId: string, guestId: string, teamId: string) => void;
  removeManager: (leagueId: string, guestId: string) => void;

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

  // permission helpers --------------------------------------------------------
  const roleOf = (leagueId: string): AdminRole => roleInLeague(get().db, leagueId, get().currentGuestId);
  const managedTeamOf = (leagueId: string): string | null =>
    managedTeamIdSel(get().db, leagueId, get().currentGuestId);

  // Owner/admin only. Reports a clear error + returns false when denied.
  const requireAdmin = (leagueId: string, action = 'change league settings'): boolean => {
    const role = roleOf(leagueId);
    if (role === 'owner' || role === 'admin') return true;
    reportError(new Error(`Only a league owner or admin can ${action}.`));
    return false;
  };

  // Owner/admin (any team) or the manager of `teamId`.
  const requireTeam = (leagueId: string, teamId: string | null | undefined, action = 'manage this team'): boolean => {
    const role = roleOf(leagueId);
    if (role === 'owner' || role === 'admin') return true;
    if (role === 'manager' && teamId && managedTeamOf(leagueId) === teamId) return true;
    reportError(new Error(`You can only ${action} for your own team.`));
    return false;
  };

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

  const resolveOffersInDb = (leagueId: string, force = false) => {
    const db = get().db;
    const league = db.leagues.find((item) => item.id === leagueId);
    if (!league) return 0;
    const now = Date.now();
    // Only auto-resolve free-agent offers here. Buy-offers for rostered players
    // (bot bids on managed teams) are resolved manually by the receiving team.
    const candidates = db.market_offers.filter(
      (offer) => offer.league_id === leagueId && offer.status === 'active' && (force || +new Date(offer.expires_at) <= now)
        && db.players.some((player) => player.id === offer.player_id && !player.team_id),
    );
    const playerIds = [...new Set(candidates.map((offer) => offer.player_id))];
    let resolved = 0;
    for (const playerId of playerIds) {
      const player = db.players.find((item) => item.id === playerId && !item.team_id);
      const offers = candidates.filter((offer) => offer.player_id === playerId);
      if (!player) {
        offers.forEach((offer) => { offer.status = 'expired'; offer.resolved_at = nowISO(); });
        continue;
      }
      const viable = offers
        .map((offer) => ({ offer, team: db.teams.find((team) => team.id === offer.team_id) }))
        .filter((entry): entry is { offer: MarketOffer; team: Team } => !!entry.team && entry.team.budget >= entry.offer.transfer_fee)
        .sort((a, b) => offerScore(b.offer, player, b.team, league.run_seed ?? league.id) - offerScore(a.offer, player, a.team, league.run_seed ?? league.id));
      const winner = viable[0];
      if (!winner) {
        offers.forEach((offer) => { offer.status = 'expired'; offer.resolved_at = nowISO(); });
        continue;
      }
      winner.team.budget -= winner.offer.transfer_fee;
      winner.team.updated_at = nowISO();
      player.team_id = winner.team.id;
      player.salary = winner.offer.salary;
      player.status = winner.offer.role_promise === 'starter' ? 'active' : 'benched';
      player.updated_at = nowISO();
      offers.forEach((offer) => {
        offer.status = offer.id === winner.offer.id ? 'accepted' : 'rejected';
        offer.resolved_at = nowISO();
      });
      db.transfer_history.push({
        id: uid('transfer'), league_id: leagueId, player_id: player.id, from_team_id: null,
        to_team_id: winner.team.id, transfer_type: 'signing', amount: winner.offer.transfer_fee, created_at: nowISO(),
      });
      resolved++;
    }
    return resolved;
  };

  // Run one bounded bot market tick and persist the resulting activity feed as
  // audit_logs entries (action_type 'bot_market'). Deterministic per tick: the
  // tick index is the count of existing bot_market entries for the league, so
  // advancing/ticking never replays the same actions and reloads add nothing.
  const runBotMarketInDb = (leagueId: string, reason: string): number => {
    const db = get().db;
    const league = db.leagues.find((item) => item.id === leagueId);
    if (!league || !league.run_started_at) return 0;
    const teams = db.teams.filter((team) => team.league_id === leagueId && team.run_active !== false);
    if (!teams.some((team) => team.is_bot)) return 0;
    const players = db.players.filter((player) => player.league_id === leagueId);
    const tick = db.audit_logs.filter((entry) => entry.league_id === leagueId && entry.action_type === 'bot_market').length;
    const actorGuestId = get().currentGuestId;
    const activity = runBotMarket({
      league,
      teams,
      players,
      offers: db.market_offers,
      transferHistory: db.transfer_history,
      tick,
      reason,
      offeredByGuestId: actorGuestId,
    });
    for (const entry of activity) {
      db.audit_logs.push({
        id: uid('al'),
        league_id: leagueId,
        // actor_guest_id is a FK to guest_sessions; attribute to the acting
        // guest. The bot team that made the move is carried in after_json.
        actor_guest_id: actorGuestId,
        action_type: 'bot_market',
        entity_type: 'market',
        entity_id: entry.player_id ?? entry.team_id,
        before_json: null,
        after_json: JSON.stringify({ kind: entry.kind, message: entry.message, team_id: entry.team_id, player_id: entry.player_id, reason }),
        created_at: entry.created_at,
      });
    }
    return activity.length;
  };

  // Apply season-end effects once per season: prize money, bounded player
  // development, fatigue/morale recovery, conservative retirements, and a
  // persisted recap snapshot (audit_logs 'season_end'). Idempotent via a
  // per-season marker so re-advancing/reloading never re-applies it.
  const runSeasonEndInDb = (leagueId: string): { rewards: number; retired: number } => {
    const db = get().db;
    const league = db.leagues.find((item) => item.id === leagueId);
    if (!league) return { rewards: 0, retired: 0 };
    // Idempotency keyed by season_key inside after_json (not entity_id, which is
    // a uuid column in Supabase and must stay a real id).
    const alreadyApplied = db.audit_logs.some((entry) => {
      if (entry.league_id !== leagueId || entry.action_type !== 'season_end') return false;
      try { return (JSON.parse(entry.after_json ?? '{}') as { season_key?: string }).season_key === league.season; } catch { return false; }
    });
    if (alreadyApplied) return { rewards: 0, retired: 0 };
    const teams = db.teams.filter((team) => team.league_id === leagueId && team.run_active !== false);
    const matches = db.matches.filter((match) => match.league_id === leagueId);
    const players = db.players.filter((player) => player.league_id === leagueId);
    const seed = `${league.run_seed ?? league.id}:${league.season}`;
    const rewards = applySeasonRewards(teams, matches);
    applyPlayerDevelopment(players, seed);
    applySeasonRecovery(teams, players);
    const retired = applyRetirements(players, seed);
    const recap = seasonRecap(league, teams, matches, players, db.match_simulations, db.transfer_history);
    db.audit_logs.push({
      id: uid('al'),
      league_id: leagueId,
      actor_guest_id: get().currentGuestId,
      action_type: 'season_end',
      entity_type: 'season',
      // entity_id is a uuid column; use the league id (season lives in after_json).
      entity_id: leagueId,
      before_json: null,
      after_json: JSON.stringify({ season_key: league.season, recap, rewards, retired }),
      created_at: nowISO(),
    });
    return { rewards: rewards.length, retired: retired.length };
  };

  // Apply a single match result + advance bracket links + create games.
  const playMatch = (m: Match, makeGames = true, deferCompletion = false) => {
    const db = get().db;
    if (!m.blue_team_id || !m.red_team_id) return;
    const existingSimulation = db.match_simulations.find((simulation) => simulation.match_id === m.id && simulation.status === 'completed');
    if (existingSimulation && m.status === 'completed') return;
    if (db.match_simulations.some((simulation) => simulation.match_id === m.id && simulation.status === 'running')) return;
    const blueTeam = db.teams.find((team) => team.id === m.blue_team_id);
    const redTeam = db.teams.find((team) => team.id === m.red_team_id);
    if (!blueTeam || !redTeam) return;
    const blue = strengthOf(m.blue_team_id);
    const red = strengthOf(m.red_team_id);
    const seed = `${m.id}:${uid('seed')}`;
    const res = simMatch(m.format, blue, red, {
      blueName: teamShort(m.blue_team_id),
      redName: teamShort(m.red_team_id),
      seed,
    });
    db.match_simulations = db.match_simulations.filter((simulation) => simulation.match_id !== m.id);
    const simulation = buildSimulation(m.league_id, m, res, blueTeam, redTeam, get().currentGuestId, seed, db.players, db.coaches);
    simulation.status = deferCompletion ? 'running' : 'completed';
    simulation.completed_at = deferCompletion ? null : nowISO();
    db.match_simulations.push(simulation);
    m.status = deferCompletion ? 'live' : 'completed';
    m.blue_score = deferCompletion ? 0 : res.blue_score;
    m.red_score = deferCompletion ? 0 : res.red_score;
    m.winner_team_id = deferCompletion ? null : res.winner === 'blue' ? m.blue_team_id : m.red_team_id;
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
    if (!deferCompletion) {
      const league = db.leagues.find((item) => item.id === m.league_id);
      const role = roleOf(m.league_id);
      const editableTeam = m.stage === 'friendly' && role !== 'owner' && role !== 'admin' ? managedTeamOf(m.league_id) : null;
      applyMatchConsequences(m, simulation, db.teams, db.players, league?.friendlies_affect_development ?? true, editableTeam);
    }
    if (!deferCompletion) advanceBracket(m);
  };

  const finishMatchSimulation = (matchId: string) => {
    const db = get().db;
    const match = db.matches.find((item) => item.id === matchId);
    const simulation = db.match_simulations.find((item) => item.match_id === matchId && item.status === 'running');
    if (!match || !simulation) return;
    const result = JSON.parse(simulation.final_result) as { winner_team_id: string; blue_score: number; red_score: number };
    match.status = 'completed';
    match.winner_team_id = result.winner_team_id;
    match.blue_score = result.blue_score;
    match.red_score = result.red_score;
    match.updated_at = nowISO();
    simulation.status = 'completed';
    simulation.completed_at = nowISO();
    const league = db.leagues.find((item) => item.id === match.league_id);
    applyMatchConsequences(match, simulation, db.teams, db.players, league?.friendlies_affect_development ?? true);
    advanceBracket(match);
    recomputeStandings(match.league_id);
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

  const syncCircuitInDb = (leagueId: string) => {
    const db = get().db;
    const league = db.leagues.find((item) => item.id === leagueId);
    if (!league) return;
    let circuit = db.season_circuits.find((item) => item.league_id === leagueId);
    if (!circuit) {
      circuit = createSeasonCircuit(league);
      db.season_circuits.push(circuit);
    }
    const teams = db.teams.filter((team) => team.league_id === leagueId && team.run_active !== false);
    const matches = db.matches.filter((match) => match.league_id === leagueId);
    Object.assign(circuit, syncSeasonCircuit(circuit, league, teams, matches));
  };

  return {
    db: EMPTY_DB,
    rev: 0,
    ready: false,
    loading: false,
    saving: false,
    error: null,
    mode: 'mock',
    supabaseStatus: 'mock',
    supabaseDiagnostics: getSupabaseDiagnostics(),
    currentGuestId: '',
    onlineGuests: {},
    toasts: [],

    init() {
      if (adapter || get().loading || get().ready) return;
      const diagnostics = getSupabaseDiagnostics();
      adapter = createDataAdapter();
      set({ mode: adapter.mode, supabaseStatus: diagnostics.status, supabaseDiagnostics: diagnostics });
      unsubscribeAdapter?.();
      unsubscribeAdapter = adapter.subscribe(
        ({ db, currentGuestId }, event) => {
          // A realtime reload can finish between queued snapshot writes and
          // must not replace newer local state that has not reached the server.
          // The final write emits another realtime event and converges normally.
          if (pendingWrites > 0) return;
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
        run_phase: 'lobby',
        starting_budget: input.starting_budget ?? 5_000_000,
        preparation_weeks: input.preparation_weeks ?? 3,
        bot_teams_enabled: input.bot_teams_enabled ?? false,
        bot_team_count: input.bot_team_count ?? 0,
        friendlies_affect_development: input.friendlies_affect_development ?? true,
        market_rules: input.market_rules ?? 'Open offers during preseason and between official weeks.',
        free_agent_offer_window_hours: input.free_agent_offer_window_hours ?? 24,
        current_run_week: 0,
        run_seed: null,
        run_started_at: null,
        run_completed_at: null,
        competition_mode: input.competition_mode ?? 'regional_season',
        is_seed: false,
        last_imported_at: null,
        created_at: ts,
        updated_at: ts,
      };
      commit(
        () => {
          const db = get().db;
          db.leagues.push(league);
          db.season_circuits.push(createSeasonCircuit(league));
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
          db.season_circuits.push(createSeasonCircuit(slices.leagues[0]));
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
          db.season_circuits.push(createSeasonCircuit(slices.leagues[0]));
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
          db.season_circuits.push(createSeasonCircuit(slices.leagues[0]));
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
          db.market_offers = db.market_offers.filter((offer) => offer.league_id !== id);
          db.match_simulations = db.match_simulations.filter((simulation) => simulation.league_id !== id);
          db.season_circuits = db.season_circuits.filter((circuit) => circuit.league_id !== id);
        },
        { toast: { kind: 'info', message: `Deleted "${name}"` } },
      );
    },

    resetLeagueResults(id) {
      if (!requireAdmin(id, 'reset results')) return;
      commit(
        () => {
          const db = get().db;
          const leagueMatches = db.matches.filter((m) => m.league_id === id);
          const ids = new Set(leagueMatches.map((m) => m.id));
          db.games = db.games.filter((g) => !ids.has(g.match_id));
          db.match_simulations
            .filter((simulation) => simulation.league_id === id)
            .sort((a, b) => +(new Date(b.completed_at ?? b.started_at)) - +(new Date(a.completed_at ?? a.started_at)))
            .forEach((simulation) => revertMatchConsequences(simulation, db.teams, db.players));
          db.match_simulations = db.match_simulations.filter((simulation) => simulation.league_id !== id);
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
          syncCircuitInDb(id);
        },
        { toast: { kind: 'info', message: 'League results reset' } },
      );
    },

    regenerateSchedule(id, format) {
      if (!requireAdmin(id, 'regenerate the schedule')) return;
      commit(
        () => {
          const db = get().db;
          const league = db.leagues.find((l) => l.id === id);
          if (!league) return;
          if (format) league.format = format;
          const teams = db.teams.filter((t) => t.league_id === id && t.run_active !== false);
          const oldIds = new Set(db.matches.filter((m) => m.league_id === id).map((m) => m.id));
          db.games = db.games.filter((g) => !oldIds.has(g.match_id));
          db.matches = db.matches.filter((m) => m.league_id !== id);
          const fresh = generateSchedule(league, teams, { start: new Date() });
          const competitionKey = phaseCompetitionKey(league) ?? (league.competition_mode === 'quick_tournament' ? 'quick_tournament' : 'regional_league');
          db.matches.push(...tagCompetitionMatches(fresh, competitionKey, league.competition_mode === 'quick_tournament' ? 'quick_tournament' : 'regional_regular_season'));
          recomputeStandings(id);
          syncCircuitInDb(id);
        },
        { toast: { kind: 'success', message: 'Schedule regenerated' } },
      );
    },

    updateRunSetup(leagueId, patch) {
      if (!requireAdmin(leagueId, 'configure the run')) return;
      const league = get().db.leagues.find((item) => item.id === leagueId);
      if (!league || !['lobby', 'team_selection'].includes(runPhase(league))) {
        reportError(new Error('Run setup is locked after the roster reveal starts.'));
        return;
      }
      const safePatch = {
        ...patch,
        preparation_weeks: patch.preparation_weeks == null ? undefined : Math.max(1, Math.min(3, patch.preparation_weeks)),
        bot_team_count: patch.bot_team_count == null ? undefined : Math.max(0, patch.bot_team_count),
        free_agent_offer_window_hours: patch.free_agent_offer_window_hours == null ? undefined : Math.max(1, patch.free_agent_offer_window_hours),
      };
      Object.keys(safePatch).forEach((key) => safePatch[key as keyof typeof safePatch] === undefined && delete safePatch[key as keyof typeof safePatch]);
      commit(() => {
        const target = get().db.leagues.find((item) => item.id === leagueId);
        if (target) Object.assign(target, safePatch, { updated_at: nowISO() });
      }, { toast: { kind: 'success', message: 'Run setup saved' } });
    },

    advanceRunPhase(leagueId) {
      if (!requireAdmin(leagueId, 'advance the run')) return;
      const league = get().db.leagues.find((item) => item.id === leagueId);
      if (!league) return;
      if (runPhase(league) === 'team_selection') {
        get().startRun(leagueId);
        return;
      }
      if (runPhase(league) === 'next_season_setup') {
        get().startNextSeason(leagueId);
        return;
      }
      const next = nextRunPhase(league);
      commit(() => {
        const db = get().db;
        const target = db.leagues.find((item) => item.id === leagueId);
        if (!target) return;
        if (isPreseason(runPhase(target))) resolveOffersInDb(leagueId, true);
        syncCircuitInDb(leagueId);
        target.run_phase = next;
        target.current_run_week = next.startsWith('preseason_week_') ? Number(next.slice(-1)) : next === 'regular_season' ? 1 : target.current_run_week ?? 0;
        const activeTeams = db.teams.filter((team) => team.league_id === leagueId && team.run_active !== false);
        const table = standingsTable(activeTeams, db.matches.filter((match) => match.league_id === leagueId));
        const bracketSeeds = (ids: string[]) => ids.slice(0, ids.length >= 8 ? 8 : ids.length >= 4 ? 4 : 2);
        const addBracket = (competitionKey: string, stageKey: string, seeds: string[]) => {
          if (db.matches.some((match) => match.league_id === leagueId && match.competition_key === competitionKey && ['playoffs', 'final'].includes(match.stage))) return;
          const selected = bracketSeeds(seeds);
          if (selected.length >= 2) db.matches.push(...tagCompetitionMatches(generateSingleElim(leagueId, selected, 'BO5', new Date()), competitionKey, stageKey));
        };
        if (next === 'playoffs') {
          const competitionKey = target.competition_mode === 'quick_tournament' ? 'quick_tournament' : 'regional_playoffs';
          const existingBracket = db.matches.some((match) => match.league_id === leagueId && match.competition_key === competitionKey && ['playoffs', 'final'].includes(match.stage));
          if (!existingBracket) addBracket(competitionKey, target.competition_mode === 'quick_tournament' ? 'quick_tournament' : 'regional_playoffs', table.map((row) => row.team.id));
        }
        if (next === 'msi') {
          syncCircuitInDb(leagueId);
          const circuit = db.season_circuits.find((item) => item.league_id === leagueId);
          const qualified = circuit ? parseQualificationResults(circuit).filter((result) => result.target_competition_key === 'msi' && result.team_id).map((result) => result.team_id as string) : [];
          addBracket('msi', 'msi', qualified.length >= 2 ? qualified : table.slice(0, 2).map((row) => row.team.id));
        }
        if (next === 'second_regional_phase' && !db.matches.some((match) => match.league_id === leagueId && match.competition_key === 'second_regional_phase')) {
          const schedule = generateSchedule(target, activeTeams, { start: new Date() }).filter((match) => ['regular_season', 'group_stage', 'swiss'].includes(match.stage));
          db.matches.push(...tagCompetitionMatches(schedule, 'second_regional_phase', 'second_regional_phase'));
        }
        if (next === 'regional_finals') addBracket('regional_finals', 'regional_finals', table.map((row) => row.team.id));
        if (next === 'worlds') {
          syncCircuitInDb(leagueId);
          const circuit = db.season_circuits.find((item) => item.league_id === leagueId);
          const qualified = circuit ? parseQualificationResults(circuit).filter((result) => result.target_competition_key === 'worlds' && result.team_id).map((result) => result.team_id as string) : [];
          addBracket('worlds', 'worlds', qualified.length >= 2 ? qualified : table.slice(0, Math.min(4, table.length)).map((row) => row.team.id));
        }
        if (runPhase(target) !== 'roster_reveal') {
          db.players.filter((player) => player.league_id === leagueId).forEach((player) => { player.hidden_until_reveal = false; });
        }
        if (next === 'completed') target.run_completed_at = nowISO();
        // Entering the offseason finalizes the competitive year: prize money,
        // player development, recovery, retirements, and a recap snapshot.
        if (next === 'offseason') runSeasonEndInDb(leagueId);
        // Bot teams trade during natural market windows only — never on render.
        const MARKET_WINDOWS: LeagueRunPhase[] = ['preseason_week_1', 'preseason_week_2', 'preseason_week_3', 'midseason_break', 'offseason'];
        if (MARKET_WINDOWS.includes(next)) runBotMarketInDb(leagueId, next.replaceAll('_', ' '));
        target.updated_at = nowISO();
        syncCircuitInDb(leagueId);
      }, { toast: { kind: 'success', message: `Run advanced to ${next.replaceAll('_', ' ')}` } });
    },

    startRun(leagueId) {
      if (!requireAdmin(leagueId, 'start the run')) return;
      const db0 = get().db;
      const league0 = db0.leagues.find((item) => item.id === leagueId);
      if (!league0 || runPhase(league0) !== 'team_selection') {
        reportError(new Error('Move the league to team selection before starting the run.'));
        return;
      }
      const managedIds = new Set(
        db0.league_members.filter((member) => member.league_id === leagueId && member.role === 'manager' && member.team_id).map((member) => member.team_id as string),
      );
      const teams = db0.teams.filter((team) => team.league_id === leagueId);
      const desiredBots = league0.bot_teams_enabled ? Math.max(0, league0.bot_team_count ?? 0) : 0;
      const botIds = teams.filter((team) => team.is_bot && !managedIds.has(team.id)).slice(0, desiredBots).map((team) => team.id);
      for (const team of teams) {
        if (botIds.length >= desiredBots) break;
        if (!managedIds.has(team.id) && !botIds.includes(team.id)) botIds.push(team.id);
      }
      const activeIds = new Set([...managedIds, ...botIds]);
      if (activeIds.size < 2) {
        reportError(new Error('At least two managed or bot teams are required to start.'));
        return;
      }
      const runSeed = uid('run');
      commit(() => {
        const db = get().db;
        const league = db.leagues.find((item) => item.id === leagueId)!;
        const matchIds = new Set(db.matches.filter((match) => match.league_id === leagueId).map((match) => match.id));
        db.games = db.games.filter((game) => !matchIds.has(game.match_id));
        db.match_simulations = db.match_simulations.filter((simulation) => simulation.league_id !== leagueId);
        db.matches = db.matches.filter((match) => match.league_id !== leagueId);
        db.market_offers = db.market_offers.filter((offer) => offer.league_id !== leagueId);
        db.players = db.players.filter((player) => player.league_id !== leagueId);
        db.coaches = db.coaches.filter((coach) => coach.league_id !== leagueId);

        const activeTeams = db.teams.filter((team) => team.league_id === leagueId && activeIds.has(team.id));
        activeTeams.forEach((team, index) => {
          team.run_active = true;
          team.is_bot = botIds.includes(team.id);
          team.bot_manager_name = team.is_bot ? botManagerName(team, index) : null;
          team.budget = league.starting_budget ?? 5_000_000;
          team.morale = 50;
          team.synergy = 50;
          team.performance_form = 50;
          team.fatigue = 0;
          team.updated_at = nowISO();
          const squad = generateRunSquad(league, team, runSeed);
          db.players.push(...squad.players);
          db.coaches.push(squad.coach);
        });
        db.teams.filter((team) => team.league_id === leagueId && !activeIds.has(team.id)).forEach((team) => {
          team.run_active = false;
          team.is_bot = false;
          team.bot_manager_name = null;
        });
        db.players.push(...generateFreeAgents(league, runSeed));
        if (league.competition_mode === 'full_circuit') {
          // Parallel regional leagues: group active teams by home region, fill
          // each region with generated bot teams, and schedule a round-robin per
          // region so every region simulates independently in the same season.
          const MIN_REGION_TEAMS = 4;
          const FILLER_SUFFIX = ['Vanguard', 'Dynamo', 'United', 'Phoenix', 'Collective', 'Sentinels', 'Rising', 'Legacy'];
          const byRegion = new Map<string, Team[]>();
          for (const team of activeTeams) {
            const region = team.region || 'Unknown';
            if (!byRegion.has(region)) byRegion.set(region, []);
            byRegion.get(region)!.push(team);
          }
          const regionMatches: Match[] = [];
          let fillerIndex = 0;
          for (const [region, regionTeams] of byRegion) {
            for (let i = regionTeams.length; i < MIN_REGION_TEAMS; i++) {
              const fid = uid('t');
              const short = `${(region.replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || 'BOT').toUpperCase()}${i + 1}`;
              const filler: Team = {
                id: fid, league_id: leagueId, name: `${region} ${FILLER_SUFFIX[fillerIndex % FILLER_SUFFIX.length]}`, short_name: short,
                region, country: regionTeams[0]?.country ?? '', tier: regionTeams[0]?.tier ?? league.tier,
                logo_url: null, banner_url: null, external_url: null, source_name: 'Generated', source_url: null, confidence: 0.2,
                budget: league.starting_budget ?? 5_000_000, wins: 0, losses: 0, games_won: 0, games_lost: 0, points: 0, form: '',
                generated: true, is_bot: true, bot_manager_name: null, run_active: true, morale: 50, synergy: 50, performance_form: 50, fatigue: 0,
                created_at: nowISO(), updated_at: nowISO(),
              };
              filler.bot_manager_name = botManagerName(filler, fillerIndex);
              fillerIndex++;
              db.teams.push(filler);
              const squad = generateRunSquad(league, filler, runSeed);
              db.players.push(...squad.players);
              db.coaches.push(squad.coach);
              regionTeams.push(filler);
            }
            const ids = regionTeams.map((team) => team.id);
            if (ids.length >= 2) regionMatches.push(...generateRoundRobin(leagueId, ids, 'BO1', false, new Date(), null));
          }
          db.matches.push(...tagCompetitionMatches(regionMatches, 'regional_league', 'regional_regular_season'));
          let circuit = db.season_circuits.find((c) => c.league_id === leagueId);
          if (!circuit) { circuit = createSeasonCircuit(league); db.season_circuits.push(circuit); }
          circuit.qualification_rules_json = JSON.stringify(buildRegionQualificationRules([...byRegion.keys()]));
        } else {
          const competitionKey = league.competition_mode === 'quick_tournament' ? 'quick_tournament' : 'regional_league';
          const stageKey = league.competition_mode === 'quick_tournament' ? 'quick_tournament' : 'regional_regular_season';
          db.matches.push(...tagCompetitionMatches(generateSchedule(league, activeTeams, { start: new Date() }), competitionKey, stageKey));
        }
        league.run_phase = 'roster_reveal';
        league.run_seed = runSeed;
        league.run_started_at = nowISO();
        league.current_run_week = 0;
        league.updated_at = nowISO();
        syncCircuitInDb(leagueId);
      }, { toast: { kind: 'success', message: 'Run started. Rosters are ready to reveal.' } });
    },

    // Loop the Full Circuit into a fresh year. Keeps teams, rosters, managers,
    // budgets and the persisted season recap; resets standings + the schedule
    // and bumps the season key. Old matches/replays are cleared for a clean
    // slate (TODO: archive prior-season matches/sims for in-app replay history).
    startNextSeason(leagueId) {
      if (!requireAdmin(leagueId, 'start the next season')) return;
      const league0 = get().db.leagues.find((item) => item.id === leagueId);
      if (!league0 || runPhase(league0) !== 'next_season_setup') {
        reportError(new Error('Finish the offseason and reach next season setup first.'));
        return;
      }
      const newSeason = nextSeasonKey(league0.season);
      commit(() => {
        const db = get().db;
        const league = db.leagues.find((item) => item.id === leagueId);
        if (!league) return;
        // Finalize the closing season's recap if it has not been captured yet.
        runSeasonEndInDb(leagueId);
        const matchIds = new Set(db.matches.filter((match) => match.league_id === leagueId).map((match) => match.id));
        db.games = db.games.filter((game) => !matchIds.has(game.match_id));
        db.match_simulations = db.match_simulations.filter((simulation) => simulation.league_id !== leagueId);
        db.matches = db.matches.filter((match) => match.league_id !== leagueId);
        db.market_offers
          .filter((offer) => offer.league_id === leagueId && offer.status === 'active')
          .forEach((offer) => { offer.status = 'expired'; offer.resolved_at = nowISO(); });
        const activeTeams = db.teams.filter((team) => team.league_id === leagueId && team.run_active !== false);
        activeTeams.forEach(resetTeamForNewSeason);
        if (league.competition_mode === 'full_circuit') {
          const byRegion = new Map<string, Team[]>();
          for (const team of activeTeams) {
            const region = team.region || 'Unknown';
            if (!byRegion.has(region)) byRegion.set(region, []);
            byRegion.get(region)!.push(team);
          }
          const regionMatches: Match[] = [];
          for (const regionTeams of byRegion.values()) {
            const ids = regionTeams.map((team) => team.id);
            if (ids.length >= 2) regionMatches.push(...generateRoundRobin(leagueId, ids, 'BO1', false, new Date(), null));
          }
          db.matches.push(...tagCompetitionMatches(regionMatches, 'regional_league', 'regional_regular_season'));
          const circuit = db.season_circuits.find((item) => item.league_id === leagueId);
          if (circuit) circuit.qualification_rules_json = JSON.stringify(buildRegionQualificationRules([...byRegion.keys()]));
        } else {
          db.matches.push(...tagCompetitionMatches(generateSchedule(league, activeTeams, { start: new Date() }), 'regional_league', 'regional_regular_season'));
        }
        db.players.push(...generateFreeAgents(league, `${league.run_seed ?? league.id}:${newSeason}`));
        league.season = newSeason;
        league.run_phase = 'preseason_week_1';
        league.current_run_week = 1;
        league.run_completed_at = null;
        league.updated_at = nowISO();
        const circuit = db.season_circuits.find((item) => item.league_id === leagueId);
        if (circuit) {
          circuit.season_key = newSeason;
          circuit.qualification_results_json = '[]';
          circuit.status = 'active';
        }
        recomputeStandings(leagueId);
        syncCircuitInDb(leagueId);
      }, { toast: { kind: 'success', message: `New season started: ${newSeason}` } });
    },

    // -- teams ----------------------------------------------------------------
    createTeam(leagueId, input) {
      if (!requireAdmin(leagueId, 'add teams')) return '';
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
        is_bot: input.is_bot ?? false,
        bot_manager_name: input.bot_manager_name ?? null,
        run_active: input.run_active ?? true,
        morale: input.morale ?? 50,
        synergy: input.synergy ?? 50,
        performance_form: input.performance_form ?? 50,
        fatigue: input.fatigue ?? 0,
        created_at: ts,
        updated_at: ts,
      };
      commit(() => get().db.teams.push(team), { toast: { kind: 'success', message: `Added team ${team.name}` }, audit: { leagueId, action: 'create', entity: 'team', entityId: id, after: team } });
      return id;
    },
    updateTeam(id, patch) {
      const before = get().db.teams.find((t) => t.id === id);
      if (before && !requireAdmin(before.league_id, 'edit teams')) return;
      commit(
        () => {
          const t = get().db.teams.find((x) => x.id === id);
          if (t) Object.assign(t, patch, { updated_at: nowISO() });
        },
        { audit: before ? { leagueId: before.league_id, action: 'update', entity: 'team', entityId: id, after: patch } : undefined },
      );
    },
    deleteTeam(id) {
      const team = get().db.teams.find((t) => t.id === id);
      if (team && !requireAdmin(team.league_id, 'remove teams')) return;
      commit(() => {
        const db = get().db;
        db.players.filter((p) => p.team_id === id).forEach((p) => (p.team_id = null));
        db.coaches.filter((c) => c.team_id === id).forEach((c) => (c.team_id = null));
        db.teams = db.teams.filter((t) => t.id !== id);
      }, { toast: { kind: 'info', message: 'Team removed' } });
    },
    setBotTeam(teamId, enabled) {
      const team = get().db.teams.find((item) => item.id === teamId);
      if (!team || !requireAdmin(team.league_id, 'configure bot teams')) return;
      const league = get().db.leagues.find((item) => item.id === team.league_id);
      if (!league || runPhase(league) !== 'team_selection') {
        reportError(new Error('Bot teams can only be changed during team selection.'));
        return;
      }
      const manager = get().db.league_members.find((member) => member.league_id === team.league_id && member.team_id === teamId && member.role === 'manager');
      if (enabled && manager) {
        reportError(new Error('Remove the human manager before assigning this team to a bot.'));
        return;
      }
      commit(() => {
        const target = get().db.teams.find((item) => item.id === teamId);
        if (target) {
          target.is_bot = enabled;
          target.bot_manager_name = enabled ? botManagerName(target, get().db.teams.filter((item) => item.league_id === target.league_id && item.is_bot).length) : null;
          target.updated_at = nowISO();
          const targetLeague = get().db.leagues.find((item) => item.id === target.league_id);
          if (targetLeague) {
            const botCount = get().db.teams.filter((item) => item.league_id === target.league_id && item.is_bot).length;
            targetLeague.bot_teams_enabled = botCount > 0;
            targetLeague.bot_team_count = botCount;
            targetLeague.updated_at = nowISO();
          }
        }
      }, { toast: { kind: 'info', message: enabled ? `${team.short_name} assigned to a bot` : `${team.short_name} returned to the selection pool` } });
    },

    randomFillBots(leagueId, count) {
      if (!requireAdmin(leagueId, 'fill bot teams')) return;
      const league = get().db.leagues.find((l) => l.id === leagueId);
      if (!league || runPhase(league) !== 'team_selection') {
        reportError(new Error('Bot teams can only be changed during team selection.'));
        return;
      }
      const managedIds = new Set(
        get().db.league_members.filter((m) => m.league_id === leagueId && m.role === 'manager' && m.team_id).map((m) => m.team_id),
      );
      const fillable = get().db.teams.filter(
        (t) => t.league_id === leagueId && t.run_active !== false && !t.is_bot && !managedIds.has(t.id),
      );
      const targets = typeof count === 'number' && count >= 0 ? fillable.slice(0, count) : fillable;
      if (!targets.length) {
        get().pushToast({ kind: 'info', message: 'No open teams to fill.' });
        return;
      }
      const targetIds = new Set(targets.map((t) => t.id));
      // Single commit so the burst persists cleanly under Supabase sync.
      commit(() => {
        const db = get().db;
        let botIndex = db.teams.filter((t) => t.league_id === leagueId && t.is_bot).length;
        db.teams.filter((t) => targetIds.has(t.id)).forEach((t) => {
          t.is_bot = true;
          t.bot_manager_name = botManagerName(t, botIndex++);
          t.updated_at = nowISO();
        });
        const l = db.leagues.find((x) => x.id === leagueId);
        if (l) {
          const botCount = db.teams.filter((t) => t.league_id === leagueId && t.is_bot).length;
          l.bot_teams_enabled = botCount > 0;
          l.bot_team_count = botCount;
          l.updated_at = nowISO();
        }
      }, { toast: { kind: 'success', message: `Filled ${targets.length} team${targets.length > 1 ? 's' : ''} with bots` } });
    },

    // -- players --------------------------------------------------------------
    createPlayer(leagueId, input) {
      if (!requireAdmin(leagueId, 'add players')) return '';
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
        category: input.category ?? playerCategory(overall),
        potential: input.potential ?? Math.min(99, overall + 5),
        hidden_until_reveal: input.hidden_until_reveal ?? false,
        performance_form: input.performance_form ?? 50,
        morale: input.morale ?? 50,
        fatigue: input.fatigue ?? 0,
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
      // Full edits (ratings, value, role, team…) are admin-only. Managers change
      // their own players' active/bench status via setPlayerStatus.
      if (before && !requireAdmin(before.league_id, 'edit player details')) return;
      commit(
        () => {
          const p = get().db.players.find((x) => x.id === id);
          if (p) Object.assign(p, patch, { updated_at: nowISO() });
        },
        { audit: before ? { leagueId: before.league_id, action: 'update', entity: 'player', entityId: id, before, after: patch } : undefined },
      );
    },
    deletePlayer(id) {
      const p0 = get().db.players.find((p) => p.id === id);
      if (p0 && !requireAdmin(p0.league_id, 'remove players')) return;
      commit(() => { get().db.players = get().db.players.filter((p) => p.id !== id); }, { toast: { kind: 'info', message: 'Player removed' } });
    },
    signPlayer(playerId, teamId) {
      const db0 = get().db;
      const p0 = db0.players.find((x) => x.id === playerId);
      const t0 = db0.teams.find((x) => x.id === teamId);
      if (!p0 || !t0) return;
      // Manager may sign a free agent to their own team; moving a player between
      // existing teams is an owner/admin action.
      if (p0.team_id && p0.team_id !== teamId) {
        if (!requireAdmin(p0.league_id, 'move players between teams')) return;
      } else if (!requireTeam(t0.league_id, teamId, 'sign players')) return;
      // Signing a free agent costs the player's value; budget must allow it.
      const cost = p0.team_id ? 0 : p0.value;
      if (cost > 0 && t0.budget < cost) {
        reportError(new Error(`${t0.short_name} can't afford ${p0.nickname} (needs ${cost.toLocaleString()}).`));
        return;
      }
      commit(
        () => {
          const db = get().db;
          const p = db.players.find((x) => x.id === playerId);
          const t = db.teams.find((x) => x.id === teamId);
          if (!p || !t) return;
          const from = p.team_id;
          if (!from && cost > 0) t.budget -= cost;
          p.team_id = teamId;
          p.status = 'active';
          p.updated_at = nowISO();
          db.transfer_history.push({ id: uid('th'), league_id: p.league_id, player_id: playerId, from_team_id: from, to_team_id: teamId, transfer_type: from ? 'trade' : 'signing', amount: cost, created_at: nowISO() });
        },
        { toast: { kind: 'success', message: `${teamShort(teamId)} signed ${p0.nickname}` } },
      );
    },
    releasePlayer(playerId) {
      const p0 = get().db.players.find((x) => x.id === playerId);
      if (!p0) return;
      if (!requireTeam(p0.league_id, p0.team_id, 'release players')) return;
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
        { toast: { kind: 'info', message: `${p0.nickname} released to free agency` } },
      );
    },
    sellPlayer(playerId, price) {
      const p0 = get().db.players.find((x) => x.id === playerId);
      if (!p0) return;
      if (!requireTeam(p0.league_id, p0.team_id, 'sell players')) return;
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
      }, { toast: { kind: 'success', message: `Sold ${p0.nickname}` } });
    },
    setPlayerStatus(playerId, status) {
      const p0 = get().db.players.find((x) => x.id === playerId);
      if (!p0) return;
      if (!requireTeam(p0.league_id, p0.team_id, 'set roster status')) return;
      commit(() => {
        const p = get().db.players.find((x) => x.id === playerId);
        if (p) Object.assign(p, { status, updated_at: nowISO() });
      });
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
      if (!requireAdmin(m.league_id, 'simulate matches')) return;
      const league = get().db.leagues.find((item) => item.id === m.league_id);
      if (league?.run_started_at && !['regular_season', 'playoffs', 'msi', 'second_regional_phase', 'regional_finals', 'worlds'].includes(runPhase(league))) {
        reportError(new Error('Official matches start after preseason.'));
        return;
      }
      if (league?.run_started_at && m.competition_key && phaseCompetitionKey(league) !== m.competition_key) {
        reportError(new Error('This match belongs to a different circuit stage.'));
        return;
      }
      commit(
        () => {
          const match = get().db.matches.find((x) => x.id === matchId)!;
          playMatch(match, true, true);
        },
        { toast: { kind: 'match', message: 'Match simulation started' } },
      );
      window.setTimeout(() => {
        const running = get().db.match_simulations.some((simulation) => simulation.match_id === matchId && simulation.status === 'running');
        if (!running) return;
        commit(() => {
          finishMatchSimulation(matchId);
          syncCircuitInDb(m.league_id);
        }, { toast: { kind: 'match', message: 'Match simulation completed' } });
      }, 1800);
    },
    resetMatch(matchId) {
      const m0 = get().db.matches.find((x) => x.id === matchId);
      if (m0 && !requireAdmin(m0.league_id, 'reset matches')) return;
      commit(() => {
        const db = get().db;
        const m = db.matches.find((x) => x.id === matchId);
        if (!m) return;
        const simulation = db.match_simulations.find((item) => item.match_id === matchId);
        if (simulation) revertMatchConsequences(simulation, db.teams, db.players);
        db.games = db.games.filter((g) => g.match_id !== matchId);
        db.match_simulations = db.match_simulations.filter((simulation) => simulation.match_id !== matchId);
        m.status = 'scheduled';
        m.blue_score = 0;
        m.red_score = 0;
        m.winner_team_id = null;
        m.updated_at = nowISO();
        recomputeStandings(m.league_id);
        syncCircuitInDb(m.league_id);
      }, { toast: { kind: 'info', message: 'Match reset' } });
    },
    setMatchResult(matchId, blueScore, redScore) {
      const m0 = get().db.matches.find((x) => x.id === matchId);
      if (m0 && !requireAdmin(m0.league_id, 'edit match results')) return;
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
          syncCircuitInDb(m.league_id);
        },
        { toast: { kind: 'match', message: `Result saved: ${resultToast(get().db, matchId)}` } },
      );
    },
    simulateWeek(leagueId, week) {
      if (!requireAdmin(leagueId, 'simulate matches')) return;
      const league0 = get().db.leagues.find((item) => item.id === leagueId);
      if (league0?.run_started_at && !['regular_season', 'second_regional_phase'].includes(runPhase(league0))) {
        reportError(new Error('Official weeks can only run during the regular season.'));
        return;
      }
      commit(
        () => {
          const db = get().db;
          resolveOffersInDb(leagueId, true);
          const activeCompetition = league0 ? phaseCompetitionKey(league0) : null;
          const toPlay = db.matches.filter((m) => m.league_id === leagueId && (!activeCompetition || !m.competition_key || m.competition_key === activeCompetition) && m.week === week && m.status !== 'completed' && m.blue_team_id && m.red_team_id);
          toPlay.forEach((m) => playMatch(m));
          const league = db.leagues.find((item) => item.id === leagueId);
          if (league) { league.current_run_week = week + 1; league.updated_at = nowISO(); }
          recomputeStandings(leagueId);
          syncCircuitInDb(leagueId);
        },
        { toast: { kind: 'match', message: `Week ${week} simulated` } },
      );
    },
    simulateRegularSeason(leagueId) {
      if (!requireAdmin(leagueId, 'simulate the season')) return;
      const league0 = get().db.leagues.find((item) => item.id === leagueId);
      if (league0?.run_started_at && !['regular_season', 'second_regional_phase'].includes(runPhase(league0))) {
        reportError(new Error('Advance the run to the regular season first.'));
        return;
      }
      commit(
        () => {
          const db = get().db;
          const league = db.leagues.find((l) => l.id === leagueId)!;
          const activeCompetition = phaseCompetitionKey(league);
          // regular/group: play all
          db.matches
            .filter((m) => m.league_id === leagueId && (!activeCompetition || !m.competition_key || m.competition_key === activeCompetition) && ['regular_season', 'group_stage'].includes(m.stage) && m.status !== 'completed' && m.blue_team_id && m.red_team_id)
            .forEach((m) => playMatch(m));
          // swiss: iteratively play + generate next rounds (cap 5 rounds)
          if (league.format === 'swiss') {
            const teams = db.teams.filter((t) => t.league_id === leagueId && t.run_active !== false).map((t) => t.id);
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
          syncCircuitInDb(leagueId);
        },
        { toast: { kind: 'match', message: 'Regular season simulated' } },
      );
    },
    simulatePlayoffs(leagueId) {
      if (!requireAdmin(leagueId, 'simulate playoffs')) return;
      const league0 = get().db.leagues.find((item) => item.id === leagueId);
      if (league0?.run_started_at && !['playoffs', 'msi', 'regional_finals', 'worlds'].includes(runPhase(league0))) {
        reportError(new Error('Advance the run to playoffs first.'));
        return;
      }
      commit(
        () => {
          const db = get().db;
          const activeCompetition = league0 ? phaseCompetitionKey(league0) : null;
          // play bracket matches in passes until stable
          for (let pass = 0; pass < 12; pass++) {
            const ready = db.matches.filter((m) => m.league_id === leagueId && (!activeCompetition || !m.competition_key || m.competition_key === activeCompetition) && ['playoffs', 'final'].includes(m.stage) && m.status !== 'completed' && m.blue_team_id && m.red_team_id);
            if (!ready.length) break;
            ready.sort((a, b) => a.week - b.week || a.match_day - b.match_day);
            ready.forEach((m) => playMatch(m));
          }
          recomputeStandings(leagueId);
          syncCircuitInDb(leagueId);
        },
        { toast: { kind: 'match', message: 'Playoffs simulated' } },
      );
    },
    simulateFullTournament(leagueId) {
      if (!requireAdmin(leagueId, 'simulate the tournament')) return;
      get().simulateRegularSeason(leagueId);
      get().simulatePlayoffs(leagueId);
      get().pushToast({ kind: 'success', message: 'Full tournament simulated' });
    },
    playFriendly(leagueId, opponentTeamId) {
      const league = get().db.leagues.find((item) => item.id === leagueId);
      const ownTeamId = managedTeamOf(leagueId);
      if (!league || !isPreseason(runPhase(league))) {
        reportError(new Error('Friendly matches are available during preseason.'));
        return;
      }
      if (!ownTeamId || ownTeamId === opponentTeamId || !requireTeam(leagueId, ownTeamId, 'play friendlies')) return;
      const opponent = get().db.teams.find((team) => team.id === opponentTeamId && team.league_id === leagueId && team.run_active !== false);
      if (!opponent) return;
      const matchId = uid('friendly');
      commit(() => {
        const match: Match = {
          id: matchId,
          league_id: leagueId,
          stage: 'friendly',
          week: league.current_run_week ?? 1,
          match_day: 0,
          date_time: nowISO(),
          blue_team_id: ownTeamId,
          red_team_id: opponentTeamId,
          format: 'BO1',
          status: 'scheduled',
          winner_team_id: null,
          blue_score: 0,
          red_score: 0,
          patch: null,
          venue_text: 'Preseason scrim',
          stream_url: null,
          external_url: null,
          source_name: 'Run friendly',
          source_url: null,
          created_at: nowISO(),
          updated_at: nowISO(),
        };
        get().db.matches.push(match);
        playMatch(match);
      }, { toast: { kind: 'match', message: `Friendly played against ${opponent.short_name}` } });
    },

    // -- playoffs generation --------------------------------------------------
    generatePlayoffs(leagueId, opts) {
      if (!requireAdmin(leagueId, 'generate playoffs')) return;
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
          const competitionKey = phaseCompetitionKey(league) ?? (league.competition_mode === 'quick_tournament' ? 'quick_tournament' : 'regional_playoffs');
          db.matches.push(...tagCompetitionMatches(fresh, competitionKey, competitionKey));
          syncCircuitInDb(leagueId);
        },
        { toast: { kind: 'success', message: `${opts.type === 'double' ? 'Double' : 'Single'}-elim playoffs generated (top ${opts.size})` } },
      );
    },

    // -- trades ---------------------------------------------------------------
    proposeTrade(input) {
      // The proposer must manage the offering team (or be owner/admin).
      if (!requireTeam(input.leagueId, input.fromTeamId, 'propose trades')) return '';
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
      const db = get().db;
      const trade = db.trades.find((t) => t.id === tradeId);
      if (!trade) return;
      const role = roleOf(trade.league_id);
      const isAdmin = role === 'owner' || role === 'admin';
      const myTeam = managedTeamOf(trade.league_id);

      if (status === 'cancelled') {
        // The proposer (or an owner/admin) can withdraw a pending trade.
        if (!(isAdmin || trade.proposed_by_guest_id === get().currentGuestId)) {
          reportError(new Error('Only the proposing manager or an admin can cancel this trade.'));
          return;
        }
      } else {
        // accept/reject: the receiving team's manager or an owner/admin.
        if (!(isAdmin || myTeam === trade.to_team_id)) {
          reportError(new Error("Only the receiving team's manager or an admin can respond to this trade."));
          return;
        }
      }

      if (status === 'accepted') {
        const fromTeam = db.teams.find((t) => t.id === trade.from_team_id);
        const toTeam = db.teams.find((t) => t.id === trade.to_team_id);
        if (fromTeam && toTeam) {
          const fromNet = trade.money_to_team - trade.money_from_team;
          const toNet = trade.money_from_team - trade.money_to_team;
          if (!canAfford(fromTeam, -fromNet) || !canAfford(toTeam, -toNet)) {
            get().pushToast({ kind: 'error', message: 'Trade rejected: insufficient budget' });
            return;
          }
        }
        // Acceptance mutates BOTH teams, so it runs through the adapter (a
        // SECURITY DEFINER RPC in Supabase, in-memory in mock) rather than a
        // per-team client write that RLS would block for a single manager.
        if (!adapter) return;
        void adapter
          .acceptTrade(tradeId, get().currentGuestId)
          .then(() => {
            get().refresh();
            get().pushToast({ kind: 'trade', message: 'Trade accepted' });
          })
          .catch(reportError);
        return;
      }

      commit(() => {
        const t = get().db.trades.find((x) => x.id === tradeId);
        if (t) {
          t.status = status;
          t.reviewed_at = nowISO();
          t.reviewed_by_guest_id = get().currentGuestId;
        }
      }, { toast: { kind: 'trade', message: `Trade ${status}` } });
    },

    submitMarketOffer(input) {
      const league = get().db.leagues.find((item) => item.id === input.leagueId);
      const player = get().db.players.find((item) => item.id === input.playerId && item.league_id === input.leagueId);
      const team = get().db.teams.find((item) => item.id === input.teamId && item.league_id === input.leagueId);
      if (!league || !player || !team || player.team_id) {
        reportError(new Error('This player is no longer available.'));
        return '';
      }
      if (!requireTeam(input.leagueId, input.teamId, 'submit free-agent offers')) return '';
      const phase = runPhase(league);
      if (!(isPreseason(phase) || phase === 'regular_season')) {
        reportError(new Error('Free-agent offers open during preseason and the regular season.'));
        return '';
      }
      const fee = Math.max(0, Math.round(input.transferFee));
      const salary = Math.max(0, Math.round(input.salary));
      if (fee > team.budget) {
        reportError(new Error(`${team.short_name} cannot afford that transfer fee.`));
        return '';
      }
      const id = uid('offer');
      const submittedAt = nowISO();
      const expiresAt = new Date(Date.now() + Math.max(1, league.free_agent_offer_window_hours ?? 24) * 3600000).toISOString();
      commit(() => {
        get().db.market_offers
          .filter((offer) => offer.player_id === input.playerId && offer.team_id === input.teamId && offer.status === 'active')
          .forEach((offer) => { offer.status = 'cancelled'; offer.resolved_at = submittedAt; });
        get().db.market_offers.push({
          id,
          league_id: input.leagueId,
          player_id: input.playerId,
          team_id: input.teamId,
          offered_by_guest_id: get().currentGuestId,
          transfer_fee: fee,
          salary,
          role_promise: input.rolePromise,
          status: 'active',
          submitted_at: submittedAt,
          expires_at: expiresAt,
          resolved_at: null,
        });
      }, { toast: { kind: 'success', message: `Offer submitted for ${player.nickname}` } });
      return id;
    },

    cancelMarketOffer(offerId) {
      const offer = get().db.market_offers.find((item) => item.id === offerId);
      if (!offer || offer.status !== 'active') return;
      const role = roleOf(offer.league_id);
      if (offer.offered_by_guest_id !== get().currentGuestId && role !== 'owner' && role !== 'admin') {
        reportError(new Error('Only the offering manager or an admin can cancel this offer.'));
        return;
      }
      commit(() => {
        const target = get().db.market_offers.find((item) => item.id === offerId);
        if (target) { target.status = 'cancelled'; target.resolved_at = nowISO(); }
      }, { toast: { kind: 'info', message: 'Offer cancelled' } });
    },

    resolveMarketOffers(leagueId, force = false) {
      if (!requireAdmin(leagueId, 'resolve market offers')) return;
      commit(() => { resolveOffersInDb(leagueId, force); }, {
        toast: { kind: 'success', message: 'Market offers resolved' },
      });
    },

    // Controlled bot market tick (admin-only). Runs one bounded round of bot
    // signings/sales/trades/offers; safe to invoke during any market window.
    runMarketTick(leagueId) {
      if (!requireAdmin(leagueId, 'run the market')) return;
      const league = get().db.leagues.find((item) => item.id === leagueId);
      if (!league || !league.run_started_at) {
        reportError(new Error('Start the run before running the market.'));
        return;
      }
      let count = 0;
      commit(() => { count = runBotMarketInDb(leagueId, 'market tick'); }, {
        toast: { kind: 'info', message: count > 0 ? `Bot market: ${count} move${count > 1 ? 's' : ''}` : 'Bot market: quiet window' },
      });
    },

    // Accept or reject an incoming bot buy-offer for one of your players.
    respondToMarketOffer(offerId, accept) {
      const db0 = get().db;
      const offer = db0.market_offers.find((item) => item.id === offerId);
      if (!offer || offer.status !== 'active') return;
      const player = db0.players.find((item) => item.id === offer.player_id);
      if (!player || !player.team_id) {
        reportError(new Error('That offer is no longer valid.'));
        return;
      }
      // The selling team's manager (or an owner/admin) decides.
      if (!requireTeam(offer.league_id, player.team_id, 'respond to offers')) return;
      const buyer = db0.teams.find((item) => item.id === offer.team_id);
      const seller = db0.teams.find((item) => item.id === player.team_id);
      if (accept && (!buyer || !seller || buyer.budget < offer.transfer_fee)) {
        reportError(new Error('The buying team can no longer afford this offer.'));
        return;
      }
      commit(() => {
        const db = get().db;
        const target = db.market_offers.find((item) => item.id === offerId);
        const p = db.players.find((item) => item.id === offer.player_id);
        if (!target || !p) return;
        if (accept) {
          const buy = db.teams.find((item) => item.id === offer.team_id);
          const sell = db.teams.find((item) => item.id === p.team_id);
          const from = p.team_id;
          if (buy) { buy.budget -= offer.transfer_fee; buy.updated_at = nowISO(); }
          if (sell) { sell.budget += offer.transfer_fee; sell.updated_at = nowISO(); }
          p.team_id = offer.team_id;
          p.status = offer.role_promise === 'starter' ? 'active' : 'benched';
          p.updated_at = nowISO();
          db.transfer_history.push({
            id: uid('th'), league_id: offer.league_id, player_id: p.id, from_team_id: from,
            to_team_id: offer.team_id, transfer_type: 'trade', amount: offer.transfer_fee, created_at: nowISO(),
          });
          // Resolve every active offer for this player.
          db.market_offers
            .filter((item) => item.player_id === p.id && item.status === 'active')
            .forEach((item) => { item.status = item.id === offerId ? 'accepted' : 'rejected'; item.resolved_at = nowISO(); });
        } else {
          target.status = 'rejected';
          target.resolved_at = nowISO();
        }
      }, { toast: { kind: 'trade', message: accept ? `${teamShort(offer.team_id)} signed ${player.nickname}` : 'Offer rejected' } });
    },

    // -- admins ---------------------------------------------------------------
    setLeagueAdmin(leagueId, guestId, role, teamId = null) {
      if (!requireAdmin(leagueId, 'manage roles')) return;
      commit(() => {
        const db = get().db;
        const existing = db.league_admins.find((a) => a.league_id === leagueId && a.guest_id === guestId);
        if (existing) { existing.role = role; existing.team_id = teamId; }
        else db.league_admins.push({ id: uid('la'), league_id: leagueId, guest_id: guestId, role, team_id: teamId });
        const member = db.league_members.find((item) => item.league_id === leagueId && item.guest_id === guestId);
        if (member) { member.role = role; member.team_id = role === 'manager' ? teamId : null; }
        else db.league_members.push({ id: uid('member'), league_id: leagueId, guest_id: guestId, role, team_id: role === 'manager' ? teamId : null, joined_at: nowISO() });
      }, { toast: { kind: 'info', message: `Set ${role} role` } });
    },
    removeLeagueAdmin(leagueId, guestId) {
      if (!requireAdmin(leagueId, 'manage roles')) return;
      commit(() => {
        get().db.league_admins = get().db.league_admins.filter((a) => !(a.league_id === leagueId && a.guest_id === guestId));
        const member = get().db.league_members.find((item) => item.league_id === leagueId && item.guest_id === guestId);
        if (member) { member.role = 'viewer'; member.team_id = null; }
      });
    },

    // -- team managers --------------------------------------------------------
    async claimTeam(leagueId, teamId) {
      const guestId = get().currentGuestId;
      if (!guestId) {
        reportError(new Error('Choose a nickname before claiming a team.'));
        return false;
      }
      const league = get().db.leagues.find((item) => item.id === leagueId);
      const team = get().db.teams.find((item) => item.id === teamId && item.league_id === leagueId);
      if (!league || runPhase(league) !== 'team_selection') {
        reportError(new Error('Teams can only be claimed during team selection.'));
        return false;
      }
      if (!team || team.is_bot) {
        reportError(new Error('That team is not available for selection.'));
        return false;
      }
      if (!adapter) return false;
      try {
        await adapter.claimTeam(leagueId, teamId, guestId);
        get().refresh();
        const team = get().db.teams.find((t) => t.id === teamId);
        get().pushToast({ kind: 'success', message: `You now manage ${team?.short_name ?? 'this team'}` });
        return true;
      } catch (error) {
        reportError(error);
        return false;
      }
    },
    assignManager(leagueId, guestId, teamId) {
      if (!requireAdmin(leagueId, 'assign managers')) return;
      const league = get().db.leagues.find((item) => item.id === leagueId);
      if (!league || runPhase(league) !== 'team_selection') {
        reportError(new Error('Managers can only be assigned during team selection.'));
        return;
      }
      const team = get().db.teams.find((item) => item.id === teamId && item.league_id === leagueId);
      if (!team || team.is_bot) {
        reportError(new Error('That team is not available for a human manager.'));
        return;
      }
      const taken = get().db.league_members.find(
        (m) => m.league_id === leagueId && m.role === 'manager' && m.team_id === teamId && m.guest_id !== guestId,
      );
      if (taken) {
        reportError(new Error('That team already has a manager. Remove them first.'));
        return;
      }
      commit(() => {
        const db = get().db;
        const member = db.league_members.find((m) => m.league_id === leagueId && m.guest_id === guestId);
        if (member) { member.role = 'manager'; member.team_id = teamId; }
        else db.league_members.push({ id: uid('member'), league_id: leagueId, guest_id: guestId, role: 'manager', team_id: teamId, joined_at: nowISO() });
      }, { toast: { kind: 'roster', message: `${teamShort(teamId)} manager assigned` } });
    },
    removeManager(leagueId, guestId) {
      // An owner/admin may remove anyone; a manager may step down from their own team.
      const isSelf = guestId === get().currentGuestId;
      if (!isSelf && !requireAdmin(leagueId, 'remove managers')) return;
      commit(() => {
        const member = get().db.league_members.find((m) => m.league_id === leagueId && m.guest_id === guestId);
        if (member && member.role === 'manager') { member.role = 'viewer'; member.team_id = null; }
      }, { toast: { kind: 'roster', message: 'Team manager removed' } });
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

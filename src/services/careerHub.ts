import type { Database, League, LeagueRunPhase, Match, Player, Team } from '@/lib/types';
import {
  teamsOf, matchesOf, playersOf, coachesOf, freeAgents, freeAgentOffersOf,
  incomingOffersForTeam, incomingOffersOf, botActivityOf, transferHistoryOf, seasonEndLogsOf,
  managedTeamId, roleInLeague,
} from '@/lib/store/selectors';
import { runPhase, nextRunPhase, RUN_PHASES, RUN_PHASE_LABELS, isPreseason } from '@/services/run';
import {
  competitionMode, circuitForLeague, syncSeasonCircuit, parseQualificationResults,
  phaseCompetitionKey, circuitRegions,
} from '@/services/competition';
import { standingsTable } from '@/services/standings';
import { computeTeamStrength } from '@/services/strength';
import { contractInfo, wageSummary, type WageSummary } from '@/services/contracts';
import { isScouted } from '@/services/scouting';
import { validateRoster } from '@/services/transfers';

// ============================================================================
// Career Hub — a single derived model that answers "what should I do next?",
// "how is my team doing?" and "where am I in the season?". Pure and read-only:
// it reads the store db through existing selectors/services so it can be unit
// tested and reused. The page renders this model.
// ============================================================================

export type HubAudience = 'manager' | 'admin' | 'viewer';
export type AlertSeverity = 'urgent' | 'info' | 'success';

export interface HubAlert {
  id: string;
  severity: AlertSeverity;
  icon: string; // lucide icon name, resolved by the page
  title: string;
  detail?: string;
  href?: string; // path under /leagues/[id], e.g. '/market'
  cta?: string;
  priority: number; // higher = more important (drives the recommended action)
}

export interface TeamSnapshot {
  team: Team;
  region: string;
  strength: number;
  budget: number;
  wages: WageSummary;
  record: { wins: number; losses: number };
  morale: number;
  form: number;
  fatigue: number;
  regionalPosition: number | null;
  regionalCount: number;
  rosterComplete: boolean;
  missingRoles: string[];
}

export interface StageInfo {
  season: string;
  phase: LeagueRunPhase;
  phaseLabel: string;
  nextPhaseLabel: string | null;
  explanation: string;
  progress: number; // 0..100 through the run
  competitionLabel: string | null;
  isFullCircuit: boolean;
  started: boolean;
}

export interface NextMatchInfo {
  match: Match | null;
  opponent: Team | null;
  isBlueSide: boolean;
  competitionLabel: string;
  difficulty: 'easier' | 'even' | 'tougher' | null;
}

export interface QualTeam { team: Team; status: string }
export interface QualSummary {
  enabled: boolean;
  regions: string[];
  msi: QualTeam[];
  worlds: QualTeam[];
  myMsi: boolean;
  myWorlds: boolean;
  bubble: Team[];
}

export interface MarketSummary {
  incomingOffers: number;
  activeFaOffers: number;
  freeAgentCount: number;
  topFreeAgents: Player[];
  expiringMine: Player[];
  wageRoom: number | null;
}

export interface ActivityItem {
  id: string;
  kind: 'match' | 'market' | 'transfer' | 'season';
  message: string;
  ts: string;
}

export interface CareerHubModel {
  audience: HubAudience;
  roleLabel: string;
  league: League;
  snapshot: TeamSnapshot | null;
  stage: StageInfo;
  nextMatch: NextMatchInfo;
  qualification: QualSummary;
  market: MarketSummary;
  activity: ActivityItem[];
  alerts: HubAlert[];
  recommended: HubAlert | null;
}

const COMPETITION_LABEL: Record<string, string> = {
  regional_league: 'Regional League',
  regional_playoffs: 'Regional Playoffs',
  second_regional_phase: 'Second Phase',
  regional_finals: 'Regional Finals',
  msi: 'MSI',
  worlds: 'Worlds',
  quick_tournament: 'Tournament',
};

const PHASE_EXPLANATION: Partial<Record<LeagueRunPhase, string>> = {
  lobby: 'Configure the run, then move to team selection.',
  team_selection: 'Pick teams and assign managers, then start the run.',
  roster_reveal: 'Rosters are revealed. Prepare for preseason.',
  preseason_week_1: 'Preseason: scout, sign free agents, run friendlies and trades.',
  preseason_week_2: 'Preseason: tune your roster before official play begins.',
  preseason_week_3: 'Final preseason week before the regular season.',
  regular_season: 'Regular season: play your regional schedule and climb the standings.',
  playoffs: 'Regional playoffs: win to be crowned champion and qualify internationally.',
  msi_qualification: 'Applying qualification rules to seed the mid-season event.',
  msi: 'MSI: the mid-season international event against other regions.',
  midseason_break: 'Mid-season break: a transfer window before the second phase.',
  second_regional_phase: 'Second regional phase: a later domestic split.',
  regional_finals: 'Regional finals decide Worlds qualification.',
  worlds: 'Worlds: the season-ending world championship.',
  offseason: 'Offseason: renew contracts, sign free agents, plan for next season.',
  next_season_setup: 'Ready to roll the year over into a new season.',
  completed: 'The season is complete.',
};

function progressFor(phase: LeagueRunPhase): number {
  const start = RUN_PHASES.indexOf('roster_reveal');
  const end = RUN_PHASES.indexOf('completed');
  const idx = RUN_PHASES.indexOf(phase);
  if (idx < 0 || end <= start) return 0;
  return Math.round((Math.max(0, idx - start) / (end - start)) * 100);
}

function teamRegion(team: Team | undefined): string {
  return team?.region || 'Unknown';
}

export function buildCareerHub(db: Database, leagueId: string, guestId: string): CareerHubModel | null {
  const league = db.leagues.find((l) => l.id === leagueId);
  if (!league) return null;

  const role = roleInLeague(db, leagueId, guestId);
  const managedTeam = managedTeamId(db, leagueId, guestId);
  const teams = teamsOf(db, leagueId);
  const matches = matchesOf(db, leagueId);
  const players = playersOf(db, leagueId);
  const coaches = coachesOf(db, leagueId);
  const mode = competitionMode(league);
  const isFullCircuit = mode === 'full_circuit';
  const phase = runPhase(league);
  const started = !!league.run_started_at;
  const myTeam = managedTeam ? teams.find((t) => t.id === managedTeam) ?? null : null;

  const audience: HubAudience = myTeam ? 'manager' : role === 'owner' || role === 'admin' ? 'admin' : 'viewer';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  // --- Stage --------------------------------------------------------------
  const competitionKey = phaseCompetitionKey(league);
  const next = nextRunPhase(league);
  const nextPhaseLabel = phase === 'completed' ? null : phase === 'next_season_setup' ? 'Start next season' : RUN_PHASE_LABELS[next];
  const stage: StageInfo = {
    season: league.season,
    phase,
    phaseLabel: RUN_PHASE_LABELS[phase],
    nextPhaseLabel,
    explanation: PHASE_EXPLANATION[phase] ?? 'Manage your team through the season.',
    progress: progressFor(phase),
    competitionLabel: competitionKey ? COMPETITION_LABEL[competitionKey] ?? competitionKey : null,
    isFullCircuit,
    started,
  };

  // --- Team snapshot ------------------------------------------------------
  let snapshot: TeamSnapshot | null = null;
  if (myTeam) {
    const region = teamRegion(myTeam);
    const regionalTeams = isFullCircuit ? teams.filter((t) => teamRegion(t) === region) : teams;
    const regionalMatches = isFullCircuit ? matches.filter((m) => m.competition_key === 'regional_league') : matches;
    const table = standingsTable(regionalTeams, regionalMatches);
    const row = table.find((r) => r.team.id === myTeam.id);
    const roster = validateRoster(myTeam, players, coaches);
    snapshot = {
      team: myTeam,
      region,
      strength: Math.round(computeTeamStrength(myTeam, players, coaches).score),
      budget: myTeam.budget,
      wages: wageSummary(myTeam, league, players, coaches),
      record: { wins: myTeam.wins, losses: myTeam.losses },
      morale: myTeam.morale ?? 50,
      form: myTeam.performance_form ?? 50,
      fatigue: myTeam.fatigue ?? 0,
      regionalPosition: row?.position ?? null,
      regionalCount: regionalTeams.length,
      rosterComplete: roster.complete,
      missingRoles: roster.missingRoles,
    };
  }

  // --- Next match ---------------------------------------------------------
  const focusTeamId = myTeam?.id ?? null;
  const upcoming = matches
    .filter((m) => m.status !== 'completed' && m.blue_team_id && m.red_team_id && (!competitionKey || !m.competition_key || m.competition_key === competitionKey))
    .filter((m) => (focusTeamId ? m.blue_team_id === focusTeamId || m.red_team_id === focusTeamId : true))
    .sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time));
  const nm = upcoming[0] ?? null;
  let nextMatch: NextMatchInfo = { match: null, opponent: null, isBlueSide: true, competitionLabel: '', difficulty: null };
  if (nm) {
    const isBlue = focusTeamId ? nm.blue_team_id === focusTeamId : true;
    const opponentId = focusTeamId ? (isBlue ? nm.red_team_id : nm.blue_team_id) : nm.blue_team_id;
    const opponent = teams.find((t) => t.id === opponentId) ?? null;
    let difficulty: NextMatchInfo['difficulty'] = null;
    if (myTeam && opponent) {
      const delta = computeTeamStrength(opponent, players, coaches).score - computeTeamStrength(myTeam, players, coaches).score;
      difficulty = delta > 4 ? 'tougher' : delta < -4 ? 'easier' : 'even';
    }
    nextMatch = {
      match: nm,
      opponent,
      isBlueSide: isBlue,
      competitionLabel: nm.competition_key ? COMPETITION_LABEL[nm.competition_key] ?? nm.stage : nm.stage,
      difficulty,
    };
  }

  // --- Qualification ------------------------------------------------------
  let qualification: QualSummary = { enabled: false, regions: [], msi: [], worlds: [], myMsi: false, myWorlds: false, bubble: [] };
  if (isFullCircuit) {
    const circuit = syncSeasonCircuit(circuitForLeague(db, league), league, teams, matches);
    const results = parseQualificationResults(circuit);
    const toQualTeams = (target: string): QualTeam[] => results
      .filter((r) => r.target_competition_key === target && r.team_id)
      .map((r) => ({ team: teams.find((t) => t.id === r.team_id), status: String(r.status) }))
      .filter((q): q is QualTeam => !!q.team);
    const msi = toQualTeams('msi');
    const worlds = toQualTeams('worlds');
    const qualifiedWorlds = new Set(worlds.map((q) => q.team.id));
    const bubble = standingsTable(teams, matches.filter((m) => m.competition_key === 'regional_league'))
      .filter((r) => !qualifiedWorlds.has(r.team.id))
      .slice(0, 3)
      .map((r) => r.team);
    qualification = {
      enabled: true,
      regions: circuitRegions(teams),
      msi,
      worlds,
      myMsi: !!myTeam && msi.some((q) => q.team.id === myTeam.id),
      myWorlds: !!myTeam && worlds.some((q) => q.team.id === myTeam.id),
      bubble,
    };
  }

  // --- Market & contracts -------------------------------------------------
  const incoming = role === 'owner' || role === 'admin' ? incomingOffersOf(db, leagueId) : incomingOffersForTeam(db, leagueId, managedTeam);
  const fa = freeAgents(db, leagueId);
  const expiringMine = myTeam
    ? players.filter((p) => p.team_id === myTeam.id && contractInfo(p, league.season).status === 'expiring')
    : [];
  const market: MarketSummary = {
    incomingOffers: incoming.length,
    activeFaOffers: freeAgentOffersOf(db, leagueId).length,
    freeAgentCount: fa.length,
    topFreeAgents: [...fa].sort((a, b) => b.rating_overall - a.rating_overall).slice(0, 4),
    expiringMine,
    wageRoom: snapshot ? snapshot.wages.wageRoom : null,
  };

  // --- Recent activity feed ----------------------------------------------
  const activity = buildActivity(db, leagueId, teams);

  // --- Alerts + recommended action ---------------------------------------
  const alerts = buildAlerts({ audience, league, phase, started, snapshot, nextMatch, market, qualification, role, mode });
  const recommended = [...alerts].sort((a, b) => b.priority - a.priority)[0] ?? null;

  return { audience, roleLabel, league, snapshot, stage, nextMatch, qualification, market, activity, alerts, recommended };
}

function buildActivity(db: Database, leagueId: string, teams: Team[]): ActivityItem[] {
  const short = (id: string | null) => teams.find((t) => t.id === id)?.short_name ?? '—';
  const items: ActivityItem[] = [];
  for (const m of matchesOf(db, leagueId).filter((x) => x.status === 'completed' && x.winner_team_id).slice(-40)) {
    const loserId = m.winner_team_id === m.blue_team_id ? m.red_team_id : m.blue_team_id;
    items.push({ id: `m-${m.id}`, kind: 'match', ts: m.date_time, message: `${short(m.winner_team_id)} beat ${short(loserId)} ${Math.max(m.blue_score, m.red_score)}-${Math.min(m.blue_score, m.red_score)}` });
  }
  for (const a of botActivityOf(db, leagueId, 15)) {
    items.push({ id: `b-${a.id}`, kind: 'market', ts: a.created_at, message: a.message });
  }
  for (const t of transferHistoryOf(db, leagueId).slice(0, 12)) {
    const player = db.players.find((p) => p.id === t.player_id);
    if (player) items.push({ id: `t-${t.id}`, kind: 'transfer', ts: t.created_at, message: `${player.nickname}: ${short(t.from_team_id)} → ${short(t.to_team_id)}` });
  }
  for (const s of seasonEndLogsOf(db, leagueId)) {
    items.push({ id: `s-${s.id}`, kind: 'season', ts: s.created_at, message: `Season ${s.season_key} completed` });
  }
  return items.sort((a, b) => +new Date(b.ts) - +new Date(a.ts)).slice(0, 8);
}

interface AlertContext {
  audience: HubAudience;
  league: League;
  phase: LeagueRunPhase;
  started: boolean;
  snapshot: TeamSnapshot | null;
  nextMatch: NextMatchInfo;
  market: MarketSummary;
  qualification: QualSummary;
  role: string;
  mode: ReturnType<typeof competitionMode>;
}

function buildAlerts(ctx: AlertContext): HubAlert[] {
  const { audience, phase, started, snapshot, nextMatch, market, qualification, role } = ctx;
  const alerts: HubAlert[] = [];
  const isAdmin = role === 'owner' || role === 'admin';
  const add = (a: HubAlert) => alerts.push(a);

  // Pre-run setup.
  if (!started) {
    if (isAdmin && (phase === 'lobby' || phase === 'team_selection')) {
      add({ id: 'setup', severity: 'urgent', icon: 'Gamepad2', priority: 100, title: phase === 'lobby' ? 'Set up your run' : 'Start the run', detail: phase === 'lobby' ? 'Configure budget and bots, then advance.' : 'Claim teams and start the season.', href: '/lobby', cta: 'Open run setup' });
    } else {
      add({ id: 'wait-start', severity: 'info', icon: 'Clock', priority: 10, title: 'Waiting for the run to start', detail: 'The league owner is still setting up.', href: '/lobby', cta: 'View run' });
    }
    return alerts;
  }

  // Roster validity (manager).
  if (snapshot && !snapshot.rosterComplete) {
    add({ id: 'roster', severity: 'urgent', icon: 'AlertTriangle', priority: 95, title: 'Your roster is incomplete', detail: `Missing a starter at ${snapshot.missingRoles.join(', ').toLowerCase()}.`, href: '/market', cta: 'Sign a player' });
  }

  // Incoming offers.
  if (market.incomingOffers > 0) {
    add({ id: 'incoming', severity: 'urgent', icon: 'Inbox', priority: 90, title: `${market.incomingOffers} incoming offer${market.incomingOffers > 1 ? 's' : ''}`, detail: 'A rival wants one of your players.', href: '/market', cta: 'Review offers' });
  }

  // Season rollover / offseason.
  if (phase === 'next_season_setup' && isAdmin) {
    add({ id: 'next-season', severity: 'success', icon: 'RefreshCw', priority: 88, title: 'Start next season', detail: 'Roll the year over and refresh the schedule.', href: '/lobby', cta: 'Start next season' });
  }
  if (phase === 'offseason') {
    add({ id: 'offseason', severity: 'info', icon: 'FileSignature', priority: 70, title: 'Offseason decisions', detail: 'Renew contracts and sign free agents before next season.', href: '/market', cta: 'Open market' });
  }

  // Admin can advance the phase.
  if (isAdmin && phase !== 'completed' && phase !== 'next_season_setup' && !['lobby', 'team_selection'].includes(phase)) {
    const ready = nextMatch.match == null; // nothing left to play in this stage
    add({ id: 'advance', severity: ready ? 'success' : 'info', icon: 'ChevronRight', priority: ready ? 78 : 40, title: `Advance the season`, detail: ready ? 'This stage looks complete — move to the next.' : 'Advance when the current stage is done.', href: '/lobby', cta: 'Open run' });
  }

  // Next match.
  if (nextMatch.match) {
    const opp = nextMatch.opponent?.short_name ?? 'your opponent';
    add({ id: 'next-match', severity: 'info', icon: 'Swords', priority: snapshot ? 72 : 50, title: snapshot ? `Next match vs ${opp}` : 'Matches are ready to play', detail: nextMatch.difficulty ? `Looks ${nextMatch.difficulty} on paper.` : `${nextMatch.competitionLabel}.`, href: `/matches/${nextMatch.match.id}`, cta: 'View match' });
  }

  // Expiring contracts (manager).
  if (snapshot && market.expiringMine.length > 0) {
    add({ id: 'expiring', severity: 'info', icon: 'CalendarClock', priority: 65, title: `Review ${market.expiringMine.length} expiring contract${market.expiringMine.length > 1 ? 's' : ''}`, detail: 'Renew key players before they hit free agency.', href: '/market', cta: 'Renew contracts' });
  }

  // Wage over cap (manager).
  if (snapshot && snapshot.wages.over) {
    add({ id: 'wages', severity: 'urgent', icon: 'Wallet', priority: 80, title: 'Wage bill over budget', detail: 'Sell or release to get back under the soft cap.', href: '/market', cta: 'Open market' });
  }

  // Scouting in preseason.
  if (snapshot && isPreseason(phase) && market.freeAgentCount > 0) {
    add({ id: 'scout', severity: 'info', icon: 'Search', priority: 55, title: 'Scout free agents', detail: 'Reveal exact ratings before preseason ends.', href: '/market', cta: 'Scout & sign' });
  }

  // Qualification race (manager, full circuit).
  if (snapshot && qualification.enabled && (phase === 'regular_season' || phase === 'second_regional_phase')) {
    const status = qualification.myWorlds ? 'on track for Worlds' : qualification.myMsi ? 'qualifying for MSI' : 'in the qualification race';
    add({ id: 'qual', severity: qualification.myWorlds ? 'success' : 'info', icon: 'Trophy', priority: 58, title: `You are ${status}`, detail: 'Keep winning to lock your seed.', href: '/competitions', cta: 'View circuit' });
  }

  // Universal fallback so there is always a recommended action.
  if (alerts.length === 0) {
    add(audience === 'viewer'
      ? { id: 'watch', severity: 'info', icon: 'Eye', priority: 30, title: 'Follow the league', detail: 'Watch matches and track the standings.', href: '/standings', cta: 'View standings' }
      : { id: 'review', severity: 'info', icon: 'Trophy', priority: 20, title: 'Review your league', detail: 'Check standings, schedule and the market.', href: '/standings', cta: 'View standings' });
  }

  return alerts;
}

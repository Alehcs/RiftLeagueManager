import type {
  Coach,
  Database,
  Game,
  League,
  Match,
  Player,
  Role,
  Team,
} from '@/lib/types';
import { PLAYER_ROLES, EMPTY_DB } from '@/lib/types';
import { DEMO_USER_ID } from '@/lib/constants';
import { Rng } from '@/lib/rng';
import { nowISO, uid } from '@/lib/utils';
import {
  COACH_NICK_POOL,
  NICK_POOL,
  RAW_LEAGUES,
  REAL_NAME_POOL,
  poolKeyForCountry,
  type RawLeague,
  type RawPlayer,
  type RawTeam,
} from './rosters';
import {
  coachSalary,
  generateCoachRatings,
  generatePlayerRatings,
  playerSalary,
  playerValue,
  teamBudget,
} from '@/services/ratings';
import { computeTeamStrength } from '@/services/strength';
import { simulateMatch } from '@/services/simulation';
import { generateSchedule } from '@/services/schedule';
import { applyStandings } from '@/services/standings';

const REF_DATE = new Date('2026-06-12T12:00:00Z');

function contractDate(rng: Rng): string {
  const months = rng.int(6, 26);
  const d = new Date(REF_DATE);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function generatedRealName(rng: Rng, cc: string): string {
  const pool = REAL_NAME_POOL[poolKeyForCountry(cc)] ?? REAL_NAME_POOL.INTL;
  return `${rng.pick(pool.first)} ${rng.pick(pool.last)}`;
}

let nickCounter = 0;
function generatedNick(rng: Rng, cc: string, used: Set<string>): string {
  const pool = NICK_POOL[poolKeyForCountry(cc)] ?? NICK_POOL.INTL;
  for (let i = 0; i < pool.length; i++) {
    const n = rng.pick(pool).trim();
    if (!used.has(n.toLowerCase())) {
      used.add(n.toLowerCase());
      return n;
    }
  }
  return `${rng.pick(pool).trim()}${(nickCounter++ % 99) + 1}`;
}

function buildPlayer(args: {
  rng: Rng;
  leagueId: string;
  teamId: string | null;
  raw?: RawPlayer;
  role: Role;
  country: string;
  strength: number;
  tier: League['tier'];
  status: Player['status'];
  source_name: string | null;
  source_url: string | null;
  usedNicks: Set<string>;
  synthetic: boolean;
}): Player {
  const { rng } = args;
  const nat = args.raw?.nat ?? args.country;
  const nick = args.raw?.nick ?? generatedNick(rng, nat, args.usedNicks);
  const hasRealName = !!args.raw?.name;
  const real_name = args.raw?.name ?? generatedRealName(rng, nat);
  const role = args.role;
  const star = args.raw?.star ?? false;
  const ratings = generatePlayerRatings(`${args.leagueId}:${nick}:${role}`, {
    strength: args.strength,
    tier: args.tier,
    role,
    star,
  });
  const age = star ? rng.int(19, 28) : rng.int(17, 26);
  const value = playerValue(ratings.rating_overall, role, age);
  const ts = nowISO();
  const synthetic = args.synthetic || !args.raw;
  return {
    id: uid('p'),
    league_id: args.leagueId,
    team_id: args.teamId,
    real_name,
    nickname: nick,
    role,
    nationality: nat,
    age,
    image_url: null,
    external_url: args.raw ? args.source_url : null,
    source_name: synthetic ? 'Generated' : args.source_name,
    source_url: synthetic ? null : args.source_url,
    confidence: synthetic ? 0.2 : hasRealName ? 0.95 : 0.85,
    value,
    salary: playerSalary(value, rng),
    contract_until: contractDate(rng),
    ...ratings,
    status: args.status,
    generated: synthetic || !hasRealName,
    created_at: ts,
    updated_at: ts,
  };
}

function buildTeamRoster(
  league: League,
  raw: RawTeam,
  teamId: string,
): { players: Player[]; coach: Coach } {
  const rng = new Rng(`team:${league.id}:${raw.short}`);
  const usedNicks = new Set<string>();
  const players: Player[] = [];
  const provided = raw.roster ?? [];
  provided.forEach((rp) => usedNicks.add(rp.nick.toLowerCase()));

  // One starter per core role: prefer a provided real player, else generate.
  for (const role of PLAYER_ROLES) {
    const rp = provided.find((p) => p.role === role);
    players.push(
      buildPlayer({
        rng,
        leagueId: league.id,
        teamId,
        raw: rp,
        role,
        country: raw.country,
        strength: raw.strength,
        tier: league.tier,
        status: 'active',
        source_name: league.source_name,
        source_url: league.source_url,
        usedNicks,
        synthetic: !rp,
      }),
    );
  }

  // Extra provided players (e.g. a real sub at a non-core slot) → benched depth.
  for (const rp of provided) {
    if (players.some((p) => p.nickname === rp.nick)) continue;
    players.push(
      buildPlayer({
        rng,
        leagueId: league.id,
        teamId,
        raw: rp,
        role: rp.role,
        country: raw.country,
        strength: raw.strength - 1,
        tier: league.tier,
        status: 'benched',
        source_name: league.source_name,
        source_url: league.source_url,
        usedNicks,
        synthetic: false,
      }),
    );
  }

  // Top teams carry a generated substitute for depth.
  if (raw.strength >= 4) {
    players.push(
      buildPlayer({
        rng,
        leagueId: league.id,
        teamId,
        role: 'SUBSTITUTE',
        country: raw.country,
        strength: raw.strength - 1,
        tier: league.tier,
        status: 'benched',
        source_name: null,
        source_url: null,
        usedNicks,
        synthetic: true,
      }),
    );
  }

  // Coach
  const ts = nowISO();
  const cratings = generateCoachRatings(`${league.id}:${raw.short}`, {
    strength: raw.strength,
    tier: league.tier,
  });
  const coachNat = raw.coach?.nat ?? raw.country;
  const coachNick =
    raw.coach?.nick ?? rng.pick(COACH_NICK_POOL[poolKeyForCountry(coachNat)] ?? COACH_NICK_POOL.INTL);
  const coach: Coach = {
    id: uid('c'),
    league_id: league.id,
    team_id: teamId,
    real_name: raw.coach?.name ?? generatedRealName(rng, coachNat),
    nickname: coachNick,
    nationality: coachNat,
    age: rng.int(28, 45),
    image_url: null,
    external_url: null,
    source_name: raw.coach ? league.source_name : 'Generated',
    source_url: raw.coach ? league.source_url : null,
    confidence: raw.coach ? 0.9 : 0.2,
    ...cratings,
    salary: coachSalary(cratings, rng),
    contract_until: contractDate(rng),
    status: 'active',
    generated: !raw.coach,
    created_at: ts,
    updated_at: ts,
  };

  return { players, coach };
}

function buildFreeAgents(league: League, count: number): { players: Player[]; coaches: Coach[] } {
  const rng = new Rng(`fa:${league.id}`);
  const usedNicks = new Set<string>();
  const players: Player[] = [];
  const roles: Role[] = PLAYER_ROLES;
  const baseCC = league.region === 'Korea' ? 'KR' : league.region === 'China' ? 'CN' : league.region === 'Brazil' ? 'BR' : league.region === 'North America' ? 'US' : league.region === 'EMEA' ? 'DE' : 'INTL';
  for (let i = 0; i < count; i++) {
    const role = roles[i % roles.length];
    players.push(
      buildPlayer({
        rng,
        leagueId: league.id,
        teamId: null,
        role,
        country: baseCC,
        strength: rng.int(2, 4),
        tier: league.tier,
        status: 'free_agent',
        source_name: null,
        source_url: null,
        usedNicks,
        synthetic: true,
      }),
    );
  }
  // a couple of free-agent coaches
  const coaches: Coach[] = [];
  for (let i = 0; i < Math.max(1, Math.round(count / 4)); i++) {
    const cratings = generateCoachRatings(`fa-coach:${league.id}:${i}`, { strength: rng.int(2, 4), tier: league.tier });
    const ts = nowISO();
    coaches.push({
      id: uid('c'),
      league_id: league.id,
      team_id: null,
      real_name: generatedRealName(rng, baseCC),
      nickname: rng.pick(COACH_NICK_POOL[poolKeyForCountry(baseCC)] ?? COACH_NICK_POOL.INTL) + (i ? String(i) : ''),
      nationality: baseCC,
      age: rng.int(27, 46),
      image_url: null,
      external_url: null,
      source_name: 'Generated',
      source_url: null,
      confidence: 0.2,
      ...cratings,
      salary: coachSalary(cratings, rng),
      contract_until: contractDate(rng),
      status: 'free_agent',
      generated: true,
      created_at: ts,
      updated_at: ts,
    });
  }
  return { players, coaches };
}

function buildLeague(raw: RawLeague, db: Database, opts?: { ownerId?: string; isSeed?: boolean }) {
  const ownerId = opts?.ownerId ?? DEMO_USER_ID;
  const ts = nowISO();
  const league: League = {
    id: uid('lg'),
    name: raw.name,
    slug: raw.slug,
    region: raw.region,
    tier: raw.tier,
    season: raw.season,
    logo_url: null,
    external_url: raw.source_url ?? null,
    source_name: raw.source_name ?? null,
    source_url: raw.source_url ?? null,
    format: raw.format,
    owner_user_id: ownerId,
    is_seed: opts?.isSeed ?? true,
    last_imported_at: ts,
    created_at: ts,
    updated_at: ts,
  };
  db.leagues.push(league);
  db.league_admins.push({
    id: uid('la'),
    league_id: league.id,
    user_id: ownerId,
    role: 'owner',
    team_id: null,
  });

  const teams: Team[] = [];
  for (const rt of raw.teams) {
    const teamId = uid('t');
    const budget = teamBudget(`${league.id}:${rt.short}`, rt.strength, raw.tier);
    const team: Team = {
      id: teamId,
      league_id: league.id,
      name: rt.name,
      short_name: rt.short,
      region: raw.region,
      country: rt.country,
      tier: raw.tier,
      logo_url: null,
      banner_url: null,
      external_url: raw.source_url ?? null,
      source_name: raw.source_name ?? null,
      source_url: raw.source_url ?? null,
      confidence: 0.95,
      budget,
      wins: 0,
      losses: 0,
      games_won: 0,
      games_lost: 0,
      points: 0,
      form: '',
      generated: false,
      created_at: ts,
      updated_at: ts,
    };

    const wantRoster = (rt.roster && rt.roster.length > 0) || raw.generateRosters;
    if (wantRoster) {
      const { players, coach } = buildTeamRoster(league, rt, teamId);
      db.players.push(...players);
      db.coaches.push(coach);
    }
    teams.push(team);
    db.teams.push(team);
  }

  // Free agents for the transfer market.
  const faCount = raw.tier === 'tier1' ? 8 : raw.tier === 'international' ? 5 : 6;
  const fa = buildFreeAgents(league, faCount);
  db.players.push(...fa.players);
  db.coaches.push(...fa.coaches);

  // Schedule + optional pre-simulation.
  const matches = generateSchedule(league, teams, { start: new Date(REF_DATE) });
  db.matches.push(...matches);

  if (raw.presimulate) {
    presimulateLeaguePortion(league, teams, db, matches);
  }
}

// Simulate the "league portion" (regular / group / swiss) at seed time so
// standings & forms are populated. Playoff/final matches are left scheduled.
function presimulateLeaguePortion(league: League, teams: Team[], db: Database, matches: Match[]) {
  const leaguePortion = matches
    .filter((m) => ['regular_season', 'group_stage', 'swiss'].includes(m.stage))
    .sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time));

  const strengthCache = new Map<string, ReturnType<typeof computeTeamStrength>>();
  const strengthOf = (teamId: string) => {
    if (!strengthCache.has(teamId)) {
      const team = teams.find((t) => t.id === teamId)!;
      strengthCache.set(teamId, computeTeamStrength(team, db.players, db.coaches));
    }
    return strengthCache.get(teamId)!;
  };

  for (const m of leaguePortion) {
    if (!m.blue_team_id || !m.red_team_id) continue;
    const blue = strengthOf(m.blue_team_id);
    const red = strengthOf(m.red_team_id);
    const blueName = teams.find((t) => t.id === m.blue_team_id)?.short_name ?? 'BLUE';
    const redName = teams.find((t) => t.id === m.red_team_id)?.short_name ?? 'RED';
    const res = simulateMatch(m.format, blue, red, { blueName, redName, seed: m.id });
    m.status = 'completed';
    m.blue_score = res.blue_score;
    m.red_score = res.red_score;
    m.winner_team_id = res.winner === 'blue' ? m.blue_team_id : m.red_team_id;
    m.updated_at = nowISO();
    for (const g of res.games) {
      const gm: Game = {
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
      };
      db.games.push(gm);
    }
  }

  // Recompute aggregates for this league's teams.
  const leagueMatches = db.matches.filter((m) => m.league_id === league.id);
  const updated = applyStandings(teams, leagueMatches);
  for (const ut of updated) {
    const idx = db.teams.findIndex((t) => t.id === ut.id);
    if (idx >= 0) db.teams[idx] = ut;
  }
}

// Build a single league's entities in isolation — used by the import flow.
// `presimulate` can be overridden (e.g. import without playing the season).
export function buildLeagueEntities(
  raw: RawLeague,
  opts?: { ownerId?: string; presimulate?: boolean },
): Pick<Database, 'leagues' | 'league_admins' | 'teams' | 'players' | 'coaches' | 'matches' | 'games'> {
  const db = structuredClone(EMPTY_DB);
  const effective: RawLeague =
    opts?.presimulate === undefined ? raw : { ...raw, presimulate: opts.presimulate };
  buildLeague(effective, db, { ownerId: opts?.ownerId, isSeed: false });
  return {
    leagues: db.leagues,
    league_admins: db.league_admins,
    teams: db.teams,
    players: db.players,
    coaches: db.coaches,
    matches: db.matches,
    games: db.games,
  };
}

let cached: Database | null = null;

export function buildSeedDatabase(): Database {
  if (cached) return structuredClone(cached);
  const db: Database = structuredClone(EMPTY_DB);

  db.profiles.push({
    id: DEMO_USER_ID,
    email: 'demo@riftleague.gg',
    username: 'DemoAdmin',
    avatar_url: null,
    created_at: nowISO(),
  });

  const tsrc = nowISO();
  const sources = [
    { name: 'Leaguepedia', base_url: 'https://lol.fandom.com', source_type: 'wiki' },
    { name: 'Liquipedia', base_url: 'https://liquipedia.net/leagueoflegends', source_type: 'wiki' },
    { name: 'LoL Esports', base_url: 'https://lolesports.com', source_type: 'official' },
    { name: 'Generic Wiki', base_url: '', source_type: 'wiki' },
    { name: 'Manual JSON', base_url: '', source_type: 'manual' },
    { name: 'CSV', base_url: '', source_type: 'file' },
  ];
  for (const s of sources) {
    db.import_sources.push({ id: uid('src'), enabled: true, created_at: tsrc, ...s });
  }

  for (const raw of RAW_LEAGUES) buildLeague(raw, db);

  cached = structuredClone(db);
  return db;
}

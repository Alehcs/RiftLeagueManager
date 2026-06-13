import type { League, LeagueFormat, Match, MatchFormat, MatchStage, Team } from '@/lib/types';
import { nowISO, uid } from '@/lib/utils';

// ============================================================================
// Schedule & bracket generation.
//   - Round robin (single / double) for league formats
//   - Single elimination (any N) and double elimination (4 or 8) for brackets
//   - Group stage (round robin per group)
//   - Swiss round 1 + dynamic next-round pairing
// Bracket matches link via feeds_winner_to / feeds_loser_to so the simulator
// can advance participants automatically.
// ============================================================================

interface MakeMatchArgs {
  leagueId: string;
  stage: MatchStage;
  week: number;
  matchDay: number;
  blue: string;
  red: string;
  format: MatchFormat;
  date: Date;
  bracketSlot?: string | null;
  patch?: string | null;
}

function makeMatch(a: MakeMatchArgs): Match {
  const ts = nowISO();
  return {
    id: uid('m'),
    league_id: a.leagueId,
    stage: a.stage,
    week: a.week,
    match_day: a.matchDay,
    date_time: a.date.toISOString(),
    blue_team_id: a.blue,
    red_team_id: a.red,
    format: a.format,
    status: 'scheduled',
    winner_team_id: null,
    blue_score: 0,
    red_score: 0,
    patch: a.patch ?? null,
    venue_text: null,
    stream_url: null,
    external_url: null,
    source_name: null,
    source_url: null,
    bracket_slot: a.bracketSlot ?? null,
    feeds_winner_to: null,
    feeds_loser_to: null,
    created_at: ts,
    updated_at: ts,
  };
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard bracket seeding order (1-indexed seeds) for a power-of-two size.
function standardSeeding(size: number): number[] {
  let seeds = [1, 2];
  const rounds = Math.log2(size);
  for (let r = 1; r < rounds; r++) {
    const sum = Math.pow(2, r + 1) + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

const dayStep = (base: Date, days: number) => new Date(base.getTime() + days * 86400000);

// ---------------------------------------------------------------------------
// Round robin (circle method)
// ---------------------------------------------------------------------------
function circleRounds(ids: string[]): [string, string][][] {
  const arr = [...ids];
  if (arr.length % 2 === 1) arr.push('__BYE__');
  const n = arr.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== '__BYE__' && b !== '__BYE__') pairs.push([a, b]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!); // rotate, first fixed
  }
  return rounds;
}

export function generateRoundRobin(
  leagueId: string,
  ids: string[],
  format: MatchFormat,
  double: boolean,
  start: Date,
  patch: string | null,
): Match[] {
  const rounds = circleRounds(ids);
  const matches: Match[] = [];
  let matchDay = 1;
  let week = 1;
  const emit = (leg: number) => {
    rounds.forEach((pairs, ri) => {
      pairs.forEach(([a, b], pi) => {
        // alternate side assignment for fairness across legs/rounds
        const swap = (ri + leg) % 2 === 1;
        const blue = swap ? b : a;
        const red = swap ? a : b;
        matches.push(
          makeMatch({
            leagueId,
            stage: 'regular_season',
            week,
            matchDay: matchDay,
            blue,
            red,
            format,
            date: dayStep(start, (week - 1) * 7 + pi),
            patch,
          }),
        );
      });
      matchDay++;
      week++;
    });
  };
  emit(0);
  if (double) emit(1);
  return matches;
}

// ---------------------------------------------------------------------------
// Single elimination (any N, top seeds get byes)
// ---------------------------------------------------------------------------
interface Slot {
  teamId?: string;
  fromMatch?: string;
}

export function generateSingleElim(
  leagueId: string,
  seedIds: string[],
  format: MatchFormat,
  start: Date,
  prefix = 'R',
): Match[] {
  const N = seedIds.length;
  if (N < 2) return [];
  const size = nextPow2(N);
  const order = standardSeeding(size);
  let level: Slot[] = order.map((seed) => (seed <= N ? { teamId: seedIds[seed - 1] } : {}));

  const matches: Match[] = [];
  const byId = new Map<string, Match>();
  let round = 1;
  const totalRounds = Math.log2(size);

  while (level.length > 1) {
    const next: Slot[] = [];
    let idx = 1;
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = level[i + 1];
      const aPresent = !!a.teamId || !!a.fromMatch;
      const bPresent = !!b.teamId || !!b.fromMatch;

      if (aPresent && !bPresent) {
        next.push({ teamId: a.teamId, fromMatch: a.fromMatch });
        continue;
      }
      if (!aPresent && bPresent) {
        next.push({ teamId: b.teamId, fromMatch: b.fromMatch });
        continue;
      }
      if (!aPresent && !bPresent) {
        next.push({});
        continue;
      }
      const isFinal = level.length === 2;
      const m = makeMatch({
        leagueId,
        stage: isFinal ? 'final' : 'playoffs',
        week: round,
        matchDay: round,
        blue: a.teamId ?? '',
        red: b.teamId ?? '',
        format,
        date: dayStep(start, (round - 1) * 4 + idx),
        bracketSlot: isFinal ? `${prefix}-FINAL` : `${prefix}-R${round}-M${idx}`,
      });
      matches.push(m);
      byId.set(m.id, m);
      if (a.fromMatch) byId.get(a.fromMatch)!.feeds_winner_to = m.id;
      if (b.fromMatch) byId.get(b.fromMatch)!.feeds_winner_to = m.id;
      next.push({ fromMatch: m.id });
      idx++;
    }
    level = next;
    round++;
    if (round > totalRounds + 1) break;
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Double elimination (4 or 8 seeds). Falls back to single elim otherwise.
// ---------------------------------------------------------------------------
export function generateDoubleElim(
  leagueId: string,
  seedIds: string[],
  format: MatchFormat,
  start: Date,
): Match[] {
  const N = seedIds.length;
  if (N !== 4 && N !== 8) return generateSingleElim(leagueId, seedIds, format, start, 'UB');
  const s = (i: number) => seedIds[i - 1] ?? '';

  const slots: Record<string, { blue: string; red: string; week: number; stage: MatchStage }> =
    N === 8
      ? {
          'UB-R1-M1': { blue: s(1), red: s(8), week: 1, stage: 'playoffs' },
          'UB-R1-M2': { blue: s(4), red: s(5), week: 1, stage: 'playoffs' },
          'UB-R1-M3': { blue: s(2), red: s(7), week: 1, stage: 'playoffs' },
          'UB-R1-M4': { blue: s(3), red: s(6), week: 1, stage: 'playoffs' },
          'UB-R2-M1': { blue: '', red: '', week: 2, stage: 'playoffs' },
          'UB-R2-M2': { blue: '', red: '', week: 2, stage: 'playoffs' },
          'LB-R1-M1': { blue: '', red: '', week: 2, stage: 'playoffs' },
          'LB-R1-M2': { blue: '', red: '', week: 2, stage: 'playoffs' },
          'UB-FINAL': { blue: '', red: '', week: 3, stage: 'playoffs' },
          'LB-R2-M1': { blue: '', red: '', week: 3, stage: 'playoffs' },
          'LB-R2-M2': { blue: '', red: '', week: 3, stage: 'playoffs' },
          'LB-R3': { blue: '', red: '', week: 4, stage: 'playoffs' },
          'LB-FINAL': { blue: '', red: '', week: 5, stage: 'playoffs' },
          GF: { blue: '', red: '', week: 6, stage: 'final' },
        }
      : {
          'UB-M1': { blue: s(1), red: s(4), week: 1, stage: 'playoffs' },
          'UB-M2': { blue: s(2), red: s(3), week: 1, stage: 'playoffs' },
          'UB-FINAL': { blue: '', red: '', week: 2, stage: 'playoffs' },
          'LB-M1': { blue: '', red: '', week: 2, stage: 'playoffs' },
          'LB-FINAL': { blue: '', red: '', week: 3, stage: 'playoffs' },
          GF: { blue: '', red: '', week: 4, stage: 'final' },
        };

  const feeds: Record<string, { w?: string; l?: string }> =
    N === 8
      ? {
          'UB-R1-M1': { w: 'UB-R2-M1', l: 'LB-R1-M1' },
          'UB-R1-M2': { w: 'UB-R2-M1', l: 'LB-R1-M1' },
          'UB-R1-M3': { w: 'UB-R2-M2', l: 'LB-R1-M2' },
          'UB-R1-M4': { w: 'UB-R2-M2', l: 'LB-R1-M2' },
          'UB-R2-M1': { w: 'UB-FINAL', l: 'LB-R2-M2' },
          'UB-R2-M2': { w: 'UB-FINAL', l: 'LB-R2-M1' },
          'LB-R1-M1': { w: 'LB-R2-M1' },
          'LB-R1-M2': { w: 'LB-R2-M2' },
          'LB-R2-M1': { w: 'LB-R3' },
          'LB-R2-M2': { w: 'LB-R3' },
          'LB-R3': { w: 'LB-FINAL' },
          'UB-FINAL': { w: 'GF', l: 'LB-FINAL' },
          'LB-FINAL': { w: 'GF' },
        }
      : {
          'UB-M1': { w: 'UB-FINAL', l: 'LB-M1' },
          'UB-M2': { w: 'UB-FINAL', l: 'LB-M1' },
          'UB-FINAL': { w: 'GF', l: 'LB-FINAL' },
          'LB-M1': { w: 'LB-FINAL' },
          'LB-FINAL': { w: 'GF' },
        };

  const matches: Match[] = [];
  const slotToId = new Map<string, string>();
  let day = 1;
  for (const [slot, cfg] of Object.entries(slots)) {
    const m = makeMatch({
      leagueId,
      stage: cfg.stage,
      week: cfg.week,
      matchDay: cfg.week,
      blue: cfg.blue,
      red: cfg.red,
      format,
      date: dayStep(start, cfg.week * 4 + day++),
      bracketSlot: slot,
    });
    matches.push(m);
    slotToId.set(slot, m.id);
  }
  for (const m of matches) {
    const f = feeds[m.bracket_slot ?? ''];
    if (f?.w) m.feeds_winner_to = slotToId.get(f.w) ?? null;
    if (f?.l) m.feeds_loser_to = slotToId.get(f.l) ?? null;
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Group stage (round robin per group)
// ---------------------------------------------------------------------------
export function generateGroups(
  leagueId: string,
  seedIds: string[],
  numGroups: number,
  format: MatchFormat,
  start: Date,
): Match[] {
  const groups: string[][] = Array.from({ length: numGroups }, () => []);
  // snake distribution keeps groups balanced by seed
  seedIds.forEach((id, i) => {
    const row = Math.floor(i / numGroups);
    const col = row % 2 === 0 ? i % numGroups : numGroups - 1 - (i % numGroups);
    groups[col].push(id);
  });
  const out: Match[] = [];
  groups.forEach((ids, gi) => {
    const label = String.fromCharCode(65 + gi);
    const rrs = circleRounds(ids);
    let week = 1;
    rrs.forEach((pairs, ri) => {
      pairs.forEach(([a, b]) => {
        out.push(
          makeMatch({
            leagueId,
            stage: 'group_stage',
            week,
            matchDay: ri + 1,
            blue: a,
            red: b,
            format,
            date: dayStep(start, ri * 2 + gi),
            bracketSlot: `GROUP-${label}`,
          }),
        );
      });
      week++;
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Swiss
// ---------------------------------------------------------------------------
export function generateSwissRound1(
  leagueId: string,
  seedIds: string[],
  format: MatchFormat,
  start: Date,
): Match[] {
  const half = Math.floor(seedIds.length / 2);
  const out: Match[] = [];
  for (let i = 0; i < half; i++) {
    out.push(
      makeMatch({
        leagueId,
        stage: 'swiss',
        week: 1,
        matchDay: 1,
        blue: seedIds[i],
        red: seedIds[i + half],
        format,
        date: dayStep(start, i),
        bracketSlot: 'SWISS-R1',
      }),
    );
  }
  return out;
}

// Pair same-record teams for the next swiss round, avoiding rematches.
export function generateNextSwissRound(
  leagueId: string,
  teamIds: string[],
  swissMatches: Match[],
  format: MatchFormat,
  start: Date,
): Match[] {
  const round = Math.max(0, ...swissMatches.map((m) => m.week)) + 1;
  const wins: Record<string, number> = {};
  const played = new Set<string>();
  teamIds.forEach((t) => (wins[t] = 0));
  for (const m of swissMatches) {
    if (m.status !== 'completed' || !m.winner_team_id) continue;
    wins[m.winner_team_id] = (wins[m.winner_team_id] ?? 0) + 1;
    played.add([m.blue_team_id, m.red_team_id].sort().join('|'));
  }
  // sort by wins desc, pair greedily
  const pool = [...teamIds].sort((a, b) => (wins[b] ?? 0) - (wins[a] ?? 0));
  const out: Match[] = [];
  const used = new Set<string>();
  for (let i = 0; i < pool.length; i++) {
    if (used.has(pool[i])) continue;
    for (let j = i + 1; j < pool.length; j++) {
      if (used.has(pool[j])) continue;
      const key = [pool[i], pool[j]].sort().join('|');
      if (played.has(key)) continue;
      used.add(pool[i]);
      used.add(pool[j]);
      out.push(
        makeMatch({
          leagueId,
          stage: 'swiss',
          week: round,
          matchDay: round,
          blue: pool[i],
          red: pool[j],
          format,
          date: dayStep(start, out.length),
          bracketSlot: `SWISS-R${round}`,
        }),
      );
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Top-level dispatcher
// ---------------------------------------------------------------------------
export function generateSchedule(
  league: League,
  teams: Team[],
  opts?: { start?: Date; seedOrder?: string[] },
): Match[] {
  const start = opts?.start ?? new Date();
  const ids = opts?.seedOrder ?? teams.map((t) => t.id);
  const patch = `${(league.season.match(/\d{2}/)?.[0] ?? '25')}.S`;
  const fmt = league.format;

  const bo3: MatchFormat = 'BO3';
  const bo1: MatchFormat = 'BO1';
  const bo5: MatchFormat = 'BO5';

  switch (fmt) {
    case 'single_round_robin_bo1':
    case 'custom_league':
      return generateRoundRobin(league.id, ids, bo1, false, start, patch);
    case 'double_round_robin_bo1':
      return generateRoundRobin(league.id, ids, bo1, true, start, patch);
    case 'bo3_regular_season':
      return generateRoundRobin(league.id, ids, bo3, true, start, patch);
    case 'single_elim':
    case 'bo5_playoffs':
    case 'custom_knockout':
      return generateSingleElim(league.id, ids, bo5, start);
    case 'double_elim':
      return generateDoubleElim(league.id, ids, bo5, start);
    case 'msi':
      return generateDoubleElim(league.id, ids.slice(0, 8), bo5, start);
    case 'swiss':
      return generateSwissRound1(league.id, ids, bo1, start);
    case 'groups_playoffs':
      return generateGroups(league.id, ids, ids.length >= 8 ? 2 : 1, bo1, start);
    case 'worlds':
      return generateGroups(league.id, ids, ids.length >= 12 ? 4 : 2, bo1, start);
    default:
      return generateRoundRobin(league.id, ids, bo1, true, start, patch);
  }
}

export function formatForLeague(format: LeagueFormat): MatchFormat {
  if (format === 'bo3_regular_season') return 'BO3';
  if (['bo5_playoffs', 'single_elim', 'double_elim', 'custom_knockout', 'msi', 'worlds'].includes(format))
    return 'BO5';
  return 'BO1';
}

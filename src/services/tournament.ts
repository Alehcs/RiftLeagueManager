import type { Database, League, Match, Player, Team } from '@/lib/types';
import { standingsTable } from '@/services/standings';
import { competitionMode, circuitForLeague, syncSeasonCircuit, parseQualificationResults } from '@/services/competition';

// ============================================================================
// Tournament experience — turns the bracket competitions (regional playoffs,
// regional finals, MSI, Worlds, quick tournaments) into a rich summary:
// seeded participants, champion/runner-up, MVP, recap and impact highlights.
//
// Pure and read-only. No schema change: everything is derived from existing
// matches (competition_key + bracket relations) and match_simulations.
// ============================================================================

export type TournamentScope = 'domestic' | 'international';
export type TournamentStatus = 'upcoming' | 'active' | 'completed';

export interface TournamentDef { key: string; name: string; scope: TournamentScope }

export interface TournamentEntry { team: Team; seed: number | null; region: string; eliminated: boolean }
export interface TournamentMvp { player: Player; teamId: string; score: number }

export interface TournamentSummary {
  key: string;
  name: string;
  scope: TournamentScope;
  status: TournamentStatus;
  stageLabel: string;
  formatLabel: string;
  formatExplanation: string;
  participants: TournamentEntry[];
  bracket: Match[];
  upcoming: Match[];
  completed: Match[];
  champion: Team | null;
  runnerUp: Team | null;
  mvp: TournamentMvp | null;
  bestPerformer: TournamentMvp | null;
  biggestUpset: { match: Match; winner: Team; loser: Team; seedGap: number } | null;
  strongestRegion: string | null;
  recap: string | null;
  progress: { completed: number; total: number };
  hasBracket: boolean;
}

const META: Record<string, { name: string; scope: TournamentScope; format: string; explain: string }> = {
  regional_playoffs: { name: 'Regional Playoffs', scope: 'domestic', format: 'Single elimination · BO5', explain: 'Top regional seeds compete in a single-elimination bracket. The winner is regional champion and earns international qualification.' },
  regional_finals: { name: 'Regional Finals', scope: 'domestic', format: 'Single elimination · BO5', explain: 'A late-season bracket that decides the final Worlds qualification from the region.' },
  msi: { name: 'MSI', scope: 'international', format: 'International bracket · BO5', explain: 'A mid-season international event. Regional champions meet in a single-elimination bracket.' },
  worlds: { name: 'Worlds', scope: 'international', format: 'World championship · BO5', explain: 'The season-ending world championship. Regional seeds compete for the world title.' },
  quick_tournament: { name: 'Tournament', scope: 'domestic', format: 'Bracket / League', explain: 'A standalone tournament played to a champion.' },
};

// Tournaments that exist for a league's competition mode.
export function leagueTournaments(league: League): TournamentDef[] {
  const mode = competitionMode(league);
  if (mode === 'quick_tournament') return [{ key: 'quick_tournament', name: 'Tournament', scope: 'domestic' }];
  if (mode === 'regional_season') return [{ key: 'regional_playoffs', name: 'Regional Playoffs', scope: 'domestic' }];
  return [
    { key: 'regional_playoffs', name: 'Regional Playoffs', scope: 'domestic' },
    { key: 'regional_finals', name: 'Regional Finals', scope: 'domestic' },
    { key: 'msi', name: 'MSI', scope: 'international' },
    { key: 'worlds', name: 'Worlds', scope: 'international' },
  ];
}

function teamRegion(team: Team | undefined): string {
  return team?.region || '—';
}

// Seed map: international events use circuit qualification seeds; domestic
// brackets use regional-league standings position.
function seedMap(db: Database, league: League, key: string, teams: Team[], matches: Match[]): Map<string, number> {
  const map = new Map<string, number>();
  if (key === 'msi' || key === 'worlds') {
    const circuit = syncSeasonCircuit(circuitForLeague(db, league), league, teams, matches);
    parseQualificationResults(circuit)
      .filter((r) => r.target_competition_key === key && r.team_id)
      .forEach((r) => { if (!map.has(r.team_id!)) map.set(r.team_id!, r.seed); });
  }
  if (map.size === 0) {
    const regular = matches.filter((m) => m.competition_key === 'regional_league');
    standingsTable(teams, regular.length ? regular : matches).forEach((row) => { if (!map.has(row.team.id)) map.set(row.team.id, row.position); });
  }
  return map;
}

interface SimStat { player_id: string; team_id: string; mvp_score?: number }

export function tournamentSummary(db: Database, league: League, key: string): TournamentSummary {
  const meta = META[key] ?? { name: key, scope: 'domestic' as TournamentScope, format: 'Bracket', explain: '' };
  const teams = db.teams.filter((t) => t.league_id === league.id);
  const allMatches = db.matches.filter((m) => m.league_id === league.id);
  const bracket = allMatches
    .filter((m) => m.competition_key === key && ['playoffs', 'final', 'group_stage', 'swiss'].includes(m.stage))
    .sort((a, b) => a.week - b.week || a.match_day - b.match_day);
  const completed = bracket.filter((m) => m.status === 'completed');
  const upcoming = bracket.filter((m) => m.status !== 'completed' && m.blue_team_id && m.red_team_id);
  const hasBracket = bracket.length > 0;

  // Participants: teams actually drawn into the bracket; fall back to projected
  // qualifiers (circuit results) when the bracket has not been generated yet.
  const seeds = seedMap(db, league, key, teams, allMatches);
  const participantIds = new Set<string>();
  for (const m of bracket) { if (m.blue_team_id) participantIds.add(m.blue_team_id); if (m.red_team_id) participantIds.add(m.red_team_id); }
  if (participantIds.size === 0 && (key === 'msi' || key === 'worlds')) {
    const circuit = syncSeasonCircuit(circuitForLeague(db, league), league, teams, allMatches);
    parseQualificationResults(circuit).filter((r) => r.target_competition_key === key && r.team_id).forEach((r) => participantIds.add(r.team_id!));
  }

  const final = [...completed].filter((m) => m.stage === 'final' && m.winner_team_id).sort((a, b) => b.week - a.week)[0];
  const champion = final ? teams.find((t) => t.id === final.winner_team_id) ?? null : null;
  const runnerUp = final ? teams.find((t) => t.id === (final.winner_team_id === final.blue_team_id ? final.red_team_id : final.blue_team_id)) ?? null : null;

  // Eliminated = lost a completed bracket match and is not the champion.
  const eliminated = new Set<string>();
  for (const m of completed) {
    if (!m.winner_team_id) continue;
    const loser = m.winner_team_id === m.blue_team_id ? m.red_team_id : m.blue_team_id;
    if (loser) eliminated.add(loser);
  }

  const participants: TournamentEntry[] = [...participantIds]
    .map((id) => teams.find((t) => t.id === id))
    .filter((t): t is Team => !!t)
    .map((team) => ({ team, seed: seeds.get(team.id) ?? null, region: teamRegion(team), eliminated: eliminated.has(team.id) && team.id !== champion?.id }))
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));

  // MVP across this tournament's completed simulations.
  const simIds = new Set(completed.map((m) => m.id));
  let mvp: TournamentMvp | null = null;
  let championBest: TournamentMvp | null = null;
  for (const sim of db.match_simulations.filter((s) => simIds.has(s.match_id) && s.status === 'completed')) {
    let stats: SimStat[] = [];
    try { stats = JSON.parse(sim.player_stats) as SimStat[]; } catch { stats = []; }
    for (const stat of stats) {
      const score = stat.mvp_score ?? 0;
      const player = db.players.find((p) => p.id === stat.player_id);
      if (!player) continue;
      if (!mvp || score > mvp.score) mvp = { player, teamId: stat.team_id, score };
      if (champion && stat.team_id === champion.id && (!championBest || score > championBest.score)) championBest = { player, teamId: stat.team_id, score };
    }
  }
  const bestPerformer = championBest && (!mvp || championBest.player.id !== mvp.player.id) ? championBest : null;

  // Biggest upset: a completed match where the worse seed won, by the widest gap.
  let biggestUpset: TournamentSummary['biggestUpset'] = null;
  for (const m of completed) {
    if (!m.winner_team_id) continue;
    const loserId = m.winner_team_id === m.blue_team_id ? m.red_team_id : m.blue_team_id;
    const ws = seeds.get(m.winner_team_id); const ls = seeds.get(loserId);
    if (ws == null || ls == null || ws <= ls) continue;
    const gap = ws - ls;
    if (!biggestUpset || gap > biggestUpset.seedGap) {
      const winner = teams.find((t) => t.id === m.winner_team_id); const loser = teams.find((t) => t.id === loserId);
      if (winner && loser) biggestUpset = { match: m, winner, loser, seedGap: gap };
    }
  }

  // Strongest region: most bracket wins (international events only).
  let strongestRegion: string | null = null;
  if (meta.scope === 'international') {
    const wins = new Map<string, number>();
    for (const m of completed) {
      const w = teams.find((t) => t.id === m.winner_team_id);
      if (w) wins.set(teamRegion(w), (wins.get(teamRegion(w)) ?? 0) + 1);
    }
    strongestRegion = [...wins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  const status: TournamentStatus = champion ? 'completed' : hasBracket && completed.length > 0 ? 'active' : hasBracket ? 'active' : 'upcoming';
  const stageLabel = champion ? 'Completed' : !hasBracket ? 'Not started' : upcoming.some((m) => m.stage === 'final') ? 'Final' : completed.length ? 'In progress' : 'Bracket set';

  let recap: string | null = null;
  if (champion) {
    const parts = [`${champion.name} won ${meta.name}${runnerUp ? `, defeating ${runnerUp.name} in the final` : ''}.`];
    if (mvp) parts.push(`${mvp.player.nickname} was the tournament MVP.`);
    if (biggestUpset) parts.push(`The biggest upset saw ${biggestUpset.winner.short_name} (#${seeds.get(biggestUpset.winner.id)}) topple ${biggestUpset.loser.short_name} (#${seeds.get(biggestUpset.loser.id)}).`);
    if (strongestRegion) parts.push(`${strongestRegion} was the strongest region.`);
    recap = parts.join(' ');
  }

  return {
    key,
    name: meta.name,
    scope: meta.scope,
    status,
    stageLabel,
    formatLabel: meta.format,
    formatExplanation: meta.explain,
    participants,
    bracket,
    upcoming,
    completed,
    champion,
    runnerUp,
    mvp,
    bestPerformer,
    biggestUpset,
    strongestRegion,
    recap,
    progress: { completed: completed.length, total: bracket.length },
    hasBracket,
  };
}

import type { Database, League, Match, Player, Team, TransferRecord } from '@/lib/types';
import { PLAYER_ROLES } from '@/lib/types';
import { Rng } from '@/lib/rng';
import { clamp, nowISO } from '@/lib/utils';
import { playerCategory } from '@/services/run';
import { playerValue } from '@/services/ratings';
import { standingsTable } from '@/services/standings';

// ============================================================================
// Annual season cycle — season-end effects + recap derivation.
//
// All functions are pure / framework-agnostic. The mutating helpers change the
// arrays they are handed in place (same pattern as applyMatchConsequences /
// runBotMarket); the store calls them inside a commit and persists the result.
// Values are conservative and seeded so a season end is deterministic.
// ============================================================================

const finalWinner = (matches: Match[], competitionKey: string): string | null => {
  const finals = matches
    .filter((m) => m.competition_key === competitionKey && m.stage === 'final' && m.status === 'completed' && m.winner_team_id)
    .sort((a, b) => b.week - a.week);
  return finals[0]?.winner_team_id ?? null;
};

const finalLoser = (matches: Match[], competitionKey: string): string | null => {
  const final = matches
    .filter((m) => m.competition_key === competitionKey && m.stage === 'final' && m.status === 'completed' && m.winner_team_id)
    .sort((a, b) => b.week - a.week)[0];
  if (!final) return null;
  return final.winner_team_id === final.blue_team_id ? final.red_team_id : final.blue_team_id;
};

const regionsOf = (teams: Team[]): string[] => [...new Set(teams.map((t) => t.region || 'Unknown'))].sort();

// Top regular-season team in each region (its "regional champion" by standing).
export function regionalChampions(teams: Team[], matches: Match[]): Record<string, string> {
  const regular = matches.filter((m) => m.competition_key === 'regional_league');
  const out: Record<string, string> = {};
  for (const region of regionsOf(teams)) {
    const regionTeams = teams.filter((t) => (t.region || 'Unknown') === region);
    const table = standingsTable(regionTeams, regular);
    if (table[0]) out[region] = table[0].team.id;
  }
  return out;
}

export interface RewardEntry { team_id: string; amount: number; reason: string }

// Conservative, bounded prize money applied at season end. Scaled to the
// ~5M starting-budget economy; everything is additive and capped.
export function applySeasonRewards(teams: Team[], matches: Match[]): RewardEntry[] {
  const rewards: RewardEntry[] = [];
  const grant = (teamId: string | null, amount: number, reason: string) => {
    if (!teamId) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    team.budget += amount;
    team.updated_at = nowISO();
    rewards.push({ team_id: teamId, amount, reason });
  };

  // Participation floor for every active team.
  for (const team of teams) grant(team.id, 250_000, 'Season participation');

  // Regional regular-season leaders.
  const regChamps = regionalChampions(teams, matches);
  for (const [region, teamId] of Object.entries(regChamps)) grant(teamId, 750_000, `${region} regular-season #1`);

  // Domestic playoff / regional finals champions.
  grant(finalWinner(matches, 'regional_playoffs'), 1_000_000, 'Regional playoff champion');
  grant(finalWinner(matches, 'regional_finals'), 1_000_000, 'Regional finals champion');

  // International performance.
  for (const id of participantsOf(matches, 'msi')) grant(id, 500_000, 'MSI participation');
  grant(finalLoser(matches, 'msi'), 750_000, 'MSI finalist');
  grant(finalWinner(matches, 'msi'), 2_000_000, 'MSI champion');

  for (const id of participantsOf(matches, 'worlds')) grant(id, 750_000, 'Worlds participation');
  grant(finalLoser(matches, 'worlds'), 1_500_000, 'Worlds finalist');
  grant(finalWinner(matches, 'worlds'), 3_000_000, 'Worlds champion');

  return rewards;
}

function participantsOf(matches: Match[], competitionKey: string): string[] {
  const ids = new Set<string>();
  for (const m of matches.filter((x) => x.competition_key === competitionKey)) {
    if (m.blue_team_id) ids.add(m.blue_team_id);
    if (m.red_team_id) ids.add(m.red_team_id);
  }
  return [...ids];
}

// Bounded, seeded development applied to every rostered player at season end.
// Young high-potential players may rise; veterans/low-form may dip. Max ±3
// overall, never above potential. Ages advance by one year.
export function applyPlayerDevelopment(players: Player[], seed: string): void {
  const rostered = players.filter((p) => p.team_id && (p.status === 'active' || p.status === 'benched'));
  for (const player of rostered) {
    const rng = new Rng(`${seed}:dev:${player.id}`);
    const age = player.age ?? 22;
    const form = player.performance_form ?? 50;
    const morale = player.morale ?? 50;
    let up = 0;
    let down = 0;
    if (age <= 21 && (player.potential ?? player.rating_overall) > player.rating_overall) up += rng.int(0, 2);
    if (form >= 65) up += rng.bool(0.5) ? 1 : 0;
    if (age >= 28) down += rng.int(0, 2);
    if (form <= 35 || morale <= 35) down += rng.bool(0.5) ? 1 : 0;
    const cap = Math.min(99, player.potential ?? 99);
    const target = clamp(player.rating_overall + up, player.rating_overall, cap);
    const delta = clamp(target - down - player.rating_overall, -3, 3);
    if (delta !== 0) {
      const shift = (value: number) => clamp(value + delta, 35, 99);
      player.rating_overall = clamp(player.rating_overall + delta, 45, 99);
      player.rating_laning = shift(player.rating_laning);
      player.rating_teamfighting = shift(player.rating_teamfighting);
      player.rating_macro = shift(player.rating_macro);
      player.rating_mechanics = shift(player.rating_mechanics);
      player.rating_consistency = shift(player.rating_consistency);
      player.category = playerCategory(player.rating_overall);
      if ((player.potential ?? 0) < player.rating_overall) player.potential = player.rating_overall;
      if (age <= 20 && delta > 0) player.potential = clamp((player.potential ?? player.rating_overall) + rng.int(0, 1), player.rating_overall, 99);
    }
    player.age = age + 1;
    player.value = playerValue(player.rating_overall, player.role, player.age);
    player.updated_at = nowISO();
  }
}

// Offseason recovery: shed fatigue and pull morale/form back toward baseline so
// the new season starts from a calm state without wiping all individuality.
export function applySeasonRecovery(teams: Team[], players: Player[]): void {
  const toward = (value: number, base: number, factor: number) => Math.round(value + (base - value) * factor);
  for (const team of teams) {
    team.fatigue = clamp(Math.round((team.fatigue ?? 0) * 0.3), 0, 100);
    team.morale = clamp(toward(team.morale ?? 50, 55, 0.6), 0, 100);
    team.performance_form = clamp(toward(team.performance_form ?? 50, 50, 0.6), 0, 100);
    team.updated_at = nowISO();
  }
  for (const player of players) {
    if (!player.team_id) continue;
    player.fatigue = clamp(Math.round((player.fatigue ?? 0) * 0.3), 0, 100);
    player.morale = clamp(toward(player.morale ?? 50, 55, 0.6), 0, 100);
    player.performance_form = clamp(toward(player.performance_form ?? 50, 50, 0.6), 0, 100);
    player.updated_at = nowISO();
  }
}

export interface RetirementEntry { player_id: string; nickname: string; team_id: string }

// Very conservative retirement: only aging, low-rated players, and only when the
// team keeps a valid roster (another active player in that role remains). Capped
// per call so a season never gutted a roster. Retired players leave their team.
export function applyRetirements(players: Player[], seed: string, maxRetirements = 3): RetirementEntry[] {
  const candidates = players
    .filter((p) => p.team_id && p.status !== 'retired' && (p.age ?? 0) >= 31 && p.rating_overall <= 68)
    .sort((a, b) => (b.age ?? 0) - (a.age ?? 0));
  const retired: RetirementEntry[] = [];
  for (const player of candidates) {
    if (retired.length >= maxRetirements) break;
    const rng = new Rng(`${seed}:retire:${player.id}`);
    if (!rng.bool(0.5)) continue;
    const activeSameRole = players.filter(
      (p) => p.team_id === player.team_id && p.id !== player.id && p.role === player.role && p.status === 'active',
    );
    // Don't break roster validity: keep at least one active player in the role.
    if (player.status === 'active' && activeSameRole.length === 0) continue;
    retired.push({ player_id: player.id, nickname: player.nickname, team_id: player.team_id as string });
    player.status = 'retired';
    player.team_id = null;
    player.updated_at = nowISO();
  }
  return retired;
}

// --- Season recap (pure read over the db) -----------------------------------

export interface RecapTeamSummary { team_id: string; short_name: string; wins: number; losses: number; points: number }
export interface SeasonRecap {
  season_key: string;
  regional_champions: { region: string; team_id: string }[];
  playoff_champion_team_id: string | null;
  msi_champion_team_id: string | null;
  worlds_champion_team_id: string | null;
  best_team_id: string | null;
  mvp_player_id: string | null;
  biggest_transfer: { player_id: string; amount: number; from_team_id: string | null; to_team_id: string | null } | null;
  team_summaries: RecapTeamSummary[];
}

export function seasonRecap(
  league: League,
  teams: Team[],
  matches: Match[],
  players: Player[],
  simulations: Database['match_simulations'],
  transferHistory: TransferRecord[],
): SeasonRecap {
  const regChamps = regionalChampions(teams, matches);
  const regular = matches.filter((m) => m.competition_key === 'regional_league');
  const overall = standingsTable(teams, regular);
  const worldsChampion = finalWinner(matches, 'worlds');
  const playoffChampion = finalWinner(matches, 'regional_finals') ?? finalWinner(matches, 'regional_playoffs');

  // MVP: highest single-game mvp_score across this league's completed sims.
  let mvpPlayerId: string | null = null;
  let bestScore = -Infinity;
  for (const sim of simulations.filter((s) => s.league_id === league.id && s.status === 'completed')) {
    let stats: { player_id: string; mvp_score?: number }[] = [];
    try { stats = JSON.parse(sim.player_stats) as typeof stats; } catch { stats = []; }
    for (const stat of stats) {
      const score = stat.mvp_score ?? 0;
      if (score > bestScore) { bestScore = score; mvpPlayerId = stat.player_id; }
    }
  }

  const biggest = [...transferHistory.filter((t) => t.league_id === league.id)].sort((a, b) => b.amount - a.amount)[0];

  return {
    season_key: league.season,
    regional_champions: Object.entries(regChamps).map(([region, team_id]) => ({ region, team_id })),
    playoff_champion_team_id: playoffChampion,
    msi_champion_team_id: finalWinner(matches, 'msi'),
    worlds_champion_team_id: worldsChampion,
    best_team_id: worldsChampion ?? overall[0]?.team.id ?? null,
    mvp_player_id: mvpPlayerId,
    biggest_transfer: biggest
      ? { player_id: biggest.player_id, amount: biggest.amount, from_team_id: biggest.from_team_id, to_team_id: biggest.to_team_id }
      : null,
    team_summaries: overall.slice(0, 10).map((row) => ({
      team_id: row.team.id, short_name: row.team.short_name, wins: row.team.wins, losses: row.team.losses, points: row.team.points,
    })),
  };
}

// Increment the trailing year in a season key, e.g. "2025" -> "2026",
// "Spring 2025" -> "Spring 2026". Falls back to appending " +1" if no year.
export function nextSeasonKey(season: string): string {
  const match = season.match(/(\d{4})(?!.*\d)/);
  if (!match) return `${season} +1`;
  const year = Number(match[1]) + 1;
  return season.slice(0, match.index) + year + season.slice((match.index ?? 0) + match[1].length);
}

// Reset competitive state on a team for a fresh season (keeps budget, roster,
// region, bot/manager flags, and identity).
export function resetTeamForNewSeason(team: Team): void {
  team.wins = 0;
  team.losses = 0;
  team.games_won = 0;
  team.games_lost = 0;
  team.points = 0;
  team.form = '';
  team.morale = 50;
  team.synergy = 50;
  team.performance_form = 50;
  team.fatigue = 0;
  team.updated_at = nowISO();
}

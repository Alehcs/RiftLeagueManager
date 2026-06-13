import type { Match, Team } from '@/lib/types';

// ============================================================================
// Standings — derived purely from completed regular-season matches.
// LoL convention: rank by match wins, then game differential as primary
// tiebreaker (head-to-head is a documented placeholder below).
// ============================================================================

export interface Last5Entry {
  result: 'W' | 'L';
  matchId: string;
  opponentId: string;
  score: string; // e.g. "2-1"
}

export interface TeamRecord {
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  form: string; // most-recent-first, e.g. "WWLWL"
  last5: Last5Entry[];
  played: number;
}

const REGULAR_STAGES = new Set(['regular_season', 'group_stage', 'swiss']);

export function teamRecord(teamId: string, matches: Match[]): TeamRecord {
  const rel = matches
    .filter(
      (m) =>
        m.status === 'completed' &&
        REGULAR_STAGES.has(m.stage) &&
        (m.blue_team_id === teamId || m.red_team_id === teamId),
    )
    .sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time));

  let wins = 0;
  let losses = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  const seq: Last5Entry[] = [];

  for (const m of rel) {
    const isBlue = m.blue_team_id === teamId;
    const myGames = isBlue ? m.blue_score : m.red_score;
    const oppGames = isBlue ? m.red_score : m.blue_score;
    gamesWon += myGames;
    gamesLost += oppGames;
    const won = m.winner_team_id === teamId;
    if (won) wins++;
    else losses++;
    seq.push({
      result: won ? 'W' : 'L',
      matchId: m.id,
      opponentId: isBlue ? m.red_team_id : m.blue_team_id,
      score: `${myGames}-${oppGames}`,
    });
  }

  const recent = seq.slice(-5).reverse();
  return {
    wins,
    losses,
    gamesWon,
    gamesLost,
    played: rel.length,
    form: recent.map((e) => e.result).join(''),
    last5: recent,
  };
}

// Returns a new teams array with aggregate fields recomputed from matches.
export function applyStandings(teams: Team[], matches: Match[]): Team[] {
  return teams.map((t) => {
    const rec = teamRecord(t.id, matches);
    return {
      ...t,
      wins: rec.wins,
      losses: rec.losses,
      games_won: rec.gamesWon,
      games_lost: rec.gamesLost,
      points: rec.wins, // 1 point per series win
      form: rec.form,
    };
  });
}

export interface StandingRow {
  position: number;
  team: Team;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  points: number;
  played: number;
  winRate: number;
  form: string;
  last5: Last5Entry[];
  group?: string;
}

export function standingsTable(teams: Team[], matches: Match[], group?: string): StandingRow[] {
  const rows: StandingRow[] = teams.map((team) => {
    const rec = teamRecord(team.id, matches);
    return {
      position: 0,
      team,
      wins: rec.wins,
      losses: rec.losses,
      gamesWon: rec.gamesWon,
      gamesLost: rec.gamesLost,
      gameDiff: rec.gamesWon - rec.gamesLost,
      points: rec.wins,
      played: rec.played,
      winRate: rec.played ? rec.wins / rec.played : 0,
      form: rec.form,
      last5: rec.last5,
      group,
    };
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    if (b.wins !== a.wins) return b.wins - a.wins;
    // Head-to-head tiebreaker placeholder — falls back to name for stability.
    return a.team.name.localeCompare(b.team.name);
  });
  rows.forEach((r, i) => (r.position = i + 1));
  return rows;
}

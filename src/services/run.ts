import type {
  Coach,
  League,
  LeagueRunPhase,
  MarketOffer,
  Match,
  MatchSimulation,
  Player,
  PlayerCategory,
  Role,
  Team,
} from '@/lib/types';
import { PLAYER_ROLES } from '@/lib/types';
import { Rng } from '@/lib/rng';
import { clamp, nowISO, uid } from '@/lib/utils';
import { generateCoachRatings, generatePlayerRatings, playerSalary, playerValue } from '@/services/ratings';
import type { MatchSimResult } from '@/services/simulation';

const NICKS = [
  'Aero', 'Arc', 'Blaze', 'Cipher', 'Crown', 'Drift', 'Echo', 'Ember', 'Fable', 'Flux',
  'Frost', 'Gale', 'Halo', 'Haze', 'Kite', 'Lotus', 'Lumen', 'Nova', 'Onyx', 'Pulse',
  'Quill', 'Rune', 'Shiver', 'Slate', 'Solar', 'Spark', 'Tempo', 'Vale', 'Vex', 'Zenith',
] as const;
const FIRST_NAMES = ['Alex', 'Daniel', 'Eli', 'Ivan', 'Jae', 'Kai', 'Leo', 'Marco', 'Min', 'Noah', 'Ren', 'Sora', 'Tae', 'Yun'] as const;
const LAST_NAMES = ['Chen', 'Diaz', 'Han', 'Kim', 'Lee', 'Martinez', 'Park', 'Rivera', 'Sato', 'Silva', 'Tan', 'Wang'] as const;
const COUNTRIES = ['KR', 'CN', 'US', 'CA', 'ES', 'FR', 'DE', 'BR', 'CL', 'JP'] as const;
const BOT_NAMES = ['Coach Atlas', 'Coach Nova', 'Coach Prime', 'Coach Rift', 'Coach Tempo', 'Coach Vector'] as const;

export const RUN_PHASES: LeagueRunPhase[] = [
  'lobby',
  'team_selection',
  'roster_reveal',
  'preseason_week_1',
  'preseason_week_2',
  'preseason_week_3',
  'regular_season',
  'playoffs',
  'completed',
];

export const RUN_PHASE_LABELS: Record<LeagueRunPhase, string> = {
  lobby: 'Lobby',
  team_selection: 'Team selection',
  roster_reveal: 'Roster reveal',
  preseason_week_1: 'Preseason week 1',
  preseason_week_2: 'Preseason week 2',
  preseason_week_3: 'Preseason week 3',
  regular_season: 'Regular season',
  playoffs: 'Playoffs',
  completed: 'Completed',
};

export function runPhase(league: League): LeagueRunPhase {
  return league.run_phase ?? 'lobby';
}

export function playerCategory(overall: number): PlayerCategory {
  if (overall >= 96) return 'Legend';
  if (overall >= 91) return 'Superstar';
  if (overall >= 86) return 'Star';
  if (overall >= 80) return 'Pro';
  if (overall >= 73) return 'Starter';
  if (overall >= 65) return 'Prospect';
  return 'Rookie';
}

export function nextRunPhase(league: League): LeagueRunPhase {
  const phase = runPhase(league);
  const prepWeeks = clamp(league.preparation_weeks ?? 3, 1, 3);
  if (phase === 'lobby') return 'team_selection';
  if (phase === 'team_selection') return 'roster_reveal';
  if (phase === 'roster_reveal') return prepWeeks >= 1 ? 'preseason_week_1' : 'regular_season';
  if (phase === 'preseason_week_1') return prepWeeks >= 2 ? 'preseason_week_2' : 'regular_season';
  if (phase === 'preseason_week_2') return prepWeeks >= 3 ? 'preseason_week_3' : 'regular_season';
  if (phase === 'preseason_week_3') return 'regular_season';
  if (phase === 'regular_season') return 'playoffs';
  if (phase === 'playoffs') return 'completed';
  return 'completed';
}

export function isPreseason(phase: LeagueRunPhase): boolean {
  return phase.startsWith('preseason_week_');
}

export function botManagerName(team: Team, index: number): string {
  return `${BOT_NAMES[index % BOT_NAMES.length]} ${team.short_name}`;
}

function generatedNickname(rng: Rng, used: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = `${rng.pick(NICKS)}${rng.bool(0.22) ? rng.int(2, 99) : ''}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const fallback = `Player${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

function makePlayer(
  league: League,
  team: Team | null,
  role: Role,
  seed: string,
  used: Set<string>,
  status: Player['status'],
): Player {
  const rng = new Rng(seed);
  const nickname = generatedNickname(rng, used);
  const age = rng.int(17, 28);
  const strength = team ? rng.range(2.6, 4.6) : rng.range(2.1, 4.4);
  const ratings = generatePlayerRatings(`${seed}:${nickname}`, {
    strength,
    tier: league.tier,
    role,
    star: rng.bool(team ? 0.16 : 0.08),
  });
  const overall = clamp(ratings.rating_overall, 55, 98);
  const value = playerValue(overall, role, age);
  const ts = nowISO();
  return {
    id: uid('player'),
    league_id: league.id,
    team_id: team?.id ?? null,
    real_name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    nickname,
    role,
    nationality: rng.pick(COUNTRIES),
    age,
    image_url: null,
    external_url: null,
    source_name: 'Generated',
    source_url: null,
    confidence: 0.2,
    value,
    salary: playerSalary(value, rng),
    contract_until: new Date(Date.now() + rng.int(10, 30) * 30 * 86400000).toISOString(),
    ...ratings,
    rating_overall: overall,
    category: playerCategory(overall),
    potential: clamp(overall + rng.int(age <= 20 ? 4 : 0, age <= 20 ? 12 : 6), overall, 99),
    hidden_until_reveal: !!team,
    status,
    generated: true,
    created_at: ts,
    updated_at: ts,
  };
}

export function generateRunSquad(league: League, team: Team, runSeed: string): { players: Player[]; coach: Coach } {
  const used = new Set<string>();
  const players = PLAYER_ROLES.map((role, index) =>
    makePlayer(league, team, role, `${runSeed}:${team.id}:${role}:${index}`, used, 'active'),
  );
  if (new Rng(`${runSeed}:${team.id}:sub`).bool(0.7)) {
    const subRole = new Rng(`${runSeed}:${team.id}:sub-role`).pick(PLAYER_ROLES);
    players.push(makePlayer(league, team, subRole, `${runSeed}:${team.id}:sub`, used, 'benched'));
  }
  const rng = new Rng(`${runSeed}:${team.id}:coach`);
  const coachRatings = generateCoachRatings(`${runSeed}:${team.id}`, { strength: rng.range(2.5, 4.5), tier: league.tier });
  const ts = nowISO();
  const coach: Coach = {
    id: uid('coach'),
    league_id: league.id,
    team_id: team.id,
    real_name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    nickname: `Coach ${rng.pick(NICKS)}`,
    nationality: rng.pick(COUNTRIES),
    age: rng.int(28, 48),
    image_url: null,
    external_url: null,
    source_name: 'Generated',
    source_url: null,
    confidence: 0.2,
    ...coachRatings,
    salary: 120000 + rng.int(0, 180) * 1000,
    contract_until: new Date(Date.now() + rng.int(12, 30) * 30 * 86400000).toISOString(),
    status: 'active',
    generated: true,
    created_at: ts,
    updated_at: ts,
  };
  return { players, coach };
}

export function generateFreeAgents(league: League, runSeed: string, count = 12): Player[] {
  const used = new Set<string>();
  return Array.from({ length: count }, (_, index) => {
    const role = PLAYER_ROLES[index % PLAYER_ROLES.length];
    return makePlayer(league, null, role, `${runSeed}:free-agent:${index}`, used, 'free_agent');
  });
}

export function offerScore(offer: MarketOffer, player: Player, team: Team, seed: string): number {
  const rng = new Rng(`${seed}:${offer.id}`);
  const roleBonus = offer.role_promise === 'starter' ? 18 : offer.role_promise === 'rotation' ? 8 : 2;
  const money = (offer.transfer_fee / Math.max(1, player.value)) * 35;
  const salary = (offer.salary / Math.max(1, player.salary)) * 30;
  const strength = ((team.wins + 1) / Math.max(1, team.wins + team.losses + 2)) * 8;
  return money + salary + roleBonus + strength + (team.synergy ?? 50) * 0.05 + rng.range(0, 12);
}

export interface TimelineEvent {
  minute: number;
  type: 'objective' | 'kill' | 'lead' | 'result';
  text: string;
}

export function buildTimeline(match: Match, result: MatchSimResult, blue: Team, red: Team, seed: string): TimelineEvent[] {
  const rng = new Rng(`timeline:${seed}`);
  const events: TimelineEvent[] = [];
  for (const game of result.games) {
    const winner = game.winner === 'blue' ? blue : red;
    events.push({ minute: 4 + rng.int(0, 3), type: 'kill', text: `Game ${game.game_number}: ${winner.short_name} finds first blood.` });
    events.push({ minute: 12 + rng.int(0, 5), type: 'objective', text: `${winner.short_name} secures the first major objective.` });
    events.push({ minute: Math.max(18, game.duration_minutes - rng.int(5, 9)), type: 'lead', text: `${winner.short_name} takes control of the map.` });
    events.push({ minute: game.duration_minutes, type: 'result', text: `${winner.short_name} wins game ${game.game_number}.` });
  }
  const seriesWinner = result.winner === 'blue' ? blue : red;
  events.push({ minute: Math.max(...result.games.map((game) => game.duration_minutes)) + 1, type: 'result', text: `${seriesWinner.name} wins ${result.blue_score}-${result.red_score}.` });
  return events;
}

export function buildSimulation(
  leagueId: string,
  match: Match,
  result: MatchSimResult,
  blue: Team,
  red: Team,
  startedByGuestId: string,
  seed: string,
  players: Player[] = [],
): MatchSimulation {
  const started = nowISO();
  const timeline = buildTimeline(match, result, blue, red, seed);
  return {
    id: uid('simulation'),
    match_id: match.id,
    league_id: leagueId,
    simulation_seed: seed,
    status: 'running',
    started_by_guest_id: startedByGuestId,
    started_at: started,
    completed_at: null,
    event_timeline: JSON.stringify(timeline),
    final_result: JSON.stringify({ winner_team_id: result.winner === 'blue' ? blue.id : red.id, blue_score: result.blue_score, red_score: result.red_score }),
    player_stats: JSON.stringify(players
      .filter((player) => (player.team_id === blue.id || player.team_id === red.id) && player.status === 'active')
      .map((player, index) => {
        const rng = new Rng(`${seed}:player:${player.id}`);
        return { player_id: player.id, team_id: player.team_id, kills: rng.int(0, 8), deaths: rng.int(0, 6), assists: rng.int(2, 16), games: result.games.length, order: index };
      })),
    team_stats: JSON.stringify({
      [blue.id]: { kills: result.games.reduce((sum, game) => sum + game.blue_kills, 0), gold: result.games.reduce((sum, game) => sum + game.blue_gold, 0) },
      [red.id]: { kills: result.games.reduce((sum, game) => sum + game.red_kills, 0), gold: result.games.reduce((sum, game) => sum + game.red_gold, 0) },
    }),
  };
}

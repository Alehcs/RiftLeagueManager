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
  type: 'movement' | 'objective' | 'kill' | 'fight' | 'lead' | 'result';
  text: string;
  game_number?: number;
  in_game_minute?: number;
  side?: 'blue' | 'red';
  player_id?: string;
  objective?: 'dragon' | 'herald' | 'baron' | 'tower' | 'nexus';
  action?: 'laning' | 'farming' | 'roaming' | 'ganking' | 'fighting' | 'objective' | 'pushing';
}

export function buildTimeline(
  match: Match,
  result: MatchSimResult,
  blue: Team,
  red: Team,
  seed: string,
  players: Player[] = [],
): TimelineEvent[] {
  const rng = new Rng(`timeline:${seed}`);
  const events: TimelineEvent[] = [];
  const rosters = {
    blue: players.filter((player) => player.team_id === blue.id && player.status === 'active'),
    red: players.filter((player) => player.team_id === red.id && player.status === 'active'),
  };
  let offset = 0;
  for (const game of result.games) {
    const winnerSide = game.winner;
    const loserSide = winnerSide === 'blue' ? 'red' : 'blue';
    const winner = winnerSide === 'blue' ? blue : red;
    const loser = loserSide === 'blue' ? blue : red;
    const actor = rng.pick(rosters[winnerSide].length ? rosters[winnerSide] : players);
    const jungler = rosters[winnerSide].find((player) => player.role === 'JUNGLE') ?? actor;
    const carry = rosters[winnerSide].find((player) => ['MID', 'ADC'].includes(player.role)) ?? actor;
    const objectiveSide = rng.bool(0.72) ? winnerSide : loserSide;
    const objectiveTeam = objectiveSide === 'blue' ? blue : red;
    const add = (
      inGameMinute: number,
      type: TimelineEvent['type'],
      text: string,
      details: Omit<TimelineEvent, 'minute' | 'type' | 'text' | 'game_number' | 'in_game_minute'> = {},
    ) => events.push({
      minute: offset + inGameMinute,
      in_game_minute: inGameMinute,
      game_number: game.game_number,
      type,
      text,
      ...details,
    });

    add(1, 'movement', `Game ${game.game_number}: both teams settle into their lanes.`, { action: 'laning' });
    add(4 + rng.int(0, 2), 'kill', `${jungler?.nickname ?? winner.short_name} turns an early gank into first blood for ${winner.short_name}.`, {
      side: winnerSide,
      player_id: jungler?.id,
      action: 'ganking',
    });
    add(8 + rng.int(0, 2), 'objective', `${objectiveTeam.short_name} secures the first dragon after forcing river control.`, {
      side: objectiveSide,
      objective: 'dragon',
      action: 'objective',
    });
    add(12 + rng.int(0, 2), 'objective', `${winner.short_name} converts top-side pressure into the Rift Herald.`, {
      side: winnerSide,
      objective: 'herald',
      action: 'objective',
    });
    add(Math.min(16, game.duration_minutes - 8), 'objective', `${winner.short_name} breaks the first tower and opens the map.`, {
      side: winnerSide,
      objective: 'tower',
      action: 'pushing',
    });
    add(Math.min(20, game.duration_minutes - 6), 'fight', `${loser.short_name} contests mid, but ${carry?.nickname ?? winner.short_name} swings the skirmish for ${winner.short_name}.`, {
      side: winnerSide,
      player_id: carry?.id,
      action: 'fighting',
    });
    if (game.duration_minutes >= 27) {
      add(game.duration_minutes - 6, 'objective', `${winner.short_name} wins the vision battle and claims Baron.`, {
        side: winnerSide,
        objective: 'baron',
        action: 'objective',
      });
    }
    add(game.duration_minutes - 3, 'lead', `${winner.short_name} groups for the final push.`, {
      side: winnerSide,
      action: 'pushing',
    });
    add(game.duration_minutes, 'result', `${winner.short_name} destroys the nexus and wins game ${game.game_number}.`, {
      side: winnerSide,
      objective: 'nexus',
      action: 'pushing',
    });
    offset += game.duration_minutes + 3;
  }
  const seriesWinner = result.winner === 'blue' ? blue : red;
  events.push({
    minute: Math.max(1, offset - 2),
    type: 'result',
    text: `${seriesWinner.name} wins the ${match.format} series ${result.blue_score}-${result.red_score}.`,
    side: result.winner,
  });
  return events;
}

function distributeTeamTotal(
  total: number,
  roster: Player[],
  seed: string,
  roleWeights: Partial<Record<Role, number>>,
): Map<string, number> {
  if (roster.length === 0) return new Map();
  const weighted = roster.map((player) => {
    const variance = new Rng(`${seed}:${player.id}`).range(0.88, 1.12);
    return { player, weight: (roleWeights[player.role] ?? 1) * variance };
  });
  const weightTotal = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const allocations = weighted.map((entry) => {
    const exact = total * entry.weight / weightTotal;
    return { player: entry.player, value: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remaining = total - allocations.reduce((sum, entry) => sum + entry.value, 0);
  allocations.sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; index < allocations.length && remaining > 0; index++, remaining--) allocations[index].value++;
  return new Map(allocations.map((entry) => [entry.player.id, entry.value]));
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
  const timeline = buildTimeline(match, result, blue, red, seed, players);
  const totalDuration = result.games.reduce((sum, game) => sum + game.duration_minutes, 0);
  const teamTotals = {
    [blue.id]: {
      kills: result.games.reduce((sum, game) => sum + game.blue_kills, 0),
      gold: result.games.reduce((sum, game) => sum + game.blue_gold, 0),
      towers: result.games.reduce((sum, game) => sum + (game.winner === 'blue' ? 8 : 3), 0),
      dragons: result.games.reduce((sum, game) => sum + (game.winner === 'blue' ? 3 : 1), 0),
      barons: result.games.filter((game) => game.winner === 'blue' && game.duration_minutes >= 27).length,
      heralds: result.games.filter((game) => game.winner === 'blue').length,
    },
    [red.id]: {
      kills: result.games.reduce((sum, game) => sum + game.red_kills, 0),
      gold: result.games.reduce((sum, game) => sum + game.red_gold, 0),
      towers: result.games.reduce((sum, game) => sum + (game.winner === 'red' ? 8 : 3), 0),
      dragons: result.games.reduce((sum, game) => sum + (game.winner === 'red' ? 3 : 1), 0),
      barons: result.games.filter((game) => game.winner === 'red' && game.duration_minutes >= 27).length,
      heralds: result.games.filter((game) => game.winner === 'red').length,
    },
  };
  const activePlayers = players.filter(
    (player) => (player.team_id === blue.id || player.team_id === red.id) && player.status === 'active',
  );
  const killsByPlayer = new Map<string, number>();
  const deathsByPlayer = new Map<string, number>();
  const goldByPlayer = new Map<string, number>();
  for (const team of [blue, red]) {
    const opponent = team.id === blue.id ? red : blue;
    const roster = activePlayers.filter((player) => player.team_id === team.id);
    const teamKills = teamTotals[team.id].kills;
    const opponentKills = teamTotals[opponent.id].kills;
    distributeTeamTotal(teamKills, roster, `${seed}:kills`, { TOP: 0.13, JUNGLE: 0.18, MID: 0.24, ADC: 0.34, SUPPORT: 0.11 })
      .forEach((value, playerId) => killsByPlayer.set(playerId, value));
    distributeTeamTotal(opponentKills, roster, `${seed}:deaths`, { TOP: 0.22, JUNGLE: 0.2, MID: 0.18, ADC: 0.2, SUPPORT: 0.2 })
      .forEach((value, playerId) => deathsByPlayer.set(playerId, value));
    distributeTeamTotal(teamTotals[team.id].gold, roster, `${seed}:gold`, { TOP: 0.2, JUNGLE: 0.17, MID: 0.22, ADC: 0.27, SUPPORT: 0.14 })
      .forEach((value, playerId) => goldByPlayer.set(playerId, value));
  }
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
    player_stats: JSON.stringify(activePlayers.map((player, index) => {
        const rng = new Rng(`${seed}:player:${player.id}`);
        const team = player.team_id === blue.id ? blue : red;
        const opponent = player.team_id === blue.id ? red : blue;
        const farmByRole: Partial<Record<Role, number>> = { TOP: 7.1, JUNGLE: 5.6, MID: 7.8, ADC: 8.4, SUPPORT: 1.4 };
        const roleFarm = farmByRole[player.role] ?? 4.5;
        const teamWon = team.id === (result.winner === 'blue' ? blue.id : red.id);
        const kills = killsByPlayer.get(player.id) ?? 0;
        const deaths = deathsByPlayer.get(player.id) ?? 0;
        const assists = rng.int(3, teamWon ? 18 : 13);
        const cs = Math.round(totalDuration * roleFarm * rng.range(0.88, 1.12));
        const gold = goldByPlayer.get(player.id) ?? 0;
        const impact = Math.round((kills * 3 + assists - deaths * 2 + player.rating_overall * 0.35 + (teamWon ? 8 : 0)) * 10) / 10;
        return {
          player_id: player.id,
          team_id: player.team_id,
          kills,
          deaths,
          assists,
          cs,
          gold,
          level: Math.min(18, 11 + Math.floor(totalDuration / Math.max(1, result.games.length * 5)) + rng.int(0, 2)),
          impact,
          games: result.games.length,
          order: index,
          opponent_team_id: opponent.id,
        };
      })),
    team_stats: JSON.stringify(teamTotals),
  };
}

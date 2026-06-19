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
import { competitionMode } from '@/services/competition';

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
  'msi_qualification',
  'msi',
  'midseason_break',
  'second_regional_phase',
  'regional_finals',
  'worlds',
  'offseason',
  'next_season_setup',
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
  msi_qualification: 'MSI qualification',
  msi: 'MSI',
  midseason_break: 'Mid-season break',
  second_regional_phase: 'Second regional phase',
  regional_finals: 'Regional finals',
  worlds: 'Worlds',
  offseason: 'Offseason',
  next_season_setup: 'Next season setup',
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
  const mode = competitionMode(league);
  const prepWeeks = clamp(league.preparation_weeks ?? 3, 1, 3);
  if (phase === 'lobby') return 'team_selection';
  if (phase === 'team_selection') return 'roster_reveal';
  if (phase === 'roster_reveal') return mode === 'quick_tournament' ? 'regular_season' : prepWeeks >= 1 ? 'preseason_week_1' : 'regular_season';
  if (phase === 'preseason_week_1') return prepWeeks >= 2 ? 'preseason_week_2' : 'regular_season';
  if (phase === 'preseason_week_2') return prepWeeks >= 3 ? 'preseason_week_3' : 'regular_season';
  if (phase === 'preseason_week_3') return 'regular_season';
  if (phase === 'regular_season') return 'playoffs';
  if (phase === 'playoffs') return mode === 'full_circuit' ? 'msi_qualification' : 'completed';
  if (phase === 'msi_qualification') return 'msi';
  if (phase === 'msi') return 'midseason_break';
  if (phase === 'midseason_break') return 'second_regional_phase';
  if (phase === 'second_regional_phase') return 'regional_finals';
  if (phase === 'regional_finals') return 'worlds';
  if (phase === 'worlds') return 'offseason';
  if (phase === 'offseason') return 'next_season_setup';
  if (phase === 'next_season_setup') return 'completed';
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
    performance_form: 50,
    morale: 50,
    fatigue: 0,
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
  type:
    | 'movement'
    | 'lane_setup'
    | 'first_blood'
    | 'solo_kill'
    | 'jungle_invade'
    | 'successful_gank'
    | 'failed_gank'
    | 'bot_lane_skirmish'
    | 'mid_roam'
    | 'dragon_secured'
    | 'herald_secured'
    | 'baron_secured'
    | 'elder_secured'
    | 'tower_destroyed'
    | 'shutdown'
    | 'teamfight'
    | 'comeback_fight'
    | 'ace'
    | 'final_push'
    | 'nexus_destroyed'
    | 'series_result'
    // Legacy event values are retained for old saved timelines.
    | 'objective'
    | 'kill'
    | 'fight'
    | 'lead'
    | 'result';
  text: string;
  game_number?: number;
  in_game_minute?: number;
  side?: 'blue' | 'red';
  player_id?: string;
  participant_ids?: string[];
  victim_player_id?: string;
  objective?: 'dragon' | 'herald' | 'baron' | 'elder' | 'tower' | 'nexus';
  action?: 'laning' | 'farming' | 'roaming' | 'ganking' | 'fighting' | 'objective' | 'pushing';
  phase?: 'early_game' | 'first_objectives' | 'mid_game' | 'baron_late_game' | 'final_push';
  importance?: number;
  gold_swing?: number;
  blue_win_probability?: number;
  state?: {
    blue: TimelineTeamState;
    red: TimelineTeamState;
  };
}

export interface TimelineTeamState {
  gold: number;
  gold_lead: number;
  momentum: number;
  objective_control: number;
  map_pressure: number;
  tower_pressure: number;
  teamfight_strength: number;
  comeback_pressure: number;
}

function timelineRoster(players: Player[], teamId: string): Player[] {
  return players
    .filter((player) => player.team_id === teamId && player.status === 'active' && PLAYER_ROLES.includes(player.role))
    .sort((a, b) => PLAYER_ROLES.indexOf(a.role) - PLAYER_ROLES.indexOf(b.role));
}

function average(values: number[], fallback = 50): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function timelineStrength(team: Team, roster: Player[], coach?: Coach): number {
  const playerScore = average(roster.map((player) => (
    player.rating_overall * 0.55
    + player.rating_macro * 0.18
    + player.rating_teamfighting * 0.17
    + player.rating_consistency * 0.1
  )));
  const coachScore = coach
    ? (coach.rating_draft + coach.rating_macro + coach.rating_leadership) / 3
    : 60;
  return playerScore + (coachScore - 60) * 0.08 + ((team.synergy ?? 50) - 50) * 0.05 - (team.fatigue ?? 0) * 0.03;
}

function chooseActor(roster: Player[], roles: Role[], rng: Rng): Player | undefined {
  const candidates = roster.filter((player) => roles.includes(player.role));
  const pool = candidates.length ? candidates : roster;
  if (!pool.length) return undefined;
  const weighted = pool.map((player) => ({
    player,
    weight: Math.max(1, player.rating_overall * 0.45 + player.rating_mechanics * 0.25 + player.rating_macro * 0.2 + player.rating_consistency * 0.1 - 45),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.range(0, total);
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.player;
  }
  return weighted[weighted.length - 1]?.player;
}

function rolesForEvent(type: TimelineEvent['type']): Role[] {
  if (type === 'solo_kill' || type === 'tower_destroyed') return ['TOP', 'MID', 'ADC'];
  if (['jungle_invade', 'successful_gank', 'failed_gank', 'dragon_secured', 'herald_secured', 'baron_secured', 'elder_secured'].includes(type)) return ['JUNGLE', 'SUPPORT'];
  if (type === 'bot_lane_skirmish') return ['ADC', 'SUPPORT'];
  if (type === 'mid_roam') return ['MID', 'SUPPORT', 'JUNGLE'];
  if (['teamfight', 'comeback_fight', 'ace'].includes(type)) return ['ADC', 'MID', 'SUPPORT', 'JUNGLE'];
  if (type === 'final_push' || type === 'nexus_destroyed') return ['ADC', 'TOP', 'MID'];
  return ['JUNGLE', 'MID', 'ADC'];
}

function opposing(side: 'blue' | 'red'): 'blue' | 'red' {
  return side === 'blue' ? 'red' : 'blue';
}

export function buildTimeline(
  match: Match,
  result: MatchSimResult,
  blue: Team,
  red: Team,
  seed: string,
  players: Player[] = [],
  coaches: Coach[] = [],
): TimelineEvent[] {
  const rng = new Rng(`timeline:${seed}`);
  const events: TimelineEvent[] = [];
  const rosters = {
    blue: timelineRoster(players, blue.id),
    red: timelineRoster(players, red.id),
  };
  const strengths = {
    blue: timelineStrength(blue, rosters.blue, coaches.find((coach) => coach.team_id === blue.id && coach.status === 'active')),
    red: timelineStrength(red, rosters.red, coaches.find((coach) => coach.team_id === red.id && coach.status === 'active')),
  };
  let offset = 0;
  for (const game of result.games) {
    const winnerSide = game.winner;
    const loserSide = winnerSide === 'blue' ? 'red' : 'blue';
    const winner = winnerSide === 'blue' ? blue : red;
    const teams = { blue, red };
    const initialBlueProbability = clamp(1 / (1 + Math.exp(-(strengths.blue - strengths.red) / 8)), 0.28, 0.72);
    const isStomp = game.notes.toLowerCase().includes('dominated');
    const comeback = game.was_comeback ?? (!isStomp && rng.bool(game.winner === (initialBlueProbability >= 0.5 ? 'red' : 'blue') ? 0.48 : 0.24));
    const earlyLeader = comeback ? loserSide : (rng.bool(isStomp ? 0.9 : 0.67) ? winnerSide : loserSide);
    const state = {
      blue: { momentum: 50, objectiveControl: 50, mapPressure: 50, towerPressure: 50, teamfightStrength: clamp(strengths.blue, 35, 99) },
      red: { momentum: 50, objectiveControl: 50, mapPressure: 50, towerPressure: 50, teamfightStrength: clamp(strengths.red, 35, 99) },
    };
    let goldLeadBlue = 0;
    let previousMinute = 0;
    const actorName = (player: Player | undefined, side: 'blue' | 'red') => player?.nickname ?? teams[side].short_name;
    const add = (
      inGameMinute: number,
      type: TimelineEvent['type'],
      text: string,
      details: Omit<TimelineEvent, 'minute' | 'type' | 'text' | 'game_number' | 'in_game_minute'> = {},
    ) => {
      const minute = Math.max(previousMinute + (events.length && events[events.length - 1]?.game_number === game.game_number ? 1 : 0), Math.round(inGameMinute));
      previousMinute = minute;
      const side = details.side;
      const importance = details.importance ?? 0;
      const objective = details.objective;
      const swing = details.gold_swing ?? Math.round(importance * (120 + minute * 4));
      if (side) {
        const other = opposing(side);
        const sign = side === 'blue' ? 1 : -1;
        goldLeadBlue += sign * swing;
        state[side].momentum = clamp(state[side].momentum + importance * 3.2, 0, 100);
        state[other].momentum = clamp(state[other].momentum - importance * 1.8, 0, 100);
        state[side].mapPressure = clamp(state[side].mapPressure + importance * 2.2, 0, 100);
        state[other].mapPressure = clamp(state[other].mapPressure - importance, 0, 100);
        if (objective) state[side].objectiveControl = clamp(state[side].objectiveControl + importance * 3, 0, 100);
        if (objective === 'tower' || objective === 'nexus') state[side].towerPressure = clamp(state[side].towerPressure + importance * 3.4, 0, 100);
        if (['teamfight', 'comeback_fight', 'ace', 'baron_secured', 'elder_secured'].includes(type)) {
          state[side].teamfightStrength = clamp(state[side].teamfightStrength + importance * 1.6, 0, 100);
        }
      }
      const baseGold = 2500 + minute * 1500;
      const blueGold = Math.round(baseGold + Math.max(0, goldLeadBlue));
      const redGold = Math.round(baseGold + Math.max(0, -goldLeadBlue));
      let blueWinProbability = clamp(
        initialBlueProbability + goldLeadBlue / 30000 + (state.blue.momentum - state.red.momentum) / 250,
        0.04,
        0.96,
      );
      if (type === 'nexus_destroyed') blueWinProbability = side === 'blue' ? 1 : 0;
      const snapshot = (snapshotSide: 'blue' | 'red'): TimelineTeamState => {
        const ownLead = snapshotSide === 'blue' ? goldLeadBlue : -goldLeadBlue;
        const own = state[snapshotSide];
        return {
          gold: snapshotSide === 'blue' ? blueGold : redGold,
          gold_lead: Math.round(ownLead),
          momentum: Math.round(own.momentum),
          objective_control: Math.round(own.objectiveControl),
          map_pressure: Math.round(own.mapPressure),
          tower_pressure: Math.round(own.towerPressure),
          teamfight_strength: Math.round(own.teamfightStrength),
          comeback_pressure: Math.round(clamp(50 - ownLead / 180 - (own.momentum - 50) * 0.7, 0, 100)),
        };
      };
      events.push({
        minute: offset + minute,
        in_game_minute: minute,
        game_number: game.game_number,
        type,
        text,
        ...details,
        importance,
        gold_swing: side ? swing : 0,
        blue_win_probability: Math.round(blueWinProbability * 1000) / 1000,
        state: { blue: snapshot('blue'), red: snapshot('red') },
      });
    };
    const event = (
      minute: number,
      type: TimelineEvent['type'],
      side: 'blue' | 'red',
      text: (actor: Player | undefined) => string,
      details: Omit<TimelineEvent, 'minute' | 'type' | 'text' | 'game_number' | 'in_game_minute' | 'side' | 'player_id' | 'participant_ids' | 'victim_player_id'> = {},
    ) => {
      const actor = chooseActor(rosters[side], rolesForEvent(type), rng);
      const teammates = rosters[side].filter((player) => player.id !== actor?.id);
      const participantCount = ['teamfight', 'comeback_fight', 'ace', 'baron_secured', 'elder_secured'].includes(type) ? 3 : 1;
      const participantIds = [actor, ...teammates.slice(0, participantCount)].filter((player): player is Player => !!player).map((player) => player.id);
      const victim = chooseActor(rosters[opposing(side)], type === 'solo_kill' ? rolesForEvent(type) : PLAYER_ROLES, rng);
      add(minute, type, text(actor), { ...details, side, player_id: actor?.id, participant_ids: participantIds, victim_player_id: victim?.id });
    };

    add(1, 'lane_setup', `Game ${game.game_number}: lanes settle as both teams contest early vision.`, { phase: 'early_game', action: 'laning' });
    const invadeSide = rng.bool(0.62) ? earlyLeader : opposing(earlyLeader);
    const invadeEvent: TimelineEvent['type'] = rng.bool(0.55) ? 'jungle_invade' : 'failed_gank';
    event(3 + rng.int(0, 1), invadeEvent, invadeSide, (actor) =>
      invadeEvent === 'jungle_invade'
        ? `${actorName(actor, invadeSide)} reads the jungle path and steals an early camp for ${teams[invadeSide].short_name}.`
        : `${teams[invadeSide].short_name} spots the gank early and wastes the opposing jungler's tempo.`,
    { phase: 'early_game', action: 'ganking', importance: 1.2 });
    event(5 + rng.int(0, 1), 'first_blood', earlyLeader, (actor) =>
      `${actorName(actor, earlyLeader)} claims first blood for ${teams[earlyLeader].short_name}.`,
    { phase: 'early_game', action: 'fighting', importance: 2.8 });
    const laneEvent: TimelineEvent['type'] = rng.bool(0.48) ? 'solo_kill' : 'bot_lane_skirmish';
    event(7 + rng.int(0, 1), laneEvent, rng.bool(0.68) ? earlyLeader : opposing(earlyLeader), (actor) =>
      laneEvent === 'solo_kill'
        ? `${actorName(actor, actor?.team_id === blue.id ? 'blue' : 'red')} finds a clean solo kill and takes control of the side lane.`
        : `${actorName(actor, actor?.team_id === blue.id ? 'blue' : 'red')} leads a sharp bot lane skirmish.`,
    { phase: 'early_game', action: 'fighting', importance: 2.1 });
    event(9 + rng.int(0, 1), 'successful_gank', rng.bool(0.62) ? earlyLeader : winnerSide, (actor) =>
      `${actorName(actor, actor?.team_id === blue.id ? 'blue' : 'red')} converts a well-timed gank into lane priority.`,
    { phase: 'early_game', action: 'ganking', importance: 2 });

    const firstObjectiveSide = rng.bool(comeback ? 0.72 : 0.38) ? earlyLeader : winnerSide;
    event(10 + rng.int(0, 1), 'dragon_secured', firstObjectiveSide, (actor) =>
      `${actorName(actor, firstObjectiveSide)} secures the first dragon after ${teams[firstObjectiveSide].short_name} establishes river control.`,
    { phase: 'first_objectives', objective: 'dragon', action: 'objective', importance: 2.4 });
    event(13 + rng.int(0, 1), 'herald_secured', rng.bool(0.72) ? winnerSide : loserSide, (actor) =>
      `${actorName(actor, actor?.team_id === blue.id ? 'blue' : 'red')} controls the top river and takes Rift Herald.`,
    { phase: 'first_objectives', objective: 'herald', action: 'objective', importance: 2.2 });
    event(Math.min(16, game.duration_minutes - 11), 'tower_destroyed', rng.bool(0.68) ? earlyLeader : winnerSide, (actor) =>
      `${actorName(actor, actor?.team_id === blue.id ? 'blue' : 'red')} converts lane pressure into the first tower.`,
    { phase: 'first_objectives', objective: 'tower', action: 'pushing', importance: 2.5 });

    event(Math.min(18, game.duration_minutes - 9), 'mid_roam', rng.bool(0.7) ? winnerSide : loserSide, (actor) =>
      `${actorName(actor, actor?.team_id === blue.id ? 'blue' : 'red')} leaves mid at the right time and creates a numbers advantage.`,
    { phase: 'mid_game', action: 'roaming', importance: 1.8 });
    event(Math.min(21, game.duration_minutes - 7), 'dragon_secured', rng.bool(0.7) ? winnerSide : loserSide, (actor) =>
      `${teams[actor?.team_id === blue.id ? 'blue' : 'red'].short_name} chains vision control into another dragon.`,
    { phase: 'mid_game', objective: 'dragon', action: 'objective', importance: 2.6 });
    const midFightSide = comeback ? loserSide : (rng.bool(0.75) ? winnerSide : loserSide);
    event(Math.min(23, game.duration_minutes - 6), rng.bool(0.45) ? 'shutdown' : 'teamfight', midFightSide, (actor) =>
      midFightSide === winnerSide
        ? `${actorName(actor, midFightSide)} breaks open the mid-game fight for ${winner.short_name}.`
        : `${actorName(actor, midFightSide)} collects a shutdown and keeps ${teams[midFightSide].short_name} in the game.`,
    { phase: 'mid_game', action: 'fighting', importance: 3.2 });

    if (game.duration_minutes >= 27) {
      const lateFightMinute = Math.max(24, game.duration_minutes - 8);
      if (comeback) {
        event(lateFightMinute, 'comeback_fight', winnerSide, (actor) =>
          `${actorName(actor, winnerSide)} finds the comeback engage and flips the game for ${winner.short_name}.`,
        { phase: 'baron_late_game', action: 'fighting', importance: 6.2 });
      } else if (rng.bool(0.5)) {
        event(lateFightMinute, 'ace', winnerSide, (actor) =>
          `${actorName(actor, winnerSide)} powers ${winner.short_name} through an ace around mid river.`,
        { phase: 'baron_late_game', action: 'fighting', importance: 5.4 });
      }
      event(game.duration_minutes - 6, 'baron_secured', winnerSide, (actor) =>
        `${actorName(actor, winnerSide)} wins the vision battle and secures Baron for ${winner.short_name}.`,
      { phase: 'baron_late_game', objective: 'baron', action: 'objective', importance: 5.8 });
    }
    if (game.duration_minutes >= 37) {
      event(game.duration_minutes - 4, 'elder_secured', winnerSide, (actor) =>
        `${actorName(actor, winnerSide)} secures Elder Dragon to end the late-game deadlock.`,
      { phase: 'baron_late_game', objective: 'elder', action: 'objective', importance: 6.5 });
    }
    event(game.duration_minutes - 3, 'final_push', winnerSide, (actor) =>
      `${actorName(actor, winnerSide)} leads ${winner.short_name} through the final push.`,
    { phase: 'final_push', action: 'pushing', importance: 4.5 });
    event(game.duration_minutes, 'nexus_destroyed', winnerSide, () =>
      `${winner.short_name} destroys the nexus and wins game ${game.game_number}.`,
    { phase: 'final_push', objective: 'nexus', action: 'pushing', importance: 8, gold_swing: 0 });
    offset += game.duration_minutes + 3;
  }
  const seriesWinner = result.winner === 'blue' ? blue : red;
  events.push({
    minute: Math.max(1, offset - 2),
    type: 'series_result',
    text: `${seriesWinner.name} wins the ${match.format} series ${result.blue_score}-${result.red_score}.`,
    side: result.winner,
    phase: 'final_push',
    importance: 10,
    blue_win_probability: result.winner === 'blue' ? 1 : 0,
  });
  return events;
}

function distributeTeamTotal(
  total: number,
  roster: Player[],
  seed: string,
  roleWeights: Partial<Record<Role, number>>,
  bonuses: Map<string, number> = new Map(),
): Map<string, number> {
  if (roster.length === 0) return new Map();
  const weighted = roster.map((player) => {
    const variance = new Rng(`${seed}:${player.id}`).range(0.88, 1.12);
    return { player, weight: Math.max(0.05, (roleWeights[player.role] ?? 1) * variance + (bonuses.get(player.id) ?? 0)) };
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
  coaches: Coach[] = [],
): MatchSimulation {
  const started = nowISO();
  const timeline = buildTimeline(match, result, blue, red, seed, players, coaches);
  const totalDuration = result.games.reduce((sum, game) => sum + game.duration_minutes, 0);
  const objectiveTypes = new Set<TimelineEvent['type']>(['dragon_secured', 'herald_secured', 'baron_secured', 'elder_secured', 'tower_destroyed']);
  const sideEvents = (side: 'blue' | 'red') => timeline.filter((event) => event.side === side);
  const countFor = (side: 'blue' | 'red', type: TimelineEvent['type']) => sideEvents(side).filter((event) => event.type === type).length;
  const teamTotals = {
    [blue.id]: {
      kills: result.games.reduce((sum, game) => sum + game.blue_kills, 0),
      gold: result.games.reduce((sum, game) => sum + game.blue_gold, 0),
      towers: result.games.reduce((sum, game) => sum + (game.winner === 'blue' ? 8 : 3), 0),
      dragons: countFor('blue', 'dragon_secured'),
      barons: countFor('blue', 'baron_secured'),
      heralds: countFor('blue', 'herald_secured'),
      elders: countFor('blue', 'elder_secured'),
    },
    [red.id]: {
      kills: result.games.reduce((sum, game) => sum + game.red_kills, 0),
      gold: result.games.reduce((sum, game) => sum + game.red_gold, 0),
      towers: result.games.reduce((sum, game) => sum + (game.winner === 'red' ? 8 : 3), 0),
      dragons: countFor('red', 'dragon_secured'),
      barons: countFor('red', 'baron_secured'),
      heralds: countFor('red', 'herald_secured'),
      elders: countFor('red', 'elder_secured'),
    },
  };
  const finalState = [...timeline].reverse().find((event) => event.state)?.state;
  const initialProbability = timeline.find((event) => event.blue_win_probability != null)?.blue_win_probability ?? 0.5;
  const activePlayers = players.filter(
    (player) => (player.team_id === blue.id || player.team_id === red.id) && player.status === 'active',
  );
  const killsByPlayer = new Map<string, number>();
  const deathsByPlayer = new Map<string, number>();
  const assistsByPlayer = new Map<string, number>();
  const goldByPlayer = new Map<string, number>();
  const keyEventsByPlayer = new Map<string, number>();
  const objectiveEventsByPlayer = new Map<string, number>();
  for (const event of timeline) {
    const participantIds = new Set([event.player_id, ...(event.participant_ids ?? [])].filter((id): id is string => !!id));
    for (const playerId of participantIds) {
      keyEventsByPlayer.set(playerId, (keyEventsByPlayer.get(playerId) ?? 0) + (event.importance ?? 1));
      if (objectiveTypes.has(event.type)) objectiveEventsByPlayer.set(playerId, (objectiveEventsByPlayer.get(playerId) ?? 0) + 1);
    }
  }
  for (const team of [blue, red]) {
    const opponent = team.id === blue.id ? red : blue;
    const roster = activePlayers.filter((player) => player.team_id === team.id);
    const teamKills = teamTotals[team.id].kills;
    const opponentKills = teamTotals[opponent.id].kills;
    const eventBonuses = new Map(roster.map((player) => [player.id, (keyEventsByPlayer.get(player.id) ?? 0) * 0.035]));
    const victimBonuses = new Map(roster.map((player) => [
      player.id,
      timeline.filter((event) => event.victim_player_id === player.id).length * 0.08,
    ]));
    distributeTeamTotal(teamKills, roster, `${seed}:kills`, { TOP: 0.13, JUNGLE: 0.18, MID: 0.24, ADC: 0.34, SUPPORT: 0.11 }, eventBonuses)
      .forEach((value, playerId) => killsByPlayer.set(playerId, value));
    distributeTeamTotal(opponentKills, roster, `${seed}:deaths`, { TOP: 0.22, JUNGLE: 0.2, MID: 0.18, ADC: 0.2, SUPPORT: 0.2 }, victimBonuses)
      .forEach((value, playerId) => deathsByPlayer.set(playerId, value));
    distributeTeamTotal(Math.round(teamKills * 2.45), roster, `${seed}:assists`, { TOP: 0.16, JUNGLE: 0.24, MID: 0.19, ADC: 0.17, SUPPORT: 0.3 }, eventBonuses)
      .forEach((value, playerId) => assistsByPlayer.set(playerId, value));
    const killGoldBonuses = new Map(roster.map((player) => [player.id, (killsByPlayer.get(player.id) ?? 0) * 0.018]));
    distributeTeamTotal(teamTotals[team.id].gold, roster, `${seed}:gold`, { TOP: 0.2, JUNGLE: 0.17, MID: 0.22, ADC: 0.27, SUPPORT: 0.14 }, killGoldBonuses)
      .forEach((value, playerId) => goldByPlayer.set(playerId, value));
  }
  const winningTeamId = result.winner === 'blue' ? blue.id : red.id;
  const stats = activePlayers.map((player, index) => {
    const rng = new Rng(`${seed}:player:${player.id}`);
    const team = player.team_id === blue.id ? blue : red;
    const opponent = player.team_id === blue.id ? red : blue;
    const farmByRole: Partial<Record<Role, number>> = { TOP: 7.1, JUNGLE: 5.6, MID: 7.8, ADC: 8.4, SUPPORT: 1.35 };
    const roleFarm = farmByRole[player.role] ?? 4.5;
    const teamWon = team.id === winningTeamId;
    const kills = killsByPlayer.get(player.id) ?? 0;
    const deaths = deathsByPlayer.get(player.id) ?? 0;
    const assists = assistsByPlayer.get(player.id) ?? 0;
    const cs = Math.round(totalDuration * roleFarm * rng.range(0.94, 1.06));
    const gold = goldByPlayer.get(player.id) ?? 0;
    const teamKills = Math.max(1, teamTotals[team.id].kills);
    const killParticipation = Math.round(clamp((kills + assists) / teamKills * 100, 0, 100));
    const teamObjectiveEvents = Math.max(1, sideEvents(team.id === blue.id ? 'blue' : 'red').filter((event) => objectiveTypes.has(event.type)).length);
    const objectiveParticipation = Math.round(clamp(((objectiveEventsByPlayer.get(player.id) ?? 0) + (['JUNGLE', 'SUPPORT'].includes(player.role) ? teamObjectiveEvents * 0.28 : teamObjectiveEvents * 0.12)) / teamObjectiveEvents * 100, 0, 100));
    const keyEvents = Math.round((keyEventsByPlayer.get(player.id) ?? 0) * 10) / 10;
    const damageImpact = Math.round(clamp(
      player.rating_teamfighting * 0.34 + player.rating_mechanics * 0.2 + kills * 3.6 + assists * 0.75 - deaths * 1.7 + cs / Math.max(35, totalDuration) * 1.5 + keyEvents * 0.42,
      10,
      100,
    ) * 10) / 10;
    const visionUtility = Math.round(clamp(
      player.rating_macro * (player.role === 'SUPPORT' ? 0.62 : player.role === 'JUNGLE' ? 0.42 : 0.16)
      + assists * 1.15
      + objectiveParticipation * 0.28
      + (player.role === 'SUPPORT' ? keyEvents * 0.8 + 18 : 0),
      0,
      100,
    ) * 10) / 10;
    const roleContribution = player.role === 'SUPPORT'
      ? visionUtility * 0.35 + assists * 1.2
      : player.role === 'JUNGLE'
        ? objectiveParticipation * 0.28 + assists * 0.7
        : player.role === 'TOP'
          ? kills * 1.8 + cs / Math.max(1, result.games.length) / 45
          : damageImpact * 0.18;
    const kdaScore = (kills + assists * 0.62) / Math.max(1, deaths) * 4.5;
    const mvpScore = Math.round((
      kdaScore
      + damageImpact * 0.32
      + objectiveParticipation * 0.16
      + roleContribution
      + keyEvents * 0.7
      + (teamWon ? 10 : 0)
    ) * 10) / 10;
    return {
      player_id: player.id,
      team_id: player.team_id ?? '',
      kills,
      deaths,
      assists,
      cs,
      gold,
      level: Math.min(18, 11 + Math.floor((totalDuration / Math.max(1, result.games.length)) / 5) + rng.int(0, 1)),
      kill_participation: killParticipation,
      damage_impact: damageImpact,
      objective_participation: objectiveParticipation,
      vision_utility: visionUtility,
      key_events: keyEvents,
      impact: Math.round((damageImpact * 0.55 + visionUtility * 0.2 + objectiveParticipation * 0.25) * 10) / 10,
      mvp_score: mvpScore,
      games: result.games.length,
      order: index,
      opponent_team_id: opponent.id,
    };
  });
  const ranked = [...stats].sort((a, b) => b.mvp_score - a.mvp_score);
  const mvp = ranked[0];
  const struggling = [...stats].sort((a, b) => a.mvp_score - b.mvp_score)[0];
  const mvpPlayer = activePlayers.find((player) => player.id === mvp?.player_id);
  const strugglingPlayer = activePlayers.find((player) => player.id === struggling?.player_id);
  const comebackEvent = timeline.find((event) => event.side === result.winner && event.type === 'comeback_fight');
  const keyObjective = [...timeline].reverse().find((event) => event.side === result.winner && ['elder_secured', 'baron_secured', 'dragon_secured', 'herald_secured'].includes(event.type));
  const averageGoldDiff = result.games.reduce((sum, game) => sum + Math.abs(game.blue_gold - game.red_gold), 0) / Math.max(1, result.games.length);
  const closeSeries = Math.abs(result.blue_score - result.red_score) === 1 && result.games.length > 1;
  const matchStyle = comebackEvent ? 'comeback' : averageGoldDiff >= 9000 ? 'stomp' : closeSeries || averageGoldDiff < 4500 ? 'close_game' : 'controlled_win';
  const styleText = matchStyle === 'comeback'
    ? 'a comeback win'
    : matchStyle === 'stomp'
      ? 'a dominant stomp'
      : matchStyle === 'close_game'
        ? 'a close, hard-fought win'
        : 'a controlled win';
  const turningPoints = timeline
    .filter((event) => event.side === result.winner && ['shutdown', 'comeback_fight', 'ace', 'baron_secured', 'elder_secured'].includes(event.type))
    .slice(-2)
    .map((event) => event.text);
  const turningPointText = turningPoints[0] ?? 'Their mid-game map pressure decided the series.';
  const objectiveText = keyObjective?.text && keyObjective.text !== turningPointText ? ` ${keyObjective.text}` : '';
  const recap = `${result.winner === 'blue' ? blue.name : red.name} earned ${styleText}. ${turningPointText}${objectiveText} ${mvpPlayer?.nickname ?? 'The winning side'} was MVP, while ${strugglingPlayer?.nickname ?? 'the opposition'} struggled to find impact.`;
  const enrichedTeamStats = {
    [blue.id]: { ...teamTotals[blue.id], state: finalState?.blue, initial_win_probability: initialProbability, final_win_probability: result.winner === 'blue' ? 1 : 0 },
    [red.id]: { ...teamTotals[red.id], state: finalState?.red, initial_win_probability: 1 - initialProbability, final_win_probability: result.winner === 'red' ? 1 : 0 },
  };
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
    final_result: JSON.stringify({
      winner_team_id: winningTeamId,
      blue_score: result.blue_score,
      red_score: result.red_score,
      mvp_player_id: mvp?.player_id,
      standout_player_id: mvp?.player_id,
      struggling_player_id: struggling?.player_id,
      match_style: matchStyle,
      key_objective: keyObjective?.type,
      turning_points: turningPoints,
      recap,
      effects_applied: false,
    }),
    player_stats: JSON.stringify(stats),
    team_stats: JSON.stringify(enrichedTeamStats),
  };
}

interface ConsequenceFinalResult {
  winner_team_id: string;
  effects_applied?: boolean;
  mvp_player_id?: string;
  effects_before?: {
    teams: Record<string, Pick<Team, 'performance_form' | 'morale' | 'synergy' | 'fatigue' | 'updated_at'>>;
    players: Record<string, Pick<Player, 'performance_form' | 'morale' | 'fatigue' | 'value' | 'updated_at'>>;
  };
}

interface ConsequencePlayerStat {
  player_id: string;
  team_id: string;
  mvp_score?: number;
  impact?: number;
  games?: number;
}

export function applyMatchConsequences(
  match: Match,
  simulation: MatchSimulation,
  teams: Team[],
  players: Player[],
  friendliesAffectDevelopment: boolean,
  editableTeamId: string | null = null,
): boolean {
  let finalResult: ConsequenceFinalResult;
  let stats: ConsequencePlayerStat[];
  try {
    finalResult = JSON.parse(simulation.final_result) as ConsequenceFinalResult;
    stats = JSON.parse(simulation.player_stats) as ConsequencePlayerStat[];
  } catch {
    return false;
  }
  if (finalResult.effects_applied || (match.stage === 'friendly' && !friendliesAffectDevelopment)) return false;
  const participantIds = new Set([match.blue_team_id, match.red_team_id]);
  const affectedTeams = teams.filter((team) => participantIds.has(team.id) && (!editableTeamId || team.id === editableTeamId));
  const ranked = [...stats].sort((a, b) => (b.mvp_score ?? b.impact ?? 0) - (a.mvp_score ?? a.impact ?? 0));
  const bestScore = ranked[0]?.mvp_score ?? ranked[0]?.impact ?? 50;
  const worstScore = ranked[ranked.length - 1]?.mvp_score ?? ranked[ranked.length - 1]?.impact ?? 50;
  const friendlyScale = match.stage === 'friendly' ? 0.55 : 1;
  finalResult.effects_before = {
    teams: Object.fromEntries(affectedTeams.map((team) => [team.id, {
      performance_form: team.performance_form,
      morale: team.morale,
      synergy: team.synergy,
      fatigue: team.fatigue,
      updated_at: team.updated_at,
    }])),
    players: {},
  };
  for (const team of affectedTeams) {
    const won = team.id === finalResult.winner_team_id;
    team.performance_form = clamp((team.performance_form ?? 50) + Math.round((won ? 4 : -3) * friendlyScale), 0, 100);
    team.morale = clamp((team.morale ?? 50) + Math.round((won ? 4 : -3) * friendlyScale), 0, 100);
    team.synergy = clamp((team.synergy ?? 50) + Math.max(1, Math.round((won ? 2 : 1) * friendlyScale)), 0, 100);
    team.fatigue = clamp(Math.round((team.fatigue ?? 0) * 0.72 + 5 * friendlyScale), 0, 100);
    team.updated_at = nowISO();
  }
  for (const stat of stats) {
    if (editableTeamId && stat.team_id !== editableTeamId) continue;
    const player = players.find((entry) => entry.id === stat.player_id);
    if (!player || !participantIds.has(stat.team_id)) continue;
    finalResult.effects_before.players[player.id] = {
      performance_form: player.performance_form,
      morale: player.morale,
      fatigue: player.fatigue,
      value: player.value,
      updated_at: player.updated_at,
    };
    const score = stat.mvp_score ?? stat.impact ?? 50;
    const won = stat.team_id === finalResult.winner_team_id;
    const relative = bestScore === worstScore ? 0 : (score - worstScore) / (bestScore - worstScore);
    const formDelta = Math.round(((relative - 0.42) * 7 + (won ? 1.2 : -0.8)) * friendlyScale);
    player.performance_form = clamp((player.performance_form ?? 50) + formDelta, 0, 100);
    player.morale = clamp((player.morale ?? 50) + Math.round((won ? 3 : -2) * friendlyScale), 0, 100);
    player.fatigue = clamp(Math.round((player.fatigue ?? 0) * 0.7 + (stat.games ?? 1) * 4 * friendlyScale), 0, 100);
    if (match.stage !== 'friendly') {
      const valueRate = stat.player_id === finalResult.mvp_player_id ? 0.012 : relative >= 0.8 ? 0.005 : relative <= 0.12 ? -0.003 : 0;
      player.value = Math.max(0, Math.round(player.value * (1 + valueRate)));
    }
    player.updated_at = nowISO();
  }
  finalResult.effects_applied = true;
  simulation.final_result = JSON.stringify(finalResult);
  return true;
}

export function revertMatchConsequences(simulation: MatchSimulation, teams: Team[], players: Player[]): boolean {
  let finalResult: ConsequenceFinalResult;
  try {
    finalResult = JSON.parse(simulation.final_result) as ConsequenceFinalResult;
  } catch {
    return false;
  }
  if (!finalResult.effects_applied || !finalResult.effects_before) return false;
  for (const [teamId, before] of Object.entries(finalResult.effects_before.teams)) {
    const team = teams.find((entry) => entry.id === teamId);
    if (team) Object.assign(team, before);
  }
  for (const [playerId, before] of Object.entries(finalResult.effects_before.players)) {
    const player = players.find((entry) => entry.id === playerId);
    if (player) Object.assign(player, before);
  }
  finalResult.effects_applied = false;
  delete finalResult.effects_before;
  simulation.final_result = JSON.stringify(finalResult);
  return true;
}

import type { Role } from '@/lib/types';
import type { TimelineEvent } from '@/services/run';

export interface SimulationFinalResult {
  winner_team_id: string;
  blue_score: number;
  red_score: number;
  mvp_player_id?: string;
  standout_player_id?: string;
  struggling_player_id?: string;
  match_style?: 'stomp' | 'close_game' | 'comeback' | 'controlled_win';
  key_objective?: string;
  turning_points?: string[];
  recap?: string;
  effects_applied?: boolean;
}

export interface SimulationPlayerStat {
  player_id: string;
  team_id: string;
  kills: number;
  deaths: number;
  assists: number;
  cs?: number;
  gold?: number;
  level?: number;
  impact?: number;
  kill_participation?: number;
  damage_impact?: number;
  objective_participation?: number;
  vision_utility?: number;
  key_events?: number;
  mvp_score?: number;
  games: number;
  order: number;
}

export interface SimulationTeamStat {
  kills: number;
  gold: number;
  towers?: number;
  dragons?: number;
  barons?: number;
  heralds?: number;
  elders?: number;
  initial_win_probability?: number;
  final_win_probability?: number;
  state?: {
    gold?: number;
    gold_lead?: number;
    momentum?: number;
    objective_control?: number;
    map_pressure?: number;
    tower_pressure?: number;
    teamfight_strength?: number;
    comeback_pressure?: number;
  };
}

export type SimulationTeamStats = Record<string, SimulationTeamStat>;
export type PlayerMapStatus = 'laning' | 'farming' | 'roaming' | 'ganking' | 'fighting' | 'recalling' | 'dead' | 'objective' | 'pushing';

export const ROLE_LABEL: Partial<Record<Role, string>> = {
  TOP: 'TOP',
  JUNGLE: 'JG',
  MID: 'MID',
  ADC: 'ADC',
  SUPPORT: 'SUP',
};

export const ROLE_ORDER: Partial<Record<Role, number>> = {
  TOP: 0,
  JUNGLE: 1,
  MID: 2,
  ADC: 3,
  SUPPORT: 4,
  COACH: 5,
  SUBSTITUTE: 6,
};

export function parseSimulationJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseTimeline(value: string | null | undefined): TimelineEvent[] {
  const events = parseSimulationJson<unknown>(value, []);
  if (!Array.isArray(events)) return [];
  return events
    .filter((event): event is TimelineEvent => !!event && typeof event === 'object' && typeof event.minute === 'number' && typeof event.text === 'string')
    .sort((a, b) => a.minute - b.minute);
}

export function simulationDuration(events: TimelineEvent[]): number {
  return Math.max(1, ...events.map((event) => event.minute));
}

export function currentTimelineEvent(events: TimelineEvent[], minute: number): TimelineEvent | undefined {
  return [...events].reverse().find((event) => event.minute <= minute);
}

export function formatSimulationClock(events: TimelineEvent[], minute: number): string {
  const current = currentTimelineEvent(events, minute);
  const game = current?.game_number;
  const inGame = current?.in_game_minute == null
    ? Math.floor(minute)
    : Math.floor(current.in_game_minute + Math.max(0, minute - current.minute));
  const clock = `${String(Math.max(0, inGame)).padStart(2, '0')}:00`;
  return game ? `G${game} ${clock}` : clock;
}

export function scaledStat(finalValue: number | undefined, progress: number, floor = 0): number {
  return Math.max(floor, Math.round((finalValue ?? 0) * Math.max(0, Math.min(1, progress))));
}

export function mapStatus(
  role: Role,
  progress: number,
  event: TimelineEvent | undefined,
  side: 'blue' | 'red',
  playerId: string,
): PlayerMapStatus {
  if (event?.player_id === playerId && event.action) return event.action;
  if (event?.side === side && event?.action === 'fighting') return 'fighting';
  if (event?.side === side && event?.action === 'objective') return 'objective';
  if (event?.side === side && event?.action === 'pushing') return 'pushing';
  if (progress > 0.82) return side === event?.side ? 'pushing' : 'fighting';
  if (progress > 0.5) return role === 'JUNGLE' || role === 'SUPPORT' ? 'roaming' : 'fighting';
  if (role === 'JUNGLE') return progress > 0.18 ? 'ganking' : 'farming';
  if (role === 'SUPPORT' && progress > 0.25) return 'roaming';
  return progress < 0.12 ? 'laning' : 'farming';
}

export function deterministicUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

import { PLAYER_ROLES, type LeagueTier, type Role } from '@/lib/types';
import { LEAGUE_FORMAT_OPTIONS } from '@/lib/constants';
import type { DataPack, DataPackSummary } from './types';

const TIERS: LeagueTier[] = ['tier1', 'tier2', 'regional', 'erl', 'international', 'custom'];
const ROLES: Role[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'COACH', 'SUBSTITUTE'];

export interface DataPackValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

// Validate a data pack's shape and referential integrity. Returns structured
// errors (blocking) and warnings (importable but worth surfacing) rather than
// throwing, so the importer can show problems inline.
export function validateDataPack(input: unknown): DataPackValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (msg: string) => errors.push(msg);

  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['Pack is not an object.'], warnings };
  }
  const pack = input as Partial<DataPack>;

  for (const key of ['id', 'name', 'game', 'season', 'version'] as const) {
    if (!pack[key] || typeof pack[key] !== 'string') fail(`Missing required string field "${key}".`);
  }
  const regions = arr(pack.regions);
  const orgs = arr(pack.organizations);
  const teams = arr(pack.teams);
  const players = arr(pack.players);
  const rosters = arr(pack.rosters);
  const competitions = arr(pack.competitions);

  if (teams.length === 0) fail('Pack has no teams.');
  if (competitions.length === 0) fail('Pack has no competitions.');

  const regionIds = uniqueIds(regions, 'region', fail);
  const orgIds = uniqueIds(orgs, 'organization', fail);
  const teamIds = uniqueIds(teams, 'team', fail);
  const playerIds = uniqueIds(players, 'player', fail);

  for (const team of teams) {
    if (!team.name || !team.short_name) fail(`Team "${team.id}" needs a name and short_name.`);
    if (team.organization_id && !orgIds.has(team.organization_id)) {
      fail(`Team "${team.id}" references unknown organization "${team.organization_id}".`);
    }
    if (team.region_id && !regionIds.has(team.region_id)) {
      fail(`Team "${team.id}" references unknown region "${team.region_id}".`);
    }
    if (team.tier && !TIERS.includes(team.tier)) fail(`Team "${team.id}" has invalid tier "${team.tier}".`);
  }

  for (const player of players) {
    if (!player.handle) fail(`Player "${player.id}" needs a handle.`);
    if (player.role && !ROLES.includes(player.role)) fail(`Player "${player.id}" has invalid role "${player.role}".`);
  }

  for (const roster of rosters) {
    if (!teamIds.has(roster.team_id)) fail(`Roster references unknown team "${roster.team_id}".`);
    const slots = [...arr(roster.starters), ...arr(roster.substitutes)];
    for (const slot of slots) {
      if (!playerIds.has(slot.player_id)) fail(`Roster for "${roster.team_id}" references unknown player "${slot.player_id}".`);
    }
    const coreRoles = new Set(arr(roster.starters).map((s) => s.role ?? players.find((p) => p.id === s.player_id)?.role));
    const missing = PLAYER_ROLES.filter((role) => !coreRoles.has(role));
    if (missing.length) warnings.push(`Roster for "${roster.team_id}" is missing ${missing.join(', ')} (will be auto-filled).`);
  }

  for (const competition of competitions) {
    if (!competition.name) fail(`Competition "${competition.id}" needs a name.`);
    if (competition.tier && !TIERS.includes(competition.tier)) fail(`Competition "${competition.id}" has invalid tier "${competition.tier}".`);
    if (competition.format && !LEAGUE_FORMAT_OPTIONS.includes(competition.format)) {
      fail(`Competition "${competition.id}" has invalid format "${competition.format}".`);
    }
    if (competition.region_id && !regionIds.has(competition.region_id)) {
      fail(`Competition "${competition.id}" references unknown region "${competition.region_id}".`);
    }
    const ids = arr(competition.team_ids);
    if (ids.length < 2) fail(`Competition "${competition.id}" needs at least 2 teams.`);
    for (const id of ids) {
      if (!teamIds.has(id)) fail(`Competition "${competition.id}" references unknown team "${id}".`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function summarizeDataPack(pack: DataPack): DataPackSummary {
  return {
    id: pack.id,
    name: pack.name,
    game: pack.game,
    season: pack.season,
    version: pack.version,
    author: pack.author,
    description: pack.description,
    regionCount: pack.regions.length,
    teamCount: pack.teams.length,
    playerCount: pack.players.length,
    competitionCount: pack.competitions.length,
  };
}

function arr<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueIds(items: Array<{ id?: string }>, label: string, fail: (m: string) => void): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id) {
      fail(`A ${label} is missing an id.`);
      continue;
    }
    if (ids.has(item.id)) fail(`Duplicate ${label} id "${item.id}".`);
    ids.add(item.id);
  }
  return ids;
}

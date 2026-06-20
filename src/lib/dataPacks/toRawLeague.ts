import type { LeagueTier } from '@/lib/types';
import { slugify } from '@/lib/utils';
import type { RawLeague, RawPlayer, RawTeam } from '@/data/rosters';
import type { DataPack, DataPackCompetition, DataPackTeam } from './types';

// Default 1..5 strength centers per tier, used when a team's players carry no
// explicit strength so generated ratings still land in a sensible range.
const TIER_STRENGTH: Record<LeagueTier, number> = {
  tier1: 4.4,
  international: 4.5,
  regional: 3.2,
  tier2: 2.8,
  erl: 2.6,
  custom: 3,
};

function teamStrength(team: DataPackTeam, playerStrengths: number[]): number {
  if (playerStrengths.length) {
    const avg = playerStrengths.reduce((sum, s) => sum + s, 0) / playerStrengths.length;
    return Math.round(avg * 10) / 10;
  }
  return TIER_STRENGTH[team.tier] ?? 3;
}

// Project a single competition in the pack onto a RawLeague the seed builder
// understands. Players named in the roster come through as real entries; any
// missing core role is auto-filled downstream, so partial packs still field a
// full lineup.
export function competitionToRawLeague(pack: DataPack, competition: DataPackCompetition): RawLeague {
  const region = pack.regions.find((r) => r.id === (competition.region_id ?? '')) ?? pack.regions[0];
  const playerById = new Map(pack.players.map((p) => [p.id, p]));
  const rosterByTeam = new Map(
    pack.rosters
      .filter((r) => r.season === (competition.season ?? pack.season) || !competition.season)
      .map((r) => [r.team_id, r]),
  );

  const teams: RawTeam[] = competition.team_ids.flatMap((teamId) => {
    const team = pack.teams.find((t) => t.id === teamId);
    if (!team) return [];
    const org = pack.organizations.find((o) => o.id === team.organization_id);
    const roster = rosterByTeam.get(team.id) ?? pack.rosters.find((r) => r.team_id === team.id);
    const slots = [
      ...(roster?.starters ?? []).map((slot) => ({ slot, star: false })),
      ...(roster?.substitutes ?? []).map((slot) => ({ slot, star: false })),
    ];
    const rawRoster: RawPlayer[] = slots.flatMap(({ slot }) => {
      const player = playerById.get(slot.player_id);
      if (!player) return [];
      return [{
        nick: player.handle,
        name: player.real_name,
        role: slot.role ?? player.role,
        nat: player.nationality ?? region?.short_name ?? 'INTL',
        star: player.star,
      }];
    });
    const strengths = rawRoster
      .map(({ nick }) => pack.players.find((p) => p.handle === nick)?.strength)
      .filter((s): s is number => typeof s === 'number');
    const homeRegion = pack.regions.find((r) => r.id === team.region_id);
    const raw: RawTeam = {
      name: team.name,
      short: team.short_name,
      country: rawRoster[0]?.nat ?? region?.short_name ?? 'INTL',
      strength: teamStrength(team, strengths),
      roster: rawRoster.length ? rawRoster : undefined,
      logo: team.logo ?? org?.logo ?? null,
      region: homeRegion?.name ?? region?.name,
      tier: team.tier,
    };
    return [raw];
  });

  return {
    name: competition.name,
    slug: slugify(`${competition.name}-${competition.season ?? pack.season}`),
    region: region?.name ?? 'Custom',
    tier: competition.tier,
    season: competition.season ?? pack.season,
    format: competition.format,
    source_name: pack.author ?? pack.name,
    source_url: pack.source,
    // Always field full lineups even when a team's roster is partial/empty.
    generateRosters: true,
    teams,
  };
}

// All competitions in the pack, projected to RawLeagues.
export function dataPackToRawLeagues(pack: DataPack): RawLeague[] {
  return pack.competitions.map((competition) => competitionToRawLeague(pack, competition));
}

import type { LeagueFormat, LeagueTier, PlayerCategory, Role } from '@/lib/types';

// ---------------------------------------------------------------------------
// Esports data packs
//
// A data pack is a portable, versioned description of an esports scene:
// regions, organizations, teams, players, rosters and competitions. Packs are
// pure data — never imported directly into UI components. The importer
// (`toRawLeague`) projects a chosen competition onto the existing RawLeague
// seed pipeline, so packs reuse all rating/roster/logo generation and persist
// as ordinary teams/players. This keeps the door open for fictional, community
// and (privately) real packs without changing the storage model.
// ---------------------------------------------------------------------------

export interface DataPackRegion {
  id: string;
  name: string;
  short_name?: string;
  tier?: LeagueTier;
}

export interface DataPackOrganization {
  id: string;
  name: string;
  short_name: string;
  region_id: string;
  logo?: string | null; // public asset path ("/assets/packs/<id>/x.svg") or external URL
  colors?: { primary?: string; secondary?: string };
  active?: boolean;
}

export interface DataPackTeam {
  id: string;
  organization_id: string;
  name: string;
  short_name: string;
  region_id: string;
  tier: LeagueTier;
  logo?: string | null; // overrides the organization logo when set
  colors?: { primary?: string; secondary?: string };
  active?: boolean;
}

export interface DataPackPlayer {
  id: string;
  handle: string; // nickname / in-game handle
  real_name?: string;
  role: Role;
  nationality?: string; // ISO-3166 alpha-2
  age?: number;
  strength?: number; // 1..5 rating center used by the generator
  potential?: number;
  category?: PlayerCategory;
  star?: boolean;
  active?: boolean;
}

export interface DataPackRosterSlot {
  player_id: string;
  role?: Role; // defaults to the player's role
}

export interface DataPackRoster {
  team_id: string;
  season: string;
  split?: string;
  starters: DataPackRosterSlot[];
  substitutes?: DataPackRosterSlot[];
  start_date?: string;
  end_date?: string;
}

export interface DataPackCompetition {
  id: string;
  name: string;
  region_id?: string;
  tier: LeagueTier;
  format: LeagueFormat; // maps to a run/competition template
  season?: string;
  split?: string;
  team_ids: string[]; // participating teams
  qualification_rules?: unknown;
}

export interface DataPackAsset {
  id: string;
  path: string; // public asset path or external URL
  kind?: 'logo' | 'banner' | 'other';
}

export interface DataPack {
  id: string;
  name: string;
  game: string; // e.g. "lol"
  season: string;
  version: string;
  author?: string;
  source?: string;
  description?: string;
  regions: DataPackRegion[];
  organizations: DataPackOrganization[];
  teams: DataPackTeam[];
  players: DataPackPlayer[];
  rosters: DataPackRoster[];
  competitions: DataPackCompetition[];
  assets?: DataPackAsset[];
  created_at?: string;
  updated_at?: string;
}

// Summary used by pack pickers without loading every entity.
export interface DataPackSummary {
  id: string;
  name: string;
  game: string;
  season: string;
  version: string;
  author?: string;
  description?: string;
  regionCount: number;
  teamCount: number;
  playerCount: number;
  competitionCount: number;
}

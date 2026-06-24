import type { LeagueFormat, LeagueTier, PlayerCategory, ReputationMeta, Role } from '@/lib/types';

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

// Optional brand/asset metadata shared by organizations and teams. Every field
// is optional and fallback-safe — missing assets degrade to generated tiles.
export interface BrandAssets {
  logo?: string | null; // public asset path ("/assets/teams/lol/x.svg") or remote URL
  logo_light?: string | null; // variant for light surfaces
  logo_dark?: string | null; // variant for dark surfaces
  colors?: { primary?: string; secondary?: string };
  brand_gradient?: string | null; // CSS gradient string for subtle accents
  asset_credit?: string | null; // attribution text if an asset is bundled
  asset_source_label?: string | null; // human label for the asset source
  aliases?: string[]; // alternate names / past identities
}

export interface DataPackOrganization extends BrandAssets {
  id: string;
  name: string;
  short_name: string;
  region_id: string;
  active?: boolean;
}

export interface DataPackTeam extends BrandAssets {
  id: string;
  organization_id: string;
  name: string;
  short_name: string;
  region_id: string;
  tier: LeagueTier;
  active?: boolean;
  legacy_label?: string | null; // nostalgia tag for historic/legacy orgs
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
  // Optional reputation/canon-bias metadata. When present it biases the
  // player's starting ratings toward their real-world reputation (~80/20).
  reputation?: ReputationMeta;
  // Optional portrait/avatar metadata. All optional & fallback-safe: missing
  // portraits degrade to a deterministic generated avatar.
  portrait_url?: string | null;
  portrait_asset?: string | null;
  avatar_seed?: string | null; // stable seed for the generated avatar
  avatar_style?: string | null; // generated-avatar style hint
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

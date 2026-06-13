// ============================================================================
// Rift League Manager — Domain types
// Mirrors the Supabase/Postgres schema 1:1 so the mock store and a real
// Postgres backend can be swapped without touching the UI or services.
// ============================================================================

export type Role = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'COACH' | 'SUBSTITUTE';
export const PLAYER_ROLES: Role[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

export type LeagueTier =
  | 'tier1' // major region (LCK, LPL, LEC, LCS...)
  | 'tier2' // academy / challenger / development
  | 'regional' // smaller official regions (LJL, LLA, PCS...)
  | 'erl' // emerging regional leagues (LFL, SuperLiga, Prime League...)
  | 'international' // Worlds, MSI, First Stand
  | 'custom';

export type LeagueFormat =
  | 'single_round_robin_bo1'
  | 'double_round_robin_bo1'
  | 'bo3_regular_season'
  | 'bo5_playoffs'
  | 'swiss'
  | 'groups_playoffs'
  | 'double_elim'
  | 'single_elim'
  | 'worlds'
  | 'msi'
  | 'custom_knockout'
  | 'custom_league';

export type PlayerStatus = 'active' | 'benched' | 'free_agent' | 'retired';
export type CoachStatus = 'active' | 'free_agent' | 'retired';

export type MatchStage = 'regular_season' | 'playoffs' | 'final' | 'group_stage' | 'swiss';
export type MatchFormat = 'BO1' | 'BO3' | 'BO5';
export type MatchStatus = 'scheduled' | 'live' | 'completed';

export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type TransferType = 'signing' | 'release' | 'trade' | 'sale';

export type AdminRole = 'owner' | 'admin' | 'manager' | 'viewer';

export type ImportType =
  | 'league'
  | 'teams'
  | 'players'
  | 'coaches'
  | 'schedule'
  | 'results'
  | 'logos'
  | 'full';
export type ImportStatus = 'pending' | 'running' | 'completed' | 'failed';

// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  slug: string;
  region: string;
  tier: LeagueTier;
  season: string;
  logo_url: string | null;
  external_url: string | null;
  source_name: string | null;
  source_url: string | null;
  format: LeagueFormat;
  owner_user_id: string;
  // demo / generated flag
  is_seed?: boolean;
  last_imported_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeagueAdmin {
  id: string;
  league_id: string;
  user_id: string;
  role: AdminRole;
  team_id: string | null;
}

export interface Team {
  id: string;
  league_id: string;
  name: string;
  short_name: string;
  region: string;
  country: string;
  tier: LeagueTier;
  logo_url: string | null;
  banner_url: string | null;
  external_url: string | null;
  source_name: string | null;
  source_url: string | null;
  confidence?: number | null;
  budget: number;
  wins: number;
  losses: number;
  games_won: number;
  games_lost: number;
  points: number;
  form: string; // e.g. "WWLWL" most-recent-first
  generated?: boolean; // true when values were plausibly synthesized
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  league_id: string;
  team_id: string | null;
  real_name: string;
  nickname: string;
  role: Role;
  nationality: string;
  age: number | null;
  image_url: string | null;
  external_url: string | null;
  source_name: string | null;
  source_url: string | null;
  confidence?: number | null;
  value: number;
  salary: number;
  contract_until: string | null;
  rating_overall: number;
  rating_laning: number;
  rating_teamfighting: number;
  rating_macro: number;
  rating_mechanics: number;
  rating_consistency: number;
  status: PlayerStatus;
  generated?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Coach {
  id: string;
  league_id: string;
  team_id: string | null;
  real_name: string;
  nickname: string;
  nationality: string;
  age: number | null;
  image_url: string | null;
  external_url: string | null;
  source_name: string | null;
  source_url: string | null;
  confidence?: number | null;
  rating_draft: number;
  rating_macro: number;
  rating_development: number;
  rating_leadership: number;
  salary: number;
  contract_until: string | null;
  status: CoachStatus;
  generated?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  league_id: string;
  stage: MatchStage;
  week: number;
  match_day: number;
  date_time: string;
  blue_team_id: string;
  red_team_id: string;
  format: MatchFormat;
  status: MatchStatus;
  winner_team_id: string | null;
  blue_score: number;
  red_score: number;
  patch: string | null;
  venue_text: string | null;
  stream_url: string | null;
  external_url: string | null;
  source_name: string | null;
  source_url: string | null;
  // bracket linkage for playoffs
  bracket_slot?: string | null; // e.g. "UB-R1-M1", "LB-R2-M2", "GF"
  feeds_winner_to?: string | null; // match id
  feeds_loser_to?: string | null; // match id
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  match_id: string;
  game_number: number;
  blue_team_id: string;
  red_team_id: string;
  winner_team_id: string;
  duration_minutes: number;
  blue_kills: number;
  red_kills: number;
  blue_gold: number;
  red_gold: number;
  notes: string | null;
}

export interface Trade {
  id: string;
  league_id: string;
  from_team_id: string;
  to_team_id: string;
  money_from_team: number;
  money_to_team: number;
  status: TradeStatus;
  proposed_by_user_id: string;
  reviewed_by_user_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface TradeItem {
  id: string;
  trade_id: string;
  player_id: string;
  from_team_id: string;
  to_team_id: string;
}

export interface TransferRecord {
  id: string;
  league_id: string;
  player_id: string;
  from_team_id: string | null;
  to_team_id: string | null;
  transfer_type: TransferType;
  amount: number;
  created_at: string;
}

export interface ImportSource {
  id: string;
  name: string;
  base_url: string;
  source_type: string;
  enabled: boolean;
  created_at: string;
}

export interface ImportJob {
  id: string;
  league_id: string | null;
  source_name: string;
  import_type: ImportType;
  status: ImportStatus;
  logs: string;
  created_at: string;
  completed_at: string | null;
}

export interface AuditLog {
  id: string;
  league_id: string;
  actor_user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// The full in-memory database shape (also the JSON export/import shape).
// ---------------------------------------------------------------------------
export interface Database {
  profiles: Profile[];
  leagues: League[];
  league_admins: LeagueAdmin[];
  teams: Team[];
  players: Player[];
  coaches: Coach[];
  matches: Match[];
  games: Game[];
  trades: Trade[];
  trade_items: TradeItem[];
  transfer_history: TransferRecord[];
  import_sources: ImportSource[];
  import_jobs: ImportJob[];
  audit_logs: AuditLog[];
}

export const EMPTY_DB: Database = {
  profiles: [],
  leagues: [],
  league_admins: [],
  teams: [],
  players: [],
  coaches: [],
  matches: [],
  games: [],
  trades: [],
  trade_items: [],
  transfer_history: [],
  import_sources: [],
  import_jobs: [],
  audit_logs: [],
};

// A single-league export bundle used by the JSON import/export feature.
export interface LeagueExport {
  format: 'rift-league-manager/v1';
  exported_at: string;
  league: League;
  teams: Team[];
  players: Player[];
  coaches: Coach[];
  matches: Match[];
  games: Game[];
  trades: Trade[];
  trade_items: TradeItem[];
  transfer_history: TransferRecord[];
}

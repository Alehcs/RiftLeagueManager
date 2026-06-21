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

export type MatchStage = 'friendly' | 'regular_season' | 'playoffs' | 'final' | 'group_stage' | 'swiss';
export type MatchFormat = 'BO1' | 'BO3' | 'BO5';
export type MatchStatus = 'scheduled' | 'live' | 'completed';

export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type TransferType = 'signing' | 'release' | 'trade' | 'sale';

export type AdminRole = 'owner' | 'admin' | 'manager' | 'viewer';

export type CompetitionMode = 'quick_tournament' | 'regional_season' | 'full_circuit';
export type TournamentType = 'league' | 'bracket' | 'playoffs' | 'international' | 'circuit';
export type CompetitionScope = 'domestic' | 'international';
export type CircuitStatus = 'setup' | 'active' | 'completed';
export type CircuitStageStatus = 'upcoming' | 'active' | 'completed';
export type QualificationRuleType =
  | 'top_n_standings'
  | 'playoff_champion'
  | 'playoff_finalist'
  | 'points'
  | 'region_slots'
  | 'manual_invite';

export type LeagueRunPhase =
  | 'lobby'
  | 'team_selection'
  | 'roster_reveal'
  | 'preseason_week_1'
  | 'preseason_week_2'
  | 'preseason_week_3'
  | 'regular_season'
  | 'playoffs'
  | 'msi_qualification'
  | 'msi'
  | 'midseason_break'
  | 'second_regional_phase'
  | 'regional_finals'
  | 'worlds'
  | 'offseason'
  | 'next_season_setup'
  | 'completed';

export type PlayerCategory = 'Rookie' | 'Prospect' | 'Starter' | 'Pro' | 'Star' | 'Superstar' | 'Legend';
export type MarketOfferStatus = 'active' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
export type RolePromise = 'starter' | 'rotation' | 'development';
export type SimulationStatus = 'pending' | 'running' | 'completed';

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

export interface GuestSession {
  id: string;
  display_name: string;
  avatar_color: string;
  created_at: string;
  last_seen_at: string;
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
  owner_guest_id: string;
  room_code: string;
  admin_code_hash: string | null;
  owner_user_id?: string | null;
  run_phase?: LeagueRunPhase;
  starting_budget?: number;
  preparation_weeks?: number;
  bot_teams_enabled?: boolean;
  bot_team_count?: number;
  friendlies_affect_development?: boolean;
  market_rules?: string;
  free_agent_offer_window_hours?: number;
  current_run_week?: number;
  run_seed?: string | null;
  run_started_at?: string | null;
  run_completed_at?: string | null;
  competition_mode?: CompetitionMode;
  // demo / generated flag
  is_seed?: boolean;
  last_imported_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeagueAdmin {
  id: string;
  league_id: string;
  guest_id: string;
  user_id?: string | null;
  role: AdminRole;
  team_id: string | null;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  guest_id: string;
  role: AdminRole;
  // The team a manager controls (null for owner/admin/viewer).
  team_id?: string | null;
  joined_at: string;
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
  is_bot?: boolean;
  bot_manager_name?: string | null;
  run_active?: boolean;
  morale?: number;
  synergy?: number;
  performance_form?: number;
  fatigue?: number;
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
  category?: PlayerCategory;
  potential?: number;
  hidden_until_reveal?: boolean;
  performance_form?: number;
  morale?: number;
  fatigue?: number;
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
  competition_key?: string | null;
  circuit_stage_key?: string | null;
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
  proposed_by_guest_id: string;
  reviewed_by_guest_id: string | null;
  proposed_by_user_id?: string | null;
  reviewed_by_user_id?: string | null;
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
  actor_guest_id: string;
  actor_user_id?: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
}

export interface MarketOffer {
  id: string;
  league_id: string;
  player_id: string;
  team_id: string;
  offered_by_guest_id: string;
  transfer_fee: number;
  salary: number;
  role_promise: RolePromise;
  status: MarketOfferStatus;
  submitted_at: string;
  expires_at: string;
  resolved_at: string | null;
  // Optional, additive fields used by bot-generated buy-offers. They carry the
  // selling team at offer time and a short human-readable rationale. No DB
  // migration is needed: data ops run through the store (mock persists these
  // fields verbatim; Supabase entity CRUD is not wired to typed columns).
  reason?: string | null;
  from_team_id?: string | null;
  // Offered contract length in seasons (free-agent offers). Client-only.
  contract_years?: number;
}

export interface MatchSimulation {
  id: string;
  match_id: string;
  league_id: string;
  simulation_seed: string;
  status: SimulationStatus;
  started_by_guest_id: string;
  started_at: string;
  completed_at: string | null;
  event_timeline: string;
  final_result: string;
  player_stats: string;
  team_stats: string;
}

// Portable definitions used by generated/demo content and future data packs.
// Pack IDs and external IDs are intentionally opaque so importing a real or
// historical data set never depends on this app's generated UUIDs.
export interface RegionDefinition {
  key: string;
  name: string;
  short_name: string;
  tier: LeagueTier;
  parent_region_key?: string | null;
  data_pack_id?: string | null;
  external_id?: string | null;
}

export interface DataPackOrganization {
  external_id: string;
  name: string;
  short_name: string;
  region_key: string;
  logo_asset_key?: string | null;
}

export interface DataPackTeam {
  external_id: string;
  organization_external_id: string;
  name: string;
  short_name: string;
  region_key: string;
  tier: 'tier1' | 'tier2' | 'other';
  logo_asset_key?: string | null;
}

export interface DataPackPlayer {
  external_id: string;
  nickname: string;
  real_name: string;
  nationality: string;
  birth_date?: string | null;
  primary_role: Role;
}

export interface DataPackRosterEntry {
  team_external_id: string;
  player_external_id: string;
  season_key: string;
  split_key?: string | null;
  status: PlayerStatus;
  contract_start?: string | null;
  contract_end?: string | null;
  salary?: number | null;
}

export interface CompetitionDataPack {
  schema: 'rift-competition-pack/v1';
  id: string;
  name: string;
  version: string;
  season_keys: string[];
  tier_scope: Array<'tier1' | 'tier2'>;
  regions: RegionDefinition[];
  organizations: DataPackOrganization[];
  teams: DataPackTeam[];
  players: DataPackPlayer[];
  rosters: DataPackRosterEntry[];
  competitions: CompetitionTemplate[];
  assets: Record<string, string>;
}

export interface CompetitionStageDefinition {
  key: string;
  name: string;
  order: number;
  schedule_type: 'none' | 'round_robin' | 'swiss' | 'single_elim' | 'double_elim';
  match_format: MatchFormat;
  advancement: string;
}

export interface QualificationRuleDefinition {
  id: string;
  type: QualificationRuleType;
  source_competition_key: string;
  target_competition_key: string;
  slots: number;
  region_key?: string | null;
  manual_team_ids?: string[];
  label: string;
}

export interface CompetitionTemplate {
  key: string;
  name: string;
  mode: CompetitionMode;
  tournament_type: TournamentType;
  region_scope: 'single_region' | 'multi_region' | 'global';
  team_count: number | null;
  stages: CompetitionStageDefinition[];
  schedule_type: CompetitionStageDefinition['schedule_type'];
  match_format: MatchFormat;
  qualification_rules: QualificationRuleDefinition[];
  advancement_rules: string[];
  affects_standings: boolean;
  affects_ranking: boolean;
  affects_prestige: boolean;
  scope: CompetitionScope;
  data_pack_id?: string | null;
  external_id?: string | null;
}

export interface CircuitCalendarStage {
  key: string;
  name: string;
  order: number;
  status: CircuitStageStatus;
  competition_key: string | null;
  description: string;
}

export interface ActiveCompetition {
  key: string;
  template_key: string;
  name: string;
  tournament_type: TournamentType;
  scope: CompetitionScope;
  status: CircuitStageStatus;
  current_stage_key: string;
  participant_team_ids: string[];
  champion_team_id: string | null;
  stage_progress: StageProgress;
}

export interface StageProgress {
  stage_key: string;
  status: CircuitStageStatus;
  completed_matches: number;
  total_matches: number;
}

export interface QualificationResult {
  rule_id: string;
  target_competition_key: string;
  team_id: string | null;
  reason: string;
  status: 'provisional' | 'qualified' | 'manual_required';
  seed: number;
}

export interface SeasonCircuit {
  id: string;
  league_id: string;
  schema_version: number;
  season_key: string;
  mode: CompetitionMode;
  status: CircuitStatus;
  current_stage_key: string;
  current_competition_key: string | null;
  calendar_json: string;
  competitions_json: string;
  qualification_rules_json: string;
  qualification_results_json: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// The full in-memory database shape (also the JSON export/import shape).
// ---------------------------------------------------------------------------
export interface Database {
  profiles: Profile[];
  guest_sessions: GuestSession[];
  leagues: League[];
  league_admins: LeagueAdmin[];
  league_members: LeagueMember[];
  teams: Team[];
  players: Player[];
  coaches: Coach[];
  matches: Match[];
  games: Game[];
  trades: Trade[];
  trade_items: TradeItem[];
  transfer_history: TransferRecord[];
  market_offers: MarketOffer[];
  match_simulations: MatchSimulation[];
  season_circuits: SeasonCircuit[];
  import_sources: ImportSource[];
  import_jobs: ImportJob[];
  audit_logs: AuditLog[];
}

export const EMPTY_DB: Database = {
  profiles: [],
  guest_sessions: [],
  leagues: [],
  league_admins: [],
  league_members: [],
  teams: [],
  players: [],
  coaches: [],
  matches: [],
  games: [],
  trades: [],
  trade_items: [],
  transfer_history: [],
  market_offers: [],
  match_simulations: [],
  season_circuits: [],
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
  market_offers?: MarketOffer[];
  match_simulations?: MatchSimulation[];
}

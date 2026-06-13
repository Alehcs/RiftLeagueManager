-- ===========================================================================
-- Rift League Manager — initial schema
-- Mirrors src/lib/types.ts. Apply with the Supabase CLI:
--   supabase db push   (or paste into the SQL editor)
-- Mock mode needs none of this; this is the production/shared-DB path.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- profiles -------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- leagues --------------------------------------------------------------------
create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  region text not null,
  tier text not null check (tier in ('tier1','tier2','regional','erl','international','custom')),
  season text not null,
  logo_url text,
  external_url text,
  source_name text,
  source_url text,
  format text not null,
  owner_user_id uuid references profiles(id) on delete set null,
  is_seed boolean default false,
  last_imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists league_admins (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','viewer')),
  team_id uuid,
  unique (league_id, user_id)
);

-- teams ----------------------------------------------------------------------
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  name text not null,
  short_name text not null,
  region text,
  country text,
  tier text,
  logo_url text,
  banner_url text,
  external_url text,
  source_name text,
  source_url text,
  confidence numeric,
  budget bigint not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  games_won int not null default 0,
  games_lost int not null default 0,
  points int not null default 0,
  form text not null default '',
  generated boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists teams_league_idx on teams(league_id);

-- players --------------------------------------------------------------------
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  real_name text,
  nickname text not null,
  role text not null check (role in ('TOP','JUNGLE','MID','ADC','SUPPORT','COACH','SUBSTITUTE')),
  nationality text,
  age int,
  image_url text,
  external_url text,
  source_name text,
  source_url text,
  confidence numeric,
  value bigint not null default 0,
  salary bigint not null default 0,
  contract_until timestamptz,
  rating_overall int not null default 60,
  rating_laning int not null default 60,
  rating_teamfighting int not null default 60,
  rating_macro int not null default 60,
  rating_mechanics int not null default 60,
  rating_consistency int not null default 60,
  status text not null default 'active' check (status in ('active','benched','free_agent','retired')),
  generated boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists players_league_idx on players(league_id);
create index if not exists players_team_idx on players(team_id);

-- coaches --------------------------------------------------------------------
create table if not exists coaches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  real_name text,
  nickname text not null,
  nationality text,
  age int,
  image_url text,
  external_url text,
  source_name text,
  source_url text,
  confidence numeric,
  rating_draft int not null default 60,
  rating_macro int not null default 60,
  rating_development int not null default 60,
  rating_leadership int not null default 60,
  salary bigint not null default 0,
  contract_until timestamptz,
  status text not null default 'active' check (status in ('active','free_agent','retired')),
  generated boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coaches_league_idx on coaches(league_id);

-- matches --------------------------------------------------------------------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  stage text not null check (stage in ('regular_season','playoffs','final','group_stage','swiss')),
  week int not null default 1,
  match_day int not null default 1,
  date_time timestamptz,
  blue_team_id uuid,
  red_team_id uuid,
  format text not null check (format in ('BO1','BO3','BO5')),
  status text not null default 'scheduled' check (status in ('scheduled','live','completed')),
  winner_team_id uuid,
  blue_score int not null default 0,
  red_score int not null default 0,
  patch text,
  venue_text text,
  stream_url text,
  external_url text,
  source_name text,
  source_url text,
  bracket_slot text,
  feeds_winner_to uuid,
  feeds_loser_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists matches_league_idx on matches(league_id);

-- games ----------------------------------------------------------------------
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  game_number int not null,
  blue_team_id uuid,
  red_team_id uuid,
  winner_team_id uuid,
  duration_minutes int,
  blue_kills int,
  red_kills int,
  blue_gold int,
  red_gold int,
  notes text
);
create index if not exists games_match_idx on games(match_id);

-- trades ---------------------------------------------------------------------
create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  from_team_id uuid not null,
  to_team_id uuid not null,
  money_from_team bigint not null default 0,
  money_to_team bigint not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  proposed_by_user_id uuid,
  reviewed_by_user_id uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists trade_items (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references trades(id) on delete cascade,
  player_id uuid not null,
  from_team_id uuid not null,
  to_team_id uuid not null
);

create table if not exists transfer_history (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  player_id uuid not null,
  from_team_id uuid,
  to_team_id uuid,
  transfer_type text not null check (transfer_type in ('signing','release','trade','sale')),
  amount bigint not null default 0,
  created_at timestamptz not null default now()
);

-- import + audit -------------------------------------------------------------
create table if not exists import_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text,
  source_type text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade,
  source_name text not null,
  import_type text not null check (import_type in ('league','teams','players','coaches','schedule','results','logos','full')),
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  logs text default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade,
  actor_user_id uuid,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

-- Realtime: add the live tables to the supabase_realtime publication.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table leagues, teams, players, coaches, matches, games, trades, trade_items, transfer_history, import_jobs';
  end if;
exception when others then null;
end $$;

-- Row Level Security ---------------------------------------------------------
-- Demo-friendly policies: public read everywhere; writes require an authenticated
-- user. Tighten these (e.g. owner/admin checks against league_admins) for prod.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','leagues','league_admins','teams','players','coaches','matches','games',
    'trades','trade_items','transfer_history','import_sources','import_jobs','audit_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('drop policy if exists "auth write" on %I', t);
    execute format('create policy "auth write" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', t);
  end loop;
end $$;

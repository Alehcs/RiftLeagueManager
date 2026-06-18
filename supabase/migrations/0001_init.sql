-- ===========================================================================
-- Rift League Manager — initial schema
-- Mirrors src/lib/types.ts. Apply with the Supabase CLI:
--   supabase db push   (or paste into the SQL editor)
-- Mock mode needs none of this; this is the production/shared-DB path.
-- ===========================================================================

-- pgcrypto powers digest(); on Supabase it lives in the dedicated extensions schema.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- profiles -------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- guest sessions -------------------------------------------------------------
create table if not exists guest_sessions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  display_name text not null check (char_length(display_name) between 2 and 32),
  avatar_color text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
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
  owner_guest_id uuid references guest_sessions(id) on delete set null,
  room_code text unique,
  admin_code_hash text,
  is_seed boolean default false,
  last_imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists league_admins (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  guest_id uuid references guest_sessions(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','viewer')),
  team_id uuid,
  unique (league_id, user_id),
  unique (league_id, guest_id)
);

create table if not exists league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  guest_id uuid not null references guest_sessions(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','manager','viewer')),
  team_id uuid, -- the team a manager controls (null otherwise); FK omitted (teams created later)
  joined_at timestamptz not null default now(),
  unique (league_id, guest_id)
);
create index if not exists league_members_guest_idx on league_members(guest_id);

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
  proposed_by_guest_id uuid references guest_sessions(id) on delete set null,
  reviewed_by_guest_id uuid references guest_sessions(id) on delete set null,
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

-- league runs + market offers + shared simulations ---------------------------
create table if not exists market_offers (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  offered_by_guest_id uuid not null references guest_sessions(id) on delete cascade,
  transfer_fee bigint not null default 0 check (transfer_fee >= 0),
  salary bigint not null default 0 check (salary >= 0),
  role_promise text not null check (role_promise in ('starter','rotation','development')),
  status text not null default 'active' check (status in ('active','accepted','rejected','expired','cancelled')),
  submitted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resolved_at timestamptz
);
create index if not exists market_offers_league_idx on market_offers(league_id);
create index if not exists market_offers_player_idx on market_offers(player_id, status);

create table if not exists match_simulations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references matches(id) on delete cascade,
  league_id uuid not null references leagues(id) on delete cascade,
  simulation_seed text not null,
  status text not null default 'pending' check (status in ('pending','running','completed')),
  started_by_guest_id uuid not null references guest_sessions(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  event_timeline jsonb not null default '[]'::jsonb,
  final_result jsonb not null default '{}'::jsonb,
  player_stats jsonb not null default '[]'::jsonb,
  team_stats jsonb not null default '{}'::jsonb
);
create index if not exists match_simulations_league_idx on match_simulations(league_id);

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
  actor_guest_id uuid references guest_sessions(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

-- Compatibility for projects that applied an earlier version of this migration.
alter table leagues add column if not exists owner_guest_id uuid references guest_sessions(id) on delete set null;
alter table leagues add column if not exists room_code text;
alter table leagues add column if not exists admin_code_hash text;
create unique index if not exists leagues_room_code_idx on leagues(room_code);
update leagues
set room_code = upper(substr(encode(extensions.digest(id::text, 'sha256'), 'hex'), 1, 8))
where room_code is null;
alter table leagues alter column room_code set not null;
alter table league_admins alter column user_id drop not null;
alter table league_admins add column if not exists guest_id uuid references guest_sessions(id) on delete cascade;
create unique index if not exists league_admins_guest_idx on league_admins(league_id, guest_id);
alter table league_members add column if not exists team_id uuid;
alter table trades add column if not exists proposed_by_guest_id uuid references guest_sessions(id) on delete set null;
alter table trades add column if not exists reviewed_by_guest_id uuid references guest_sessions(id) on delete set null;
alter table audit_logs add column if not exists actor_guest_id uuid references guest_sessions(id) on delete set null;
alter table leagues add column if not exists run_phase text not null default 'lobby';
alter table leagues add column if not exists starting_budget bigint not null default 5000000;
alter table leagues add column if not exists preparation_weeks int not null default 3;
alter table leagues add column if not exists bot_teams_enabled boolean not null default false;
alter table leagues add column if not exists bot_team_count int not null default 0;
alter table leagues add column if not exists friendlies_affect_development boolean not null default true;
alter table leagues add column if not exists market_rules text not null default 'Open offers during preseason and between official weeks.';
alter table leagues add column if not exists free_agent_offer_window_hours int not null default 24;
alter table leagues add column if not exists current_run_week int not null default 0;
alter table leagues add column if not exists run_seed text;
alter table leagues add column if not exists run_started_at timestamptz;
alter table leagues add column if not exists run_completed_at timestamptz;
alter table leagues drop constraint if exists leagues_run_phase_check;
alter table leagues add constraint leagues_run_phase_check check (run_phase in (
  'lobby','team_selection','roster_reveal','preseason_week_1','preseason_week_2','preseason_week_3','regular_season','playoffs','completed'
));
alter table leagues drop constraint if exists leagues_preparation_weeks_check;
alter table leagues add constraint leagues_preparation_weeks_check check (preparation_weeks between 1 and 3);
alter table leagues drop constraint if exists leagues_bot_team_count_check;
alter table leagues add constraint leagues_bot_team_count_check check (bot_team_count >= 0);
alter table leagues drop constraint if exists leagues_offer_window_check;
alter table leagues add constraint leagues_offer_window_check check (free_agent_offer_window_hours >= 1);

alter table teams add column if not exists is_bot boolean not null default false;
alter table teams add column if not exists bot_manager_name text;
alter table teams add column if not exists run_active boolean not null default true;
alter table teams add column if not exists morale int not null default 50;
alter table teams add column if not exists synergy int not null default 50;
alter table teams drop constraint if exists teams_morale_check;
alter table teams add constraint teams_morale_check check (morale between 0 and 100);
alter table teams drop constraint if exists teams_synergy_check;
alter table teams add constraint teams_synergy_check check (synergy between 0 and 100);

alter table players add column if not exists category text;
alter table players add column if not exists potential int;
alter table players add column if not exists hidden_until_reveal boolean not null default false;
alter table players drop constraint if exists players_category_check;
alter table players add constraint players_category_check check (category is null or category in ('Rookie','Prospect','Starter','Pro','Star','Superstar','Legend'));
alter table players drop constraint if exists players_potential_check;
alter table players add constraint players_potential_check check (potential is null or potential between 0 and 99);

alter table matches drop constraint if exists matches_stage_check;
alter table matches add constraint matches_stage_check check (stage in ('friendly','regular_season','playoffs','final','group_stage','swiss'));
create unique index if not exists league_members_unique_managed_team_idx
  on league_members(league_id, team_id) where role = 'manager' and team_id is not null;

-- Realtime: add the live tables to the supabase_realtime publication.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'matches','games','teams','players','coaches','trades','trade_items',
      'transfer_history','market_offers','match_simulations','audit_logs','league_members'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
exception when others then null;
end $$;

-- Row Level Security ---------------------------------------------------------
create or replace function public.current_guest_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.guest_sessions where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.has_league_role(target_league_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.leagues
    where id = target_league_id
      and (owner_guest_id = public.current_guest_id() or owner_user_id = auth.uid())
  ) or exists (
    select 1 from public.league_admins
    where league_id = target_league_id
      and (guest_id = public.current_guest_id() or user_id = auth.uid())
      and role = any(allowed_roles)
  );
$$;

revoke all on function public.current_guest_id() from public;
-- True when the current guest may write a given team: an owner/admin of the
-- team's league, or the manager assigned to that team.
create or replace function public.manages_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams t
    where t.id = target_team_id
      and (
        public.has_league_role(t.league_id, array['owner','admin'])
        or exists (
          select 1 from public.league_members m
          where m.league_id = t.league_id
            and m.team_id = target_team_id
            and m.guest_id = public.current_guest_id()
            and m.role = 'manager'
        )
      )
  );
$$;

revoke all on function public.has_league_role(uuid, text[]) from public;
revoke all on function public.manages_team(uuid) from public;
grant execute on function public.current_guest_id() to anon, authenticated;
grant execute on function public.has_league_role(uuid, text[]) to anon, authenticated;
grant execute on function public.manages_team(uuid) to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','guest_sessions','leagues','league_admins','league_members','teams','players','coaches','matches','games',
    'trades','trade_items','transfer_history','market_offers','match_simulations','import_sources','import_jobs','audit_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('drop policy if exists "auth write" on %I', t);
  end loop;
end $$;

drop policy if exists "profile insert self" on profiles;
drop policy if exists "profile update self" on profiles;
drop policy if exists "profile delete self" on profiles;
drop policy if exists "guest sessions insert" on guest_sessions;
drop policy if exists "guest sessions update" on guest_sessions;
drop policy if exists "league insert owner" on leagues;
drop policy if exists "league update admin" on leagues;
drop policy if exists "league delete admin" on leagues;
drop policy if exists "league admins write" on league_admins;
drop policy if exists "league members self join" on league_members;
drop policy if exists "league members self leave" on league_members;
drop policy if exists "league members admin write" on league_members;
drop policy if exists "league members self insert" on league_members;
drop policy if exists "league members self update" on league_members;
drop policy if exists "league members self delete" on league_members;
drop policy if exists "league members admin manage" on league_members;
drop policy if exists "teams write" on teams;
drop policy if exists "teams admin write" on teams;
drop policy if exists "teams manager write" on teams;
drop policy if exists "players write" on players;
drop policy if exists "players admin write" on players;
drop policy if exists "players manager write" on players;
drop policy if exists "coaches write" on coaches;
drop policy if exists "matches write" on matches;
drop policy if exists "games write" on games;
drop policy if exists "trades write" on trades;
drop policy if exists "trades admin write" on trades;
drop policy if exists "trades manager write" on trades;
drop policy if exists "trade items write" on trade_items;
drop policy if exists "trade items admin write" on trade_items;
drop policy if exists "trade items manager write" on trade_items;
drop policy if exists "transfer history write" on transfer_history;
drop policy if exists "transfer history admin write" on transfer_history;
drop policy if exists "transfer history manager write" on transfer_history;
drop policy if exists "market offers admin write" on market_offers;
drop policy if exists "market offers manager write" on market_offers;
drop policy if exists "match simulations admin write" on match_simulations;
drop policy if exists "match simulations friendly write" on match_simulations;
drop policy if exists "matches friendly manager write" on matches;
drop policy if exists "games friendly manager write" on games;
drop policy if exists "audit logs insert" on audit_logs;
drop policy if exists "audit logs write" on audit_logs;
drop policy if exists "import sources write" on import_sources;
drop policy if exists "import jobs write" on import_jobs;

create policy "public read" on profiles for select using (true);

create policy "public read" on guest_sessions for select using (true);
create policy "guest sessions insert" on guest_sessions for insert to authenticated
  with check (auth_user_id = auth.uid());
create policy "guest sessions update" on guest_sessions for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy "public read" on leagues for select using (true);
create policy "league insert owner" on leagues for insert to authenticated
  with check (owner_guest_id = public.current_guest_id());
create policy "league update admin" on leagues for update to authenticated
  using (public.has_league_role(id, array['owner','admin']))
  with check (public.has_league_role(id, array['owner','admin']));
create policy "league delete admin" on leagues for delete to authenticated
  using (public.has_league_role(id, array['owner','admin']));

create policy "public read" on league_admins for select using (true);
create policy "league admins write" on league_admins for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));

create policy "public read" on league_members for select using (true);
-- A guest may add THEMSELVES as a viewer when joining a room.
create policy "league members self insert" on league_members for insert to authenticated
  with check (guest_id = public.current_guest_id() and role = 'viewer');
-- A guest may update/keep THEIR OWN row (the client upserts, so a re-sent row
-- takes the UPDATE arm) but cannot escalate past viewer this way.
create policy "league members self update" on league_members for update to authenticated
  using (guest_id = public.current_guest_id())
  with check (guest_id = public.current_guest_id() and role = 'viewer');
-- A guest may remove their own membership.
create policy "league members self delete" on league_members for delete to authenticated
  using (guest_id = public.current_guest_id());
-- Owners/admins (the creator owns the league row, written first) manage any
-- member: insert/update/delete with any role. Self-escalation is impossible
-- because a non-admin satisfies neither this policy nor the viewer-only self
-- policy; admin is granted only via the owner-creation path or the recovery RPC.
create policy "league members admin manage" on league_members for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));

create policy "public read" on teams for select using (true);
-- Owner/admin manage every team; a manager may update their own team (e.g. budget).
create policy "teams admin write" on teams for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));
create policy "teams manager write" on teams for all to authenticated
  using (public.manages_team(id))
  with check (public.manages_team(id));

create policy "public read" on players for select using (true);
-- Owner/admin manage all players; a manager may move players for their own team
-- and sign free agents in a league they manage in (client upserts, so policies
-- cover the INSERT-with-check + UPDATE arms).
create policy "players admin write" on players for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));
create policy "players manager write" on players for all to authenticated
  using (
    public.manages_team(team_id)
    or (team_id is null and exists (
      select 1 from public.league_members m
      where m.league_id = players.league_id and m.guest_id = public.current_guest_id() and m.role = 'manager'
    ))
  )
  with check (
    public.manages_team(team_id)
    or (team_id is null and exists (
      select 1 from public.league_members m
      where m.league_id = players.league_id and m.guest_id = public.current_guest_id() and m.role = 'manager'
    ))
  );

-- Coaches, matches and games are owner/admin only (managers don't simulate).
create policy "public read" on coaches for select using (true);
create policy "coaches write" on coaches for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));

create policy "public read" on matches for select using (true);
create policy "matches write" on matches for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));
create policy "matches friendly manager write" on matches for all to authenticated
  using (stage = 'friendly' and (public.manages_team(blue_team_id) or public.manages_team(red_team_id)))
  with check (
    stage = 'friendly'
    and (public.manages_team(blue_team_id) or public.manages_team(red_team_id))
    and exists (select 1 from teams where id = blue_team_id and league_id = matches.league_id)
    and exists (select 1 from teams where id = red_team_id and league_id = matches.league_id)
  );

create policy "public read" on games for select using (true);
create policy "games write" on games for all to authenticated
  using (exists (
    select 1 from matches where matches.id = games.match_id
      and public.has_league_role(matches.league_id, array['owner','admin'])
  ))
  with check (exists (
    select 1 from matches where matches.id = games.match_id
      and public.has_league_role(matches.league_id, array['owner','admin'])
  ));
create policy "games friendly manager write" on games for all to authenticated
  using (exists (
    select 1 from matches where matches.id = games.match_id and matches.stage = 'friendly'
      and (public.manages_team(matches.blue_team_id) or public.manages_team(matches.red_team_id))
  ))
  with check (exists (
    select 1 from matches where matches.id = games.match_id and matches.stage = 'friendly'
      and (public.manages_team(matches.blue_team_id) or public.manages_team(matches.red_team_id))
  ));

-- Trades: owner/admin full; a manager may write trades involving their team
-- (propose / reject / cancel). Cross-team acceptance runs via accept_trade().
create policy "public read" on trades for select using (true);
create policy "trades admin write" on trades for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));
create policy "trades manager write" on trades for all to authenticated
  using (public.manages_team(from_team_id) or public.manages_team(to_team_id))
  with check (public.manages_team(from_team_id) or public.manages_team(to_team_id));

create policy "public read" on trade_items for select using (true);
create policy "trade items admin write" on trade_items for all to authenticated
  using (exists (
    select 1 from trades where trades.id = trade_items.trade_id
      and public.has_league_role(trades.league_id, array['owner','admin'])
  ))
  with check (exists (
    select 1 from trades where trades.id = trade_items.trade_id
      and public.has_league_role(trades.league_id, array['owner','admin'])
  ));
create policy "trade items manager write" on trade_items for all to authenticated
  using (exists (
    select 1 from trades where trades.id = trade_items.trade_id
      and (public.manages_team(trades.from_team_id) or public.manages_team(trades.to_team_id))
  ))
  with check (exists (
    select 1 from trades where trades.id = trade_items.trade_id
      and (public.manages_team(trades.from_team_id) or public.manages_team(trades.to_team_id))
  ));

create policy "public read" on transfer_history for select using (true);
create policy "transfer history admin write" on transfer_history for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));
create policy "transfer history manager write" on transfer_history for all to authenticated
  using (public.manages_team(from_team_id) or public.manages_team(to_team_id))
  with check (public.manages_team(from_team_id) or public.manages_team(to_team_id));

create policy "public read" on market_offers for select using (true);
create policy "market offers admin write" on market_offers for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));
create policy "market offers manager write" on market_offers for all to authenticated
  using (offered_by_guest_id = public.current_guest_id() and public.manages_team(team_id))
  with check (
    offered_by_guest_id = public.current_guest_id()
    and public.manages_team(team_id)
    and exists (select 1 from teams where id = market_offers.team_id and league_id = market_offers.league_id)
    and exists (select 1 from players where id = market_offers.player_id and league_id = market_offers.league_id and team_id is null)
  );

create policy "public read" on match_simulations for select using (true);
create policy "match simulations admin write" on match_simulations for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));
create policy "match simulations friendly write" on match_simulations for all to authenticated
  using (exists (
    select 1 from matches where matches.id = match_simulations.match_id and matches.stage = 'friendly'
      and (public.manages_team(matches.blue_team_id) or public.manages_team(matches.red_team_id))
  ))
  with check (started_by_guest_id = public.current_guest_id() and exists (
    select 1 from matches where matches.id = match_simulations.match_id and matches.league_id = match_simulations.league_id and matches.stage = 'friendly'
      and (public.manages_team(matches.blue_team_id) or public.manages_team(matches.red_team_id))
  ));

create policy "public read" on audit_logs for select using (true);
create policy "audit logs write" on audit_logs for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (
    actor_guest_id = public.current_guest_id()
    and public.has_league_role(league_id, array['owner','admin','manager'])
  );

create policy "public read" on import_sources for select using (true);
create policy "import sources write" on import_sources for all to authenticated
  using (public.current_guest_id() is not null) with check (public.current_guest_id() is not null);

create policy "public read" on import_jobs for select using (true);
create policy "import jobs write" on import_jobs for all to authenticated
  using (league_id is null or public.has_league_role(league_id, array['owner','admin','manager']))
  with check (league_id is null or public.has_league_role(league_id, array['owner','admin','manager']));

create or replace function public.recover_league_admin(
  target_room_code text,
  recovery_code text,
  target_guest_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_league_id uuid;
begin
  if public.current_guest_id() is distinct from target_guest_id then
    raise exception 'Guest session mismatch';
  end if;

  select id into target_league_id
  from public.leagues
  where room_code = upper(trim(target_room_code))
    and admin_code_hash = encode(extensions.digest(recovery_code, 'sha256'), 'hex');

  if target_league_id is null then return null; end if;

  insert into public.league_admins (league_id, guest_id, role, team_id)
  values (target_league_id, target_guest_id, 'admin', null)
  on conflict (league_id, guest_id) do update set role = 'admin', team_id = null;

  insert into public.league_members (league_id, guest_id, role)
  values (target_league_id, target_guest_id, 'admin')
  on conflict (league_id, guest_id) do update set role = 'admin';

  return target_league_id;
end;
$$;

revoke all on function public.recover_league_admin(text, text, uuid) from public;
grant execute on function public.recover_league_admin(text, text, uuid) to authenticated;

-- A league member claims an unclaimed team as its manager (self-service).
-- SECURITY DEFINER so it can validate + write past the per-team RLS policies.
create or replace function public.claim_team(
  target_league_id uuid,
  target_team_id uuid,
  target_guest_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_guest_id() is distinct from target_guest_id then
    raise exception 'Guest session mismatch';
  end if;
  if not exists (select 1 from public.teams where id = target_team_id and league_id = target_league_id) then
    raise exception 'Team not found in this league';
  end if;
  if not exists (select 1 from public.leagues where id = target_league_id and run_phase = 'team_selection') then
    raise exception 'Teams can only be claimed during team selection';
  end if;
  if exists (select 1 from public.teams where id = target_team_id and is_bot) then
    raise exception 'That team is assigned to a bot';
  end if;
  if not exists (select 1 from public.league_members where league_id = target_league_id and guest_id = target_guest_id)
     and not exists (select 1 from public.leagues where id = target_league_id and owner_guest_id = target_guest_id) then
    raise exception 'Join the league before claiming a team';
  end if;
  if exists (
    select 1 from public.league_members
    where league_id = target_league_id and team_id = target_team_id and role = 'manager' and guest_id <> target_guest_id
  ) then
    raise exception 'That team already has a manager';
  end if;
  if exists (
    select 1 from public.league_members
    where league_id = target_league_id and guest_id = target_guest_id and role = 'manager'
      and team_id is distinct from target_team_id
  ) then
    raise exception 'You already manage another team in this league';
  end if;
  insert into public.league_members (league_id, guest_id, role, team_id)
  values (target_league_id, target_guest_id, 'manager', target_team_id)
  on conflict (league_id, guest_id) do update set role = 'manager', team_id = target_team_id;
  return true;
end;
$$;

revoke all on function public.claim_team(uuid, uuid, uuid) from public;
grant execute on function public.claim_team(uuid, uuid, uuid) to authenticated;

-- Execute an accepted trade across both teams atomically. SECURITY DEFINER so a
-- single manager can move the counterparty's players/budget after validation.
create or replace function public.accept_trade(target_trade_id uuid, target_guest_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  tr public.trades;
  reviewer_team uuid;
  is_admin boolean;
  item public.trade_items;
begin
  if public.current_guest_id() is distinct from target_guest_id then
    raise exception 'Guest session mismatch';
  end if;
  select * into tr from public.trades where id = target_trade_id;
  if tr.id is null then raise exception 'Trade not found'; end if;
  if tr.status <> 'pending' then raise exception 'Trade is no longer pending'; end if;

  is_admin := public.has_league_role(tr.league_id, array['owner','admin']);
  select team_id into reviewer_team
  from public.league_members
  where league_id = tr.league_id and guest_id = target_guest_id and role = 'manager'
  limit 1;
  if not is_admin and reviewer_team is distinct from tr.to_team_id then
    raise exception 'Only the receiving team manager or an admin can accept this trade';
  end if;

  for item in select * from public.trade_items where trade_id = target_trade_id loop
    update public.players set team_id = item.to_team_id, status = 'active', updated_at = now()
    where id = item.player_id;
    insert into public.transfer_history (league_id, player_id, from_team_id, to_team_id, transfer_type, amount)
    values (tr.league_id, item.player_id, item.from_team_id, item.to_team_id, 'trade', 0);
  end loop;

  update public.teams set budget = budget + (tr.money_to_team - tr.money_from_team), updated_at = now()
  where id = tr.from_team_id;
  update public.teams set budget = budget + (tr.money_from_team - tr.money_to_team), updated_at = now()
  where id = tr.to_team_id;
  update public.trades set status = 'accepted', reviewed_at = now(), reviewed_by_guest_id = target_guest_id
  where id = target_trade_id;
  return true;
end;
$$;

revoke all on function public.accept_trade(uuid, uuid) from public;
grant execute on function public.accept_trade(uuid, uuid) to authenticated;

-- Base table privileges. RLS still gates which ROWS each role can touch; these
-- grants give the anon/authenticated roles table-level access (some Supabase
-- projects do not apply the default public grants). anon is read-only; guests
-- (authenticated via anonymous sign-in) may write, gated by the policies above.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant insert, update, delete on tables to authenticated;

-- Keep auth bindings and recovery hashes out of public room reads.
revoke select on guest_sessions from anon, authenticated;
grant select (id, display_name, avatar_color, created_at, last_seen_at) on guest_sessions to anon, authenticated;
revoke select on leagues from anon, authenticated;
grant select (
  id, name, slug, region, tier, season, logo_url, external_url, source_name, source_url,
  format, owner_user_id, owner_guest_id, room_code, is_seed, last_imported_at,
  run_phase, starting_budget, preparation_weeks, bot_teams_enabled, bot_team_count,
  friendlies_affect_development, market_rules, free_agent_offer_window_hours,
  current_run_week, run_seed, run_started_at, run_completed_at, created_at, updated_at
) on leagues to anon, authenticated;

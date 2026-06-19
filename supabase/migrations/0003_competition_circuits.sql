-- Competition modes and versioned circuit snapshots. All additions are
-- backward compatible: existing leagues become Regional Season runs.

alter table leagues
  add column if not exists competition_mode text not null default 'regional_season';

alter table leagues drop constraint if exists leagues_competition_mode_check;
alter table leagues add constraint leagues_competition_mode_check
  check (competition_mode in ('quick_tournament', 'regional_season', 'full_circuit'));

alter table leagues drop constraint if exists leagues_run_phase_check;
alter table leagues add constraint leagues_run_phase_check check (run_phase in (
  'lobby', 'team_selection', 'roster_reveal',
  'preseason_week_1', 'preseason_week_2', 'preseason_week_3',
  'regular_season', 'playoffs', 'msi_qualification', 'msi',
  'midseason_break', 'second_regional_phase', 'regional_finals',
  'worlds', 'offseason', 'next_season_setup', 'completed'
));

alter table matches add column if not exists competition_key text;
alter table matches add column if not exists circuit_stage_key text;
create index if not exists matches_competition_idx
  on matches (league_id, competition_key, circuit_stage_key);

create table if not exists season_circuits (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null unique references leagues(id) on delete cascade,
  schema_version int not null default 1 check (schema_version > 0),
  season_key text not null,
  mode text not null default 'regional_season'
    check (mode in ('quick_tournament', 'regional_season', 'full_circuit')),
  status text not null default 'setup'
    check (status in ('setup', 'active', 'completed')),
  current_stage_key text not null,
  current_competition_key text,
  calendar_json jsonb not null default '[]'::jsonb,
  competitions_json jsonb not null default '[]'::jsonb,
  qualification_rules_json jsonb not null default '[]'::jsonb,
  qualification_results_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists season_circuits_league_idx on season_circuits(league_id);

alter table season_circuits enable row level security;
drop policy if exists "public read" on season_circuits;
drop policy if exists "season circuits admin write" on season_circuits;
create policy "public read" on season_circuits for select using (true);
create policy "season circuits admin write" on season_circuits for all to authenticated
  using (public.has_league_role(league_id, array['owner','admin']))
  with check (public.has_league_role(league_id, array['owner','admin']));

grant select on season_circuits to anon, authenticated;
grant insert, update, delete on season_circuits to authenticated;
grant select (competition_mode) on leagues to anon, authenticated;

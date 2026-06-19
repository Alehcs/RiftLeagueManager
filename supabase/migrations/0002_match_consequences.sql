-- Bounded manager-sim development state. Simulation detail remains in the
-- existing JSONB columns on match_simulations.
alter table teams add column if not exists performance_form int not null default 50;
alter table teams add column if not exists fatigue int not null default 0;
alter table players add column if not exists performance_form int not null default 50;
alter table players add column if not exists morale int not null default 50;
alter table players add column if not exists fatigue int not null default 0;

alter table teams drop constraint if exists teams_performance_form_check;
alter table teams add constraint teams_performance_form_check check (performance_form between 0 and 100);
alter table teams drop constraint if exists teams_fatigue_check;
alter table teams add constraint teams_fatigue_check check (fatigue between 0 and 100);
alter table players drop constraint if exists players_performance_form_check;
alter table players add constraint players_performance_form_check check (performance_form between 0 and 100);
alter table players drop constraint if exists players_morale_check;
alter table players add constraint players_morale_check check (morale between 0 and 100);
alter table players drop constraint if exists players_fatigue_check;
alter table players add constraint players_fatigue_check check (fatigue between 0 and 100);

import type {
  ActiveCompetition,
  CircuitCalendarStage,
  CompetitionMode,
  CompetitionTemplate,
  Database,
  League,
  LeagueRunPhase,
  Match,
  QualificationResult,
  QualificationRuleDefinition,
  SeasonCircuit,
  Team,
} from '@/lib/types';
import { standingsTable } from '@/services/standings';
import { nowISO, uid } from '@/lib/utils';

export const COMPETITION_MODE_META: Record<CompetitionMode, { label: string; short: string; description: string }> = {
  quick_tournament: {
    label: 'Quick Tournament',
    short: 'Quick',
    description: 'A fast standalone league or bracket with no international qualification or offseason.',
  },
  regional_season: {
    label: 'Regional Season',
    short: 'Regional',
    description: 'Preseason, regional regular season, playoffs, a champion, and optional qualification slots.',
  },
  full_circuit: {
    label: 'Full Competitive Circuit',
    short: 'Full circuit',
    description: 'A complete year spanning regional phases, MSI, Worlds qualification, Worlds, and offseason.',
  },
};

const stage = (
  key: string,
  name: string,
  order: number,
  schedule_type: CompetitionTemplate['schedule_type'],
  match_format: 'BO1' | 'BO3' | 'BO5',
  advancement: string,
) => ({ key, name, order, schedule_type, match_format, advancement });

const msiRules: QualificationRuleDefinition[] = [
  { id: 'msi-champion', type: 'playoff_champion', source_competition_key: 'regional_playoffs', target_competition_key: 'msi', slots: 1, label: 'Regional playoff champion' },
  { id: 'msi-finalist', type: 'playoff_finalist', source_competition_key: 'regional_playoffs', target_competition_key: 'msi', slots: 1, label: 'Regional playoff finalist' },
];

const worldsRules: QualificationRuleDefinition[] = [
  { id: 'worlds-champion', type: 'playoff_champion', source_competition_key: 'regional_finals', target_competition_key: 'worlds', slots: 1, label: 'Regional finals champion' },
  { id: 'worlds-points', type: 'points', source_competition_key: 'second_regional_phase', target_competition_key: 'worlds', slots: 2, label: 'Season points' },
];

export const COMPETITION_TEMPLATES: CompetitionTemplate[] = [
  {
    key: 'quick_league', name: 'Quick League', mode: 'quick_tournament', tournament_type: 'league', region_scope: 'single_region', team_count: null,
    stages: [stage('league', 'League', 1, 'round_robin', 'BO1', 'Best record wins')], schedule_type: 'round_robin', match_format: 'BO1', qualification_rules: [],
    advancement_rules: ['Complete the configured schedule', 'Highest seed is champion'], affects_standings: true, affects_ranking: false, affects_prestige: false, scope: 'domestic',
  },
  {
    key: 'quick_bracket', name: 'Quick Bracket', mode: 'quick_tournament', tournament_type: 'bracket', region_scope: 'single_region', team_count: null,
    stages: [stage('bracket', 'Knockout bracket', 1, 'single_elim', 'BO5', 'Winner advances')], schedule_type: 'single_elim', match_format: 'BO5', qualification_rules: [],
    advancement_rules: ['Single or double elimination', 'Final winner is champion'], affects_standings: false, affects_ranking: false, affects_prestige: false, scope: 'domestic',
  },
  {
    key: 'regional_league', name: 'Regional League', mode: 'regional_season', tournament_type: 'league', region_scope: 'single_region', team_count: null,
    stages: [stage('regular_season', 'Regular season', 1, 'round_robin', 'BO1', 'Top seeds reach playoffs')], schedule_type: 'round_robin', match_format: 'BO1', qualification_rules: [],
    advancement_rules: ['Rank by series wins and game differential'], affects_standings: true, affects_ranking: true, affects_prestige: true, scope: 'domestic',
  },
  {
    key: 'regional_playoffs', name: 'Regional Playoffs', mode: 'regional_season', tournament_type: 'playoffs', region_scope: 'single_region', team_count: 8,
    stages: [stage('playoffs', 'Playoffs', 1, 'single_elim', 'BO5', 'Winner advances')], schedule_type: 'single_elim', match_format: 'BO5', qualification_rules: msiRules,
    advancement_rules: ['Seed from regional standings', 'Final winner is regional champion'], affects_standings: false, affects_ranking: true, affects_prestige: true, scope: 'domestic',
  },
  {
    key: 'msi', name: 'MSI-style International Event', mode: 'full_circuit', tournament_type: 'international', region_scope: 'multi_region', team_count: null,
    stages: [stage('international_bracket', 'International bracket', 1, 'single_elim', 'BO5', 'Winner advances')], schedule_type: 'single_elim', match_format: 'BO5', qualification_rules: msiRules,
    advancement_rules: ['Qualified teams are seeded into a configurable bracket'], affects_standings: false, affects_ranking: true, affects_prestige: true, scope: 'international',
  },
  {
    key: 'worlds', name: 'Worlds-style International Event', mode: 'full_circuit', tournament_type: 'international', region_scope: 'global', team_count: null,
    stages: [stage('international_bracket', 'World championship bracket', 1, 'single_elim', 'BO5', 'Winner advances')], schedule_type: 'single_elim', match_format: 'BO5', qualification_rules: worldsRules,
    advancement_rules: ['Regional slots feed a configurable international format'], affects_standings: false, affects_ranking: true, affects_prestige: true, scope: 'international',
  },
  {
    key: 'full_circuit', name: 'Full Competitive Circuit', mode: 'full_circuit', tournament_type: 'circuit', region_scope: 'global', team_count: null,
    stages: [], schedule_type: 'none', match_format: 'BO1', qualification_rules: [...msiRules, ...worldsRules],
    advancement_rules: ['Calendar checkpoints activate competitions and transfer qualification results'], affects_standings: true, affects_ranking: true, affects_prestige: true, scope: 'domestic',
  },
];

const FULL_CALENDAR = [
  ['preseason', 'Preseason', null, 'Roster preparation, friendlies, market, and trades.'],
  ['regional_regular_season', 'Regional Regular Season', 'regional_league', 'Domestic league schedule and standings.'],
  ['regional_playoffs', 'Regional Playoffs', 'regional_playoffs', 'Top regional seeds play for the title.'],
  ['msi_qualification', 'MSI Qualification', null, 'Apply the configured regional qualification rules.'],
  ['msi', 'MSI', 'msi', 'Mid-season international event.'],
  ['midseason_break', 'Mid-season Break / Transfer Window', null, 'Recovery and roster changes between phases.'],
  ['second_regional_phase', 'Second Regional Phase / Summer-style Split', 'second_regional_phase', 'A configurable later domestic phase.'],
  ['regional_finals', 'Regional Finals / Worlds Qualification', 'regional_finals', 'Final regional seeds and championship points are resolved.'],
  ['worlds', 'Worlds', 'worlds', 'Season-ending international championship.'],
  ['offseason', 'Offseason', null, 'Contracts, transfers, and roster planning.'],
  ['next_season_setup', 'Next Season Setup', null, 'Prepare the next circuit without replacing historical results.'],
] as const;

function calendarFor(mode: CompetitionMode): CircuitCalendarStage[] {
  const rows = mode === 'full_circuit'
    ? FULL_CALENDAR
    : mode === 'regional_season'
      ? [
          ['preseason', 'Preseason', null, 'Roster preparation and friendlies.'],
          ['regional_regular_season', 'Regional Regular Season', 'regional_league', 'Domestic schedule and standings.'],
          ['regional_playoffs', 'Regional Playoffs', 'regional_playoffs', 'Top seeds play for the championship.'],
          ['season_complete', 'Season Complete', null, 'Champion and final results are locked.'],
        ] as const
      : [
          ['quick_setup', 'Quick Setup', null, 'Select teams and reveal rosters.'],
          ['quick_tournament', 'Standalone Tournament', 'quick_tournament', 'Play the configured league or bracket.'],
          ['results', 'Results & Replay', null, 'Champion, match results, and replays remain available.'],
        ] as const;
  return rows.map(([key, name, competition_key, description], order) => ({ key, name, order, status: order === 0 ? 'active' : 'upcoming', competition_key, description }));
}

function competitionsFor(mode: CompetitionMode, league: League): ActiveCompetition[] {
  const domestic = (key: string, template_key: string, name: string, type: ActiveCompetition['tournament_type']): ActiveCompetition => ({
    key, template_key, name, tournament_type: type, scope: 'domestic', status: 'upcoming', current_stage_key: 'setup', participant_team_ids: [], champion_team_id: null,
    stage_progress: { stage_key: 'setup', status: 'upcoming', completed_matches: 0, total_matches: 0 },
  });
  if (mode === 'quick_tournament') {
    const bracket = ['single_elim', 'double_elim', 'custom_knockout'].includes(league.format);
    return [domestic('quick_tournament', bracket ? 'quick_bracket' : 'quick_league', bracket ? 'Quick Bracket' : 'Quick League', bracket ? 'bracket' : 'league')];
  }
  const items = [domestic('regional_league', 'regional_league', 'Regional League', 'league'), domestic('regional_playoffs', 'regional_playoffs', 'Regional Playoffs', 'playoffs')];
  if (mode === 'full_circuit') {
    items.push(domestic('second_regional_phase', 'regional_league', 'Second Regional Phase', 'league'));
    items.push(domestic('regional_finals', 'regional_playoffs', 'Regional Finals', 'playoffs'));
    items.push({ ...domestic('msi', 'msi', 'MSI-style Event', 'international'), scope: 'international' });
    items.push({ ...domestic('worlds', 'worlds', 'Worlds-style Event', 'international'), scope: 'international' });
  }
  return items;
}

export function competitionMode(league: League): CompetitionMode {
  return league.competition_mode ?? 'regional_season';
}

export function createSeasonCircuit(league: League): SeasonCircuit {
  const mode = competitionMode(league);
  const ts = nowISO();
  return {
    id: uid('circuit'), league_id: league.id, schema_version: 1, season_key: league.season, mode, status: 'setup',
    current_stage_key: calendarFor(mode)[0].key, current_competition_key: null,
    calendar_json: JSON.stringify(calendarFor(mode)), competitions_json: JSON.stringify(competitionsFor(mode, league)),
    qualification_rules_json: JSON.stringify(mode === 'full_circuit' ? [...msiRules, ...worldsRules] : []), qualification_results_json: '[]',
    created_at: ts, updated_at: ts,
  };
}

export function parseCircuitCalendar(circuit: SeasonCircuit): CircuitCalendarStage[] {
  return parseJson<CircuitCalendarStage[]>(circuit.calendar_json, []);
}

export function parseCompetitions(circuit: SeasonCircuit): ActiveCompetition[] {
  return parseJson<ActiveCompetition[]>(circuit.competitions_json, []);
}

export function parseQualificationResults(circuit: SeasonCircuit): QualificationResult[] {
  return parseJson<QualificationResult[]>(circuit.qualification_results_json, []);
}

export function phaseStageKey(league: League): string {
  const phase = league.run_phase ?? 'lobby';
  if (competitionMode(league) === 'quick_tournament') {
    if (['lobby', 'team_selection', 'roster_reveal'].includes(phase)) return 'quick_setup';
    if (phase === 'completed') return 'results';
    return 'quick_tournament';
  }
  const map: Partial<Record<LeagueRunPhase, string>> = {
    lobby: 'preseason', team_selection: 'preseason', roster_reveal: 'preseason', preseason_week_1: 'preseason', preseason_week_2: 'preseason', preseason_week_3: 'preseason',
    regular_season: 'regional_regular_season', playoffs: 'regional_playoffs', msi_qualification: 'msi_qualification', msi: 'msi', midseason_break: 'midseason_break',
    second_regional_phase: 'second_regional_phase', regional_finals: 'regional_finals', worlds: 'worlds', offseason: 'offseason', next_season_setup: 'next_season_setup',
    completed: competitionMode(league) === 'regional_season' ? 'season_complete' : 'next_season_setup',
  };
  return map[phase] ?? 'preseason';
}

export function phaseCompetitionKey(league: League): string | null {
  const stageKey = phaseStageKey(league);
  if (stageKey === 'regional_regular_season') return 'regional_league';
  if (stageKey === 'quick_tournament') return 'quick_tournament';
  return ['regional_playoffs', 'msi', 'second_regional_phase', 'regional_finals', 'worlds'].includes(stageKey) ? stageKey : null;
}

// Playable, competitively-meaningful match stages (excludes preseason friendlies).
const REQUIRED_MATCH_STAGES = ['regular_season', 'group_stage', 'swiss', 'playoffs', 'final'];

export interface PhasePendingMatches {
  count: number;
  competitionKey: string;
}

// Required, still-unplayed matches for the league's CURRENT phase. Returns null
// when the phase has no required competition (preseason, roster reveal, MSI
// qualification, mid-season break, offseason, next-season setup, lobby/team
// selection, completed) so advancing through those is never blocked. For league
// and bracket phases alike, a non-completed match in the active competition —
// including not-yet-decided bracket slots — counts as pending, so the guard
// holds until the stage (and its final) is fully played out.
export function pendingPhaseMatches(league: League, matches: Match[]): PhasePendingMatches | null {
  const competitionKey = phaseCompetitionKey(league);
  if (!competitionKey) return null;
  const count = matches.filter(
    (match) =>
      match.league_id === league.id &&
      match.competition_key === competitionKey &&
      REQUIRED_MATCH_STAGES.includes(match.stage) &&
      match.status !== 'completed',
  ).length;
  return count > 0 ? { count, competitionKey } : null;
}

export function syncSeasonCircuit(circuit: SeasonCircuit, league: League, teams: Team[], matches: Match[]): SeasonCircuit {
  const currentStage = phaseStageKey(league);
  const currentCompetition = phaseCompetitionKey(league);
  const calendar = parseCircuitCalendar(circuit).map((item) => ({
    ...item,
    status: item.key === currentStage ? 'active' as const : item.order < (parseCircuitCalendar(circuit).find((entry) => entry.key === currentStage)?.order ?? 0) ? 'completed' as const : 'upcoming' as const,
  }));
  const competitions = parseCompetitions(circuit).map((competition) => {
    const relevant = matches.filter((match) => match.competition_key === competition.key);
    const final = relevant.filter((match) => match.stage === 'final' && match.status === 'completed').sort((a, b) => b.week - a.week)[0];
    const allDone = relevant.length > 0 && relevant.every((match) => match.status === 'completed');
    return {
      ...competition,
      status: competition.key === currentCompetition ? 'active' as const : allDone ? 'completed' as const : 'upcoming' as const,
      current_stage_key: currentStage,
      participant_team_ids: competition.participant_team_ids.length ? competition.participant_team_ids : teams.map((team) => team.id),
      champion_team_id: final?.winner_team_id ?? (allDone && competition.tournament_type === 'league' ? standingsTable(teams, relevant)[0]?.team.id ?? null : null),
      stage_progress: {
        stage_key: currentStage,
        status: competition.key === currentCompetition ? 'active' as const : allDone ? 'completed' as const : 'upcoming' as const,
        completed_matches: relevant.filter((match) => match.status === 'completed').length,
        total_matches: relevant.length,
      },
    };
  });
  const rules = parseJson<QualificationRuleDefinition[]>(circuit.qualification_rules_json, []);
  const results = evaluateQualificationRules(rules, teams, matches);
  return {
    ...circuit, mode: competitionMode(league), status: league.run_phase === 'completed' ? 'completed' : league.run_started_at ? 'active' : 'setup',
    current_stage_key: currentStage, current_competition_key: currentCompetition, calendar_json: JSON.stringify(calendar), competitions_json: JSON.stringify(competitions),
    qualification_results_json: JSON.stringify(results), updated_at: nowISO(),
  };
}

export function evaluateQualificationRules(rules: QualificationRuleDefinition[], teams: Team[], matches: Match[]): QualificationResult[] {
  const out: QualificationResult[] = [];
  const usedByTarget = new Map<string, Set<string>>();
  for (const rule of rules) {
    const used = usedByTarget.get(rule.target_competition_key) ?? new Set<string>();
    usedByTarget.set(rule.target_competition_key, used);
    const sourceMatches = matches.filter((match) => match.competition_key === rule.source_competition_key);
    const final = sourceMatches.filter((match) => match.stage === 'final' && match.status === 'completed').sort((a, b) => b.week - a.week)[0];
    const eligibleTeams = rule.region_key ? teams.filter((team) => team.region === rule.region_key) : teams;
    const sourceTableMatches = sourceMatches.some((match) => ['regular_season', 'group_stage', 'swiss'].includes(match.stage))
      ? sourceMatches
      : matches.filter((match) => ['regular_season', 'group_stage', 'swiss'].includes(match.stage));
    const table = standingsTable(eligibleTeams, sourceTableMatches);
    const sourceComplete = sourceMatches.length > 0 && sourceMatches.every((match) => match.status === 'completed');
    let candidates: string[] = [];
    let confirmed = false;
    if (rule.type === 'playoff_champion' && final?.winner_team_id) { candidates = [final.winner_team_id]; confirmed = true; }
    else if (rule.type === 'playoff_finalist' && final?.winner_team_id) { candidates = [final.winner_team_id === final.blue_team_id ? final.red_team_id : final.blue_team_id]; confirmed = true; }
    else if (rule.type === 'manual_invite') { candidates = rule.manual_team_ids ?? []; confirmed = true; }
    else { candidates = table.map((row) => row.team.id); confirmed = sourceComplete; }
    candidates = candidates.filter((id) => id && !used.has(id)).slice(0, rule.slots);
    for (const teamId of candidates) {
      used.add(teamId);
      const seed = out.filter((result) => result.target_competition_key === rule.target_competition_key && result.team_id).length + 1;
      out.push({ rule_id: rule.id, target_competition_key: rule.target_competition_key, team_id: teamId, reason: confirmed ? rule.label : `Currently qualifying: ${rule.label}`, status: confirmed ? 'qualified' : 'provisional', seed });
    }
    for (let index = candidates.length; index < rule.slots; index++) {
      out.push({ rule_id: rule.id, target_competition_key: rule.target_competition_key, team_id: null, reason: `${rule.label} slot pending`, status: 'manual_required', seed: used.size + 1 });
    }
  }
  return out;
}

export function tagCompetitionMatches(matches: Match[], competitionKey: string, circuitStageKey: string): Match[] {
  return matches.map((match) => ({ ...match, competition_key: competitionKey, circuit_stage_key: circuitStageKey }));
}

export function circuitForLeague(db: Database, league: League): SeasonCircuit {
  return db.season_circuits.find((item) => item.league_id === league.id) ?? createSeasonCircuit(league);
}

// Distinct home regions present among a circuit's active teams.
export function circuitRegions(teams: Team[]): string[] {
  return [...new Set(teams.map((team) => team.region || 'Unknown'))].sort();
}

// Per-region MSI/Worlds qualification rules for a Full Circuit. region_key scopes
// the standings the qualification engine reads, so each region produces its own
// qualifiers from its own regional league.
export function buildRegionQualificationRules(regions: string[]): QualificationRuleDefinition[] {
  return regions.flatMap((region) => [
    { id: `msi-${region}`, type: 'points' as const, source_competition_key: 'regional_league', target_competition_key: 'msi', slots: 1, region_key: region, label: `${region} #1 seed → MSI` },
    { id: `worlds-${region}`, type: 'points' as const, source_competition_key: 'regional_league', target_competition_key: 'worlds', slots: 2, region_key: region, label: `${region} season seed → Worlds` },
  ]);
}

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

'use client';

import Link from 'next/link';
import { CalendarDays, Check, Circle, Clock3, Globe2, Target, Trophy, Users2 } from 'lucide-react';
import { useDb, useLeague } from '@/lib/store/hooks';
import { teamsOf } from '@/lib/store/selectors';
import {
  circuitForLeague,
  circuitRegions,
  COMPETITION_MODE_META,
  parseCircuitCalendar,
  parseCompetitions,
  parseQualificationResults,
  syncSeasonCircuit,
} from '@/services/competition';
import { standingsTable } from '@/services/standings';
import { MatchCard } from '@/components/league/MatchCard';
import { StandingsTable } from '@/components/league/StandingsTable';
import { TeamLogo } from '@/components/ui/image';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Stat } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export default function CompetitionsPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  if (!league) return null;
  const teams = teamsOf(db, league.id);
  const matches = db.matches.filter((match) => match.league_id === league.id);
  const circuit = syncSeasonCircuit(circuitForLeague(db, league), league, teams, matches);
  const calendar = parseCircuitCalendar(circuit);
  const competitions = parseCompetitions(circuit);
  const qualificationResults = parseQualificationResults(circuit);
  const active = competitions.find((competition) => competition.key === circuit.current_competition_key)
    ?? competitions.find((competition) => competition.status === 'active')
    ?? (circuit.status === 'completed' ? [...competitions].reverse().find((competition) => competition.champion_team_id) : undefined);
  const activeMatches = active ? matches.filter((match) => match.competition_key === active.key) : [];
  const upcoming = activeMatches.filter((match) => match.status !== 'completed' && match.blue_team_id && match.red_team_id).slice(0, 4);
  const completedCount = activeMatches.filter((match) => match.status === 'completed').length;
  const completed = activeMatches.filter((match) => match.status === 'completed').sort((a, b) => +new Date(b.date_time) - +new Date(a.date_time)).slice(0, 4);
  const activeTeams = active ? teams.filter((team) => active.participant_team_ids.includes(team.id)) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Globe2 size={20} className="text-rift-cyan" /><h2 className="text-xl font-bold text-slate-100">Competition circuit</h2></div>
          <p className="mt-1 text-sm text-slate-500">{COMPETITION_MODE_META[circuit.mode].description}</p>
        </div>
        <Badge color="#a78bfa">{COMPETITION_MODE_META[circuit.mode].label}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays size={16} /> Season calendar</CardTitle></CardHeader>
        <CardBody>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {calendar.map((item) => (
              <div key={item.key} className={cn('rounded-lg border p-3', item.status === 'active' ? 'border-rift-cyan bg-rift-cyan/10' : 'border-border bg-bg-soft/30')}>
                <div className="flex items-center gap-2">
                  {item.status === 'completed' ? <Check size={14} className="text-rift-green" /> : item.status === 'active' ? <Clock3 size={14} className="text-rift-cyan" /> : <Circle size={12} className="text-slate-600" />}
                  <span className={cn('text-sm font-semibold', item.status === 'active' ? 'text-rift-cyan' : 'text-slate-200')}>{item.name}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {circuit.mode === 'full_circuit' && (
        <RegionalLeagues teams={teams} matches={matches} results={qualificationResults} leagueId={league.id} />
      )}

      {circuit.mode === 'full_circuit' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <QualificationCard target="msi" title="MSI qualification" results={qualificationResults} teams={teams} matches={matches} />
          <QualificationCard target="worlds" title="Worlds qualification" results={qualificationResults} teams={teams} matches={matches} />
        </div>
      )}

      {active ? (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
            <Stat label="Active competition" value={active.name} />
            <Stat label="Scope" value={active.scope === 'international' ? 'International' : 'Domestic'} />
            <Stat label="Participants" value={activeTeams.length} />
            <Stat label="Progress" value={`${completedCount}/${activeMatches.length}`} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy size={16} className="text-rift-gold" /> {active.name}</CardTitle>
              <Link href={active.tournament_type === 'league' ? `/leagues/${league.id}/standings` : `/leagues/${league.id}/playoffs`}><Button size="sm" variant="outline">Full {active.tournament_type === 'league' ? 'standings' : 'bracket'}</Button></Link>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Users2 size={13} /> Participating teams</div>
                <div className="flex flex-wrap gap-2">{activeTeams.map((team) => <div key={team.id} className="flex items-center gap-2 rounded-lg border border-border bg-bg-soft/30 px-2 py-1.5 text-xs text-slate-300"><TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} size="xs" /> {team.short_name}</div>)}</div>
              </div>
              {active.tournament_type === 'league' && activeMatches.length > 0 && <StandingsTable teams={activeTeams} matches={activeMatches} leagueId={league.id} compact limit={8} />}
            </CardBody>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <MatchList title="Upcoming matches" matches={upcoming} leagueId={league.id} empty="No ready matches in this stage." />
            <MatchList title="Completed matches" matches={completed} leagueId={league.id} empty="No completed matches in this stage." />
          </div>
        </>
      ) : <EmptyState title="No active competition" hint="Complete setup to activate this circuit." />}
    </div>
  );
}

function RegionalLeagues({ teams, matches, results, leagueId }: { teams: ReturnType<typeof teamsOf>; matches: ReturnType<typeof useDb>['matches']; results: ReturnType<typeof parseQualificationResults>; leagueId: string }) {
  const regions = circuitRegions(teams);
  const regionalMatches = matches.filter((m) => m.competition_key === 'regional_league');
  const qualifiedIds = (target: string) => new Set(results.filter((r) => r.target_competition_key === target && r.team_id).map((r) => r.team_id));
  const msiIds = qualifiedIds('msi');
  const worldsIds = qualifiedIds('worlds');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe2 size={16} className="text-rift-cyan" /> Regional leagues</CardTitle>
        <Badge color="#26d0ce">{regions.length} region{regions.length === 1 ? '' : 's'} in parallel</Badge>
      </CardHeader>
      <CardBody className="grid gap-4 lg:grid-cols-2">
        {regions.map((region) => {
          const regionTeams = teams.filter((t) => (t.region || 'Unknown') === region);
          const rMatches = regionalMatches.filter((m) => regionTeams.some((t) => t.id === m.blue_team_id || t.id === m.red_team_id));
          const played = rMatches.filter((m) => m.status === 'completed').length;
          return (
            <div key={region} className="rounded-lg border border-border bg-bg-soft/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-slate-200">{region}</span>
                <span className="text-[11px] text-slate-500">{regionTeams.length} teams · {played}/{rMatches.length} played</span>
              </div>
              {rMatches.length ? <StandingsTable teams={regionTeams} matches={rMatches} leagueId={leagueId} compact limit={6} /> : <p className="py-2 text-xs text-slate-500">Schedule pending.</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {regionTeams.filter((t) => msiIds.has(t.id)).map((t) => <Badge key={t.id} color="#22c55e">MSI · {t.short_name}</Badge>)}
                {regionTeams.filter((t) => worldsIds.has(t.id) && !msiIds.has(t.id)).map((t) => <Badge key={t.id} color="#c8a85a">Worlds · {t.short_name}</Badge>)}
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function QualificationCard({ target, title, results, teams, matches }: { target: string; title: string; results: ReturnType<typeof parseQualificationResults>; teams: ReturnType<typeof teamsOf>; matches: ReturnType<typeof useDb>['matches'] }) {
  const targetResults = results.filter((result) => result.target_competition_key === target);
  const qualifiedIds = new Set(targetResults.flatMap((result) => result.team_id ? [result.team_id] : []));
  const bubble = standingsTable(teams, matches).filter((row) => !qualifiedIds.has(row.team.id)).slice(0, 2);
  const remaining = targetResults.filter((result) => !result.team_id).length;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Target size={15} /> {title}</CardTitle><Badge color={remaining ? '#f59e0b' : '#22c55e'}>{remaining} slots open</Badge></CardHeader>
      <CardBody className="space-y-3">
        {targetResults.map((result, index) => {
          const team = teams.find((item) => item.id === result.team_id);
          return <div key={`${result.rule_id}-${index}`} className="flex items-center gap-3 rounded-lg border border-border p-2"><span className="w-5 text-center text-xs font-bold text-slate-600">{index + 1}</span>{team ? <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} size="xs" /> : <Circle size={18} className="text-slate-700" />}<div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-200">{team?.name ?? 'Slot pending'}</div><div className="text-xs text-slate-500">{result.reason}</div></div><Badge color={result.status === 'qualified' ? '#22c55e' : '#f59e0b'}>{result.status}</Badge></div>;
        })}
        <div className="border-t border-border pt-3"><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Bubble teams</div><div className="text-sm text-slate-400">{bubble.length ? bubble.map((row) => row.team.short_name).join(' · ') : 'No remaining bubble teams'}</div></div>
      </CardBody>
    </Card>
  );
}

function MatchList({ title, matches, leagueId, empty }: { title: string; matches: ReturnType<typeof useDb>['matches']; leagueId: string; empty: string }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardBody className="space-y-2">{matches.length ? matches.map((match) => <MatchCard key={match.id} match={match} leagueId={leagueId} />) : <p className="text-sm text-slate-500">{empty}</p>}</CardBody></Card>;
}

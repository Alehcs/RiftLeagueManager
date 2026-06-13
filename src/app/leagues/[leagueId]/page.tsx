'use client';

import Link from 'next/link';
import { ArrowRight, Crown, TrendingUp } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canManage } from '@/lib/store/hooks';
import { teamsOf, matchesOf, playersOf } from '@/lib/store/selectors';
import { standingsTable } from '@/services/standings';
import { StandingsTable } from '@/components/league/StandingsTable';
import { MatchCard } from '@/components/league/MatchCard';
import { SimControls } from '@/components/league/SimControls';
import { Card, CardHeader, CardTitle, CardBody, Stat, EmptyState } from '@/components/ui/primitives';
import { OverallBadge, RoleBadge } from '@/components/ui/rating';
import { PlayerAvatar } from '@/components/ui/image';
import { ROLE_META } from '@/lib/constants';

export default function LeagueOverview({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  if (!league) return null;

  const teams = teamsOf(db, league.id);
  const matches = matchesOf(db, league.id);
  const players = playersOf(db, league.id).filter((p) => p.team_id);
  const completed = matches.filter((m) => m.status === 'completed');
  const recent = [...completed].sort((a, b) => +new Date(b.date_time) - +new Date(a.date_time)).slice(0, 5);
  const upcoming = matches
    .filter((m) => m.status !== 'completed' && m.blue_team_id && m.red_team_id)
    .sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time))
    .slice(0, 5);
  const table = standingsTable(teams, matches);
  const leader = table[0];
  const topPlayers = [...players].sort((a, b) => b.rating_overall - a.rating_overall).slice(0, 5);

  return (
    <div className="space-y-6">
      {canManage(role) && (
        <Card className="flex flex-col items-start justify-between gap-3 p-3 sm:flex-row sm:items-center">
          <div className="px-1 text-sm text-slate-400">
            <span className="font-medium text-slate-200">Simulation</span> — play out matches & advance the season.
          </div>
          <SimControls leagueId={league.id} compact />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        <Stat label="Teams" value={teams.length} />
        <Stat label="Matches played" value={`${completed.length}/${matches.length}`} />
        <Stat label="Rostered players" value={players.length} />
        <Stat
          label="Leader"
          value={leader ? leader.team.short_name : '—'}
          sub={leader ? `${leader.wins}-${leader.losses}` : undefined}
          accent="#c8a85a"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Standings</CardTitle>
            <Link href={`/leagues/${league.id}/standings`} className="flex items-center gap-1 text-xs text-rift-cyan hover:underline">
              Full table <ArrowRight size={13} />
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {teams.length ? (
              <StandingsTable teams={teams} matches={matches} leagueId={league.id} limit={8} compact />
            ) : (
              <div className="p-4">
                <EmptyState title="No teams yet" hint="Add teams from the admin panel." />
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Crown size={15} className="text-rift-gold" /> Top rated players
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {topPlayers.map((p, i) => {
              const team = teams.find((t) => t.id === p.team_id);
              return (
                <Link
                  key={p.id}
                  href={`/leagues/${league.id}/players`}
                  className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-bg-elevated"
                >
                  <span className="w-4 text-center text-xs font-bold text-slate-600">{i + 1}</span>
                  <PlayerAvatar name={p.nickname} src={p.image_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-slate-100">{p.nickname}</span>
                      <RoleBadge role={p.role} />
                    </div>
                    <div className="truncate text-[11px] text-slate-500">{team?.name ?? 'Free agent'}</div>
                  </div>
                  <OverallBadge value={p.rating_overall} size="sm" />
                </Link>
              );
            })}
            {topPlayers.length === 0 && <p className="text-sm text-slate-500">No players yet.</p>}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <TrendingUp size={15} className="text-rift-green" /> Recent results
            </CardTitle>
            <Link href={`/leagues/${league.id}/schedule`} className="text-xs text-rift-cyan hover:underline">
              Schedule →
            </Link>
          </CardHeader>
          <CardBody className="space-y-2">
            {recent.length ? (
              recent.map((m) => <MatchCard key={m.id} match={m} leagueId={league.id} />)
            ) : (
              <EmptyState title="No results yet" hint="Simulate matches to populate results." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {upcoming.length ? (
              upcoming.map((m) => <MatchCard key={m.id} match={m} leagueId={league.id} />)
            ) : (
              <EmptyState title="Nothing scheduled" hint="All matches have been played." />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

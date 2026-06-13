'use client';

import Link from 'next/link';
import { Play, Trophy } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canManage } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { matchesOf } from '@/lib/store/selectors';
import { MatchCard } from '@/components/league/MatchCard';
import { SimControls } from '@/components/league/SimControls';
import { Button, Card, CardBody, EmptyState } from '@/components/ui/primitives';

export default function SchedulePage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const simulateWeek = useStore((s) => s.simulateWeek);
  if (!league) return null;
  const manage = canManage(role);

  const matches = matchesOf(db, league.id);
  const leaguePortion = matches.filter((m) => ['regular_season', 'group_stage', 'swiss'].includes(m.stage));
  const bracket = matches.filter((m) => ['playoffs', 'final'].includes(m.stage));

  const weeks = [...new Set(leaguePortion.map((m) => m.week))].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Schedule</h2>
          <p className="text-sm text-slate-500">{leaguePortion.length} matches across {weeks.length} weeks</p>
        </div>
        {manage && <SimControls leagueId={league.id} compact />}
      </div>

      {weeks.length === 0 && bracket.length === 0 && (
        <EmptyState
          title="No schedule yet"
          hint="Generate a schedule from the admin panel."
          action={
            <Link href={`/leagues/${league.id}/admin`}>
              <Button variant="primary" size="sm">Go to admin</Button>
            </Link>
          }
        />
      )}

      {weeks.map((week) => {
        const wMatches = leaguePortion.filter((m) => m.week === week).sort((a, b) => a.match_day - b.match_day || +new Date(a.date_time) - +new Date(b.date_time));
        const pending = wMatches.filter((m) => m.status !== 'completed' && m.blue_team_id && m.red_team_id);
        const stageLabel = wMatches[0]?.stage === 'group_stage' ? `Group Round ${week}` : wMatches[0]?.stage === 'swiss' ? `Swiss Round ${week}` : `Week ${week}`;
        return (
          <div key={week}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-bg-elevated px-1.5 text-xs text-slate-400">{week}</span>
                {stageLabel}
                <span className="text-xs font-normal text-slate-600">
                  {wMatches.filter((m) => m.status === 'completed').length}/{wMatches.length} played
                </span>
              </h3>
              {manage && pending.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => simulateWeek(league.id, week)}>
                  <Play size={13} /> Sim week
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {wMatches.map((m) => (
                <MatchCard key={m.id} match={m} leagueId={league.id} />
              ))}
            </div>
          </div>
        );
      })}

      {bracket.length > 0 && (
        <Card>
          <CardBody className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Trophy size={16} className="text-rift-gold" />
              {bracket.length} playoff matches in the bracket.
            </div>
            <Link href={`/leagues/${league.id}/playoffs`}>
              <Button variant="secondary" size="sm">View bracket</Button>
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

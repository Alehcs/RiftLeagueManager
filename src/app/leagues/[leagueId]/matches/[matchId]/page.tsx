'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Play, RotateCcw, Save, Swords, Clock, Coins } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canAdminister } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { teamById, gamesOf, playersOf, coachesOf, simulationOf } from '@/lib/store/selectors';
import { computeTeamStrength } from '@/services/strength';
import { seriesWinProbability } from '@/services/simulation';
import { TeamLogo } from '@/components/ui/image';
import { Button, Card, CardHeader, CardTitle, CardBody, Badge } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form';
import { MatchStatusBadge } from '@/components/common/badges';
import { cn, formatDateTime, formatPercent } from '@/lib/utils';
import type { TimelineEvent } from '@/services/run';

export default function MatchDetailPage({ params }: { params: { leagueId: string; matchId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const simulate = useStore((s) => s.simulateMatch);
  const reset = useStore((s) => s.resetMatch);
  const setResult = useStore((s) => s.setMatchResult);
  const match = db.matches.find((m) => m.id === params.matchId);
  const simulation = simulationOf(db, params.matchId);

  const [blueScore, setBlueScore] = useState('');
  const [redScore, setRedScore] = useState('');

  if (!league || !match) return <p className="text-slate-500">Match not found.</p>;
  const blue = teamById(db, match.blue_team_id);
  const red = teamById(db, match.red_team_id);
  const games = gamesOf(db, match.id);
  const manage = canAdminister(role);
  const isDone = match.status === 'completed';

  const blueWon = match.winner_team_id === match.blue_team_id;
  const allPlayers = playersOf(db, league.id);
  const allCoaches = coachesOf(db, league.id);
  const bStr = blue ? computeTeamStrength(blue, allPlayers, allCoaches) : null;
  const rStr = red ? computeTeamStrength(red, allPlayers, allCoaches) : null;
  const pBlue = bStr && rStr ? seriesWinProbability(match.format, bStr, rStr) : 0.5;

  const saveManual = () => {
    const b = Math.max(0, parseInt(blueScore || `${match.blue_score}`, 10) || 0);
    const r = Math.max(0, parseInt(redScore || `${match.red_score}`, 10) || 0);
    setResult(match.id, b, r);
  };

  return (
    <div className="space-y-6">
      <Link href={`/leagues/${league.id}/schedule`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
        <ChevronLeft size={14} /> Schedule
      </Link>

      {/* Scoreboard */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-center gap-2 border-b border-border bg-bg-soft/50 py-2 text-xs text-slate-500">
          <Badge color="#8b5cf6">{match.bracket_slot ?? `Week ${match.week}`}</Badge>
          <Badge color="#64748b">{match.format}</Badge>
          <MatchStatusBadge status={match.status} />
          {match.patch && <span>Patch {match.patch}</span>}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-5 sm:gap-6 sm:p-8">
          <TeamColumn teamId={match.blue_team_id} leagueId={league.id} win={isDone && blueWon} side="blue" />
          <div className="text-center">
            {isDone ? (
              <div className="flex items-center gap-2 text-4xl font-extrabold tabular-nums sm:text-6xl">
                <span className={blueWon ? 'text-rift-cyan' : 'text-slate-600'}>{match.blue_score}</span>
                <span className="text-slate-700">:</span>
                <span className={!blueWon ? 'text-rift-cyan' : 'text-slate-600'}>{match.red_score}</span>
              </div>
            ) : (
              <Swords size={32} className="mx-auto text-slate-600" />
            )}
            <div className="mt-1 text-[11px] text-slate-600">{match.date_time && formatDateTime(match.date_time)}</div>
          </div>
          <TeamColumn teamId={match.red_team_id} leagueId={league.id} win={isDone && !blueWon} side="red" />
        </div>

        {/* Win probability */}
        {blue && red && (
          <div className="border-t border-border px-5 py-3">
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>{blue.short_name} {formatPercent(pBlue)}</span>
              <span>win probability</span>
              <span>{formatPercent(1 - pBlue)} {red.short_name}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-bg-soft">
              <div className="bg-rift-cyan/80" style={{ width: `${pBlue * 100}%` }} />
              <div className="bg-rift-red/60" style={{ width: `${(1 - pBlue) * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-600">
              <span>Strength {bStr?.score}</span>
              <span>Strength {rStr?.score}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Admin controls */}
      {manage && (
        <Card>
          <CardHeader>
            <CardTitle>Result controls</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap items-end gap-3">
            <Button variant="primary" size="sm" disabled={match.status !== 'scheduled'} onClick={() => simulate(match.id)}>
              <Play size={14} /> Start match
            </Button>
            <Button variant="ghost" size="sm" onClick={() => reset(match.id)}>
              <RotateCcw size={14} /> Reset
            </Button>
            <div className="flex items-end gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">{blue?.short_name} score</label>
                <Input type="number" min={0} className="w-20" placeholder={`${match.blue_score}`} value={blueScore} onChange={(e) => setBlueScore(e.target.value)} />
              </div>
              <span className="pb-2 text-slate-600">:</span>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">{red?.short_name} score</label>
                <Input type="number" min={0} className="w-20" placeholder={`${match.red_score}`} value={redScore} onChange={(e) => setRedScore(e.target.value)} />
              </div>
              <Button variant="secondary" size="sm" onClick={saveManual}>
                <Save size={14} /> Save result
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {simulation && <SimulationTimeline timelineJson={simulation.event_timeline} completed={simulation.status === 'completed'} />}

      {/* Games */}
      {games.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Games ({games.length})</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {games.map((g) => {
              const gBlueWon = g.winner_team_id === g.blue_team_id;
              const goldDiff = Math.abs(g.blue_gold - g.red_gold);
              return (
                <div key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-400">G{g.game_number}</span>
                  <span className={cn('font-medium', gBlueWon ? 'text-rift-cyan' : 'text-slate-400')}>{blue?.short_name}</span>
                  <span className="tabular-nums text-slate-300">
                    {g.blue_kills} <span className="text-slate-600">-</span> {g.red_kills}
                  </span>
                  <span className={cn('font-medium', !gBlueWon ? 'text-rift-cyan' : 'text-slate-400')}>{red?.short_name}</span>
                  <span className="ml-auto flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock size={12} /> {g.duration_minutes}:00</span>
                    <span className="flex items-center gap-1"><Coins size={12} /> {(goldDiff / 1000).toFixed(1)}k {gBlueWon ? blue?.short_name : red?.short_name}</span>
                  </span>
                  {g.notes && <span className="w-full text-[11px] text-slate-600">{g.notes}</span>}
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SimulationTimeline({ timelineJson, completed }: { timelineJson: string; completed: boolean }) {
  const events = parseTimeline(timelineJson);
  const [visible, setVisible] = useState(completed ? events.length : 1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    setVisible(1);
    const timer = window.setInterval(() => {
      setVisible((count) => {
        if (count >= events.length) {
          window.clearInterval(timer);
          setPlaying(false);
          return count;
        }
        return count + 1;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [events.length, playing]);

  return (
    <Card>
      <CardHeader><CardTitle>Shared simulation timeline</CardTitle><Button size="sm" variant="outline" onClick={() => setPlaying(true)}><Play size={13} /> {completed ? 'Watch replay' : 'Watch simulation'}</Button></CardHeader>
      <CardBody className="space-y-2">
        {events.slice(0, visible).map((event, index) => <div key={`${event.minute}-${index}`} className="flex gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-sm"><span className="w-10 shrink-0 font-semibold tabular-nums text-rift-cyan">{event.minute}&apos;</span><span className="text-slate-300">{event.text}</span></div>)}
      </CardBody>
    </Card>
  );
}

function parseTimeline(value: string): TimelineEvent[] {
  try {
    const parsed = JSON.parse(value) as TimelineEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function TeamColumn({ teamId, leagueId, win, side }: { teamId: string; leagueId: string; win: boolean; side: 'blue' | 'red' }) {
  const db = useDb();
  const team = teamById(db, teamId);
  if (!team) return <div className="text-center text-slate-600">TBD</div>;
  return (
    <Link href={`/leagues/${leagueId}/teams/${team.id}`} className="flex flex-col items-center gap-2 text-center group">
      <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} size="xl" className={cn(win && 'ring-2 ring-rift-cyan')} />
      <div>
        <div className={cn('font-bold group-hover:text-rift-cyan', win ? 'text-slate-50' : 'text-slate-300')}>{team.name}</div>
        <div className="text-[11px] uppercase tracking-wide" style={{ color: side === 'blue' ? '#3b82f6' : '#ef4444' }}>
          {side} side
        </div>
      </div>
    </Link>
  );
}

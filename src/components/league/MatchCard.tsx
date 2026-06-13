'use client';

import Link from 'next/link';
import { cn, formatDateTime } from '@/lib/utils';
import type { Match } from '@/lib/types';
import { useDb } from '@/lib/store/hooks';
import { teamById } from '@/lib/store/selectors';
import { TeamLogo } from '@/components/ui/image';
import { Badge } from '@/components/ui/primitives';
import { MatchStatusBadge } from '@/components/common/badges';

function Side({ teamId, score, winner, align }: { teamId: string; score: number; winner: boolean; align: 'left' | 'right' }) {
  const db = useDb();
  const team = teamById(db, teamId);
  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-2', align === 'right' && 'flex-row-reverse text-right')}>
      {team ? (
        <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} size="sm" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[9px] text-slate-600">TBD</div>
      )}
      <span className={cn('min-w-0 truncate text-sm', winner ? 'font-bold text-slate-100' : 'text-slate-300')}>
        {team?.short_name ?? 'TBD'}
      </span>
    </div>
  );
}

export function MatchCard({ match, leagueId }: { match: Match; leagueId: string }) {
  const isDone = match.status === 'completed';
  const blueWon = isDone && match.winner_team_id === match.blue_team_id;
  const redWon = isDone && match.winner_team_id === match.red_team_id;

  return (
    <Link
      href={`/leagues/${leagueId}/matches/${match.id}`}
      className="block rounded-xl border border-border bg-bg-card/70 p-3 transition-all hover:border-border-soft hover:bg-bg-elevated/70"
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          {match.bracket_slot ? (
            <Badge color="#8b5cf6">{match.bracket_slot}</Badge>
          ) : (
            <span>Week {match.week}</span>
          )}
          <Badge color="#64748b">{match.format}</Badge>
        </span>
        <MatchStatusBadge status={match.status} />
      </div>

      <div className="flex items-center gap-2">
        <Side teamId={match.blue_team_id} score={match.blue_score} winner={blueWon} align="left" />
        <div className="shrink-0 px-1">
          {isDone ? (
            <div className="flex items-center gap-1 text-lg font-bold tabular-nums">
              <span className={blueWon ? 'text-rift-cyan' : 'text-slate-500'}>{match.blue_score}</span>
              <span className="text-slate-600">:</span>
              <span className={redWon ? 'text-rift-cyan' : 'text-slate-500'}>{match.red_score}</span>
            </div>
          ) : (
            <span className="text-xs font-medium text-slate-600">vs</span>
          )}
        </div>
        <Side teamId={match.red_team_id} score={match.red_score} winner={redWon} align="right" />
      </div>

      {match.date_time && !isDone && (
        <div className="mt-2 text-center text-[11px] text-slate-600">{formatDateTime(match.date_time)}</div>
      )}
    </Link>
  );
}

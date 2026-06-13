'use client';

import Link from 'next/link';
import type { Match } from '@/lib/types';
import { useDb } from '@/lib/store/hooks';
import { teamById } from '@/lib/store/selectors';
import { TeamLogo } from '@/components/ui/image';
import { cn } from '@/lib/utils';

function BracketMatch({ match, leagueId }: { match: Match; leagueId: string }) {
  const db = useDb();
  const blue = teamById(db, match.blue_team_id);
  const red = teamById(db, match.red_team_id);
  const done = match.status === 'completed';
  const blueWon = done && match.winner_team_id === match.blue_team_id;
  const redWon = done && match.winner_team_id === match.red_team_id;

  const Row = ({ team, score, won }: { team?: ReturnType<typeof teamById>; score: number; won: boolean }) => (
    <div className={cn('flex items-center gap-2 px-2 py-1.5', won && 'bg-rift-cyan/10')}>
      {team ? (
        <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} size="xs" />
      ) : (
        <div className="h-6 w-6 rounded border border-dashed border-border" />
      )}
      <span className={cn('flex-1 truncate text-xs', won ? 'font-bold text-slate-100' : 'text-slate-400')}>
        {team?.short_name ?? 'TBD'}
      </span>
      <span className={cn('text-sm font-bold tabular-nums', won ? 'text-rift-cyan' : 'text-slate-500')}>{done ? score : '–'}</span>
    </div>
  );

  return (
    <Link
      href={`/leagues/${leagueId}/matches/${match.id}`}
      className="block w-44 overflow-hidden rounded-lg border border-border bg-bg-card transition-colors hover:border-rift-cyan/40"
    >
      <div className="border-b border-border/60 bg-bg-soft/40 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
        {match.bracket_slot} · {match.format}
      </div>
      <Row team={blue} score={match.blue_score} won={blueWon} />
      <div className="h-px bg-border/60" />
      <Row team={red} score={match.red_score} won={redWon} />
    </Link>
  );
}

function Column({ title, matches, leagueId }: { title: string; matches: Match[]; leagueId: string }) {
  if (!matches.length) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="flex flex-1 flex-col justify-around gap-4">
        {matches.map((m) => (
          <BracketMatch key={m.id} match={m} leagueId={leagueId} />
        ))}
      </div>
    </div>
  );
}

export function BracketView({ matches, leagueId }: { matches: Match[]; leagueId: string }) {
  const isDouble = matches.some((m) => m.bracket_slot?.startsWith('LB-'));

  if (isDouble) {
    const ub = matches.filter((m) => m.bracket_slot?.startsWith('UB-'));
    const lb = matches.filter((m) => m.bracket_slot?.startsWith('LB-'));
    const gf = matches.filter((m) => m.bracket_slot === 'GF');
    const byWeek = (list: Match[]) => {
      const weeks = [...new Set(list.map((m) => m.week))].sort((a, b) => a - b);
      return weeks.map((w) => list.filter((m) => m.week === w));
    };
    return (
      <div className="space-y-8">
        <div>
          <div className="mb-2 text-sm font-semibold text-rift-cyan">Upper Bracket</div>
          <div className="flex gap-6 overflow-x-auto pb-2">
            {byWeek(ub).map((col, i) => (
              <Column key={i} title={`Round ${i + 1}`} matches={col} leagueId={leagueId} />
            ))}
            {gf.length > 0 && <Column title="Grand Final" matches={gf} leagueId={leagueId} />}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-rift-red/80">Lower Bracket</div>
          <div className="flex gap-6 overflow-x-auto pb-2">
            {byWeek(lb).map((col, i) => (
              <Column key={i} title={`LB Round ${i + 1}`} matches={col} leagueId={leagueId} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // single elim — columns by week
  const weeks = [...new Set(matches.map((m) => m.week))].sort((a, b) => a - b);
  return (
    <div className="flex gap-6 overflow-x-auto pb-2">
      {weeks.map((w, i) => {
        const col = matches.filter((m) => m.week === w);
        const isFinal = col.some((m) => m.stage === 'final');
        return <Column key={w} title={isFinal ? 'Final' : `Round ${i + 1}`} matches={col} leagueId={leagueId} />;
      })}
    </div>
  );
}

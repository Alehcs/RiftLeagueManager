'use client';

import Link from 'next/link';
import { cn, formatPercent } from '@/lib/utils';
import type { Match, Team } from '@/lib/types';
import { standingsTable } from '@/services/standings';
import { TeamLogo } from '@/components/ui/image';
import { FormPips } from './FormPips';

export function StandingsTable({
  teams,
  matches,
  leagueId,
  group,
  limit,
  playoffCutoff,
  compact,
}: {
  teams: Team[];
  matches: Match[];
  leagueId: string;
  group?: string;
  limit?: number;
  playoffCutoff?: number;
  compact?: boolean;
}) {
  const rows = standingsTable(teams, matches, group);
  const shown = limit ? rows.slice(0, limit) : rows;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 text-center font-medium">W</th>
            <th className="px-3 py-2 text-center font-medium">L</th>
            {!compact && <th className="px-3 py-2 text-center font-medium">Games</th>}
            {!compact && <th className="px-3 py-2 text-center font-medium">Win%</th>}
            <th className="px-3 py-2 text-center font-medium">Diff</th>
            {!compact && <th className="px-3 py-2 font-medium">Form</th>}
            <th className="px-3 py-2 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const inPlayoffs = playoffCutoff != null && r.position <= playoffCutoff;
            const cutLine = playoffCutoff != null && r.position === playoffCutoff;
            return (
              <tr
                key={r.team.id}
                className={cn(
                  'group border-b border-border/60 transition-colors hover:bg-bg-elevated/60',
                  cutLine && 'border-b-2 border-b-rift-cyan/30',
                )}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {inPlayoffs && <span className="h-3 w-0.5 rounded-full bg-rift-cyan" />}
                    <span className={cn('tabular-nums', r.position <= 3 ? 'font-bold text-slate-200' : 'text-slate-500')}>
                      {r.position}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/leagues/${leagueId}/teams/${r.team.id}`} className="flex items-center gap-2.5 hover:text-rift-cyan">
                    <TeamLogo name={r.team.name} shortName={r.team.short_name} src={r.team.logo_url} color={r.team.color_primary} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-100 group-hover:text-rift-cyan">{r.team.name}</span>
                      <span className="block text-[10px] text-slate-500">{r.team.short_name}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-center font-semibold tabular-nums text-rift-green">{r.wins}</td>
                <td className="px-3 py-2 text-center font-semibold tabular-nums text-rift-red/80">{r.losses}</td>
                {!compact && (
                  <td className="px-3 py-2 text-center tabular-nums text-slate-400">
                    {r.gamesWon}-{r.gamesLost}
                  </td>
                )}
                {!compact && (
                  <td className="px-3 py-2 text-center tabular-nums text-slate-400">{r.played ? formatPercent(r.winRate) : '—'}</td>
                )}
                <td className={cn('px-3 py-2 text-center tabular-nums', r.gameDiff > 0 ? 'text-rift-green' : r.gameDiff < 0 ? 'text-rift-red/80' : 'text-slate-500')}>
                  {r.gameDiff > 0 ? '+' : ''}
                  {r.gameDiff}
                </td>
                {!compact && (
                  <td className="px-3 py-2">
                    <FormPips form={r.form} />
                  </td>
                )}
                <td className="px-3 py-2 text-right text-base font-bold tabular-nums text-slate-100">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shown.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">No teams to rank yet.</p>}
    </div>
  );
}

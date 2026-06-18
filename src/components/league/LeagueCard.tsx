'use client';

import Link from 'next/link';
import { Users, Swords, ChevronRight } from 'lucide-react';
import type { League } from '@/lib/types';
import { TeamLogo } from '@/components/ui/image';
import { TierBadge, RegionBadge, FormatBadge, RunPhaseBadge } from '@/components/common/badges';
import { runPhase } from '@/services/run';
import { Card } from '@/components/ui/primitives';
import { useDb } from '@/lib/store/hooks';
import { teamsOf, playersOf, matchesOf } from '@/lib/store/selectors';

export function LeagueCard({ league }: { league: League }) {
  const db = useDb();
  const teams = teamsOf(db, league.id);
  const players = playersOf(db, league.id);
  const matches = matchesOf(db, league.id);
  const completed = matches.filter((m) => m.status === 'completed').length;
  const progress = matches.length ? Math.round((completed / matches.length) * 100) : 0;

  return (
    <Link href={`/leagues/${league.id}/lobby`}>
      <Card hover className="group h-full overflow-hidden">
        <div className="relative h-20 bg-gradient-to-br from-bg-elevated to-bg-soft">
          <div
            className="absolute inset-0 opacity-30"
            style={{ backgroundImage: 'radial-gradient(400px 120px at 30% -20%, rgba(38,208,206,0.25), transparent)' }}
          />
          <div className="absolute -bottom-5 left-4">
            <TeamLogo name={league.name} src={league.logo_url} size="lg" className="rounded-xl ring-4 ring-bg-card" />
          </div>
          <div className="absolute right-3 top-3 flex gap-1.5">
            <TierBadge tier={league.tier} />
            <RegionBadge region={league.region} />
          </div>
        </div>
        <div className="px-4 pb-4 pt-7">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 group-hover:text-rift-cyan">{league.name}</h3>
              <p className="text-xs text-slate-500">{league.season}</p>
            </div>
            <ChevronRight size={18} className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-rift-cyan" />
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Swords size={13} /> {teams.length} teams
            </span>
            <span className="flex items-center gap-1">
              <Users size={13} /> {players.length} players
            </span>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-slate-500">
              <FormatBadge format={league.format} />
              <RunPhaseBadge phase={runPhase(league)} />
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-bg-soft">
              <div className="h-full rounded-full bg-rift-cyan/80" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

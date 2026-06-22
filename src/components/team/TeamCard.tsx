'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import type { Team } from '@/lib/types';
import { PLAYER_ROLES } from '@/lib/types';
import { useDb } from '@/lib/store/hooks';
import { playersOf, coachesOf } from '@/lib/store/selectors';
import { computeTeamStrength } from '@/services/strength';
import { TeamLogo, PlayerAvatar } from '@/components/ui/image';
import { Card, Badge } from '@/components/ui/primitives';
import { RegionBadge } from '@/components/common/badges';
import { RoleBadge } from '@/components/ui/rating';
import { formatMoney, ratingColor } from '@/lib/utils';

export function TeamCard({ team }: { team: Team }) {
  const db = useDb();
  const players = playersOf(db, team.league_id);
  const coaches = coachesOf(db, team.league_id);
  const strength = computeTeamStrength(team, players, coaches);
  const starters = PLAYER_ROLES.map((r) => strength.starters.find((p) => p.role === r)).filter(Boolean);

  return (
    <Link href={`/leagues/${team.league_id}/teams/${team.id}`}>
      <Card hover className="h-full p-4">
        <div className="flex items-start gap-3">
          <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-bold text-slate-100">{team.name}</h3>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">{team.short_name}</span>
              <RegionBadge region={team.region} />
              {team.active === false && <Badge color="#c8a85a">Legacy</Badge>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold tabular-nums" style={{ color: ratingColor(strength.score) }}>
              {Math.round(strength.score)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-600">PWR</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              <span className="font-bold text-rift-green">{team.wins}</span>
              <span className="text-slate-600">-</span>
              <span className="font-bold text-rift-red/80">{team.losses}</span>
            </span>
            <span className="text-xs text-slate-500">{team.games_won}-{team.games_lost} games</span>
          </div>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Wallet size={12} /> {formatMoney(team.budget)}
          </span>
        </div>

        {starters.length > 0 && (
          <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
            {starters.map(
              (p) =>
                p && (
                  <div key={p.id} className="flex flex-1 flex-col items-center gap-1" title={`${p.nickname} · ${p.role} · ${p.rating_overall}`}>
                    <PlayerAvatar name={p.nickname} src={p.image_url} size="xs" />
                    <RoleBadge role={p.role} />
                  </div>
                ),
            )}
          </div>
        )}
      </Card>
    </Link>
  );
}

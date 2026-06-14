'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { canAdminister, useLeagueRole, useManagedTeamId } from '@/lib/store/hooks';
import {
  LayoutGrid, ListOrdered, CalendarDays, Users2, User, GraduationCap,
  Store, ArrowLeftRight, Trophy, Settings, Shield,
} from 'lucide-react';

const TABS = [
  { seg: '', label: 'Overview', icon: LayoutGrid },
  { seg: 'standings', label: 'Standings', icon: ListOrdered },
  { seg: 'schedule', label: 'Schedule', icon: CalendarDays },
  { seg: 'teams', label: 'Teams', icon: Users2 },
  { seg: 'players', label: 'Players', icon: User },
  { seg: 'coaches', label: 'Coaches', icon: GraduationCap },
  { seg: 'market', label: 'Market', icon: Store },
  { seg: 'trades', label: 'Trades', icon: ArrowLeftRight },
  { seg: 'playoffs', label: 'Playoffs', icon: Trophy },
  { seg: 'admin', label: 'Admin', icon: Settings },
];

export function LeagueSubnav({ leagueId }: { leagueId: string }) {
  const pathname = usePathname();
  const role = useLeagueRole(leagueId);
  const managedTeam = useManagedTeamId(leagueId);
  const base = `/leagues/${leagueId}`;
  return (
    <div className="sticky top-14 z-30 -mx-4 mb-6 border-b border-border bg-bg/80 px-4 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {managedTeam && (
          <Link
            href={`${base}/teams/${managedTeam}`}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              pathname === `${base}/teams/${managedTeam}`
                ? 'bg-rift-gold/15 text-rift-gold'
                : 'text-rift-gold/80 hover:bg-bg-elevated',
            )}
          >
            <Shield size={15} />
            <span className="whitespace-nowrap">My Team</span>
          </Link>
        )}
        {TABS.filter((tab) => tab.seg !== 'admin' || canAdminister(role)).map((t) => {
          const href = t.seg ? `${base}/${t.seg}` : base;
          const active = t.seg ? pathname.startsWith(href) : pathname === base;
          return (
            <Link
              key={t.seg || 'overview'}
              href={href}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-rift-cyan/15 text-rift-cyan'
                  : 'text-slate-400 hover:bg-bg-elevated hover:text-slate-200',
                t.seg === 'admin' && 'ml-auto',
              )}
            >
              <t.icon size={15} />
              <span className="whitespace-nowrap">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

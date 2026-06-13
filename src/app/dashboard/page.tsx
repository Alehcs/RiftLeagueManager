'use client';

import Link from 'next/link';
import { DownloadCloud, Wand2, Trophy, Users, Swords, RefreshCw } from 'lucide-react';
import { useDb } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { LeagueCard } from '@/components/league/LeagueCard';
import { PageContainer, LoadingGate, PageHeader } from '@/components/common/layout';
import { Button, Card, Stat, EmptyState } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ui/dialog';
import { TIER_META } from '@/lib/constants';
import type { LeagueTier } from '@/lib/types';

const TIER_ORDER: LeagueTier[] = ['tier1', 'international', 'regional', 'erl', 'tier2', 'custom'];

export default function DashboardPage() {
  const db = useDb();
  const reseed = useStore((s) => s.reseed);

  const byTier = TIER_ORDER.map((tier) => ({
    tier,
    leagues: db.leagues.filter((l) => l.tier === tier),
  })).filter((g) => g.leagues.length > 0);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        subtitle="All your leagues & tournaments"
        actions={
          <>
            <Link href="/leagues/import">
              <Button variant="primary">
                <DownloadCloud size={16} /> Import league
              </Button>
            </Link>
            <Link href="/leagues/new">
              <Button variant="outline">
                <Wand2 size={16} /> New league
              </Button>
            </Link>
            <ConfirmButton variant="ghost" confirmLabel="Reload demo?" onConfirm={reseed}>
              <RefreshCw size={15} /> Reset demo
            </ConfirmButton>
          </>
        }
      />

      <LoadingGate>
        <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          <Stat label="Leagues" value={db.leagues.length} accent="#26d0ce" />
          <Stat label="Teams" value={db.teams.length} accent="#c8a85a" />
          <Stat label="Players" value={db.players.length} accent="#8b5cf6" />
          <Stat label="Matches" value={db.matches.length} accent="#3b82f6" />
        </div>

        {db.leagues.length === 0 ? (
          <EmptyState
            title="No leagues yet"
            hint="Import a real LoL esports league or create one from scratch."
            icon={<Trophy size={40} />}
            action={
              <Link href="/leagues/import">
                <Button variant="primary">Import a league</Button>
              </Link>
            }
          />
        ) : (
          byTier.map((g) => (
            <section key={g.tier} className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full" style={{ backgroundColor: TIER_META[g.tier].color }} />
                <h2 className="font-semibold text-slate-200">{TIER_META[g.tier].label}</h2>
                <span className="text-xs text-slate-600">({g.leagues.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.leagues.map((l) => (
                  <LeagueCard key={l.id} league={l} />
                ))}
              </div>
            </section>
          ))
        )}

        <Card className="mt-4 flex flex-col items-center gap-2 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rift-purple/10 text-rift-purple">
              <Swords size={20} />
            </span>
            <div>
              <div className="font-semibold text-slate-200">Build your own tournament</div>
              <div className="text-sm text-slate-500">Mix real teams across regions into a custom international event.</div>
            </div>
          </div>
          <Link href="/leagues/new">
            <Button variant="secondary">
              <Users size={16} /> Start building
            </Button>
          </Link>
        </Card>
      </LoadingGate>
    </PageContainer>
  );
}

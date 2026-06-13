'use client';

import Link from 'next/link';
import { ExternalLink, ChevronLeft } from 'lucide-react';
import { useDb, useReady } from '@/lib/store/hooks';
import { leagueByIdOrSlug } from '@/lib/store/selectors';
import { LeagueSubnav } from '@/components/league/LeagueSubnav';
import { TeamLogo } from '@/components/ui/image';
import { TierBadge, RegionBadge, FormatBadge } from '@/components/common/badges';
import { PageContainer } from '@/components/common/layout';
import { Spinner } from '@/components/ui/primitives';

export default function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { leagueId: string };
}) {
  const ready = useReady();
  const db = useDb();
  const league = leagueByIdOrSlug(db, params.leagueId);

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!league) {
    return (
      <PageContainer>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-semibold text-slate-300">League not found</p>
          <p className="text-sm text-slate-500">It may have been deleted or the link is invalid.</p>
          <Link href="/dashboard" className="text-rift-cyan hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pt-4">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
        <ChevronLeft size={14} /> Dashboard
      </Link>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <TeamLogo name={league.name} src={league.logo_url} size="xl" className="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-50">{league.name}</h1>
            <TierBadge tier={league.tier} />
            <RegionBadge region={league.region} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span>{league.season}</span>
            <span className="text-slate-700">·</span>
            <FormatBadge format={league.format} />
            {league.source_name && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-xs">Source: {league.source_name}</span>
              </>
            )}
            {league.external_url && (
              <a
                href={league.external_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-rift-cyan hover:underline"
              >
                <ExternalLink size={12} /> External
              </a>
            )}
          </div>
        </div>
      </div>

      <LeagueSubnav leagueId={league.id} />
      {children}
    </PageContainer>
  );
}

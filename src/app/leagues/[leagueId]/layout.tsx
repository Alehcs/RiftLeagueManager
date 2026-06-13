'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ChevronLeft, Copy, Check, Users } from 'lucide-react';
import { useCurrentGuest, useDb, useReady } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { leagueByIdOrSlug } from '@/lib/store/selectors';
import { LeagueSubnav } from '@/components/league/LeagueSubnav';
import { TeamLogo } from '@/components/ui/image';
import { TierBadge, RegionBadge, FormatBadge } from '@/components/common/badges';
import { PageContainer } from '@/components/common/layout';
import { Badge, Button, Spinner } from '@/components/ui/primitives';
import { guestInitials } from '@/lib/utils';

export default function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { leagueId: string };
}) {
  const ready = useReady();
  const db = useDb();
  const currentGuest = useCurrentGuest();
  const league = leagueByIdOrSlug(db, params.leagueId);
  const leagueId = league?.id;
  const startPresence = useStore((state) => state.startPresence);
  const presentGuests = useStore((state) => leagueId ? state.onlineGuests[leagueId] : undefined);
  const onlineGuests = presentGuests ?? [];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    return startPresence(leagueId);
  }, [currentGuest?.avatar_color, currentGuest?.display_name, currentGuest?.id, leagueId, startPresence]);

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
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <a href={`/join/${league.room_code}`} target="_blank" rel="noreferrer" title="Open invite link">
              <Badge color="#26d0ce">Room {league.room_code}</Badge>
            </a>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/join/${league.room_code}`);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Invite'}
            </Button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500" title={onlineGuests.map((guest) => guest.display_name).join(', ')}>
            <Users size={13} /> {onlineGuests.length} {onlineGuests.length === 1 ? 'user' : 'users'} online
            <div className="ml-1 flex -space-x-1.5">
              {onlineGuests.slice(0, 4).map((guest) => (
                <span key={guest.id} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg text-[9px] font-bold text-white" style={{ backgroundColor: guest.avatar_color }}>
                  {guestInitials(guest.display_name)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <LeagueSubnav leagueId={league.id} />
      {children}
    </PageContainer>
  );
}

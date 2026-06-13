'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DownloadCloud, Wand2, Trophy, Users, Swords, RefreshCw, LogIn, UserRound } from 'lucide-react';
import { useCurrentGuest, useDb, useMode } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { LeagueCard } from '@/components/league/LeagueCard';
import { PageContainer, LoadingGate, PageHeader } from '@/components/common/layout';
import { Button, Card, Stat, EmptyState } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form';
import { TIER_META } from '@/lib/constants';
import type { LeagueTier } from '@/lib/types';

const TIER_ORDER: LeagueTier[] = ['tier1', 'international', 'regional', 'erl', 'tier2', 'custom'];

export default function DashboardPage() {
  const db = useDb();
  const mode = useMode();
  const guest = useCurrentGuest();
  const router = useRouter();
  const reseed = useStore((s) => s.reseed);
  const updateGuest = useStore((s) => s.updateGuest);
  const joinLeague = useStore((s) => s.joinLeagueByRoomCode);
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  useEffect(() => setNickname(guest?.display_name ?? ''), [guest?.display_name]);

  const memberLeagueIds = new Set(db.league_members.filter((member) => member.guest_id === guest?.id).map((member) => member.league_id));
  const yourLeagues = db.leagues.filter((league) => league.owner_guest_id === guest?.id || memberLeagueIds.has(league.id));

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
            {mode === 'mock' && (
              <ConfirmButton variant="ghost" confirmLabel="Reload demo?" onConfirm={reseed}>
                <RefreshCw size={15} /> Reset demo
              </ConfirmButton>
            )}
          </>
        }
      />

      <LoadingGate>
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: guest?.avatar_color }}>
                {guest?.display_name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wide text-slate-500">Playing as</div>
                <div className="truncate font-semibold text-slate-100">{guest?.display_name}</div>
              </div>
              <div className="flex max-w-xs gap-2">
                <Input aria-label="Change nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} />
                <Button size="sm" variant="outline" disabled={nickname.trim().length < 2 || nickname.trim() === guest?.display_name} onClick={() => updateGuest(nickname)}>
                  Save
                </Button>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200"><LogIn size={15} /> Join a room</div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input aria-label="Room code" placeholder="Room code" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
              <Input aria-label="Recovery code" placeholder="Recovery code (optional)" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} />
              <Button
                variant="primary"
                disabled={!roomCode.trim()}
                onClick={async () => {
                  const id = await joinLeague(roomCode, recoveryCode || undefined);
                  if (id) router.push(`/leagues/${id}`);
                }}
              >
                Join
              </Button>
            </div>
          </Card>
        </div>

        {yourLeagues.length > 0 && (
          <section className="mb-7">
            <div className="mb-3 flex items-center gap-2">
              <UserRound size={17} className="text-rift-cyan" />
              <h2 className="font-semibold text-slate-200">Your rooms</h2>
              <span className="text-xs text-slate-600">({yourLeagues.length})</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {yourLeagues.map((league) => <LeagueCard key={league.id} league={league} />)}
            </div>
          </section>
        )}

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
          <>
            <h2 className="mb-3 font-semibold text-slate-300">Explore leagues</h2>
            {byTier.map((g) => (
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
            ))}
          </>
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

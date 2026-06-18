'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentGuest } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { PageContainer } from '@/components/common/layout';
import { Button, Spinner } from '@/components/ui/primitives';

export default function JoinRoomPage({ params }: { params: { roomCode: string } }) {
  const guest = useCurrentGuest();
  const joinLeague = useStore((state) => state.joinLeagueByRoomCode);
  const error = useStore((state) => state.error);
  const router = useRouter();
  const attempted = useRef(false);

  useEffect(() => {
    if (!guest || attempted.current) return;
    attempted.current = true;
    void joinLeague(params.roomCode).then((leagueId) => {
      if (leagueId) router.replace(`/leagues/${leagueId}/lobby`);
    });
  }, [guest, joinLeague, params.roomCode, router]);

  return (
    <PageContainer>
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
        {!error ? <Spinner className="h-8 w-8" /> : null}
        <div>
          <h1 className="text-xl font-bold text-slate-100">Joining room {params.roomCode.toUpperCase()}</h1>
          <p className="mt-1 text-sm text-slate-500">{error ?? 'Connecting your guest session…'}</p>
        </div>
        {error && <Link href="/dashboard"><Button variant="outline">Back to dashboard</Button></Link>}
      </div>
    </PageContainer>
  );
}

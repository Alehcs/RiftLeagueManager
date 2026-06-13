'use client';

import { Play, FastForward, Trophy, Zap, RotateCcw } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { Button } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ui/dialog';

export function SimControls({ leagueId, compact }: { leagueId: string; compact?: boolean }) {
  const simRegular = useStore((s) => s.simulateRegularSeason);
  const simPlayoffs = useStore((s) => s.simulatePlayoffs);
  const simFull = useStore((s) => s.simulateFullTournament);
  const reset = useStore((s) => s.resetLeagueResults);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" size={compact ? 'sm' : 'md'} onClick={() => simRegular(leagueId)}>
        <Play size={15} /> Sim Season
      </Button>
      <Button variant="secondary" size={compact ? 'sm' : 'md'} onClick={() => simPlayoffs(leagueId)}>
        <Trophy size={15} /> Sim Playoffs
      </Button>
      <Button variant="outline" size={compact ? 'sm' : 'md'} onClick={() => simFull(leagueId)}>
        <Zap size={15} /> Sim Full
      </Button>
      <ConfirmButton variant="ghost" size={compact ? 'sm' : 'md'} confirmLabel="Reset all results?" onConfirm={() => reset(leagueId)}>
        <RotateCcw size={15} /> Reset
      </ConfirmButton>
    </div>
  );
}

export { FastForward };

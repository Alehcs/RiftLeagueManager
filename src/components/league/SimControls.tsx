'use client';

import { Play, FastForward, Trophy, Zap, RotateCcw } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { Button } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ui/dialog';
import { useLeague } from '@/lib/store/hooks';
import { runPhase } from '@/services/run';

export function SimControls({ leagueId, compact }: { leagueId: string; compact?: boolean }) {
  const league = useLeague(leagueId);
  const simRegular = useStore((s) => s.simulateRegularSeason);
  const simPlayoffs = useStore((s) => s.simulatePlayoffs);
  const simFull = useStore((s) => s.simulateFullTournament);
  const reset = useStore((s) => s.resetLeagueResults);
  const phase = league ? runPhase(league) : 'lobby';
  const legacy = !league?.run_started_at;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(legacy || ['regular_season', 'second_regional_phase'].includes(phase)) && <Button variant="primary" size={compact ? 'sm' : 'md'} onClick={() => simRegular(leagueId)}>
        <Play size={15} /> Sim {phase === 'second_regional_phase' ? 'Second Phase' : 'Season'}
      </Button>}
      {(legacy || ['playoffs', 'msi', 'regional_finals', 'worlds'].includes(phase)) && <Button variant="secondary" size={compact ? 'sm' : 'md'} onClick={() => simPlayoffs(leagueId)}>
        <Trophy size={15} /> Sim {phase === 'msi' ? 'MSI' : phase === 'worlds' ? 'Worlds' : phase === 'regional_finals' ? 'Regional Finals' : 'Playoffs'}
      </Button>}
      {legacy && <Button variant="outline" size={compact ? 'sm' : 'md'} onClick={() => simFull(leagueId)}>
        <Zap size={15} /> Sim Full
      </Button>}
      <ConfirmButton variant="ghost" size={compact ? 'sm' : 'md'} confirmLabel="Reset all results?" onConfirm={() => reset(leagueId)}>
        <RotateCcw size={15} /> Reset
      </ConfirmButton>
    </div>
  );
}

export { FastForward };

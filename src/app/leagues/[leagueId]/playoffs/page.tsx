'use client';

import { useState } from 'react';
import { Trophy, Play, Wand2, RotateCcw } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canAdminister } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { teamsOf } from '@/lib/store/selectors';
import { leagueTournaments, tournamentSummary } from '@/services/tournament';
import { phaseCompetitionKey } from '@/services/competition';
import { TournamentView } from '@/components/league/TournamentView';
import { Card, CardBody, Button } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ui/dialog';
import { Select } from '@/components/ui/form';
import { cn } from '@/lib/utils';

export default function PlayoffsPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const generate = useStore((s) => s.generatePlayoffs);
  const simulate = useStore((s) => s.simulatePlayoffs);
  const reset = useStore((s) => s.resetLeagueResults);
  const [type, setType] = useState<'single' | 'double'>('single');
  const [size, setSize] = useState(6);

  const tournaments = league ? leagueTournaments(league) : [];
  const activeKey = league ? phaseCompetitionKey(league) : null;
  const [selected, setSelected] = useState<string>('');
  if (!league) return null;

  const teams = teamsOf(db, league.id);
  const manage = canAdminister(role);
  const selectedKey = selected || (tournaments.some((t) => t.key === activeKey) ? activeKey! : tournaments[0]?.key);
  const summary = selectedKey ? tournamentSummary(db, league, selectedKey) : null;

  const maxSize = Math.min(8, teams.length);
  const sizeOptions = [2, 4, 6, 8].filter((s) => s <= maxSize);
  // The manual generator drives domestic playoffs; the simulate button plays the
  // bracket of whatever stage the run is currently on.
  const canGenerate = manage && (selectedKey === 'regional_playoffs' || selectedKey === 'quick_tournament');
  const canSimulate = manage && summary?.hasBracket && selectedKey === activeKey;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-100"><Trophy size={18} className="text-rift-gold" /> Tournaments</h2>
        <p className="text-sm text-slate-500">Brackets, champions and MVPs for every stage of the season.</p>
      </div>

      {tournaments.length > 1 && (
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-bg-soft/40 p-1">
          {tournaments.map((t) => (
            <button
              key={t.key}
              onClick={() => setSelected(t.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                t.key === selectedKey ? 'bg-rift-cyan/15 text-rift-cyan' : 'text-slate-400 hover:text-slate-200',
                t.key === activeKey && t.key !== selectedKey && 'text-rift-green',
              )}
            >
              {t.name}{t.key === activeKey && <span className="h-1.5 w-1.5 rounded-full bg-rift-green" />}
            </button>
          ))}
        </div>
      )}

      {(canGenerate || canSimulate || (manage && summary?.hasBracket)) && (
        <Card>
          <CardBody className="flex flex-wrap items-end gap-3">
            {canGenerate && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">Bracket type</label>
                  <Select value={type} onChange={(e) => setType(e.target.value as 'single' | 'double')} className="w-40">
                    <option value="single">Single elimination</option>
                    <option value="double">Double elimination</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">Teams</label>
                  <Select value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-28">
                    {sizeOptions.map((s) => <option key={s} value={s}>Top {s}</option>)}
                  </Select>
                </div>
                <Button variant="primary" onClick={() => generate(league.id, { type, size })}>
                  <Wand2 size={15} /> {summary?.hasBracket ? 'Regenerate' : 'Generate'} bracket
                </Button>
              </>
            )}
            {canSimulate && (
              <Button variant="secondary" onClick={() => simulate(league.id)}>
                <Play size={15} /> Simulate bracket
              </Button>
            )}
            {manage && summary?.hasBracket && (
              <ConfirmButton variant="ghost" confirmLabel="Reset results?" onConfirm={() => reset(league.id)}>
                <RotateCcw size={15} /> Reset
              </ConfirmButton>
            )}
          </CardBody>
        </Card>
      )}

      {summary && <TournamentView summary={summary} leagueId={league.id} />}
    </div>
  );
}

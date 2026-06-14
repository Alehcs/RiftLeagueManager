'use client';

import { useState } from 'react';
import { Trophy, Play, Wand2, RotateCcw } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canAdminister } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { bracketMatches, teamsOf, matchesOf, teamById } from '@/lib/store/selectors';
import { BracketView } from '@/components/league/BracketView';
import { Card, CardBody, Button, EmptyState } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ui/dialog';
import { Select } from '@/components/ui/form';
import { TeamLogo } from '@/components/ui/image';

export default function PlayoffsPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const generate = useStore((s) => s.generatePlayoffs);
  const simulate = useStore((s) => s.simulatePlayoffs);
  const reset = useStore((s) => s.resetLeagueResults);
  const [type, setType] = useState<'single' | 'double'>('single');
  const [size, setSize] = useState(6);

  if (!league) return null;
  const teams = teamsOf(db, league.id);
  const bracket = bracketMatches(db, league.id);
  const manage = canAdminister(role);
  const champion = bracket.find((m) => m.stage === 'final' && m.winner_team_id);
  const champTeam = champion ? teamById(db, champion.winner_team_id) : null;

  const maxSize = Math.min(8, teams.length);
  const sizeOptions = [2, 4, 6, 8].filter((s) => s <= maxSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-100">
            <Trophy size={18} className="text-rift-gold" /> Playoffs
          </h2>
          <p className="text-sm text-slate-500">Bracket seeded from the regular-season standings</p>
        </div>
      </div>

      {champTeam && (
        <Card className="border-rift-gold/40 bg-gradient-to-r from-rift-gold/10 to-transparent">
          <CardBody className="flex items-center gap-4">
            <TeamLogo name={champTeam.name} shortName={champTeam.short_name} src={champTeam.logo_url} size="lg" className="ring-2 ring-rift-gold" />
            <div>
              <div className="text-xs uppercase tracking-wider text-rift-gold">Champion</div>
              <div className="text-2xl font-extrabold text-slate-50">{champTeam.name}</div>
            </div>
            <Trophy size={40} className="ml-auto text-rift-gold/70" />
          </CardBody>
        </Card>
      )}

      {manage && (
        <Card>
          <CardBody className="flex flex-wrap items-end gap-3">
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
              <Wand2 size={15} /> {bracket.length ? 'Regenerate' : 'Generate'} bracket
            </Button>
            {bracket.length > 0 && (
              <>
                <Button variant="secondary" onClick={() => simulate(league.id)}>
                  <Play size={15} /> Simulate bracket
                </Button>
                <ConfirmButton variant="ghost" confirmLabel="Reset results?" onConfirm={() => reset(league.id)}>
                  <RotateCcw size={15} /> Reset
                </ConfirmButton>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {bracket.length > 0 ? (
        <Card>
          <CardBody>
            <BracketView matches={bracket} leagueId={league.id} />
          </CardBody>
        </Card>
      ) : (
        <EmptyState
          title="No bracket yet"
          hint={manage ? 'Generate a playoff bracket from the current standings above.' : 'The bracket has not been generated yet.'}
          icon={<Trophy size={40} />}
        />
      )}
    </div>
  );
}

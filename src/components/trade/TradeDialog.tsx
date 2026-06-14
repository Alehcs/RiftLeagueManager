'use client';

import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { Player, Team } from '@/lib/types';
import { useStore } from '@/lib/store/store';
import { useLeagueRole, useManagedTeamId } from '@/lib/store/hooks';
import { tradeBalance } from '@/services/transfers';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/primitives';
import { Field, Input, Select } from '@/components/ui/form';
import { RoleBadge } from '@/components/ui/rating';
import { cn, formatMoney } from '@/lib/utils';

export function TradeDialog({
  open,
  onClose,
  leagueId,
  teams,
  players,
  defaultFromTeam,
}: {
  open: boolean;
  onClose: () => void;
  leagueId: string;
  teams: Team[];
  players: Player[];
  defaultFromTeam?: string;
}) {
  const propose = useStore((s) => s.proposeTrade);
  const role = useLeagueRole(leagueId);
  const managedTeam = useManagedTeamId(leagueId);
  // A manager may only offer from the team they control; admins choose freely.
  const lockedFrom = role === 'manager' ? managedTeam : null;
  const initialFrom = lockedFrom ?? defaultFromTeam ?? teams[0]?.id ?? '';
  const [fromTeam, setFromTeam] = useState(initialFrom);
  const [toTeam, setToTeam] = useState(teams.find((t) => t.id !== initialFrom)?.id ?? '');
  const [fromSel, setFromSel] = useState<string[]>([]);
  const [toSel, setToSel] = useState<string[]>([]);
  const [moneyFrom, setMoneyFrom] = useState(0);
  const [moneyTo, setMoneyTo] = useState(0);

  const fromRoster = players.filter((p) => p.team_id === fromTeam);
  const toRoster = players.filter((p) => p.team_id === toTeam);
  const fromPlayers = players.filter((p) => fromSel.includes(p.id));
  const toPlayers = players.filter((p) => toSel.includes(p.id));
  const bal = tradeBalance(fromPlayers, toPlayers, moneyFrom, moneyTo);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const canPropose = fromTeam && toTeam && fromTeam !== toTeam && (fromSel.length || toSel.length || moneyFrom || moneyTo);

  const fromName = teams.find((t) => t.id === fromTeam)?.short_name ?? 'A';
  const toName = teams.find((t) => t.id === toTeam)?.short_name ?? 'B';

  return (
    <Dialog open={open} onClose={onClose} size="xl" title="Propose a trade">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <RosterColumn label={lockedFrom ? 'Your team' : 'Team A'} teamId={fromTeam} setTeam={setFromTeam} teams={teams} roster={fromRoster} selected={fromSel} onToggle={(id) => toggle(fromSel, setFromSel, id)} locked={!!lockedFrom} />
          <RosterColumn label="Team B" teamId={toTeam} setTeam={setToTeam} teams={teams} roster={toRoster} selected={toSel} onToggle={(id) => toggle(toSel, setToSel, id)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={`Cash from ${fromName}`}>
            <Input type="number" min={0} value={moneyFrom || ''} onChange={(e) => setMoneyFrom(Math.max(0, Number(e.target.value)))} />
          </Field>
          <Field label={`Cash from ${toName}`}>
            <Input type="number" min={0} value={moneyTo || ''} onChange={(e) => setMoneyTo(Math.max(0, Number(e.target.value)))} />
          </Field>
        </div>

        <div className="rounded-lg border border-border bg-bg-soft/40 p-3 text-sm">
          <div className="mb-2 flex items-center justify-center gap-2 text-slate-400">
            <span className="font-semibold text-slate-200">{fromName}</span>
            <ArrowLeftRight size={16} className="text-rift-purple" />
            <span className="font-semibold text-slate-200">{toName}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>{fromName} gives <b className="text-slate-200">{formatMoney(bal.fromGives)}</b> of value</span>
            <span>{toName} gives <b className="text-slate-200">{formatMoney(bal.toGives)}</b> of value</span>
          </div>
          <div className="mt-1 text-center text-xs text-slate-500">
            Net to {fromName}: <span className={cn('font-semibold', bal.netToFrom >= 0 ? 'text-rift-green' : 'text-rift-red')}>{bal.netToFrom >= 0 ? '+' : ''}{formatMoney(bal.netToFrom)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!canPropose}
            onClick={() => {
              propose({ leagueId, fromTeamId: fromTeam, toTeamId: toTeam, playersFrom: fromSel, playersTo: toSel, moneyFromTeam: moneyFrom, moneyToTeam: moneyTo });
              onClose();
            }}
          >
            Propose trade
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function RosterColumn({
  label, teamId, setTeam, teams, roster, selected, onToggle, locked,
}: {
  label: string;
  teamId: string;
  setTeam: (id: string) => void;
  teams: Team[];
  roster: Player[];
  selected: string[];
  onToggle: (id: string) => void;
  locked?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <Select value={teamId} onChange={(e) => setTeam(e.target.value)} className="mb-2" disabled={locked}>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
      <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
        {roster.length === 0 && <p className="px-2 py-3 text-center text-xs text-slate-600">Empty roster</p>}
        {roster.map((p) => {
          const sel = selected.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                sel ? 'bg-rift-purple/20 ring-1 ring-rift-purple/50' : 'hover:bg-bg-elevated',
              )}
            >
              <input type="checkbox" checked={sel} readOnly className="accent-rift-purple" />
              <span className="flex-1 truncate font-medium text-slate-200">{p.nickname}</span>
              <RoleBadge role={p.role} />
              <span className="text-xs text-slate-500">{formatMoney(p.value)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

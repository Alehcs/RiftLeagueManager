'use client';

import { useState } from 'react';
import { Pencil, Trash2, LogOut, DollarSign, UserPlus, ExternalLink } from 'lucide-react';
import type { Player, Team } from '@/lib/types';
import { useStore } from '@/lib/store/store';
import { useDb } from '@/lib/store/hooks';
import { teamById } from '@/lib/store/selectors';
import { Dialog, ConfirmButton } from '@/components/ui/dialog';
import { Button, Badge } from '@/components/ui/primitives';
import { Select } from '@/components/ui/form';
import { PlayerAvatar } from '@/components/ui/image';
import { RoleBadge, RatingBar, OverallBadge } from '@/components/ui/rating';
import { PlayerStatusBadge, GeneratedBadge, SourceBadge } from '@/components/common/badges';
import { PlayerForm } from './PlayerForm';
import { flagEmoji, formatMoney, formatMoneyFull, formatDate } from '@/lib/utils';

export function PlayerDialog({
  player,
  open,
  onClose,
  teams,
  canEdit,
}: {
  player: Player;
  open: boolean;
  onClose: () => void;
  teams: Team[];
  canEdit: boolean;
}) {
  const db = useDb();
  const updatePlayer = useStore((s) => s.updatePlayer);
  const deletePlayer = useStore((s) => s.deletePlayer);
  const signPlayer = useStore((s) => s.signPlayer);
  const releasePlayer = useStore((s) => s.releasePlayer);
  const sellPlayer = useStore((s) => s.sellPlayer);
  const [editing, setEditing] = useState(false);
  const [signTeam, setSignTeam] = useState('');

  const team = teamById(db, player.team_id);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setEditing(false);
        onClose();
      }}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          {flagEmoji(player.nationality)} {player.nickname}
          <RoleBadge role={player.role} />
        </div>
      }
    >
      {editing ? (
        <PlayerForm
          initial={player}
          teams={teams}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSave={(d) => {
            updatePlayer(player.id, d);
            setEditing(false);
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <PlayerAvatar name={player.nickname} src={player.image_url} size="xl" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-100">{player.nickname}</span>
                <PlayerStatusBadge status={player.status} />
              </div>
              <div className="text-sm text-slate-400">
                {player.real_name || '—'} {player.age ? `· ${player.age}y` : ''}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">{team ? team.name : 'Free agent'}</span>
                <SourceBadge name={player.source_name} />
                <GeneratedBadge show={player.generated} />
                {player.confidence != null && <span className="text-slate-600">conf {Math.round(player.confidence * 100)}%</span>}
              </div>
            </div>
            <OverallBadge value={player.rating_overall} size="lg" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Meta label="Value" value={formatMoney(player.value)} />
            <Meta label="Salary" value={formatMoney(player.salary)} />
            <Meta label="Contract" value={player.contract_until ? formatDate(player.contract_until) : '—'} />
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-bg-soft/40 p-3">
            <RatingBar label="Laning" value={player.rating_laning} />
            <RatingBar label="Teamfight" value={player.rating_teamfighting} />
            <RatingBar label="Macro" value={player.rating_macro} />
            <RatingBar label="Mechanics" value={player.rating_mechanics} />
            <RatingBar label="Consistency" value={player.rating_consistency} />
          </div>

          {player.external_url && (
            <a href={player.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-rift-cyan hover:underline">
              <ExternalLink size={12} /> External profile
            </a>
          )}

          {/* Market actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {!player.team_id ? (
              <div className="flex items-center gap-2">
                <Select value={signTeam} onChange={(e) => setSignTeam(e.target.value)} className="w-44">
                  <option value="">Sign to team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
                <Button variant="primary" size="sm" disabled={!signTeam} onClick={() => { signPlayer(player.id, signTeam); onClose(); }}>
                  <UserPlus size={14} /> Sign
                </Button>
              </div>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => releasePlayer(player.id)}>
                  <LogOut size={14} /> Release
                </Button>
                <Button variant="outline" size="sm" onClick={() => sellPlayer(player.id)}>
                  <DollarSign size={14} /> Sell ({formatMoneyFull(player.value)})
                </Button>
              </>
            )}
            {canEdit && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  <Pencil size={14} /> Edit
                </Button>
                <ConfirmButton variant="ghost" size="sm" confirmLabel="Delete?" onConfirm={() => { deletePlayer(player.id); onClose(); }}>
                  <Trash2 size={14} />
                </ConfirmButton>
              </>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-200">{value}</div>
    </div>
  );
}

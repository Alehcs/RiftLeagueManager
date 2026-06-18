'use client';

import { useState } from 'react';
import { Pencil, Trash2, LogOut, DollarSign, UserPlus, ExternalLink, HandCoins } from 'lucide-react';
import type { Player, Team } from '@/lib/types';
import { useStore } from '@/lib/store/store';
import { useDb, useLeagueRole, useManagedTeamId, canAdminister, canManageTeam } from '@/lib/store/hooks';
import { teamById } from '@/lib/store/selectors';
import { Dialog, ConfirmButton } from '@/components/ui/dialog';
import { Button, Badge } from '@/components/ui/primitives';
import { Input, Select } from '@/components/ui/form';
import { PlayerAvatar } from '@/components/ui/image';
import { RoleBadge, RatingBar, OverallBadge } from '@/components/ui/rating';
import { PlayerStatusBadge, GeneratedBadge, SourceBadge, PlayerCategoryBadge } from '@/components/common/badges';
import { PlayerForm } from './PlayerForm';
import { flagEmoji, formatMoney, formatMoneyFull } from '@/lib/utils';
import { isPreseason, playerCategory, runPhase } from '@/services/run';
import type { RolePromise } from '@/lib/types';

export function PlayerDialog({
  player,
  open,
  onClose,
  teams,
}: {
  player: Player;
  open: boolean;
  onClose: () => void;
  teams: Team[];
  canEdit?: boolean;
}) {
  const db = useDb();
  const updatePlayer = useStore((s) => s.updatePlayer);
  const deletePlayer = useStore((s) => s.deletePlayer);
  const signPlayer = useStore((s) => s.signPlayer);
  const releasePlayer = useStore((s) => s.releasePlayer);
  const sellPlayer = useStore((s) => s.sellPlayer);
  const setPlayerStatus = useStore((s) => s.setPlayerStatus);
  const submitMarketOffer = useStore((s) => s.submitMarketOffer);
  const role = useLeagueRole(player.league_id);
  const managedTeam = useManagedTeamId(player.league_id);

  // Permissions: full edit/delete is admin-only; releasing/selling a rostered
  // player or signing a free agent is scoped to the team the user manages.
  const isAdmin = canAdminister(role);
  const canManageThis = canManageTeam(role, managedTeam, player.team_id);
  const signTeams = isAdmin ? teams : teams.filter((t) => t.id === managedTeam);
  const canSign = signTeams.length > 0;

  const [editing, setEditing] = useState(false);
  const [signTeam, setSignTeam] = useState(isAdmin ? '' : managedTeam ?? '');
  const [transferFee, setTransferFee] = useState(player.value);
  const [salary, setSalary] = useState(player.salary);
  const [rolePromise, setRolePromise] = useState<RolePromise>('starter');

  const team = teamById(db, player.team_id);
  const league = db.leagues.find((item) => item.id === player.league_id);
  const phase = league ? runPhase(league) : 'lobby';
  const useOffers = isPreseason(phase) || phase === 'regular_season';
  const activeOffers = db.market_offers.filter((offer) => offer.player_id === player.id && offer.status === 'active');

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
                <PlayerCategoryBadge category={player.category ?? playerCategory(player.rating_overall)} />
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
            <Meta label="Potential" value={`${player.potential ?? player.rating_overall}`} />
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

          {/* Market actions (gated by role + team) */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {!player.team_id ? (
              canSign && (useOffers ? (
                <div className="w-full space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={signTeam} onChange={(e) => setSignTeam(e.target.value)}>
                      {isAdmin && <option value="">Offer from team…</option>}
                      {signTeams.filter((item) => item.run_active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </Select>
                    <Select value={rolePromise} onChange={(e) => setRolePromise(e.target.value as RolePromise)}><option value="starter">Starter role</option><option value="rotation">Rotation role</option><option value="development">Development role</option></Select>
                    <Input type="number" min={0} value={transferFee} onChange={(e) => setTransferFee(Number(e.target.value))} aria-label="Transfer fee" />
                    <Input type="number" min={0} value={salary} onChange={(e) => setSalary(Number(e.target.value))} aria-label="Salary offer" />
                  </div>
                  <div className="flex justify-end"><Button variant="primary" size="sm" disabled={!signTeam} onClick={() => { submitMarketOffer({ leagueId: player.league_id, playerId: player.id, teamId: signTeam, transferFee, salary, rolePromise }); onClose(); }}><HandCoins size={14} /> Submit offer</Button></div>
                  {activeOffers.length > 0 && <div className="space-y-1 rounded-lg border border-border bg-bg-soft/40 p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">Competing offers</div>{activeOffers.map((offer) => <div key={offer.id} className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{teams.find((item) => item.id === offer.team_id)?.short_name} · {offer.role_promise}</span><span>{formatMoney(offer.transfer_fee)} + {formatMoney(offer.salary)}/yr</span></div>)}</div>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Select value={signTeam} onChange={(e) => setSignTeam(e.target.value)} className="w-44">
                    {isAdmin && <option value="">Sign to team…</option>}
                    {signTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                  <Button variant="primary" size="sm" disabled={!signTeam} onClick={() => { signPlayer(player.id, signTeam); onClose(); }}>
                    <UserPlus size={14} /> Sign
                  </Button>
                </div>
              ))
            ) : (
              canManageThis && (
                <>
                  {(player.status === 'active' || player.status === 'benched') && (
                    <Button variant="secondary" size="sm" onClick={() => setPlayerStatus(player.id, player.status === 'active' ? 'benched' : 'active')}>
                      {player.status === 'active' ? 'Bench' : 'Activate'}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => releasePlayer(player.id)}>
                    <LogOut size={14} /> Release
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => sellPlayer(player.id)}>
                    <DollarSign size={14} /> Sell ({formatMoneyFull(player.value)})
                  </Button>
                </>
              )
            )}
            {isAdmin && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  <Pencil size={14} /> Edit
                </Button>
                <ConfirmButton variant="ghost" size="sm" confirmLabel="Delete?" onConfirm={() => { deletePlayer(player.id); onClose(); }}>
                  <Trash2 size={14} />
                </ConfirmButton>
              </>
            )}
            {!canSign && !player.team_id && <span className="text-xs text-slate-500">View only — claim a team to sign players.</span>}
            {player.team_id && !canManageThis && !isAdmin && <span className="text-xs text-slate-500">Managed by another team.</span>}
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

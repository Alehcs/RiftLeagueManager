'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, LogOut, DollarSign, UserPlus, ExternalLink, HandCoins, Search, FileSignature, RefreshCw, UserSquare } from 'lucide-react';
import type { Player, Team } from '@/lib/types';
import { useStore } from '@/lib/store/store';
import { useDb, useLeagueRole, useManagedTeamId, canAdminister, canManageTeam } from '@/lib/store/hooks';
import { teamById } from '@/lib/store/selectors';
import { Dialog, ConfirmButton } from '@/components/ui/dialog';
import { Button, Badge } from '@/components/ui/primitives';
import { Input, Select } from '@/components/ui/form';
import { PlayerAvatar } from '@/components/ui/image';
import { RoleBadge, RatingBar, OverallBadge } from '@/components/ui/rating';
import { PlayerStatusBadge, GeneratedBadge, SourceBadge, PlayerCategoryBadge, ContractBadge } from '@/components/common/badges';
import { PlayerForm } from './PlayerForm';
import { flagEmoji, formatMoney, formatMoneyFull } from '@/lib/utils';
import { isPreseason, playerCategory, runPhase } from '@/services/run';
import { contractInfo } from '@/services/contracts';
import { isScouted, scoutReport, formatEstimate } from '@/services/scouting';
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
  const scoutPlayer = useStore((s) => s.scoutPlayer);
  const renewContract = useStore((s) => s.renewContract);
  const role = useLeagueRole(player.league_id);
  const managedTeam = useManagedTeamId(player.league_id);

  // Permissions: full edit/delete is admin-only; releasing/selling a rostered
  // player or signing a free agent is scoped to the team the user manages.
  const isAdmin = canAdminister(role);
  const canManageThis = canManageTeam(role, managedTeam, player.team_id);
  const canScout = role === 'owner' || role === 'admin' || role === 'manager';
  const signTeams = isAdmin ? teams : teams.filter((t) => t.id === managedTeam);
  const canSign = signTeams.length > 0;

  const [editing, setEditing] = useState(false);
  const [signTeam, setSignTeam] = useState(isAdmin ? '' : managedTeam ?? '');
  const [transferFee, setTransferFee] = useState(player.value);
  const [salary, setSalary] = useState(player.salary);
  const [rolePromise, setRolePromise] = useState<RolePromise>('starter');
  const [offerYears, setOfferYears] = useState(2);
  const [showRenew, setShowRenew] = useState(false);
  const [renewSalary, setRenewSalary] = useState(player.salary);
  const [renewYears, setRenewYears] = useState(2);

  const team = teamById(db, player.team_id);
  const league = db.leagues.find((item) => item.id === player.league_id);
  const season = league?.season ?? '';
  const phase = league ? runPhase(league) : 'lobby';
  const useOffers = isPreseason(phase) || phase === 'regular_season';
  const activeOffers = db.market_offers.filter((offer) => offer.player_id === player.id && offer.status === 'active');
  const scouted = isScouted(player);
  const contract = contractInfo(player, season);
  const report = scoutReport(player, season);

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
            <PlayerAvatar name={player.nickname} src={player.image_url} seed={player.avatar_seed} size="xl" />
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
                <ContractBadge status={contract.status} years={contract.years_remaining} />
                <SourceBadge name={player.source_name} />
                <GeneratedBadge show={player.generated} />
              </div>
            </div>
            {scouted ? (
              <OverallBadge value={player.rating_overall} size="lg" />
            ) : (
              <div className="rounded-lg border border-border bg-bg-soft/60 px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Est. OVR</div>
                <div className="text-lg font-bold text-slate-300">{formatEstimate(report.overall)}</div>
              </div>
            )}
          </div>

          <Link href={`/leagues/${player.league_id}/players/${player.id}`} onClick={onClose} className="flex items-center justify-center gap-1.5 rounded-lg border border-rift-cyan/30 bg-rift-cyan/5 py-2 text-sm font-medium text-rift-cyan transition-colors hover:bg-rift-cyan/10">
            <UserSquare size={15} /> View full career profile
          </Link>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Meta label="Value" value={formatMoney(player.value)} />
            <Meta label="Salary" value={formatMoney(player.salary)} />
            <Meta label="Potential" value={scouted ? `${player.potential ?? player.rating_overall}` : formatEstimate(report.potential)} />
          </div>

          {/* Contract + scouting */}
          <div className="grid gap-2 rounded-lg border border-border bg-bg-soft/40 p-3 sm:grid-cols-3">
            <Meta label="Contract" value={contract.status === 'free_agent' ? 'Free agent' : contract.years_remaining != null ? `${Math.max(0, contract.years_remaining)} season${contract.years_remaining === 1 ? '' : 's'}` : '—'} />
            <Meta label="Buyout" value={player.team_id ? formatMoney(contract.buyout) : '—'} />
            <Meta label="Expected wage" value={`${formatMoney(report.expectedSalary)}/yr`} />
          </div>

          {scouted ? (
            <div className="space-y-2 rounded-lg border border-border bg-bg-soft/40 p-3">
              <RatingBar label="Laning" value={player.rating_laning} />
              <RatingBar label="Teamfight" value={player.rating_teamfighting} />
              <RatingBar label="Macro" value={player.rating_macro} />
              <RatingBar label="Mechanics" value={player.rating_mechanics} />
              <RatingBar label="Consistency" value={player.rating_consistency} />
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-dashed border-border bg-bg-soft/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scout report</span>
                <Badge color={report.recommendation === 'sign' ? '#22c55e' : report.recommendation === 'prospect' ? '#3b82f6' : report.recommendation === 'avoid' ? '#ef4444' : '#eab308'}>{report.recommendationLabel}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Strengths: </span><span className="text-rift-green">{report.strengths.join(', ')}</span></div>
                <div><span className="text-slate-500">Weaknesses: </span><span className="text-rift-red">{report.weaknesses.join(', ')}</span></div>
                <div><span className="text-slate-500">Est. potential: </span><span className="text-slate-300">{formatEstimate(report.potential)}</span></div>
                <div><span className="text-slate-500">Exact stats hidden until scouted.</span></div>
              </div>
              {canScout && <div className="flex justify-end"><Button variant="secondary" size="sm" onClick={() => scoutPlayer(player.id)}><Search size={14} /> Scout player</Button></div>}
            </div>
          )}

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
                    <Select value={offerYears} onChange={(e) => setOfferYears(Number(e.target.value))} aria-label="Contract length">
                      {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y} season{y > 1 ? 's' : ''}</option>)}
                    </Select>
                  </div>
                  <div className="flex justify-end"><Button variant="primary" size="sm" disabled={!signTeam} onClick={() => { submitMarketOffer({ leagueId: player.league_id, playerId: player.id, teamId: signTeam, transferFee, salary, rolePromise, contractYears: offerYears }); onClose(); }}><HandCoins size={14} /> Submit offer</Button></div>
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
                  <Button variant="secondary" size="sm" onClick={() => { setRenewSalary(player.salary); setRenewYears(2); setShowRenew((v) => !v); }}>
                    <RefreshCw size={14} /> Renew
                  </Button>
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

          {showRenew && canManageThis && player.team_id && (
            <div className="space-y-3 rounded-lg border border-border bg-bg-soft/40 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><FileSignature size={13} /> Renew contract</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-400">New salary
                  <Input type="number" min={0} value={renewSalary} onChange={(e) => setRenewSalary(Number(e.target.value))} aria-label="New salary" />
                </label>
                <label className="text-xs text-slate-400">Length
                  <Select value={renewYears} onChange={(e) => setRenewYears(Number(e.target.value))} aria-label="Contract length">
                    {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y} season{y > 1 ? 's' : ''}</option>)}
                  </Select>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Expected wage {formatMoney(report.expectedSalary)}/yr</span>
                <Button variant="primary" size="sm" onClick={() => { renewContract(player.id, { salary: renewSalary, years: renewYears }); setShowRenew(false); }}><RefreshCw size={14} /> Confirm renewal</Button>
              </div>
            </div>
          )}
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

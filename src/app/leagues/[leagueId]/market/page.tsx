'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight, Search, Wallet, CalendarClock, HandCoins, Globe, Bot, Inbox, Check, X, AlertTriangle, Play } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, useManagedTeamId, canManage, canAdminister, canManageTeam } from '@/lib/store/hooks';
import {
  freeAgents, freeAgentCoaches, teamsOf, playersOf, coachesOf,
  freeAgentOffersOf, incomingOffersOf, incomingOffersForTeam, botActivityOf, teamById, playerById,
} from '@/lib/store/selectors';
import { PLAYER_ROLES, type Player, type PlayerCategory, type Role } from '@/lib/types';
import { ROLE_META, regionBadge } from '@/lib/constants';
import { playerCategory } from '@/services/run';
import { contractInfo, wageSummary, type ContractStatus } from '@/services/contracts';
import { ContractBadge } from '@/components/common/badges';
import { PlayerRow } from '@/components/player/PlayerRow';
import { CoachRow } from '@/components/coach/CoachRow';
import { TradeDialog } from '@/components/trade/TradeDialog';
import { Card, CardHeader, CardTitle, CardBody, Button, Stat, EmptyState, Badge } from '@/components/ui/primitives';
import { useDialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/form';
import { formatMoney, timeAgo } from '@/lib/utils';
import { useStore } from '@/lib/store/store';

const CATEGORIES: PlayerCategory[] = ['Rookie', 'Prospect', 'Starter', 'Pro', 'Star', 'Superstar', 'Legend'];
type StatusFilter = 'all' | 'free' | 'contracted';

const ACTIVITY_COLOR: Record<string, string> = {
  signing: '#22c55e',
  sale: '#eab308',
  trade: '#8b5cf6',
  offer: '#26d0ce',
  reject: '#ef4444',
};

export default function MarketPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const managedTeam = useManagedTeamId(league?.id);
  const tradeDialog = useDialog();
  const resolveOffers = useStore((state) => state.resolveMarketOffers);
  const runMarketTick = useStore((state) => state.runMarketTick);
  const respondToOffer = useStore((state) => state.respondToMarketOffer);
  const [tab, setTab] = useState<'players' | 'coaches'>('players');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [minRating, setMinRating] = useState(0);
  const [maxRating, setMaxRating] = useState(99);
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<PlayerCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [contractFilter, setContractFilter] = useState<ContractStatus | 'all'>('all');
  const leagueId = league?.id ?? '';
  const faOffers = freeAgentOffersOf(db, leagueId);

  useEffect(() => {
    if (!leagueId || !canAdminister(role) || faOffers.length === 0) return;
    const nextExpiry = Math.min(...faOffers.map((offer) => +new Date(offer.expires_at)));
    const timer = window.setTimeout(() => resolveOffers(leagueId, false), Math.max(0, nextExpiry - Date.now()) + 250);
    return () => window.clearTimeout(timer);
  }, [faOffers, leagueId, resolveOffers, role]);

  if (!league) return null;
  const teams = teamsOf(db, league.id);
  const allPlayers = playersOf(db, league.id);
  const allCoaches = coachesOf(db, league.id);
  const manage = canManage(role);
  const isAdmin = canAdminister(role);
  const faCoaches = freeAgentCoaches(db, league.id);
  const regions = [...new Set(teams.map((t) => t.region).filter(Boolean))].sort();
  const teamRegion = (teamId: string | null) => teams.find((t) => t.id === teamId)?.region ?? null;

  // Incoming bot buy-offers: a manager sees offers for their own players; an
  // owner/admin sees every team's incoming offers.
  const incoming = isAdmin ? incomingOffersOf(db, league.id) : incomingOffersForTeam(db, league.id, managedTeam);
  const activity = botActivityOf(db, league.id);

  // Computed inline (not memoized): the store mutates `db` in place, so a
  // `db`-keyed useMemo would not refresh after a sign/release.
  const pool = allPlayers
    .filter((p) => {
      if (statusFilter === 'free' && p.team_id) return false;
      if (statusFilter === 'contracted' && !p.team_id) return false;
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (p.rating_overall < minRating || p.rating_overall > maxRating) return false;
      if (categoryFilter !== 'all' && (p.category ?? playerCategory(p.rating_overall)) !== categoryFilter) return false;
      if (contractFilter !== 'all' && contractInfo(p, league.season).status !== contractFilter) return false;
      if (teamFilter !== 'all' && (teamFilter === 'free' ? !!p.team_id : p.team_id !== teamFilter)) return false;
      if (regionFilter !== 'all') {
        if (regionFilter === 'free') { if (p.team_id) return false; }
        else if (teamRegion(p.team_id) !== regionFilter) return false;
      }
      if (q && !`${p.nickname} ${p.real_name}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.rating_overall - a.rating_overall)
    .slice(0, 60);

  // rostered players whose contracts are expiring (<= 1 season left)
  const expiring = allPlayers
    .filter((p) => p.team_id && contractInfo(p, league.season).status === 'expiring')
    .sort((a, b) => (contractInfo(a, league.season).years_remaining ?? 9) - (contractInfo(b, league.season).years_remaining ?? 9))
    .slice(0, 8);
  const myTeam = managedTeam ? teams.find((t) => t.id === managedTeam) : undefined;
  const wages = myTeam ? wageSummary(myTeam, league, allPlayers, allCoaches) : null;

  // Would accepting this offer leave the selling team without a starter at the
  // player's role? Surfaced as a warning (accept is still allowed).
  const wouldBreakRoster = (player: Player | undefined): boolean => {
    if (!player?.team_id) return false;
    return !allPlayers.some(
      (p) => p.team_id === player.team_id && p.id !== player.id && p.role === player.role && p.status === 'active',
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-100"><Globe size={18} className="text-rift-cyan" /> Global transfer market</h2>
          <p className="text-sm text-slate-500">{league.market_rules || 'Buy, sell, and trade players from any region. Competitions stay regional.'}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && league.run_started_at && (
            <Button variant="outline" onClick={() => runMarketTick(league.id)} title="Run one bot market round">
              <Play size={15} /> Run market
            </Button>
          )}
          {manage && <Button variant="primary" onClick={tradeDialog.openIt}>
            <ArrowLeftRight size={16} /> Trade center
          </Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        <Stat label="Free agents" value={freeAgents(db, league.id).length} accent="#26d0ce" />
        <Stat label="Regions" value={regions.length || 1} />
        <Stat label="Teams" value={teams.length} />
        <Stat label="Avg budget" value={formatMoney(teams.reduce((a, t) => a + t.budget, 0) / Math.max(1, teams.length))} accent="#c8a85a" />
      </div>

      {/* Incoming bot offers */}
      {incoming.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Inbox size={14} /> Incoming offers ({incoming.length})</CardTitle></CardHeader>
          <CardBody className="space-y-2">
            {incoming.map((offer) => {
              const player = playerById(db, offer.player_id);
              const buyer = teamById(db, offer.team_id);
              const seller = teamById(db, player?.team_id ?? offer.from_team_id ?? null);
              const canRespond = isAdmin || canManageTeam(role, managedTeam, player?.team_id);
              const breaks = wouldBreakRoster(player);
              return (
                <div key={offer.id} className="rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge color="#26d0ce">{buyer?.short_name ?? 'Bot'}</Badge>
                      <span className="text-slate-400">wants</span>
                      <span className="font-semibold text-slate-100">{player?.nickname ?? 'a player'}</span>
                      {seller && <span className="text-xs text-slate-500">from {seller.short_name}</span>}
                    </div>
                    <span className="text-xs text-slate-300">{formatMoney(offer.transfer_fee)} fee</span>
                  </div>
                  {offer.reason && <p className="mt-1 text-xs text-slate-500">{offer.reason}</p>}
                  {breaks && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-rift-red"><AlertTriangle size={12} /> Selling leaves {seller?.short_name ?? 'the team'} without a starting {player?.role.toLowerCase()}.</p>
                  )}
                  {canRespond && (
                    <div className="mt-2 flex justify-end gap-2">
                      <Button variant="danger" size="sm" onClick={() => respondToOffer(offer.id, false)}><X size={13} /> Reject</Button>
                      <Button variant="primary" size="sm" onClick={() => respondToOffer(offer.id, true)}><Check size={13} /> Accept</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      {/* Active free-agent offers */}
      {faOffers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><HandCoins size={14} /> Active free-agent offers</CardTitle>{isAdmin && <Button size="sm" variant="outline" onClick={() => resolveOffers(league.id, false)}>Resolve expired</Button>}</CardHeader>
          <CardBody className="space-y-2">
            {faOffers.map((offer) => {
              const player = allPlayers.find((item) => item.id === offer.player_id);
              const team = teams.find((item) => item.id === offer.team_id);
              return <div key={offer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-sm"><span className="font-medium text-slate-200">{team?.short_name} → {player?.nickname}</span><span className="text-xs text-slate-400">{formatMoney(offer.transfer_fee)} fee · {formatMoney(offer.salary)}/yr · {offer.role_promise}</span></div>;
            })}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Player / coach pool */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-soft/40 p-1">
            <TabBtn active={tab === 'players'} onClick={() => setTab('players')}>Players</TabBtn>
            <TabBtn active={tab === 'coaches'} onClick={() => setTab('coaches')}>Coaches ({faCoaches.length})</TabBtn>
          </div>

          {tab === 'players' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[160px] flex-1">
                  <Search size={15} className="absolute left-2.5 top-2.5 text-slate-500" />
                  <Input className="pl-8" placeholder="Search players…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <Select className="w-32" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                  <option value="all">All players</option>
                  <option value="free">Free agents</option>
                  <option value="contracted">Contracted</option>
                </Select>
                <Select className="w-32" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                  <option value="all">All regions</option>
                  <option value="free">Free agents</option>
                  {regions.map((r) => <option key={r} value={r}>{regionBadge(r).label} · {r}</option>)}
                </Select>
                <Select className="w-32" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                  <option value="all">All teams</option>
                  <option value="free">Free agents</option>
                  {[...teams].sort((a, b) => a.short_name.localeCompare(b.short_name)).map((t) => <option key={t.id} value={t.id}>{t.short_name}</option>)}
                </Select>
                <Select className="w-28" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}>
                  <option value="all">All roles</option>
                  {PLAYER_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                </Select>
                <Select className="w-32" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as PlayerCategory | 'all')}>
                  <option value="all">Any category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Select className="w-32" value={contractFilter} onChange={(e) => setContractFilter(e.target.value as ContractStatus | 'all')}>
                  <option value="all">Any contract</option>
                  <option value="contracted">Contracted</option>
                  <option value="expiring">Expiring</option>
                  <option value="free_agent">Free agent</option>
                </Select>
                <Select className="w-28" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
                  <option value={0}>Min any</option>
                  <option value={70}>Min 70</option>
                  <option value={80}>Min 80</option>
                  <option value={85}>Min 85</option>
                </Select>
                <Select className="w-28" value={maxRating} onChange={(e) => setMaxRating(Number(e.target.value))}>
                  <option value={99}>Max any</option>
                  <option value={95}>Max 95</option>
                  <option value={85}>Max 85</option>
                  <option value={75}>Max 75</option>
                </Select>
              </div>
              {pool.length ? (
                <div className="space-y-2">
                  {pool.map((p) => (
                    <PlayerRow key={p.id} player={p} teams={teams} canEdit={manage} />
                  ))}
                </div>
              ) : (
                <EmptyState title="No players match" hint="Adjust the filters above." />
              )}
            </>
          )}

          {tab === 'coaches' && (
            faCoaches.length ? (
              <div className="space-y-2">
                {faCoaches.map((c) => (
                  <CoachRow key={c.id} coach={c} teams={teams} canEdit={manage} />
                ))}
              </div>
            ) : (
              <EmptyState title="No free-agent coaches" />
            )
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Bot size={14} /> Market activity</CardTitle></CardHeader>
            <CardBody className="space-y-2">
              {activity.length === 0 && <p className="text-sm text-slate-500">No bot moves yet. Advance a market window or run the market.</p>}
              {activity.slice(0, 12).map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ACTIVITY_COLOR[entry.kind] ?? '#64748b' }} />
                  <div className="min-w-0">
                    <p className="text-slate-300">{entry.message}</p>
                    <p className="text-[10px] text-slate-600">{timeAgo(entry.created_at)}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          {wages && myTeam && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-1.5"><Wallet size={14} /> {myTeam.short_name} budget &amp; wages</CardTitle></CardHeader>
              <CardBody className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-border bg-bg-soft/40 px-2 py-2"><div className="text-[10px] uppercase tracking-wide text-slate-500">Transfer budget</div><div className="mt-0.5 text-sm font-semibold text-rift-gold">{formatMoney(wages.transferBudget)}</div></div>
                  <div className="rounded-lg border border-border bg-bg-soft/40 px-2 py-2"><div className="text-[10px] uppercase tracking-wide text-slate-500">Wage room</div><div className={`mt-0.5 text-sm font-semibold ${wages.wageRoom < 0 ? 'text-rift-red' : 'text-rift-green'}`}>{formatMoney(wages.wageRoom)}</div></div>
                </div>
                <div className="flex justify-between text-xs text-slate-400"><span>Wage bill</span><span>{formatMoney(wages.wageBill)} / {formatMoney(wages.wageCap)}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-soft">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (wages.wageBill / Math.max(1, wages.wageCap)) * 100)}%`, backgroundColor: wages.over ? '#ef4444' : wages.wageBill / Math.max(1, wages.wageCap) > 0.85 ? '#eab308' : '#22c55e' }} />
                </div>
                {wages.over && <p className="flex items-center gap-1 text-xs text-rift-red"><AlertTriangle size={12} /> Wage bill exceeds the soft cap.</p>}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5"><Wallet size={14} /> Team budgets &amp; wages</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2.5">
              {[...teams].sort((a, b) => b.budget - a.budget).map((t) => {
                const w = wageSummary(t, league, allPlayers, allCoaches);
                const ratio = Math.min(100, (w.wageBill / Math.max(1, w.wageCap)) * 100);
                return (
                  <div key={t.id}>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">{t.short_name}{t.is_bot && <span className="ml-1 text-[10px] text-slate-600">bot</span>}</span>
                      <span className="text-slate-400">{formatMoney(t.budget)} · wage {formatMoney(w.wageBill)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-soft">
                      <div className="h-full rounded-full" style={{ width: `${ratio}%`, backgroundColor: w.over ? '#ef4444' : ratio > 85 ? '#eab308' : '#22c55e' }} />
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5"><CalendarClock size={14} /> Contracts expiring</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {expiring.map((p) => {
                const team = teams.find((t) => t.id === p.team_id);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-300">{p.nickname} <span className="text-xs text-slate-600">{team?.short_name}</span></span>
                    <ContractBadge status="expiring" years={contractInfo(p, league.season).years_remaining} />
                  </div>
                );
              })}
              {expiring.length === 0 && <p className="text-sm text-slate-500">No expiring contracts.</p>}
            </CardBody>
          </Card>
        </div>
      </div>

      <TradeDialog open={tradeDialog.open} onClose={tradeDialog.close} leagueId={league.id} teams={teams} players={allPlayers} />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-rift-cyan/15 text-rift-cyan' : 'text-slate-400 hover:text-slate-200'}`}
    >
      {children}
    </button>
  );
}

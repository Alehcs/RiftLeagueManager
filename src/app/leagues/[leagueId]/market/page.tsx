'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight, Search, Wallet, CalendarClock, HandCoins } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canManage, canAdminister } from '@/lib/store/hooks';
import { freeAgents, freeAgentCoaches, teamsOf, playersOf, coachesOf, marketOffersOf } from '@/lib/store/selectors';
import { PLAYER_ROLES, type Role } from '@/lib/types';
import { ROLE_META } from '@/lib/constants';
import { salaryCommitment } from '@/services/transfers';
import { PlayerRow } from '@/components/player/PlayerRow';
import { CoachRow } from '@/components/coach/CoachRow';
import { TradeDialog } from '@/components/trade/TradeDialog';
import { Card, CardHeader, CardTitle, CardBody, Button, Stat, EmptyState } from '@/components/ui/primitives';
import { useDialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/form';
import { formatDate, formatMoney } from '@/lib/utils';
import { useStore } from '@/lib/store/store';

export default function MarketPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const tradeDialog = useDialog();
  const resolveOffers = useStore((state) => state.resolveMarketOffers);
  const [tab, setTab] = useState<'players' | 'coaches'>('players');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [minRating, setMinRating] = useState(0);
  const leagueId = league?.id ?? '';
  const offers = marketOffersOf(db, leagueId);
  const activeOffers = offers.filter((offer) => offer.status === 'active');

  useEffect(() => {
    if (!leagueId || !canAdminister(role) || activeOffers.length === 0) return;
    const nextExpiry = Math.min(...activeOffers.map((offer) => +new Date(offer.expires_at)));
    const timer = window.setTimeout(() => resolveOffers(leagueId, false), Math.max(0, nextExpiry - Date.now()) + 250);
    return () => window.clearTimeout(timer);
  }, [activeOffers, leagueId, resolveOffers, role]);

  if (!league) return null;
  const teams = teamsOf(db, league.id);
  const allPlayers = playersOf(db, league.id);
  const allCoaches = coachesOf(db, league.id);
  const manage = canManage(role);
  const faCoaches = freeAgentCoaches(db, league.id);

  // Computed inline (not memoized): the store mutates `db` in place, so a
  // `db`-keyed useMemo would not refresh after a sign/release.
  const fa = freeAgents(db, league.id)
    .filter((p) => (roleFilter === 'all' || p.role === roleFilter) && p.rating_overall >= minRating && `${p.nickname} ${p.real_name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.rating_overall - a.rating_overall);

  // contracts expiring soonest (rostered players)
  const expiring = allPlayers
    .filter((p) => p.team_id && p.contract_until)
    .sort((a, b) => +new Date(a.contract_until!) - +new Date(b.contract_until!))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Transfer market</h2>
          <p className="text-sm text-slate-500">{league.market_rules || 'Submit offers, run trades, and manage team budgets.'}</p>
        </div>
        {manage && <Button variant="primary" onClick={tradeDialog.openIt}>
          <ArrowLeftRight size={16} /> Trade center
        </Button>}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        <Stat label="Free agents" value={freeAgents(db, league.id).length} accent="#26d0ce" />
        <Stat label="FA coaches" value={faCoaches.length} />
        <Stat label="Teams" value={teams.length} />
        <Stat label="Avg budget" value={formatMoney(teams.reduce((a, t) => a + t.budget, 0) / Math.max(1, teams.length))} accent="#c8a85a" />
      </div>

      {activeOffers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><HandCoins size={14} /> Active free-agent offers</CardTitle>{canAdminister(role) && <Button size="sm" variant="outline" onClick={() => resolveOffers(league.id, false)}>Resolve expired</Button>}</CardHeader>
          <CardBody className="space-y-2">
            {activeOffers.map((offer) => {
              const player = allPlayers.find((item) => item.id === offer.player_id);
              const team = teams.find((item) => item.id === offer.team_id);
              return <div key={offer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-sm"><span className="font-medium text-slate-200">{team?.short_name} → {player?.nickname}</span><span className="text-xs text-slate-400">{formatMoney(offer.transfer_fee)} fee · {formatMoney(offer.salary)}/yr · {offer.role_promise}</span></div>;
            })}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Free agents */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-soft/40 p-1">
            <TabBtn active={tab === 'players'} onClick={() => setTab('players')}>Players ({freeAgents(db, league.id).length})</TabBtn>
            <TabBtn active={tab === 'coaches'} onClick={() => setTab('coaches')}>Coaches ({faCoaches.length})</TabBtn>
          </div>

          {tab === 'players' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[160px] flex-1">
                  <Search size={15} className="absolute left-2.5 top-2.5 text-slate-500" />
                  <Input className="pl-8" placeholder="Search free agents…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <Select className="w-32" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}>
                  <option value="all">All roles</option>
                  {PLAYER_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                </Select>
                <Select className="w-32" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
                  <option value={0}>Any rating</option>
                  <option value={70}>70+</option>
                  <option value={80}>80+</option>
                  <option value={85}>85+</option>
                </Select>
              </div>
              {fa.length ? (
                <div className="space-y-2">
                  {fa.map((p) => (
                    <PlayerRow key={p.id} player={p} teams={teams} canEdit={manage} />
                  ))}
                </div>
              ) : (
                <EmptyState title="No free agents match" hint="Release a player or adjust filters." />
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
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5"><Wallet size={14} /> Team budgets</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2.5">
              {[...teams].sort((a, b) => b.budget - a.budget).map((t) => {
                const sal = salaryCommitment(t, allPlayers, allCoaches);
                const ratio = Math.min(100, (sal / Math.max(1, t.budget)) * 100);
                return (
                  <div key={t.id}>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">{t.short_name}</span>
                      <span className="text-slate-400">{formatMoney(t.budget)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-soft">
                      <div className="h-full rounded-full" style={{ width: `${ratio}%`, backgroundColor: ratio > 90 ? '#ef4444' : ratio > 70 ? '#eab308' : '#22c55e' }} />
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
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{p.nickname} <span className="text-xs text-slate-600">{team?.short_name}</span></span>
                    <span className="text-xs text-slate-500">{p.contract_until ? formatDate(p.contract_until) : '—'}</span>
                  </div>
                );
              })}
              {expiring.length === 0 && <p className="text-sm text-slate-500">No contract data.</p>}
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

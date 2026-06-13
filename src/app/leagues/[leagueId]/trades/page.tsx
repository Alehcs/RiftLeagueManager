'use client';

import { ArrowLeftRight, Check, X, Ban, ArrowRight } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canManage } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { tradesOf, tradeItemsOf, transferHistoryOf, teamsOf, playersOf, teamById, playerById } from '@/lib/store/selectors';
import type { Trade } from '@/lib/types';
import { TradeDialog } from '@/components/trade/TradeDialog';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge, EmptyState } from '@/components/ui/primitives';
import { useDialog } from '@/components/ui/dialog';
import { TeamLogo } from '@/components/ui/image';
import { RoleBadge } from '@/components/ui/rating';
import { formatMoney, timeAgo } from '@/lib/utils';

const STATUS_COLOR: Record<Trade['status'], string> = {
  pending: '#eab308',
  accepted: '#22c55e',
  rejected: '#ef4444',
  cancelled: '#64748b',
};

export default function TradesPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const setStatus = useStore((s) => s.setTradeStatus);
  const tradeDialog = useDialog();

  if (!league) return null;
  const teams = teamsOf(db, league.id);
  const players = playersOf(db, league.id);
  const trades = tradesOf(db, league.id);
  const history = transferHistoryOf(db, league.id).slice(0, 25);
  const manage = canManage(role);
  const pending = trades.filter((t) => t.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Trades</h2>
          <p className="text-sm text-slate-500">{pending.length} pending · {trades.length} total</p>
        </div>
        <Button variant="primary" onClick={tradeDialog.openIt}>
          <ArrowLeftRight size={16} /> Propose trade
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {trades.length === 0 ? (
            <EmptyState title="No trades yet" hint="Propose a trade to move players between teams." icon={<ArrowLeftRight size={36} />} />
          ) : (
            trades.map((trade) => {
              const from = teamById(db, trade.from_team_id);
              const to = teamById(db, trade.to_team_id);
              const items = tradeItemsOf(db, trade.id);
              const toFrom = items.filter((i) => i.to_team_id === trade.from_team_id);
              const toTo = items.filter((i) => i.to_team_id === trade.to_team_id);
              return (
                <Card key={trade.id}>
                  <CardBody className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        {from && <TeamLogo name={from.name} shortName={from.short_name} src={from.logo_url} size="xs" />}
                        <span className="font-semibold text-slate-200">{from?.short_name}</span>
                        <ArrowLeftRight size={14} className="text-rift-purple" />
                        <span className="font-semibold text-slate-200">{to?.short_name}</span>
                        {to && <TeamLogo name={to.name} shortName={to.short_name} src={to.logo_url} size="xs" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={STATUS_COLOR[trade.status]}>{trade.status}</Badge>
                        <span className="text-[11px] text-slate-600">{timeAgo(trade.created_at)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <TradeSide title={`${to?.short_name} receives`} playerIds={toTo.map((i) => i.player_id)} money={trade.money_from_team} db={db} />
                      <TradeSide title={`${from?.short_name} receives`} playerIds={toFrom.map((i) => i.player_id)} money={trade.money_to_team} db={db} />
                    </div>

                    {trade.status === 'pending' && manage && (
                      <div className="flex justify-end gap-2 border-t border-border pt-3">
                        <Button variant="ghost" size="sm" onClick={() => setStatus(trade.id, 'cancelled')}><Ban size={13} /> Cancel</Button>
                        <Button variant="danger" size="sm" onClick={() => setStatus(trade.id, 'rejected')}><X size={13} /> Reject</Button>
                        <Button variant="primary" size="sm" onClick={() => setStatus(trade.id, 'accepted')}><Check size={13} /> Accept</Button>
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transfer history</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {history.length === 0 && <p className="text-sm text-slate-500">No transfers yet.</p>}
            {history.map((h) => {
              const p = playerById(db, h.player_id);
              const from = teamById(db, h.from_team_id);
              const to = teamById(db, h.to_team_id);
              return (
                <div key={h.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="truncate text-slate-300">{p?.nickname ?? 'Player'}</div>
                    <div className="flex items-center gap-1 text-slate-600">
                      <span>{from?.short_name ?? 'FA'}</span>
                      <ArrowRight size={10} />
                      <span>{to?.short_name ?? 'FA'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge color="#8b5cf6">{h.transfer_type}</Badge>
                    {h.amount > 0 && <div className="mt-0.5 text-slate-500">{formatMoney(h.amount)}</div>}
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <TradeDialog open={tradeDialog.open} onClose={tradeDialog.close} leagueId={league.id} teams={teams} players={players} />
    </div>
  );
}

function TradeSide({ title, playerIds, money, db }: { title: string; playerIds: string[]; money: number; db: import('@/lib/types').Database }) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{title}</div>
      <div className="space-y-1">
        {playerIds.map((id) => {
          const p = playerById(db, id);
          if (!p) return null;
          return (
            <div key={id} className="flex items-center gap-1.5">
              <RoleBadge role={p.role} />
              <span className="truncate text-slate-200">{p.nickname}</span>
            </div>
          );
        })}
        {money > 0 && <div className="text-rift-green">+ {formatMoney(money)}</div>}
        {playerIds.length === 0 && money === 0 && <div className="text-slate-600">nothing</div>}
      </div>
    </div>
  );
}

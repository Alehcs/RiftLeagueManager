'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Eye, Sparkles } from 'lucide-react';
import { useDb, useLeague, useManagedTeamId } from '@/lib/store/hooks';
import { teamManager, teamsOf } from '@/lib/store/selectors';
import { playerCategory, runPhase } from '@/services/run';
import { TeamLogo } from '@/components/ui/image';
import { Button, Card, CardBody, Badge } from '@/components/ui/primitives';
import { PlayerCategoryBadge } from '@/components/common/badges';
import { RoleBadge, OverallBadge } from '@/components/ui/rating';
import { formatMoney } from '@/lib/utils';

export default function RosterRevealPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const managedTeamId = useManagedTeamId(league?.id);
  const teams = useMemo(() => league ? teamsOf(db, league.id).filter((team) => team.run_active !== false) : [], [db, league]);
  const [teamId, setTeamId] = useState('');
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!teamId && teams.length) setTeamId(managedTeamId ?? teams[0].id);
  }, [managedTeamId, teamId, teams]);

  const team = teams.find((item) => item.id === teamId);
  const roster = team ? db.players.filter((player) => player.team_id === team.id).sort((a, b) => a.role.localeCompare(b.role)) : [];

  useEffect(() => {
    setRevealed(0);
    if (!roster.length) return;
    const timer = window.setInterval(() => {
      setRevealed((value) => {
        if (value >= roster.length) {
          window.clearInterval(timer);
          return value;
        }
        return value + 1;
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [teamId, roster.length]);

  if (!league || !team) return null;
  const manager = teamManager(db, league.id, team.id);
  const managerName = team.is_bot
    ? team.bot_manager_name ?? 'Bot manager'
    : db.guest_sessions.find((guest) => guest.id === manager?.guest_id)?.display_name ?? 'Unassigned';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/leagues/${league.id}/lobby`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"><ChevronLeft size={14} /> Run lobby</Link>
        <div className="flex flex-wrap gap-2">{teams.map((item) => <Button key={item.id} size="sm" variant={item.id === team.id ? 'primary' : 'outline'} onClick={() => setTeamId(item.id)}>{item.short_name}</Button>)}</div>
      </div>

      <Card className="overflow-hidden border-rift-gold/30 bg-gradient-to-b from-rift-gold/10 to-bg-card">
        <CardBody className="py-8 text-center">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
            <div className="relative"><TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} color={team.color_primary} size="xl" className="ring-2 ring-rift-gold/50" /><Sparkles className="absolute -right-3 -top-3 text-rift-gold" size={22} /></div>
            <div><Badge color="#c8a85a">Roster reveal</Badge><h2 className="mt-2 text-3xl font-extrabold text-slate-50">{team.name}</h2><p className="mt-1 text-sm text-slate-400">Manager {managerName} · Starting budget {formatMoney(team.budget)}</p></div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roster.map((player, index) => {
          const visible = index < revealed || runPhase(league) !== 'roster_reveal';
          if (!visible) return <Card key={player.id} className="min-h-48 border-dashed"><CardBody className="flex min-h-48 items-center justify-center"><Eye size={28} className="text-slate-700" /></CardBody></Card>;
          const category = player.category ?? playerCategory(player.rating_overall);
          return (
            <Card key={player.id} className="animate-fade-in border-rift-cyan/20">
              <CardBody className="space-y-4">
                <div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><h3 className="text-xl font-bold text-slate-50">{player.nickname}</h3><RoleBadge role={player.role} /></div><p className="mt-1 text-xs text-slate-500">{player.real_name} · Age {player.age ?? '—'}</p></div><OverallBadge value={player.rating_overall} size="lg" /></div>
                <div className="flex items-center justify-between"><PlayerCategoryBadge category={category} /><span className="text-xs text-slate-400">Potential <strong className="text-slate-200">{player.potential ?? player.rating_overall}</strong></span></div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs"><div className="rounded-lg bg-bg-soft p-2"><div className="text-slate-600">Value</div><div className="font-semibold text-slate-200">{formatMoney(player.value)}</div></div><div className="rounded-lg bg-bg-soft p-2"><div className="text-slate-600">Salary</div><div className="font-semibold text-slate-200">{formatMoney(player.salary)}</div></div></div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

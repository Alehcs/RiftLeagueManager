'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Eye, Gamepad2, Globe2, Settings2, Swords, Trophy, Users2, Wallet } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, useManagedTeamId, canAdminister } from '@/lib/store/hooks';
import { membersOf, teamManager, teamsOf } from '@/lib/store/selectors';
import { useStore } from '@/lib/store/store';
import { FORMAT_META, LEAGUE_FORMAT_OPTIONS } from '@/lib/constants';
import type { LeagueFormat } from '@/lib/types';
import { isPreseason, nextRunPhase, RUN_PHASE_LABELS, runPhase } from '@/services/run';
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Stat } from '@/components/ui/primitives';
import { Field, Input, Select, Textarea, Toggle } from '@/components/ui/form';
import { RunPhaseBadge } from '@/components/common/badges';
import { TeamSelectionPanel } from '@/components/league/TeamSelectionPanel';
import { formatMoney } from '@/lib/utils';
import { COMPETITION_MODE_META, competitionMode } from '@/services/competition';

export default function LobbyPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const managedTeamId = useManagedTeamId(league?.id);
  const updateSetup = useStore((state) => state.updateRunSetup);
  const advance = useStore((state) => state.advanceRunPhase);
  const playFriendly = useStore((state) => state.playFriendly);
  const [friendlyOpponent, setFriendlyOpponent] = useState('');

  const [setup, setSetup] = useState({
    startingBudget: 5_000_000,
    preparationWeeks: 3,
    botsEnabled: false,
    botCount: 0,
    format: 'double_round_robin_bo1' as LeagueFormat,
    friendliesAffect: true,
    marketRules: '',
    offerWindow: 24,
  });

  useEffect(() => {
    if (!league) return;
    setSetup({
      startingBudget: league.starting_budget ?? 5_000_000,
      preparationWeeks: league.preparation_weeks ?? 3,
      botsEnabled: league.bot_teams_enabled ?? false,
      botCount: league.bot_team_count ?? 0,
      format: league.format,
      friendliesAffect: league.friendlies_affect_development ?? true,
      marketRules: league.market_rules ?? '',
      offerWindow: league.free_agent_offer_window_hours ?? 24,
    });
  }, [league]);

  if (!league) return null;
  const phase = runPhase(league);
  const isAdmin = canAdminister(role);
  const teams = teamsOf(db, league.id);
  const members = membersOf(db, league.id);
  const activeTeams = teams.filter((team) => team.run_active !== false);
  const selected = teams.filter((team) => team.is_bot || teamManager(db, league.id, team.id));
  const activeOffers = db.market_offers.filter((offer) => offer.league_id === league.id && offer.status === 'active').length;
  const managedTeam = teams.find((team) => team.id === managedTeamId);
  const friendlyOpponents = activeTeams.filter((team) => team.id !== managedTeamId);
  const finalMatch = db.matches.filter((match) => match.league_id === league.id && match.stage === 'final' && match.status === 'completed').sort((a, b) => b.week - a.week)[0];
  const champion = teams.find((team) => team.id === finalMatch?.winner_team_id);
  const watchSimulation = db.match_simulations
    .filter((simulation) => simulation.league_id === league.id)
    .sort((a, b) => (a.status === 'running' ? -1 : b.status === 'running' ? 1 : +new Date(b.started_at) - +new Date(a.started_at)))[0];

  const saveSetup = () => updateSetup(league.id, {
    starting_budget: setup.startingBudget,
    preparation_weeks: setup.preparationWeeks,
    bot_teams_enabled: setup.botsEnabled,
    bot_team_count: setup.botCount,
    format: setup.format,
    friendlies_affect_development: setup.friendliesAffect,
    market_rules: setup.marketRules,
    free_agent_offer_window_hours: setup.offerWindow,
  });

  const modeMeta = COMPETITION_MODE_META[competitionMode(league)];
  const nextLabel = phase === 'team_selection' ? 'Start run' : `Advance to ${RUN_PHASE_LABELS[nextRunPhase(league)]}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Gamepad2 className="text-rift-cyan" size={20} />
            <h2 className="text-xl font-bold text-slate-100">League run</h2>
            <RunPhaseBadge phase={phase} />
          </div>
          <p className="mt-1 text-sm text-slate-500"><span className="font-medium text-slate-300">{modeMeta.label}:</span> {modeMeta.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {watchSimulation && (
            <Link href={`/leagues/${league.id}/matches/${watchSimulation.match_id}/viewer`}>
              <Button variant={watchSimulation.status === 'running' ? 'primary' : 'outline'}><Eye size={15} /> {watchSimulation.status === 'running' ? 'Watch live match' : 'Latest replay'}</Button>
            </Link>
          )}
          <Link href={`/leagues/${league.id}/competitions`}><Button variant="outline"><Globe2 size={15} /> Circuit</Button></Link>
          {phase === 'roster_reveal' && (
            <Link href={`/leagues/${league.id}/reveal`}><Button variant="gold"><Eye size={15} /> Open roster reveal</Button></Link>
          )}
          {isAdmin && phase !== 'completed' && (
            <Button variant="primary" onClick={() => advance(league.id)}>
              {nextLabel} <ChevronRight size={15} />
            </Button>
          )}
        </div>
      </div>

      <div className="stat-grid grid-cols-2 sm:grid-cols-4">
        <Stat label="Selected teams" value={selected.length} sub={`${teams.length} available`} />
        <Stat label="Managers" value={members.filter((member) => member.role === 'manager').length} />
        <Stat label="Starting budget" value={formatMoney(league.starting_budget ?? 5_000_000)} accent="#c8a85a" />
        <Stat label="Active offers" value={activeOffers} accent="#26d0ce" />
      </div>

      {isAdmin && ['lobby', 'team_selection'].includes(phase) && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 size={15} /> Run setup</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Starting budget"><Input type="number" min={0} step={100000} value={setup.startingBudget} onChange={(event) => setSetup({ ...setup, startingBudget: Number(event.target.value) })} /></Field>
              <Field label="Preparation weeks"><Select value={setup.preparationWeeks} onChange={(event) => setSetup({ ...setup, preparationWeeks: Number(event.target.value) })}><option value={1}>1 week</option><option value={2}>2 weeks</option><option value={3}>3 weeks</option></Select></Field>
              <Field label="Tournament format"><Select value={setup.format} onChange={(event) => setSetup({ ...setup, format: event.target.value as LeagueFormat })}>{LEAGUE_FORMAT_OPTIONS.map((format) => <option key={format} value={format}>{FORMAT_META[format].label}</option>)}</Select></Field>
              <Field label="Offer window (hours)"><Input type="number" min={1} value={setup.offerWindow} onChange={(event) => setSetup({ ...setup, offerWindow: Number(event.target.value) })} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Toggle checked={setup.botsEnabled} onChange={(botsEnabled) => setSetup({ ...setup, botsEnabled })} label="Enable bot teams" />
              <Field label="Number of bot teams"><Input type="number" min={0} max={teams.length} disabled={!setup.botsEnabled} value={setup.botCount} onChange={(event) => setSetup({ ...setup, botCount: Number(event.target.value) })} /></Field>
              <Toggle checked={setup.friendliesAffect} onChange={(friendliesAffect) => setSetup({ ...setup, friendliesAffect })} label="Friendlies affect morale and synergy" />
            </div>
            <Field label="Market rules"><Textarea rows={2} value={setup.marketRules} onChange={(event) => setSetup({ ...setup, marketRules: event.target.value })} /></Field>
            <div className="flex justify-end"><Button variant="primary" onClick={saveSetup}>Save setup</Button></div>
          </CardBody>
        </Card>
      )}

      {phase === 'lobby' && (
        <Card><CardBody className="flex flex-col items-center gap-3 py-10 text-center"><Users2 size={30} className="text-rift-cyan" /><div><h3 className="font-semibold text-slate-200">Lobby open</h3><p className="mt-1 text-sm text-slate-500">Share the room invite. When everyone has joined, an admin can open team selection.</p></div></CardBody></Card>
      )}

      {phase === 'team_selection' && (
        teams.length ? <TeamSelectionPanel league={league} /> : <EmptyState title="No teams available" hint="Add or import real teams from the Admin page before opening selection." />
      )}

      {isPreseason(phase) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Preparation week {league.current_run_week ?? 1}</CardTitle></CardHeader><CardBody className="space-y-3"><p className="text-sm text-slate-400">Negotiate free agents, trade with other managers, and tune your active roster before official matches.</p><div className="flex flex-wrap gap-2"><Link href={`/leagues/${league.id}/market`}><Button variant="primary"><Wallet size={14} /> Open market</Button></Link><Link href={`/leagues/${league.id}/trades`}><Button variant="secondary"><Swords size={14} /> Trades</Button></Link></div></CardBody></Card>
          <Card><CardHeader><CardTitle>Friendly match</CardTitle></CardHeader><CardBody className="space-y-3">{managedTeam ? <><Select value={friendlyOpponent} onChange={(event) => setFriendlyOpponent(event.target.value)}><option value="">Choose opponent…</option>{friendlyOpponents.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select><Button variant="secondary" disabled={!friendlyOpponent} onClick={() => playFriendly(league.id, friendlyOpponent)}><Swords size={14} /> Play friendly</Button></> : <p className="text-sm text-slate-500">Claim a team to play preseason friendlies.</p>}</CardBody></Card>
        </div>
      )}

      {['regular_season', 'playoffs', 'msi_qualification', 'msi', 'midseason_break', 'second_regional_phase', 'regional_finals', 'worlds', 'offseason', 'next_season_setup', 'completed'].includes(phase) && (
        <Card><CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="flex items-center gap-2 font-semibold text-slate-200">{phase === 'completed' ? <><Trophy size={17} className="text-rift-gold" /> Champion: {champion?.name ?? 'Tournament complete'}</> : 'Tournament in progress'}</h3><p className="text-sm text-slate-500">Official simulations are admin-controlled and saved for every manager and viewer.</p></div><Link href={`/leagues/${league.id}/schedule`}><Button variant="primary">Open match center <ChevronRight size={14} /></Button></Link></CardBody></Card>
      )}
    </div>
  );
}

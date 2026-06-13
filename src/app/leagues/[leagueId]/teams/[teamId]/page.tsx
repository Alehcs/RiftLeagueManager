'use client';

import Link from 'next/link';
import { ChevronLeft, Pencil, Trash2, Plus, Wallet, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canManage } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { playersOfTeam, coachesOfTeam, teamsOf, matchesOf, teamById } from '@/lib/store/selectors';
import { computeTeamStrength } from '@/services/strength';
import { validateRoster, salaryCommitment } from '@/services/transfers';
import { ROLE_META } from '@/lib/constants';
import { PLAYER_ROLES } from '@/lib/types';
import { TeamLogo } from '@/components/ui/image';
import { PlayerRow } from '@/components/player/PlayerRow';
import { PlayerForm } from '@/components/player/PlayerForm';
import { CoachRow } from '@/components/coach/CoachRow';
import { TeamForm } from '@/components/team/TeamForm';
import { MatchCard } from '@/components/league/MatchCard';
import { Card, CardHeader, CardTitle, CardBody, Button, Stat, EmptyState, Divider } from '@/components/ui/primitives';
import { Dialog, ConfirmButton, useDialog } from '@/components/ui/dialog';
import { TierBadge, RegionBadge } from '@/components/common/badges';
import { RatingBar } from '@/components/ui/rating';
import { cn, formatMoney, ratingColor } from '@/lib/utils';

export default function TeamProfilePage({ params }: { params: { leagueId: string; teamId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const updateTeam = useStore((s) => s.updateTeam);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const createPlayer = useStore((s) => s.createPlayer);
  const editDialog = useDialog();
  const addPlayerDialog = useDialog();

  const team = teamById(db, params.teamId);
  if (!league || !team) return <p className="text-slate-500">Team not found.</p>;

  const allTeams = teamsOf(db, league.id);
  const allPlayers = db.players.filter((p) => p.league_id === league.id);
  const allCoaches = db.coaches.filter((c) => c.league_id === league.id);
  const roster = playersOfTeam(db, team.id);
  const coaches = coachesOfTeam(db, team.id);
  const strength = computeTeamStrength(team, allPlayers, allCoaches);
  const validation = validateRoster(team, allPlayers, allCoaches);
  const salaries = salaryCommitment(team, allPlayers, allCoaches);
  const manage = canManage(role);

  const matches = matchesOf(db, league.id)
    .filter((m) => m.blue_team_id === team.id || m.red_team_id === team.id)
    .sort((a, b) => +new Date(b.date_time) - +new Date(a.date_time))
    .slice(0, 6);

  // roster ordering: by role then overall
  const sortedRoster = [...roster].sort((a, b) => {
    const ra = ROLE_META[a.role].order;
    const rb = ROLE_META[b.role].order;
    return ra - rb || b.rating_overall - a.rating_overall;
  });

  return (
    <div className="space-y-6">
      <Link href={`/leagues/${league.id}/teams`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
        <ChevronLeft size={14} /> Teams
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} size="xl" className="rounded-2xl" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-50">{team.name}</h1>
            <TierBadge tier={team.tier} />
            <RegionBadge region={team.region} />
            <span className="font-mono text-sm text-slate-500">{team.short_name}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
            <Wallet size={14} /> {formatMoney(team.budget)} budget
            <span className="text-slate-700">·</span>
            <span>{formatMoney(salaries)} salaries</span>
          </div>
        </div>
        {manage && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={editDialog.openIt}><Pencil size={14} /> Edit</Button>
            <ConfirmButton variant="ghost" size="sm" confirmLabel="Delete team?" onConfirm={() => deleteTeam(team.id)}>
              <Trash2 size={14} />
            </ConfirmButton>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        <Stat label="Record" value={`${team.wins}-${team.losses}`} accent="#22c55e" />
        <Stat label="Games" value={`${team.games_won}-${team.games_lost}`} />
        <Stat label="Points" value={team.points} accent="#c8a85a" />
        <Stat label="Power" value={Math.round(strength.score)} accent={ratingColor(strength.score)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Roster */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">Roster ({roster.length})</h2>
            {manage && (
              <Button variant="secondary" size="sm" onClick={addPlayerDialog.openIt}>
                <Plus size={14} /> Add to roster
              </Button>
            )}
          </div>
          {sortedRoster.length ? (
            <div className="space-y-2">
              {sortedRoster.map((p) => (
                <PlayerRow key={p.id} player={p} teams={allTeams} canEdit={manage} showTeam={false} />
              ))}
            </div>
          ) : (
            <EmptyState title="Empty roster" hint="Sign players from the market or add them here." />
          )}

          {coaches.length > 0 && (
            <>
              <h2 className="mt-4 font-semibold text-slate-200">Coaching staff</h2>
              <div className="space-y-2">
                {coaches.map((c) => (
                  <CoachRow key={c.id} coach={c} teams={allTeams} canEdit={manage} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sidebar: validation + strength */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Roster validation</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {validation.issues.map((iss, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {iss.level === 'error' ? (
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rift-red" />
                  ) : iss.level === 'warn' ? (
                    <Info size={15} className="mt-0.5 shrink-0 text-rift-gold" />
                  ) : (
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-rift-green" />
                  )}
                  <span className={cn(iss.level === 'error' ? 'text-rift-red' : iss.level === 'warn' ? 'text-slate-300' : 'text-rift-green')}>
                    {iss.message}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strength breakdown</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2.5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-slate-400">Overall power</span>
                <span className="text-2xl font-bold" style={{ color: ratingColor(strength.score) }}>{Math.round(strength.score)}</span>
              </div>
              <Divider />
              {PLAYER_ROLES.map((r) => {
                const slot = strength.byRole[r];
                return (
                  <div key={r} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-9 text-[10px] font-bold" style={{ color: ROLE_META[r].color }}>{ROLE_META[r].short}</span>
                      <span className="text-slate-400">{slot ? slot.nickname : '—'}</span>
                    </span>
                    <span className="font-semibold tabular-nums" style={{ color: slot ? ratingColor(slot.overall) : '#475569' }}>
                      {slot ? slot.overall : '—'}
                    </span>
                  </div>
                );
              })}
              <Divider />
              <RatingBar label="Macro" value={Math.round(strength.macroAvg)} />
              <RatingBar label="Consist" value={Math.round(strength.consistencyAvg)} />
              <div className="flex justify-between pt-1 text-xs text-slate-500">
                <span>Coach +{strength.coachBonus}</span>
                <span>Budget +{strength.budgetBonus}</span>
                <span>Form {strength.formBonus >= 0 ? '+' : ''}{strength.formBonus}</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {matches.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold text-slate-200">Recent & upcoming</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} leagueId={league.id} />
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={editDialog.open} onClose={editDialog.close} title="Edit team" size="lg">
        <TeamForm initial={team} submitLabel="Save changes" onCancel={editDialog.close} onSave={(d) => { updateTeam(team.id, d); editDialog.close(); }} />
      </Dialog>
      <Dialog open={addPlayerDialog.open} onClose={addPlayerDialog.close} title={`Add player to ${team.short_name}`} size="lg">
        <PlayerForm
          initial={{ nickname: '', role: 'MID', team_id: team.id, status: 'active' }}
          teams={allTeams}
          submitLabel="Add player"
          onCancel={addPlayerDialog.close}
          onSave={(d) => { createPlayer(league.id, { ...d, nickname: d.nickname, role: d.role, team_id: team.id }); addPlayerDialog.close(); }}
        />
      </Dialog>
    </div>
  );
}

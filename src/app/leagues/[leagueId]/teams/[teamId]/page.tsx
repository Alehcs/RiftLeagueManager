'use client';

import Link from 'next/link';
import { ChevronLeft, Pencil, Trash2, Plus, Wallet, AlertTriangle, CheckCircle2, Info, Crown, UserPlus, UserMinus, Trophy, History, ArrowRightLeft, Zap, CalendarClock } from 'lucide-react';
import {
  useDb, useLeague, useLeagueRole, useManagedTeamId, useCurrentGuestId, canAdminister, canManageTeam,
} from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { playersOfTeam, coachesOfTeam, teamsOf, matchesOf, teamById, teamManager } from '@/lib/store/selectors';
import { computeTeamStrength } from '@/services/strength';
import { teamHistory } from '@/services/teamHistory';
import { validateRoster, salaryCommitment } from '@/services/transfers';
import { ROLE_META } from '@/lib/constants';
import { PLAYER_ROLES } from '@/lib/types';
import { TeamLogo } from '@/components/ui/image';
import { PlayerRow } from '@/components/player/PlayerRow';
import { PlayerForm } from '@/components/player/PlayerForm';
import { CoachRow } from '@/components/coach/CoachRow';
import { TeamForm } from '@/components/team/TeamForm';
import { MatchCard } from '@/components/league/MatchCard';
import { Card, CardHeader, CardTitle, CardBody, Button, Stat, EmptyState, Divider, Badge } from '@/components/ui/primitives';
import { Dialog, ConfirmButton, useDialog } from '@/components/ui/dialog';
import { TierBadge, RegionBadge, TeamStatusBadge } from '@/components/common/badges';
import { RatingBar } from '@/components/ui/rating';
import { cn, formatMoney, ratingColor, timeAgo } from '@/lib/utils';

export default function TeamProfilePage({ params }: { params: { leagueId: string; teamId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const managedTeam = useManagedTeamId(league?.id);
  const myGuestId = useCurrentGuestId();
  const updateTeam = useStore((s) => s.updateTeam);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const createPlayer = useStore((s) => s.createPlayer);
  const claimTeam = useStore((s) => s.claimTeam);
  const removeManager = useStore((s) => s.removeManager);
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
  const isAdmin = canAdminister(role);
  const manage = canManageTeam(role, managedTeam, team.id); // can manage THIS team's roster
  const managerMember = teamManager(db, league.id, team.id);
  const managerGuest = managerMember ? db.guest_sessions.find((g) => g.id === managerMember.guest_id) : undefined;
  const isMyTeam = managerMember?.guest_id === myGuestId;
  // A non-managing member may claim this team when it is unmanaged and they
  // don't already manage another team in the league.
  const canClaim = !managerMember && !managedTeam && role !== 'owner' && role !== 'admin';

  const matches = matchesOf(db, league.id)
    .filter((m) => m.blue_team_id === team.id || m.red_team_id === team.id)
    .sort((a, b) => +new Date(b.date_time) - +new Date(a.date_time))
    .slice(0, 6);

  const history = teamHistory(db, league, team);
  const { identity } = history;

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
            <TeamStatusBadge active={identity.active} legacyLabel={identity.legacyLabel} />
            <span className="font-mono text-sm text-slate-500">{team.short_name}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <Wallet size={14} /> {formatMoney(team.budget)} budget
            <span className="text-slate-700">·</span>
            <span>{formatMoney(salaries)} salaries</span>
            <span className="text-slate-700">·</span>
            <span className="inline-flex items-center gap-1">
              <Crown size={13} className={managerGuest ? 'text-rift-gold' : 'text-slate-600'} />
              {managerGuest ? (
                <span className="text-slate-300">Manager: <span className="font-medium text-slate-100">{managerGuest.display_name}</span>{isMyTeam && ' (you)'}</span>
              ) : (
                <span className="text-slate-500">Unmanaged</span>
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canClaim && (
            <Button variant="primary" size="sm" onClick={() => claimTeam(league.id, team.id)}>
              <UserPlus size={14} /> Claim team
            </Button>
          )}
          {isMyTeam && (
            <ConfirmButton variant="outline" size="sm" confirmLabel="Leave team?" onConfirm={() => removeManager(league.id, myGuestId)}>
              <UserMinus size={14} /> Leave
            </ConfirmButton>
          )}
          {isAdmin && managerMember && !isMyTeam && (
            <ConfirmButton variant="ghost" size="sm" confirmLabel="Remove manager?" onConfirm={() => removeManager(league.id, managerMember.guest_id)}>
              <UserMinus size={14} /> Remove mgr
            </ConfirmButton>
          )}
          {isAdmin && (
            <>
              <Button variant="secondary" size="sm" onClick={editDialog.openIt}><Pencil size={14} /> Edit</Button>
              <ConfirmButton variant="ghost" size="sm" confirmLabel="Delete team?" onConfirm={() => deleteTeam(team.id)}>
                <Trash2 size={14} />
              </ConfirmButton>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        <Stat label="Record" value={`${team.wins}-${team.losses}`} accent="#22c55e" />
        <Stat label="Games" value={`${team.games_won}-${team.games_lost}`} />
        <Stat label="Points" value={team.points} accent="#c8a85a" />
        <Stat label="Power" value={Math.round(strength.score)} accent={ratingColor(strength.score)} />
      </div>

      {/* Trophy cabinet + history */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Trophy cabinet */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Trophy size={15} className="text-rift-gold" /> Trophy cabinet</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5">
              <Stat label="Worlds" value={history.worldsTitles} accent="#c8a85a" />
              <Stat label="MSI" value={history.msiTitles} accent="#8b5cf6" />
              <Stat label="Regional" value={history.regionalTitles} accent="#22c55e" />
              <Stat label="Finals" value={history.finalsAppearances} />
              <Stat label="Playoffs" value={history.playoffAppearances} accent="#26d0ce" />
            </div>
            {history.trophies.length ? (
              <div className="flex flex-wrap gap-2">
                {history.trophies.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-soft/40 px-2.5 py-1.5 text-sm">
                    <Trophy size={13} style={{ color: t.color }} />
                    <span className="text-slate-200">{t.label}</span>
                    {t.season && <span className="text-[11px] text-slate-500">{t.season}</span>}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No trophies yet — win playoffs, MSI or Worlds to fill the cabinet.</p>
            )}
            {(history.biggestWin || history.biggestUpset) && (
              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                {history.biggestWin && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-rift-green/30 bg-rift-green/5 px-2.5 py-1.5 text-rift-green">
                    <Zap size={12} /> Biggest win {history.biggestWin.scoreFor}-{history.biggestWin.scoreAgainst} vs {history.biggestWin.opponent?.short_name ?? '—'}
                  </span>
                )}
                {history.biggestUpset && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-rift-purple/30 bg-rift-purple/5 px-2.5 py-1.5 text-rift-purple">
                    <Zap size={12} /> Upset over {history.biggestUpset.opponent.short_name} (+{history.biggestUpset.seedGap} seeds)
                  </span>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Organization identity */}
        <Card>
          <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
          <CardBody className="space-y-2.5 text-sm">
            <Row label="Home region" value={identity.region} />
            <Row label="Tier" value={<TierBadge tier={identity.tier} />} />
            <Row label="Status" value={<TeamStatusBadge active={identity.active} legacyLabel={null} />} />
            {identity.color && (
              <Row label="Colors" value={<span className="inline-flex items-center gap-1.5"><span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: identity.color }} /><span className="font-mono text-xs text-slate-400">{identity.color}</span></span>} />
            )}
            {identity.legacyLabel && (
              <div className="rounded-lg border border-rift-gold/30 bg-rift-gold/5 px-2.5 py-2 text-xs text-rift-gold">{identity.legacyLabel}</div>
            )}
            {identity.nostalgia && (
              <p className="text-[11px] text-slate-500">Historic / legacy organization — reserved for nostalgia templates and custom tournaments.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Results + roster movement + past seasons */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-1.5"><History size={15} className="text-rift-cyan" /> Recent results</CardTitle></CardHeader>
          <CardBody>
            {history.recentResults.length ? (
              <div className="space-y-1.5">
                {history.recentResults.map((r) => (
                  <Link key={r.match.id} href={`/leagues/${league.id}/matches/${r.match.id}`} className="flex items-center gap-2 rounded-lg border border-border/60 bg-bg-soft/30 px-2.5 py-1.5 text-sm hover:border-rift-cyan/40">
                    <span className={cn('w-5 text-center text-xs font-bold', r.won ? 'text-rift-green' : 'text-rift-red/80')}>{r.won ? 'W' : 'L'}</span>
                    {r.opponent && <TeamLogo name={r.opponent.name} shortName={r.opponent.short_name} src={r.opponent.logo_url} size="xs" />}
                    <span className="flex-1 truncate text-slate-300">vs {r.opponent?.short_name ?? 'TBD'}</span>
                    <span className="tabular-nums font-semibold text-slate-200">{r.scoreFor}-{r.scoreAgainst}</span>
                    <span className="text-[11px] text-slate-600">{timeAgo(r.match.date_time)}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No matches played yet.</p>}
            {history.nextMatch && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rift-cyan/30 bg-rift-cyan/5 px-2.5 py-2 text-sm">
                <CalendarClock size={14} className="text-rift-cyan" />
                <span className="text-slate-300">Next:</span>
                <Link href={`/leagues/${league.id}/matches/${history.nextMatch.id}`} className="font-medium text-rift-cyan hover:underline">
                  vs {(teamById(db, history.nextMatch.blue_team_id === team.id ? history.nextMatch.red_team_id : history.nextMatch.blue_team_id))?.short_name ?? 'TBD'}
                </Link>
                <span className="ml-auto text-[11px] text-slate-500">{new Date(history.nextMatch.date_time).toLocaleDateString()}</span>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><ArrowRightLeft size={15} className="text-rift-purple" /> Roster moves</CardTitle></CardHeader>
          <CardBody>
            {history.rosterChanges.length ? (
              <div className="space-y-2">
                {history.rosterChanges.map((c) => (
                  <div key={c.id} className="border-b border-border/50 pb-1.5 text-sm last:border-0">
                    <span className="text-slate-300">{c.message}</span>
                    <span className="ml-1.5 text-[11px] text-slate-600">{timeAgo(c.ts)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No transfers recorded yet.</p>}
          </CardBody>
        </Card>
      </div>

      {history.pastSeasons.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Previous seasons</CardTitle></CardHeader>
          <CardBody>
            <div className="space-y-1.5">
              {history.pastSeasons.map((s) => (
                <div key={s.season} className="flex flex-wrap items-center gap-2 border-b border-border/50 py-1.5 text-sm last:border-0">
                  <span className="w-28 font-medium text-slate-200">{s.season}</span>
                  <span className="tabular-nums text-slate-400">{s.wins}-{s.losses} · {s.points} pts</span>
                  <span className="ml-auto flex gap-1.5">
                    {s.worlds && <Badge color="#c8a85a">Worlds</Badge>}
                    {s.msi && <Badge color="#8b5cf6">MSI</Badge>}
                    {s.regional && <Badge color="#22c55e">Regional</Badge>}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Roster */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">Roster ({roster.length})</h2>
            {isAdmin && (
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

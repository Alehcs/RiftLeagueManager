'use client';

import Link from 'next/link';
import {
  ChevronLeft, Trophy, Award, Star, History, Search, DollarSign, LogOut, ExternalLink,
  Crown, Activity, TrendingUp, ArrowRightLeft, Sparkles, Shield,
} from 'lucide-react';
import { useDb, useLeague, useLeagueRole, useManagedTeamId, canAdminister, canManageTeam } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { teamById } from '@/lib/store/selectors';
import { contractInfo } from '@/services/contracts';
import { isScouted, scoutReport, formatEstimate, overallEstimate, potentialEstimate } from '@/services/scouting';
import { playerCareerStats, playerCareerHistory, playerAwards, playerLegacy, competitionLabel } from '@/services/playerCareer';
import { playerCategory } from '@/services/run';
import { PlayerAvatar, TeamLogo } from '@/components/ui/image';
import { OverallBadge, RoleBadge, RatingBar } from '@/components/ui/rating';
import { PlayerStatusBadge, PlayerCategoryBadge, ContractBadge, GeneratedBadge, InitArchetypeBadge } from '@/components/common/badges';
import { Card, CardHeader, CardTitle, CardBody, Badge, Button, EmptyState, Stat } from '@/components/ui/primitives';
import { flagEmoji, formatMoney, timeAgo, cn } from '@/lib/utils';

export default function PlayerProfilePage({ params }: { params: { leagueId: string; playerId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const managedTeam = useManagedTeamId(league?.id);
  const scoutPlayer = useStore((s) => s.scoutPlayer);
  const sellPlayer = useStore((s) => s.sellPlayer);
  const releasePlayer = useStore((s) => s.releasePlayer);
  const setPlayerStatus = useStore((s) => s.setPlayerStatus);

  if (!league) return null;
  const player = db.players.find((p) => p.id === params.playerId && p.league_id === league.id);
  if (!player) {
    return (
      <div className="space-y-4">
        <Link href={`/leagues/${league.id}/players`} className="inline-flex items-center gap-1 text-sm text-rift-cyan hover:underline"><ChevronLeft size={15} /> Players</Link>
        <EmptyState title="Player not found" hint="This player may have been removed." icon={<Shield size={36} />} />
      </div>
    );
  }

  const team = teamById(db, player.team_id);
  const season = league.season;
  const contract = contractInfo(player, season);
  const scouted = isScouted(player);
  const report = scoutReport(player, season);
  const stats = playerCareerStats(db, player.id);
  const history = playerCareerHistory(db, player);
  const awards = playerAwards(db, league, player);
  const legacy = playerLegacy(player, awards);
  const category = player.category ?? playerCategory(player.rating_overall);

  const isAdmin = canAdminister(role);
  const canManageThis = canManageTeam(role, managedTeam, player.team_id);
  const canScout = (role === 'owner' || role === 'admin' || role === 'manager') && !scouted;

  return (
    <div className="space-y-5">
      <Link href={`/leagues/${league.id}/players`} className="inline-flex items-center gap-1 text-sm text-rift-cyan hover:underline"><ChevronLeft size={15} /> Players</Link>

      {/* Header */}
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <PlayerAvatar name={player.nickname} src={player.image_url} seed={player.avatar_seed} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-extrabold text-slate-50">{flagEmoji(player.nationality)} {player.nickname}</h2>
              <RoleBadge role={player.role} />
              <PlayerStatusBadge status={player.status} />
              <Badge color={legacy.color}>{legacy.tier}</Badge>
            </div>
            <div className="mt-1 text-sm text-slate-400">{player.real_name || '—'}{player.age ? ` · ${player.age}y` : ''}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              {team ? (
                <Link href={`/leagues/${league.id}/teams/${team.id}`} className="flex items-center gap-1.5 text-slate-300 hover:text-rift-cyan">
                  <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} color={team.color_primary} size="xs" /> {team.name}
                </Link>
              ) : <span className="text-rift-cyan">Free agent</span>}
              <PlayerCategoryBadge category={category} />
              <ContractBadge status={contract.status} years={contract.years_remaining} />
              <InitArchetypeBadge archetype={player.init_archetype} showGenerated />
              <GeneratedBadge show={player.generated} />
            </div>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            {scouted ? <OverallBadge value={player.rating_overall} size="lg" /> : (
              <div className="rounded-lg border border-dashed border-border bg-bg-soft/60 px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Est. OVR</div>
                <div className="text-xl font-bold text-slate-300">{formatEstimate(overallEstimate(player))}</div>
              </div>
            )}
            <div className="text-center text-xs text-slate-500">Potential<br /><span className="text-sm font-semibold text-slate-300">{scouted ? (player.potential ?? player.rating_overall) : formatEstimate(potentialEstimate(player))}</span></div>
          </div>
        </CardBody>
      </Card>

      {/* Quick actions */}
      {(canScout || canManageThis) && (
        <div className="flex flex-wrap gap-2">
          {canScout && <Button variant="secondary" size="sm" onClick={() => scoutPlayer(player.id)}><Search size={14} /> Scout</Button>}
          {canManageThis && (player.status === 'active' || player.status === 'benched') && (
            <Button variant="outline" size="sm" onClick={() => setPlayerStatus(player.id, player.status === 'active' ? 'benched' : 'active')}>{player.status === 'active' ? 'Bench' : 'Activate'}</Button>
          )}
          {canManageThis && <Button variant="outline" size="sm" onClick={() => sellPlayer(player.id)}><DollarSign size={14} /> Sell ({formatMoney(player.value)})</Button>}
          {canManageThis && <Button variant="ghost" size="sm" onClick={() => releasePlayer(player.id)}><LogOut size={14} /> Release</Button>}
          {(isAdmin || canManageThis) && <Link href={`/leagues/${league.id}/market`}><Button variant="ghost" size="sm">Market <ExternalLink size={13} /></Button></Link>}
        </div>
      )}

      {/* Key meta */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        <Stat label="Value" value={formatMoney(player.value)} accent="#c8a85a" />
        <Stat label="Salary" value={`${formatMoney(player.salary)}/yr`} />
        <Stat label="Contract" value={contract.status === 'free_agent' ? 'Free agent' : contract.years_remaining != null ? `${Math.max(0, contract.years_remaining)} seasons` : '—'} />
        <Stat label="Buyout" value={player.team_id ? formatMoney(contract.buyout) : '—'} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: ratings / scouting */}
        <div className="space-y-5 lg:col-span-2">
          {/* This-season stats */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Activity size={15} className="text-rift-cyan" /> This season</CardTitle></CardHeader>
            <CardBody>
              {stats.games > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                    <Mini label="Series" value={stats.games} />
                    <Mini label="W-L" value={`${stats.wins}-${stats.losses}`} />
                    <Mini label="KDA" value={stats.kda} accent="#26d0ce" />
                    <Mini label="CS/g" value={stats.csPerGame} />
                    <Mini label="MVPs" value={stats.mvps} accent="#c8a85a" />
                    <Mini label="Impact" value={stats.avgImpact} />
                  </div>
                  <div className="mt-2 text-center text-xs text-slate-500">{stats.kills}/{stats.deaths}/{stats.assists} total · {formatMoney(stats.goldPerGame)} gold/game</div>
                  {stats.byCompetition.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">{stats.byCompetition.map((c) => <Badge key={c.key} color="#475569">{competitionLabel(c.key)}: {c.wins}/{c.games}</Badge>)}</div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">No matches played yet this season.</p>
              )}
            </CardBody>
          </Card>

          {/* Ratings or scout report */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Star size={15} className="text-rift-gold" /> {scouted ? 'Ratings' : 'Scout report'}</CardTitle>{!scouted && <Badge color={report.recommendation === 'sign' ? '#22c55e' : report.recommendation === 'prospect' ? '#3b82f6' : report.recommendation === 'avoid' ? '#ef4444' : '#eab308'}>{report.recommendationLabel}</Badge>}</CardHeader>
            <CardBody className="space-y-2">
              {scouted ? (
                <>
                  <RatingBar label="Laning" value={player.rating_laning} />
                  <RatingBar label="Teamfight" value={player.rating_teamfighting} />
                  <RatingBar label="Macro" value={player.rating_macro} />
                  <RatingBar label="Mechanics" value={player.rating_mechanics} />
                  <RatingBar label="Consistency" value={player.rating_consistency} />
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">Strengths: </span><span className="text-rift-green">{report.strengths.join(', ')}</span></div>
                  <div><span className="text-slate-500">Weaknesses: </span><span className="text-rift-red">{report.weaknesses.join(', ')}</span></div>
                  <div><span className="text-slate-500">Est. OVR: </span><span className="text-slate-300">{formatEstimate(report.overall)}</span></div>
                  <div><span className="text-slate-500">Est. potential: </span><span className="text-slate-300">{formatEstimate(report.potential)}</span></div>
                  <div className="col-span-2 text-slate-500">Scout this player to reveal exact ratings.</div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Career history */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><History size={15} className="text-rift-purple" /> Career history</CardTitle></CardHeader>
            <CardBody>
              {history.length ? (
                <div className="space-y-2.5">
                  {history.map((e) => (
                    <div key={e.id} className="flex items-start gap-2.5">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.kind === 'current' ? '#26d0ce' : e.kind === 'signing' ? '#22c55e' : e.kind === 'retire' ? '#ef4444' : '#8b5cf6' }} />
                      <div className="min-w-0 flex-1 border-b border-border/50 pb-2 text-sm">
                        <span className="text-slate-300">{e.message}</span>
                        <span className="ml-2 text-[11px] text-slate-600">{timeAgo(e.ts)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No transfer history recorded yet.</p>}
            </CardBody>
          </Card>
        </div>

        {/* Right: awards / development */}
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Trophy size={15} className="text-rift-gold" /> Awards &amp; trophies</CardTitle></CardHeader>
            <CardBody>
              {awards.length ? (
                <div className="space-y-2">
                  {awards.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border bg-bg-soft/30 px-2.5 py-1.5">
                      {a.kind === 'champion' ? <Crown size={14} style={{ color: a.color }} /> : a.kind === 'mvp' || a.kind === 'season_mvp' ? <Star size={14} style={{ color: a.color }} /> : <Award size={14} style={{ color: a.color }} />}
                      <span className="text-sm text-slate-200">{a.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No awards yet" hint="Win matches and tournaments to earn honors." icon={<Award size={32} />} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><TrendingUp size={15} className="text-rift-green" /> Development</CardTitle></CardHeader>
            <CardBody className="space-y-2">
              <Meter label="Overall" value={player.rating_overall} color="#26d0ce" max={99} />
              <Meter label="Potential" value={player.potential ?? player.rating_overall} color="#8b5cf6" max={99} />
              <Meter label="Form" value={player.performance_form ?? 50} color="#22c55e" />
              <Meter label="Morale" value={player.morale ?? 50} color="#eab308" />
              <Meter label="Fatigue" value={player.fatigue ?? 0} color="#ef4444" invert />
              <p className="pt-1 text-[11px] text-slate-600"><Sparkles size={11} className="mb-0.5 mr-1 inline" />Trajectory reflects the current season; players grow or decline each offseason.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><ArrowRightLeft size={15} /> Legacy</CardTitle></CardHeader>
            <CardBody>
              <div className="flex items-center gap-2">
                <Badge color={legacy.color}>{legacy.tier}</Badge>
                <span className="text-xs text-slate-500">{awards.length} career honor{awards.length === 1 ? '' : 's'}</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold" style={{ color: accent ?? '#e2e8f0' }}>{value}</div>
    </div>
  );
}

function Meter({ label, value, color, max = 100, invert }: { label: string; value: number; color: string; max?: number; invert?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const barColor = invert ? (pct > 70 ? '#ef4444' : pct > 40 ? '#eab308' : '#22c55e') : color;
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-slate-500"><span>{label}</span><span>{Math.round(value)}</span></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-bg-soft"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} /></div>
    </div>
  );
}

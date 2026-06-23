'use client';

import Link from 'next/link';
import {
  LayoutDashboard, Globe2, Trophy, Swords, Wallet, CalendarClock, Inbox, Search,
  AlertTriangle, ChevronRight, RefreshCw, FileSignature, Gamepad2, Clock, Eye, Play,
  ArrowRight, Activity, Shield, TrendingUp, Users2, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useDb, useLeague, useLeagueRole, useCurrentGuestId, canAdminister } from '@/lib/store/hooks';
import { buildCareerHub, type HubAlert, type AlertSeverity } from '@/services/careerHub';
import { COMPETITION_MODE_META, competitionMode } from '@/services/competition';
import { SimControls } from '@/components/league/SimControls';
import { MatchCard } from '@/components/league/MatchCard';
import { StandingsTable } from '@/components/league/StandingsTable';
import { TeamLogo, PlayerAvatar } from '@/components/ui/image';
import { OverallBadge, RoleBadge } from '@/components/ui/rating';
import { ContractBadge } from '@/components/common/badges';
import { Card, CardHeader, CardTitle, CardBody, Badge, Button, EmptyState } from '@/components/ui/primitives';
import { teamsOf, matchesOf, playersOf } from '@/lib/store/selectors';
import { contractInfo } from '@/services/contracts';
import { formatMoney, timeAgo, cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  Gamepad2, Clock, AlertTriangle, Inbox, RefreshCw, FileSignature, ChevronRight, Swords,
  CalendarClock, Wallet, Search, Trophy, Eye, Play,
};

const SEVERITY: Record<AlertSeverity, { ring: string; text: string; bg: string }> = {
  urgent: { ring: 'border-rift-red/50', text: 'text-rift-red', bg: 'bg-rift-red/10' },
  info: { ring: 'border-rift-cyan/40', text: 'text-rift-cyan', bg: 'bg-rift-cyan/5' },
  success: { ring: 'border-rift-green/40', text: 'text-rift-green', bg: 'bg-rift-green/10' },
};

const DIFFICULTY_COLOR = { easier: '#22c55e', even: '#eab308', tougher: '#ef4444' } as const;

export default function CareerHubPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const guestId = useCurrentGuestId();
  const role = useLeagueRole(league?.id);
  if (!league) return null;
  const hub = buildCareerHub(db, league.id, guestId);
  if (!hub) return null;

  const base = `/leagues/${league.id}`;
  const href = (h?: string) => (h ? `${base}${h}` : base);
  const isAdmin = canAdminister(role);
  const { snapshot, stage, nextMatch, qualification, market, activity, alerts, recommended } = hub;
  const teams = teamsOf(db, league.id);
  const matches = matchesOf(db, league.id);
  const players = playersOf(db, league.id);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard size={20} className="text-rift-cyan" />
            <h2 className="text-xl font-bold text-slate-100">Career Hub</h2>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{hub.audience === 'manager' ? 'Your team home base' : hub.audience === 'admin' ? 'League control center' : 'Spectator view'} · {COMPETITION_MODE_META[competitionMode(league)].short} · {league.season}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color="#a78bfa">{hub.roleLabel}</Badge>
          {stage.competitionLabel && <Badge color="#26d0ce">{stage.competitionLabel}</Badge>}
        </div>
      </div>

      {/* Recommended next action */}
      {recommended && <RecommendedBanner alert={recommended} href={href} />}

      {/* Snapshot · Stage · Next match */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {snapshot ? (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Shield size={15} className="text-rift-gold" /> My team</CardTitle><Link href={href(`/teams/${snapshot.team.id}`)} className="text-xs text-rift-cyan hover:underline">Open →</Link></CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <TeamLogo name={snapshot.team.name} shortName={snapshot.team.short_name} src={snapshot.team.logo_url} size="md" />
                <div className="min-w-0">
                  <div className="truncate font-bold text-slate-100">{snapshot.team.name}</div>
                  <div className="text-xs text-slate-500">{snapshot.region} · {snapshot.team.short_name}{snapshot.regionalPosition ? ` · #${snapshot.regionalPosition}/${snapshot.regionalCount}` : ''}</div>
                </div>
                <div className="ml-auto text-center">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Strength</div>
                  <div className="text-lg font-bold text-rift-cyan">{snapshot.strength}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <Mini label="Record" value={`${snapshot.record.wins}-${snapshot.record.losses}`} />
                <Mini label="Budget" value={formatMoney(snapshot.budget)} accent="#c8a85a" />
                <Mini label="Wage room" value={formatMoney(snapshot.wages.wageRoom)} accent={snapshot.wages.over ? '#ef4444' : '#22c55e'} />
                <Mini label="Roster" value={snapshot.rosterComplete ? 'Valid' : 'Incomplete'} accent={snapshot.rosterComplete ? '#22c55e' : '#ef4444'} />
              </div>
              <div className="space-y-1.5">
                <MeterRow label="Morale" value={snapshot.morale} color="#22c55e" />
                <MeterRow label="Form" value={snapshot.form} color="#26d0ce" />
                <MeterRow label="Fatigue" value={snapshot.fatigue} color="#ef4444" invert />
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Users2 size={15} /> League snapshot</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Teams</span><span className="text-slate-200">{teams.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Matches played</span><span className="text-slate-200">{matches.filter((m) => m.status === 'completed').length}/{matches.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Rostered players</span><span className="text-slate-200">{players.filter((p) => p.team_id).length}</span></div>
              <Link href={href('/standings')} className="mt-1 inline-flex items-center gap-1 text-xs text-rift-cyan hover:underline">Standings <ArrowRight size={12} /></Link>
            </CardBody>
          </Card>
        )}

        {/* Stage */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Activity size={15} className="text-rift-purple" /> Season stage</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-slate-100">{stage.phaseLabel}</span>
                {stage.nextPhaseLabel && <span className="text-[11px] text-slate-500">Next: {stage.nextPhaseLabel}</span>}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{stage.explanation}</p>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wide text-slate-500"><span>Season progress</span><span>{stage.progress}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-soft"><div className="h-full rounded-full bg-rift-purple" style={{ width: `${stage.progress}%` }} /></div>
            </div>
            {isAdmin && stage.started && <SimControls leagueId={league.id} compact />}
          </CardBody>
        </Card>

        {/* Next match */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Swords size={15} className="text-rift-red" /> {snapshot ? 'Next match' : 'Up next'}</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {nextMatch.match && nextMatch.opponent ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">{nextMatch.competitionLabel}</span>
                  {nextMatch.difficulty && <Badge color={DIFFICULTY_COLOR[nextMatch.difficulty]}>{nextMatch.difficulty}</Badge>}
                </div>
                <div className="flex items-center justify-center gap-3 py-1">
                  <TeamLogo name={nextMatch.opponent.name} shortName={nextMatch.opponent.short_name} src={nextMatch.opponent.logo_url} size="md" />
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{snapshot ? 'vs' : 'Featured'}</div>
                    <div className="font-bold text-slate-100">{nextMatch.opponent.name}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={href(`/matches/${nextMatch.match.id}`)} className="flex-1"><Button variant="primary" size="sm" className="w-full"><Eye size={14} /> View match</Button></Link>
                  <Link href={href('/schedule')}><Button variant="outline" size="sm">Schedule</Button></Link>
                </div>
              </>
            ) : nextMatch.match ? (
              <Link href={href(`/matches/${nextMatch.match.id}`)}><Button variant="primary" size="sm" className="w-full"><Eye size={14} /> View next match</Button></Link>
            ) : (
              <EmptyState title="No matches scheduled" hint={stage.started ? 'This stage is complete or awaiting the next phase.' : 'Start the run to generate a schedule.'} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Alerts + Qualification */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Sparkles size={15} className="text-rift-gold" /> To-do &amp; alerts</CardTitle></CardHeader>
          <CardBody className="space-y-2">
            {alerts.length ? alerts.map((a) => <AlertRow key={a.id} alert={a} href={href} />) : <p className="text-sm text-slate-500">All caught up — nothing needs your attention.</p>}
          </CardBody>
        </Card>

        {qualification.enabled ? (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Globe2 size={15} className="text-rift-cyan" /> Qualification race</CardTitle><Link href={href('/playoffs')} className="text-xs text-rift-cyan hover:underline">Brackets →</Link></CardHeader>
            <CardBody className="space-y-3">
              {(qualification.myMsi || qualification.myWorlds) && (
                <div className="flex items-center gap-2 rounded-lg border border-rift-gold/40 bg-rift-gold/10 px-3 py-2 text-sm">
                  <Trophy size={15} className="text-rift-gold" />
                  <span className="font-semibold text-rift-gold">Your team qualified for {qualification.myWorlds ? 'Worlds' : 'MSI'}!</span>
                  <Link href={href('/playoffs')} className="ml-auto text-xs text-rift-cyan hover:underline">View →</Link>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 text-xs text-slate-400">{qualification.regions.length} region{qualification.regions.length === 1 ? '' : 's'}: {qualification.regions.map((r) => <Badge key={r} color="#64748b">{r}</Badge>)}</div>
              <QualBlock title="MSI" color="#26d0ce" teams={qualification.msi} mine={qualification.myMsi} />
              <QualBlock title="Worlds" color="#c8a85a" teams={qualification.worlds} mine={qualification.myWorlds} />
              {qualification.bubble.length > 0 && <div className="text-xs text-slate-500">Bubble: {qualification.bubble.map((t) => t.short_name).join(' · ')}</div>}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Trophy size={15} className="text-rift-gold" /> Standings</CardTitle><Link href={href('/standings')} className="text-xs text-rift-cyan hover:underline">Full table →</Link></CardHeader>
            <CardBody className="p-0">{teams.length ? <StandingsTable teams={teams} matches={matches} leagueId={league.id} limit={6} compact /> : <div className="p-4"><EmptyState title="No standings yet" /></div>}</CardBody>
          </Card>
        )}
      </div>

      {/* Market & contracts + Recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Wallet size={15} className="text-rift-gold" /> Market &amp; contracts</CardTitle><Link href={href('/market')} className="text-xs text-rift-cyan hover:underline">Market →</Link></CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Mini label="Incoming" value={market.incomingOffers} accent={market.incomingOffers ? '#ef4444' : undefined} />
              <Mini label="FA offers" value={market.activeFaOffers} />
              <Mini label="Free agents" value={market.freeAgentCount} accent="#26d0ce" />
            </div>
            {market.expiringMine.length > 0 && (
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Your expiring contracts</div>
                <div className="space-y-1">{market.expiringMine.slice(0, 4).map((p) => <div key={p.id} className="flex items-center justify-between text-sm"><span className="text-slate-300">{p.nickname}</span><ContractBadge status="expiring" years={contractInfo(p, league.season).years_remaining} /></div>)}</div>
              </div>
            )}
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Top free agents</div>
              {market.topFreeAgents.length ? <div className="space-y-1">{market.topFreeAgents.map((p) => (
                <Link key={p.id} href={href(`/players/${p.id}`)} className="flex items-center gap-2 rounded-md p-1 hover:bg-bg-elevated">
                  <PlayerAvatar name={p.nickname} src={p.image_url} size="sm" />
                  <span className="flex-1 truncate text-sm text-slate-200">{p.nickname}</span>
                  <RoleBadge role={p.role} />
                  <OverallBadge value={p.rating_overall} size="sm" />
                </Link>
              ))}</div> : <p className="text-sm text-slate-500">No free agents available.</p>}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><TrendingUp size={15} className="text-rift-green" /> Recent activity</CardTitle></CardHeader>
          <CardBody className="space-y-2">
            {activity.length ? activity.map((item) => (
              <div key={item.id} className="flex items-start gap-2 text-xs">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.kind === 'match' ? '#22c55e' : item.kind === 'transfer' ? '#8b5cf6' : item.kind === 'season' ? '#c8a85a' : '#26d0ce' }} />
                <div className="min-w-0 flex-1"><p className="text-slate-300">{item.message}</p><p className="text-[10px] text-slate-600">{timeAgo(item.ts)}</p></div>
              </div>
            )) : <p className="text-sm text-slate-500">No activity yet.</p>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function RecommendedBanner({ alert, href }: { alert: HubAlert; href: (h?: string) => string }) {
  const sev = SEVERITY[alert.severity];
  const Icon = ICONS[alert.icon] ?? Sparkles;
  return (
    <Card className={cn('border', sev.ring, sev.bg)}>
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', sev.bg, sev.text)}><Icon size={20} /></div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recommended next</div>
            <div className="font-bold text-slate-100">{alert.title}</div>
            {alert.detail && <div className="text-xs text-slate-400">{alert.detail}</div>}
          </div>
        </div>
        {alert.href && <Link href={href(alert.href)}><Button variant="primary" size="sm">{alert.cta ?? 'Go'} <ChevronRight size={14} /></Button></Link>}
      </CardBody>
    </Card>
  );
}

function AlertRow({ alert, href }: { alert: HubAlert; href: (h?: string) => string }) {
  const sev = SEVERITY[alert.severity];
  const Icon = ICONS[alert.icon] ?? Sparkles;
  const body = (
    <div className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', sev.ring, sev.bg)}>
      <Icon size={16} className={sev.text} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-200">{alert.title}</div>
        {alert.detail && <div className="truncate text-xs text-slate-500">{alert.detail}</div>}
      </div>
      {alert.href && <ChevronRight size={15} className="shrink-0 text-slate-600" />}
    </div>
  );
  return alert.href ? <Link href={href(alert.href)} className="block transition-opacity hover:opacity-90">{body}</Link> : body;
}

function QualBlock({ title, color, teams, mine }: { title: string; color: string; teams: { team: import('@/lib/types').Team; status: string }[]; mine: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2"><Badge color={color}>{title}</Badge>{mine && <Badge color="#22c55e">You qualify</Badge>}</div>
      <div className="flex flex-wrap gap-1.5">
        {teams.length ? teams.map((q) => <span key={q.team.id} className="flex items-center gap-1 rounded-md border border-border bg-bg-soft/40 px-1.5 py-0.5 text-xs text-slate-300"><TeamLogo name={q.team.name} shortName={q.team.short_name} src={q.team.logo_url} size="xs" /> {q.team.short_name}</span>) : <span className="text-xs text-slate-600">No teams qualified yet.</span>}
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

function MeterRow({ label, value, color, invert }: { label: string; value: number; color: string; invert?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  const barColor = invert ? (pct > 70 ? '#ef4444' : pct > 40 ? '#eab308' : '#22c55e') : color;
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-slate-500"><span>{label}</span><span>{Math.round(value)}</span></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-bg-soft"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} /></div>
    </div>
  );
}

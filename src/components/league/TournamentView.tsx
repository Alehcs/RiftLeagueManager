'use client';

import Link from 'next/link';
import { Trophy, Crown, Star, Swords, Users2, Info, Zap, Globe2, Gift } from 'lucide-react';
import type { TournamentSummary } from '@/services/tournament';
import { BracketView } from '@/components/league/BracketView';
import { MatchCard } from '@/components/league/MatchCard';
import { TeamLogo, PlayerAvatar } from '@/components/ui/image';
import { RoleBadge, OverallBadge } from '@/components/ui/rating';
import { Card, CardHeader, CardTitle, CardBody, Badge, EmptyState } from '@/components/ui/primitives';
import { regionBadge } from '@/lib/constants';
import { cn } from '@/lib/utils';

const STATUS_COLOR = { upcoming: '#64748b', active: '#26d0ce', completed: '#c8a85a' } as const;
const REWARD_NOTE: Record<string, string> = {
  regional_playoffs: 'Champion earns a prize bonus, prestige, and international qualification.',
  regional_finals: 'Champion secures the final Worlds slot plus a prize bonus.',
  msi: 'MSI champion earns a major prize bonus and ranking prestige; results feed the season recap.',
  worlds: 'World champion earns the season’s biggest prize and lasting prestige; results feed the season recap.',
  quick_tournament: 'Champion is crowned for the standalone event.',
};

export function TournamentView({ summary, leagueId }: { summary: TournamentSummary; leagueId: string }) {
  const { champion, runnerUp, mvp, bestPerformer, biggestUpset, strongestRegion, recap } = summary;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {summary.scope === 'international' ? <Globe2 size={18} className="text-rift-cyan" /> : <Trophy size={18} className="text-rift-gold" />}
            <h3 className="text-lg font-bold text-slate-100">{summary.name}</h3>
            <Badge color={STATUS_COLOR[summary.status]}>{summary.stageLabel}</Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><Info size={12} /> {summary.formatLabel}</p>
        </div>
        {summary.progress.total > 0 && <div className="text-xs text-slate-500">{summary.progress.completed}/{summary.progress.total} matches</div>}
      </div>

      <p className="rounded-lg border border-border bg-bg-soft/30 px-3 py-2 text-xs leading-relaxed text-slate-400">{summary.formatExplanation}</p>

      {/* Champion + recap */}
      {champion && (
        <Card className="border-rift-gold/40 bg-gradient-to-r from-rift-gold/10 to-transparent">
          <CardBody className="space-y-3">
            <div className="flex items-center gap-4">
              <TeamLogo name={champion.name} shortName={champion.short_name} src={champion.logo_url} size="lg" className="ring-2 ring-rift-gold" />
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider text-rift-gold">{summary.name} Champion</div>
                <div className="truncate text-2xl font-extrabold text-slate-50">{champion.name}</div>
                {runnerUp && <div className="text-xs text-slate-500">def. {runnerUp.name} in the final</div>}
              </div>
              <Crown size={40} className="ml-auto hidden shrink-0 text-rift-gold/70 sm:block" />
            </div>
            {recap && <p className="text-sm leading-relaxed text-slate-300">{recap}</p>}
            <div className="grid gap-2 sm:grid-cols-3">
              {mvp && <Highlight icon={<Star size={14} className="text-rift-gold" />} label="Tournament MVP" value={mvp.player.nickname} sub={mvp.player.role} player={mvp.player} href={`/leagues/${leagueId}/players/${mvp.player.id}`} />}
              {bestPerformer && <Highlight icon={<Zap size={14} className="text-rift-cyan" />} label="Best performer" value={bestPerformer.player.nickname} sub={bestPerformer.player.role} player={bestPerformer.player} href={`/leagues/${leagueId}/players/${bestPerformer.player.id}`} />}
              {strongestRegion && <Highlight icon={<Globe2 size={14} className="text-rift-purple" />} label="Strongest region" value={strongestRegion} />}
            </div>
          </CardBody>
        </Card>
      )}

      {/* MVP-only (in-progress tournaments with completed games) */}
      {!champion && mvp && (
        <Card>
          <CardBody className="flex items-center gap-3">
            <Star size={16} className="text-rift-gold" />
            <div className="text-sm"><span className="text-slate-500">Current standout: </span><span className="font-semibold text-slate-200">{mvp.player.nickname}</span></div>
          </CardBody>
        </Card>
      )}

      {biggestUpset && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-soft/30 px-3 py-2 text-xs text-slate-400">
          <Swords size={14} className="text-rift-red" /> Biggest upset: <span className="font-semibold text-slate-200">{biggestUpset.winner.short_name}</span> beat <span className="text-slate-300">{biggestUpset.loser.short_name}</span> as the lower seed.
        </div>
      )}

      {/* Participants */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-1.5"><Users2 size={15} /> Participants ({summary.participants.length})</CardTitle></CardHeader>
        <CardBody>
          {summary.participants.length ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {summary.participants.map((p) => {
                const rb = regionBadge(p.region);
                return (
                  <div key={p.team.id} className={cn('flex items-center gap-2 rounded-lg border border-border bg-bg-soft/30 px-2.5 py-1.5', p.eliminated && 'opacity-50', p.team.id === champion?.id && 'border-rift-gold/50 bg-rift-gold/5')}>
                    {p.seed != null && <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-500">#{p.seed}</span>}
                    <TeamLogo name={p.team.name} shortName={p.team.short_name} src={p.team.logo_url} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{p.team.name}</span>
                    <Badge color={rb.color}>{rb.label}</Badge>
                    {p.team.id === champion?.id && <Trophy size={13} className="text-rift-gold" />}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Participants will appear once teams qualify.</p>
          )}
        </CardBody>
      </Card>

      {/* Bracket */}
      {summary.hasBracket ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Trophy size={15} className="text-rift-gold" /> Bracket</CardTitle></CardHeader>
          <CardBody><BracketView matches={summary.bracket} leagueId={leagueId} /></CardBody>
        </Card>
      ) : (
        <EmptyState title="Bracket not generated yet" hint="The bracket appears once this stage begins." icon={<Trophy size={36} />} />
      )}

      {/* Match lists */}
      {summary.hasBracket && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Upcoming matches</CardTitle></CardHeader>
            <CardBody className="space-y-2">{summary.upcoming.length ? summary.upcoming.slice(0, 6).map((m) => <MatchCard key={m.id} match={m} leagueId={leagueId} />) : <p className="text-sm text-slate-500">No matches awaiting play.</p>}</CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Completed matches</CardTitle></CardHeader>
            <CardBody className="space-y-2">{summary.completed.length ? [...summary.completed].reverse().slice(0, 6).map((m) => <MatchCard key={m.id} match={m} leagueId={leagueId} />) : <p className="text-sm text-slate-500">No matches played yet.</p>}</CardBody>
          </Card>
        </div>
      )}

      {/* Rewards / impact */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-bg-soft/30 px-3 py-2 text-xs text-slate-400">
        <Gift size={14} className="mt-0.5 shrink-0 text-rift-green" /> {REWARD_NOTE[summary.key] ?? 'Results feed standings, prestige and the season recap.'}
      </div>
    </div>
  );
}

function Highlight({ icon, label, value, sub, player, href }: { icon: React.ReactNode; label: string; value: string; sub?: string; href?: string; player?: { nickname: string; image_url: string | null; role: import('@/lib/types').Role; rating_overall: number } }) {
  const inner = (
    <>
      {player ? <PlayerAvatar name={player.nickname} src={player.image_url} size="sm" /> : <div className="flex h-7 w-7 items-center justify-center">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">{icon} {label}</div>
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-slate-200">{value}</span>
          {sub && player && <RoleBadge role={player.role} />}
        </div>
      </div>
      {player && <OverallBadge value={player.rating_overall} size="sm" />}
    </>
  );
  const className = 'flex items-center gap-2 rounded-lg border border-border bg-bg-card/60 px-2.5 py-2';
  return href ? <Link href={href} className={cn(className, 'transition-colors hover:border-rift-cyan/40')}>{inner}</Link> : <div className={className}>{inner}</div>;
}

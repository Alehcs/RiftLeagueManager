'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BarChart3,
  Building2,
  ChevronLeft,
  CircleDollarSign,
  Eye,
  FastForward,
  Flame,
  Info,
  Pause,
  Play,
  RotateCcw,
  Shield,
  SkipForward,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canAdminister } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { gamesOf, simulationOf, teamById } from '@/lib/store/selectors';
import type { Player, PlayerCategory, Team } from '@/lib/types';
import type { TimelineEvent } from '@/services/run';
import {
  currentTimelineEvent,
  deterministicUnit,
  formatSimulationClock,
  parseSimulationJson,
  parseTimeline,
  ROLE_LABEL,
  ROLE_ORDER,
  scaledStat,
  simulationDuration,
  type SimulationFinalResult,
  type SimulationPlayerStat,
  type SimulationTeamStat,
  type SimulationTeamStats,
} from '@/services/simulationView';
import { SimulationMap, SimulationMinimap, type MapPlayer } from './SimulationMap';
import { TeamLogo, PlayerAvatar } from '@/components/ui/image';
import { PlayerCategoryBadge } from '@/components/common/badges';
import { Badge, Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

type PanelMode = 'info' | 'events' | 'summary';

const CATEGORY_FALLBACK: PlayerCategory = 'Starter';

export function MatchSimulationViewer({ leagueId, matchId }: { leagueId: string; matchId: string }) {
  const db = useDb();
  const league = useLeague(leagueId);
  const role = useLeagueRole(league?.id);
  const simulateMatch = useStore((state) => state.simulateMatch);
  const match = db.matches.find((item) => item.id === matchId);
  const simulation = simulationOf(db, matchId);
  const blue = match ? teamById(db, match.blue_team_id) : undefined;
  const red = match ? teamById(db, match.red_team_id) : undefined;
  const games = match ? gamesOf(db, match.id) : [];
  const events = useMemo(() => parseTimeline(simulation?.event_timeline), [simulation?.event_timeline]);
  const duration = useMemo(() => simulationDuration(events), [events]);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [panelMode, setPanelMode] = useState<PanelMode>('info');
  const [showSummary, setShowSummary] = useState(false);
  const loadedSimulationId = useRef<string>();

  useEffect(() => {
    if (loadedSimulationId.current === simulation?.id) return;
    loadedSimulationId.current = simulation?.id;
    if (!simulation) {
      setPlayhead(0);
      setPlaying(false);
      setShowSummary(false);
      return;
    }
    if (simulation.status === 'running') {
      setPlayhead(0);
      setPlaying(true);
      setShowSummary(false);
    } else {
      setPlayhead(duration);
      setPlaying(false);
      setShowSummary(true);
      setPanelMode('summary');
    }
  }, [duration, simulation]);

  useEffect(() => {
    if (!playing || !simulation || events.length === 0) return;
    const timer = window.setInterval(() => {
      setPlayhead((current) => {
        const next = Math.min(duration, current + speed * 0.45);
        if (next >= duration) {
          window.clearInterval(timer);
          setPlaying(false);
          setShowSummary(simulation.status === 'completed');
          if (simulation.status === 'completed') setPanelMode('summary');
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [duration, events.length, playing, simulation, speed]);

  if (!league || !match || !blue || !red) {
    return <div className="rounded-xl border border-border bg-bg-card p-10 text-center text-sm text-slate-500">Match viewer unavailable.</div>;
  }

  const playerStats = parseSimulationJson<SimulationPlayerStat[]>(simulation?.player_stats, []);
  const storedTeamStats = parseSimulationJson<SimulationTeamStats>(simulation?.team_stats, {});
  const finalResult = parseSimulationJson<SimulationFinalResult>(simulation?.final_result, {
    winner_team_id: match.winner_team_id ?? '',
    blue_score: match.blue_score,
    red_score: match.red_score,
  });
  const blueStats = completeTeamStats(storedTeamStats[blue.id], games, 'blue');
  const redStats = completeTeamStats(storedTeamStats[red.id], games, 'red');
  const progress = simulation ? Math.min(1, playhead / duration) : 0;
  const currentEvent = currentTimelineEvent(events, playhead);
  const bluePlayers = rosterFor(db.players, blue.id);
  const redPlayers = rosterFor(db.players, red.id);
  const mapPlayers = buildMapPlayers([...bluePlayers, ...redPlayers], blue.id, playerStats, progress, simulation?.simulation_seed ?? match.id);
  const status = simulation?.status ?? 'pending';
  const visibleEvents = events.filter((event) => event.minute <= playhead);
  const allPerformers = [...bluePlayers, ...redPlayers]
    .map((player) => ({ player, stat: statFor(player, playerStats, simulation?.simulation_seed ?? match.id, duration) }))
    .sort((a, b) => performanceScore(b.stat, b.player) - performanceScore(a.stat, a.player));
  const mvp = allPerformers.find((entry) => entry.player.id === finalResult.mvp_player_id) ?? allPerformers[0];
  const worst = allPerformers.find((entry) => entry.player.id === finalResult.struggling_player_id) ?? allPerformers[allPerformers.length - 1];
  const winner = finalResult.winner_team_id === blue.id ? blue : finalResult.winner_team_id === red.id ? red : undefined;

  const replay = () => {
    setPlayhead(0);
    setPlaying(true);
    setShowSummary(false);
    setPanelMode('events');
  };
  const skipToResult = () => {
    setPlayhead(duration);
    setPlaying(false);
    setShowSummary(!!simulation);
    setPanelMode('summary');
  };

  return (
    <div className="relative left-1/2 w-[calc(100vw-1rem)] max-w-[1800px] -translate-x-1/2 space-y-2 pb-6">
      <div className="flex items-center justify-between px-1">
        <Link href={`/leagues/${league.id}/matches/${match.id}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200">
          <ChevronLeft size={14} /> Match details
        </Link>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-slate-600">
          <Eye size={12} /> Watch only · persisted simulation
        </div>
      </div>

      <Scoreboard
        blue={blue}
        red={red}
        blueStats={blueStats}
        redStats={redStats}
        blueScore={finalResult.blue_score}
        redScore={finalResult.red_score}
        progress={progress}
        clock={formatSimulationClock(events, playhead)}
        status={status}
        format={match.format}
        blueWinProbability={currentEvent?.blue_win_probability ?? blueStats.initial_win_probability ?? 0.5}
      />

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(440px,.9fr)]">
        <section className="min-w-0 space-y-2">
          <div className="relative min-h-[590px] xl:h-[calc(100vh-230px)] xl:min-h-[650px] xl:max-h-[900px]">
            <SimulationMap players={mapPlayers} progress={progress} event={currentEvent} seed={simulation?.simulation_seed ?? match.id} blue={blue} red={red} />
            <EventFeed events={visibleEvents} blue={blue} red={red} />
            {showSummary && simulation && (
              <div className="absolute left-1/2 top-1/2 z-30 w-[min(460px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-rift-gold/40 bg-slate-950/95 p-5 text-center shadow-2xl backdrop-blur">
                <Trophy className="mx-auto text-rift-gold" size={28} />
                <div className="mt-2 text-[10px] font-bold uppercase tracking-[.24em] text-rift-gold">Match complete</div>
                <h2 className="mt-1 text-2xl font-black text-white">{winner ? `${winner.name} wins` : 'Result unavailable'}</h2>
                <div className="mt-1 text-4xl font-black tabular-nums text-slate-100">{finalResult.blue_score} <span className="text-slate-600">:</span> {finalResult.red_score}</div>
                {mvp && <p className="mt-3 text-sm text-slate-400">MVP <Link href={`/leagues/${leagueId}/players/${mvp.player.id}`} className="font-semibold text-rift-cyan hover:underline">{mvp.player.nickname}</Link> · {mvp.stat.kills}/{mvp.stat.deaths}/{mvp.stat.assists}</p>}
                <div className="mt-4 flex justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={replay}><RotateCcw size={13} /> Replay</Button>
                  <Link href={`/leagues/${league.id}/matches/${match.id}`}><Button size="sm" variant="gold"><BarChart3 size={13} /> Final result</Button></Link>
                </div>
              </div>
            )}
          </div>

          <PlaybackControls
            playing={playing}
            speed={speed}
            progress={progress}
            disabled={!simulation || events.length === 0}
            completed={simulation?.status === 'completed'}
            onToggle={() => { setPlaying((value) => !value); setShowSummary(false); }}
            onSpeed={setSpeed}
            onSkip={skipToResult}
            onReplay={replay}
          />
        </section>

        <aside className="min-w-0 space-y-2">
          <TeamRoster
            team={blue}
            side="blue"
            players={bluePlayers}
            stats={playerStats}
            finalStats={blueStats}
            progress={progress}
            duration={duration}
            seed={simulation?.simulation_seed ?? match.id}
            state={currentEvent?.state?.blue ?? blueStats.state}
          />
          <TeamRoster
            team={red}
            side="red"
            players={redPlayers}
            stats={playerStats}
            finalStats={redStats}
            progress={progress}
            duration={duration}
            seed={simulation?.simulation_seed ?? match.id}
            state={currentEvent?.state?.red ?? redStats.state}
          />

          <div className="grid gap-2 sm:grid-cols-[220px_1fr] xl:grid-cols-[210px_1fr] 2xl:grid-cols-[240px_1fr]">
            <div className="rounded-xl border border-border bg-[#11131d] p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Minimap</span>
                <Activity size={12} className="text-rift-cyan" />
              </div>
              <SimulationMinimap players={mapPlayers} progress={progress} event={currentEvent} seed={simulation?.simulation_seed ?? match.id} />
            </div>
            <QuickPanel
              mode={panelMode}
              setMode={setPanelMode}
              status={status}
              matchInfo={`${match.stage.replace('_', ' ')} · Week ${match.week} · ${match.format}`}
              currentEvent={currentEvent}
              winner={status === 'completed' || showSummary ? winner : undefined}
              mvp={status === 'completed' || showSummary ? mvp : undefined}
              worst={status === 'completed' || showSummary ? worst : undefined}
              events={events}
              recap={finalResult.recap}
              canStart={canAdminister(role) && match.status === 'scheduled'}
              onStart={() => simulateMatch(match.id)}
              onPause={() => setPlaying(false)}
              onResult={skipToResult}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Scoreboard({ blue, red, blueStats, redStats, blueScore, redScore, progress, clock, status, format, blueWinProbability }: {
  blue: Team;
  red: Team;
  blueStats: SimulationTeamStat;
  redStats: SimulationTeamStat;
  blueScore: number;
  redScore: number;
  progress: number;
  clock: string;
  status: 'pending' | 'running' | 'completed';
  format: string;
  blueWinProbability: number;
}) {
  return (
    <header className="overflow-hidden rounded-xl border border-slate-700/70 bg-[#12131d] shadow-xl">
      <div className="grid min-h-[78px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-5">
        <TeamIdentity team={blue} side="blue" score={blueScore} />
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Badge color={status === 'running' ? '#ef4444' : status === 'completed' ? '#22c55e' : '#64748b'} className="uppercase">
              {status === 'running' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rift-red" />}{status}
            </Badge>
            <Badge color="#8b5cf6">{format}</Badge>
          </div>
          <div className="mt-1 font-mono text-lg font-black tabular-nums text-white sm:text-xl">{clock}</div>
          <div className="mt-0.5 text-[9px] font-semibold tabular-nums text-slate-500">
            Win pressure <span className="text-rift-blue">{Math.round(blueWinProbability * 100)}%</span>
            <span className="px-1 text-slate-700">·</span>
            <span className="text-rift-red">{Math.round((1 - blueWinProbability) * 100)}%</span>
          </div>
        </div>
        <TeamIdentity team={red} side="red" score={redScore} />
      </div>
      <div className="grid grid-cols-2 border-t border-white/5 bg-black/25 lg:grid-cols-[1fr_auto_1fr]">
        <TeamStatStrip stats={blueStats} progress={progress} side="blue" />
        <div className="hidden items-center gap-3 border-x border-white/5 px-5 text-xs font-black tabular-nums text-slate-300 lg:flex">
          <span className="text-rift-blue">{scaledStat(blueStats.kills, progress)}</span><Swords size={14} className="text-slate-600" /><span className="text-rift-red">{scaledStat(redStats.kills, progress)}</span>
        </div>
        <TeamStatStrip stats={redStats} progress={progress} side="red" />
      </div>
    </header>
  );
}

function TeamIdentity({ team, side, score }: { team: Team; side: 'blue' | 'red'; score: number }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', side === 'red' && 'flex-row-reverse text-right')}>
      <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} color={team.color_primary} size="md" className={cn('ring-2', side === 'blue' ? 'ring-rift-blue/60' : 'ring-rift-red/60')} />
      <div className="min-w-0">
        <div className={cn('truncate text-sm font-black sm:text-lg', side === 'blue' ? 'text-blue-300' : 'text-red-300')}>{team.name}</div>
        <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-600">{side} side · Series {score}</div>
      </div>
    </div>
  );
}

function TeamStatStrip({ stats, progress, side }: { stats: SimulationTeamStat; progress: number; side: 'blue' | 'red' }) {
  const gold = Math.max(progress > 0 ? 2500 : 0, scaledStat(stats.gold, progress));
  const items = [
    { icon: <CircleDollarSign size={12} />, value: `${(gold / 1000).toFixed(1)}k`, label: 'gold' },
    { icon: <Building2 size={12} />, value: scaledStat(stats.towers, progress), label: 'towers' },
    { icon: <Flame size={12} />, value: scaledStat(stats.dragons, progress), label: 'dragons' },
    { icon: <Sparkles size={12} />, value: scaledStat(stats.barons, progress), label: 'barons' },
  ];
  return <div className={cn('flex items-center gap-3 overflow-hidden px-3 py-2 text-[11px] sm:justify-center', side === 'red' && 'justify-end')}>{items.map((item) => <span key={item.label} title={item.label} className="flex items-center gap-1 font-semibold tabular-nums text-slate-300"><span className={side === 'blue' ? 'text-rift-blue' : 'text-rift-red'}>{item.icon}</span>{item.value}</span>)}</div>;
}

function TeamRoster({ team, side, players, stats, finalStats, progress, duration, seed, state }: {
  team: Team;
  side: 'blue' | 'red';
  players: Player[];
  stats: SimulationPlayerStat[];
  finalStats: SimulationTeamStat;
  progress: number;
  duration: number;
  seed: string;
  state?: SimulationTeamStat['state'];
}) {
  const pressure = state?.map_pressure ?? Math.round(45 + (finalStats.gold / Math.max(1, finalStats.gold + 50000)) * 40 * progress);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-700/70 bg-[#141620] shadow-lg">
      <div className="flex items-center gap-3 border-b border-white/5 bg-white/[.025] px-3 py-2">
        <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} color={team.color_primary} size="xs" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-black text-slate-100">{team.name}</div>
          <div className="text-[9px] uppercase tracking-[.15em] text-slate-600">Momentum {state?.momentum ?? 50} · Objectives {state?.objective_control ?? 50}</div>
        </div>
        <div className="text-right">
          <div className={cn('text-xs font-black tabular-nums', side === 'blue' ? 'text-rift-blue' : 'text-rift-red')}>{scaledStat(finalStats.kills, progress)} K</div>
          <div className="text-[9px] text-slate-600">Pressure {Math.min(99, pressure)}</div>
        </div>
      </div>
      <div className="divide-y divide-white/5">
        {players.map((player) => {
          const final = statFor(player, stats, seed, duration);
          const current = {
            kills: scaledStat(final.kills, progress), deaths: scaledStat(final.deaths, progress), assists: scaledStat(final.assists, progress),
            cs: scaledStat(final.cs, progress), gold: Math.max(progress ? 500 : 0, scaledStat(final.gold, progress)), level: Math.max(progress ? 1 : 0, scaledStat(final.level, progress)),
          };
          const impact = Math.max(12, Math.min(100, Math.round((final.impact ?? performanceScore(final, player)) * progress)));
          return (
            <div key={player.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5">
              <PlayerAvatar name={player.nickname} src={player.image_url} seed={player.avatar_seed} size="xs" className={cn('border', side === 'blue' ? 'border-rift-blue/60' : 'border-rift-red/60')} />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="w-7 shrink-0 text-[9px] font-black" style={{ color: side === 'blue' ? '#47a7ff' : '#ff5d73' }}>{ROLE_LABEL[player.role] ?? player.role}</span>
                  <span className="min-w-0 truncate text-xs font-bold text-slate-100">{player.nickname}</span>
                  <PlayerCategoryBadge category={player.category ?? CATEGORY_FALLBACK} />
                  <span className="ml-auto hidden text-[9px] text-slate-600 2xl:inline">OVR {player.rating_overall}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 min-w-12 flex-1 overflow-hidden rounded-full bg-slate-900"><div className={cn('h-full rounded-full', side === 'blue' ? 'bg-gradient-to-r from-blue-700 to-cyan-400' : 'bg-gradient-to-r from-red-800 to-rose-400')} style={{ width: `${impact}%` }} /></div>
                  <span className="w-20 text-right text-[9px] tabular-nums text-slate-500">L{current.level} · {current.cs} CS · {(current.gold / 1000).toFixed(1)}k</span>
                </div>
              </div>
              <div className="w-[58px] text-right font-mono text-[11px] font-bold tabular-nums text-slate-300">{current.kills}/{current.deaths}/{current.assists}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EventFeed({ events, blue, red }: { events: TimelineEvent[]; blue: Team; red: Team }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-20 w-[min(440px,calc(100%-2rem))] rounded-xl border border-white/10 bg-slate-950/80 p-3 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[.2em] text-slate-500">Live event feed</span>
        <span className="flex items-center gap-1 text-[9px] text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> timeline synced</span>
      </div>
      <div className="max-h-32 space-y-1 overflow-hidden">
        {events.length === 0 && <div className="py-3 text-xs text-slate-500">Waiting for the first saved event…</div>}
        {events.slice(-5).map((event, index) => {
          const side = event.side ?? (event.text.includes(blue.short_name) ? 'blue' : event.text.includes(red.short_name) ? 'red' : undefined);
          return <div key={`${event.minute}-${index}`} className="flex gap-2 text-[11px] leading-4"><span className="w-11 shrink-0 font-mono font-bold tabular-nums" style={{ color: side === 'blue' ? '#47a7ff' : side === 'red' ? '#ff5d73' : '#94a3b8' }}>{event.game_number ? `G${event.game_number} ` : ''}{event.in_game_minute ?? event.minute}&apos;</span><span className="text-slate-200">{event.text}</span></div>;
        })}
      </div>
    </div>
  );
}

function PlaybackControls({ playing, speed, progress, disabled, completed, onToggle, onSpeed, onSkip, onReplay }: {
  playing: boolean; speed: 1 | 2 | 4; progress: number; disabled: boolean; completed: boolean;
  onToggle: () => void; onSpeed: (speed: 1 | 2 | 4) => void; onSkip: () => void; onReplay: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700/70 bg-[#141620] px-3 py-2 shadow-lg">
      <Button size="icon" variant="outline" disabled={disabled} onClick={onToggle} aria-label={playing ? 'Pause replay' : 'Play replay'}>{playing ? <Pause size={16} /> : <Play size={16} />}</Button>
      {[1, 2, 4].map((value) => <button key={value} disabled={disabled} onClick={() => onSpeed(value as 1 | 2 | 4)} className={cn('h-8 rounded-lg border px-3 text-xs font-bold transition-colors disabled:opacity-40', speed === value ? 'border-rift-cyan/60 bg-rift-cyan/10 text-rift-cyan' : 'border-border text-slate-500 hover:text-slate-200')}>{value}x</button>)}
      <div className="mx-1 h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full bg-gradient-to-r from-rift-blue via-rift-cyan to-rift-red transition-all" style={{ width: `${progress * 100}%` }} /></div>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onSkip}><SkipForward size={14} /> Result</Button>
      {completed && <Button size="sm" variant="ghost" disabled={disabled} onClick={onReplay}><RotateCcw size={14} /> Replay</Button>}
    </div>
  );
}

function QuickPanel({ mode, setMode, status, matchInfo, currentEvent, winner, mvp, worst, events, recap, canStart, onStart, onPause, onResult }: {
  mode: PanelMode; setMode: (mode: PanelMode) => void; status: string; matchInfo: string; currentEvent?: TimelineEvent; winner?: Team;
  mvp?: { player: Player; stat: SimulationPlayerStat }; worst?: { player: Player; stat: SimulationPlayerStat }; events: TimelineEvent[];
  recap?: string;
  canStart: boolean; onStart: () => void; onPause: () => void; onResult: () => void;
}) {
  return (
    <div className="flex min-h-[250px] flex-col rounded-xl border border-slate-700/70 bg-[#11131d] p-2">
      <div className="grid grid-cols-3 gap-1">
        {([['info', Info], ['events', Activity], ['summary', Trophy]] as const).map(([value, Icon]) => <button key={value} onClick={() => setMode(value)} className={cn('flex h-8 items-center justify-center gap-1 rounded-md border text-[9px] font-bold uppercase', mode === value ? 'border-rift-cyan/50 bg-rift-cyan/10 text-rift-cyan' : 'border-border text-slate-500')}><Icon size={11} /> {value}</button>)}
      </div>
      <div className="min-h-0 flex-1 p-2 text-xs">
        {mode === 'info' && <div className="space-y-2"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-600">Match info</div><div className="capitalize text-slate-200">{matchInfo}</div><div className="flex items-center gap-2 text-slate-500"><Shield size={12} /> Status: <span className="font-semibold uppercase text-slate-300">{status}</span></div>{currentEvent && <div className="rounded-md bg-bg-soft p-2 text-[10px] leading-4 text-slate-400">{currentEvent.text}</div>}</div>}
        {mode === 'events' && <div className="space-y-1"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-600">Key events</div>{events.filter((event) => event.type !== 'movement').slice(-4).map((event, index) => <div key={`${event.minute}-${index}`} className="line-clamp-2 text-[10px] leading-4 text-slate-400"><span className="mr-1 font-mono text-rift-cyan">{event.in_game_minute ?? event.minute}&apos;</span>{event.text}</div>)}</div>}
        {mode === 'summary' && <div className="space-y-2"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-rift-gold">Post-match report</div>{winner ? <div className="font-bold text-slate-100">Winner · {winner.name}</div> : <div className="text-slate-500">Awaiting the persisted result.</div>}{mvp && <PerformerLine label="MVP" entry={mvp} positive />}{worst && <PerformerLine label="Low impact" entry={worst} />}{(recap || events.length > 0) && <p className="line-clamp-4 text-[10px] leading-4 text-slate-500">{recap ?? events.slice(-3).map((event) => event.text).join(' ')}</p>}</div>}
      </div>
      <div className="space-y-1.5">
        {canStart && <Button className="w-full" size="sm" variant="primary" onClick={onStart}><Play size={13} /> Start simulation</Button>}
        <Button className="w-full" size="sm" variant="outline" onClick={onResult} disabled={status === 'pending'}><FastForward size={13} /> View final result</Button>
        <Button className="w-full" size="sm" variant="ghost" onClick={onPause}><Pause size={13} /> Pause</Button>
      </div>
    </div>
  );
}

function PerformerLine({ label, entry, positive }: { label: string; entry: { player: Player; stat: SimulationPlayerStat }; positive?: boolean }) {
  return <div className="flex items-center gap-2 rounded-md bg-bg-soft px-2 py-1.5"><PlayerAvatar name={entry.player.nickname} src={entry.player.image_url} size="xs" /><div className="min-w-0 flex-1"><div className="text-[9px] uppercase text-slate-600">{label}</div><div className={cn('truncate text-[11px] font-bold', positive ? 'text-rift-cyan' : 'text-slate-300')}>{entry.player.nickname}</div></div><span className="font-mono text-[9px] text-slate-500">{entry.stat.kills}/{entry.stat.deaths}/{entry.stat.assists}</span></div>;
}

function rosterFor(players: Player[], teamId: string): Player[] {
  return players
    .filter((player) => player.team_id === teamId && player.status === 'active' && ROLE_ORDER[player.role] != null)
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
    .slice(0, 5);
}

function statFor(player: Player, stats: SimulationPlayerStat[], seed: string, duration: number): SimulationPlayerStat {
  const stored = stats.find((stat) => stat.player_id === player.id);
  if (stored) return stored;
  const roll = deterministicUnit(`${seed}:fallback:${player.id}`);
  const kills = Math.floor(roll * 7);
  const deaths = 1 + Math.floor((1 - roll) * 5);
  const assists = 3 + Math.floor(roll * 12);
  const farm = player.role === 'ADC' || player.role === 'MID' ? 7.5 : player.role === 'TOP' ? 6.8 : player.role === 'JUNGLE' ? 5.3 : 1.3;
  const cs = Math.round(duration * farm);
  return { player_id: player.id, team_id: player.team_id ?? '', kills, deaths, assists, cs, gold: Math.round(cs * 20 + kills * 300 + assists * 80 + 2500), level: Math.min(18, 11 + Math.floor(duration / 7)), impact: Math.round((player.rating_overall * .45 + kills * 3 + assists - deaths * 2) * 10) / 10, games: 1, order: 0 };
}

function performanceScore(stat: SimulationPlayerStat, player: Player): number {
  return stat.mvp_score ?? stat.impact ?? stat.kills * 3 + stat.assists - stat.deaths * 2 + player.rating_overall * 0.35;
}

function completeTeamStats(stored: SimulationTeamStat | undefined, games: ReturnType<typeof gamesOf>, side: 'blue' | 'red'): SimulationTeamStat {
  const wins = games.filter((game) => game.winner_team_id === (side === 'blue' ? game.blue_team_id : game.red_team_id)).length;
  return {
    kills: stored?.kills ?? games.reduce((sum, game) => sum + (side === 'blue' ? game.blue_kills : game.red_kills), 0),
    gold: stored?.gold ?? games.reduce((sum, game) => sum + (side === 'blue' ? game.blue_gold : game.red_gold), 0),
    towers: stored?.towers ?? games.length * 3 + wins * 5,
    dragons: stored?.dragons ?? games.length + wins * 2,
    barons: stored?.barons ?? games.filter((game) => game.duration_minutes >= 27 && game.winner_team_id === (side === 'blue' ? game.blue_team_id : game.red_team_id)).length,
    heralds: stored?.heralds ?? wins,
    elders: stored?.elders ?? 0,
    initial_win_probability: stored?.initial_win_probability,
    final_win_probability: stored?.final_win_probability,
    state: stored?.state,
  };
}

function buildMapPlayers(players: Player[], blueTeamId: string, stats: SimulationPlayerStat[], progress: number, seed: string): MapPlayer[] {
  return players.map((player, index) => {
    const final = statFor(player, stats, seed, 35);
    const fighting = progress > 0.45;
    const healthRoll = deterministicUnit(`${seed}:health:${player.id}:${Math.floor(progress * 12)}`);
    return {
      player,
      side: player.team_id === blueTeamId ? 'blue' : 'red',
      index,
      level: Math.max(1, scaledStat(final.level ?? 16, progress)),
      health: Math.round(fighting ? 38 + healthRoll * 60 : 72 + healthRoll * 27),
    };
  });
}

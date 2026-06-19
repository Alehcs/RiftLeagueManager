'use client';

import { Crosshair, Flame, Shield, Skull, Swords } from 'lucide-react';
import type { Player, Team } from '@/lib/types';
import type { TimelineEvent } from '@/services/run';
import { cn } from '@/lib/utils';
import { deterministicUnit, mapStatus, ROLE_LABEL, type PlayerMapStatus } from '@/services/simulationView';

export interface MapPlayer {
  player: Player;
  side: 'blue' | 'red';
  index: number;
  level: number;
  health: number;
}

interface Point { x: number; y: number }

const LANE_POSITIONS: Record<'blue' | 'red', Record<string, Point>> = {
  blue: {
    TOP: { x: 20, y: 26 },
    JUNGLE: { x: 34, y: 66 },
    MID: { x: 43, y: 58 },
    ADC: { x: 67, y: 83 },
    SUPPORT: { x: 61, y: 86 },
  },
  red: {
    TOP: { x: 35, y: 15 },
    JUNGLE: { x: 67, y: 34 },
    MID: { x: 58, y: 42 },
    ADC: { x: 84, y: 63 },
    SUPPORT: { x: 88, y: 57 },
  },
};

function playerPosition(entry: MapPlayer, progress: number, event: TimelineEvent | undefined, seed: string): Point {
  const start = LANE_POSITIONS[entry.side][entry.player.role] ?? (entry.side === 'blue' ? { x: 24, y: 76 } : { x: 76, y: 24 });
  const jitter = deterministicUnit(`${seed}:${entry.player.id}`) * 4 - 2;
  let target: Point;
  if (event?.objective === 'dragon') target = { x: 64, y: 68 };
  else if (event?.objective === 'baron' || event?.objective === 'herald') target = { x: 37, y: 32 };
  else if (event?.action === 'fighting') target = { x: 51, y: 49 };
  else if (progress > 0.78) target = entry.side === 'blue' ? { x: 84, y: 17 } : { x: 17, y: 84 };
  else target = entry.side === 'blue' ? { x: 57, y: 44 } : { x: 43, y: 56 };
  const movement = progress < 0.28 ? progress * 0.22 : progress < 0.72 ? 0.16 + progress * 0.38 : 0.45 + progress * 0.42;
  const grouped = event?.action === 'fighting' || event?.action === 'objective' || progress > 0.72;
  const factor = grouped ? Math.min(0.9, movement + 0.25) : movement;
  return {
    x: start.x + (target.x - start.x) * factor + jitter,
    y: start.y + (target.y - start.y) * factor - jitter * 0.55,
  };
}

function statusIcon(status: PlayerMapStatus) {
  if (status === 'fighting') return <Swords size={9} />;
  if (status === 'ganking') return <Crosshair size={9} />;
  if (status === 'objective') return <Flame size={9} />;
  if (status === 'dead') return <Skull size={9} />;
  return <Shield size={9} />;
}

function MapToken({ entry, position, status, compact = false }: { entry: MapPlayer; position: Point; status: PlayerMapStatus; compact?: boolean }) {
  const color = entry.side === 'blue' ? '#47a7ff' : '#ff5d73';
  const initials = entry.player.nickname.slice(0, 2).toUpperCase();
  return (
    <div
      className={cn('absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out', compact ? 'h-3 w-3' : 'group')}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      title={`${entry.player.nickname} · ${ROLE_LABEL[entry.player.role] ?? entry.player.role} · ${status}`}
    >
      {compact ? (
        <span className="block h-3 w-3 rounded-full border-2 border-slate-950 shadow-[0_0_8px_currentColor]" style={{ backgroundColor: color, color }} />
      ) : (
        <>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 bg-slate-950 text-[10px] font-black text-white shadow-[0_2px_12px_rgba(0,0,0,.8)]" style={{ borderColor: color }}>
            {initials}
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-950 px-0.5 text-[8px] font-bold" style={{ color }}>{entry.level}</span>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900" style={{ color }}>{statusIcon(status)}</span>
          </div>
          <div className="mt-1 w-11 overflow-hidden rounded-full border border-black/60 bg-black/80 p-px">
            <div className="h-1 rounded-full bg-emerald-400 transition-all" style={{ width: `${entry.health}%` }} />
          </div>
          <div className="absolute left-1/2 top-12 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-950/95 px-2 py-1 text-[9px] font-semibold text-slate-200 shadow-xl group-hover:block">
            {entry.player.nickname} · {status}
          </div>
        </>
      )}
    </div>
  );
}

function BattlefieldArt({ compact = false }: { compact?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id={compact ? 'mini-grid' : 'battle-grid'} width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M 7 0 L 0 0 0 7" fill="none" stroke="#bde7d3" strokeOpacity=".035" strokeWidth=".35" />
        </pattern>
        <linearGradient id={compact ? 'mini-river' : 'battle-river'} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#173d54" />
          <stop offset=".5" stopColor="#256175" />
          <stop offset="1" stopColor="#173d54" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="#102b24" />
      <rect width="100" height="100" fill={`url(#${compact ? 'mini-grid' : 'battle-grid'})`} />
      <path d="M-8 85 C22 75 25 56 46 52 C66 48 73 25 108 14" fill="none" stroke={`url(#${compact ? 'mini-river' : 'battle-river'})`} strokeWidth="10" />
      <path d="M10 90 C10 55 9 18 18 11 C42 7 68 9 90 10" fill="none" stroke="#9aa77b" strokeOpacity=".36" strokeWidth="7" />
      <path d="M10 90 L90 10" fill="none" stroke="#a5a984" strokeOpacity=".42" strokeWidth="7" />
      <path d="M10 90 C49 91 82 91 90 81 C92 56 91 31 90 10" fill="none" stroke="#9aa77b" strokeOpacity=".36" strokeWidth="7" />
      <path d="M13 85 C36 66 57 45 86 16" fill="none" stroke="#d7cf9b" strokeOpacity=".17" strokeWidth="2" strokeDasharray="2 2" />
      <path d="M18 23 L30 19 L35 34 L25 42 L14 36 Z M65 12 L81 18 L75 34 L62 29 Z M16 62 L33 57 L39 71 L28 82 L14 76 Z M62 67 L80 61 L88 75 L77 87 L63 82 Z" fill="#1a4030" stroke="#2b5b43" strokeWidth=".7" />
      <path d="M42 18 L54 14 L59 26 L48 34 L38 29 Z M42 69 L55 63 L64 77 L52 86 L39 81 Z" fill="#173b2c" stroke="#2b5b43" strokeWidth=".6" />
      <circle cx="38" cy="33" r="6" fill="#101c25" stroke="#8b5cf6" strokeOpacity=".7" strokeWidth=".8" />
      <circle cx="64" cy="68" r="6" fill="#152129" stroke="#ef8a46" strokeOpacity=".8" strokeWidth=".8" />
      <path d="M35 33 L38 29 L41 33 L38 37 Z" fill="#a78bfa" opacity=".8" />
      <path d="M61 70 C62 64 68 64 67 70 C66 68 63 68 61 70 Z" fill="#fb923c" opacity=".9" />
      <rect x="3" y="82" width="15" height="15" rx="2" fill="#17395d" stroke="#47a7ff" strokeWidth="1" />
      <rect x="82" y="3" width="15" height="15" rx="2" fill="#552234" stroke="#ff5d73" strokeWidth="1" />
      <path d="M7 92 L12 86 L16 92 L12 95 Z M84 9 L89 5 L94 10 L89 15 Z" fill="#e7f5ff" opacity=".8" />
      {[
        [12, 70, 'blue'], [12, 45, 'blue'], [30, 70, 'blue'], [35, 65, 'blue'], [45, 55, 'blue'],
        [88, 30, 'red'], [88, 55, 'red'], [70, 30, 'red'], [65, 35, 'red'], [55, 45, 'red'],
      ].map(([x, y, side], index) => (
        <g key={index}>
          <circle cx={x} cy={y} r={compact ? 1.25 : 1.7} fill={side === 'blue' ? '#47a7ff' : '#ff5d73'} opacity=".92" />
          <circle cx={x} cy={y} r={compact ? 2 : 2.5} fill="none" stroke={side === 'blue' ? '#47a7ff' : '#ff5d73'} strokeOpacity=".3" strokeWidth=".6" />
        </g>
      ))}
    </svg>
  );
}

export function SimulationMap({ players, progress, event, seed, blue, red }: { players: MapPlayer[]; progress: number; event?: TimelineEvent; seed: string; blue: Team; red: Team }) {
  return (
    <div className="relative h-full min-h-[580px] overflow-hidden rounded-xl border border-slate-700/70 bg-[#102b24] shadow-[inset_0_0_90px_rgba(0,0,0,.65)]">
      <BattlefieldArt />
      <div className="absolute left-4 top-4 z-10 rounded-lg border border-white/10 bg-slate-950/75 px-3 py-2 backdrop-blur">
        <div className="text-[9px] font-bold uppercase tracking-[.2em] text-slate-500">Tactical view</div>
        <div className="mt-0.5 text-xs font-semibold text-slate-200">{event?.action ? event.action.replace('_', ' ') : 'Opening setup'}</div>
      </div>
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/75 px-3 py-2 text-[10px] text-slate-400 backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-rift-blue" /> {blue.short_name}
        <span className="ml-1 h-2 w-2 rounded-full bg-rift-red" /> {red.short_name}
      </div>
      {players.map((entry) => {
        const position = playerPosition(entry, progress, event, seed);
        const status = mapStatus(entry.player.role, progress, event, entry.side, entry.player.id);
        return <MapToken key={entry.player.id} entry={entry} position={position} status={status} />;
      })}
    </div>
  );
}

export function SimulationMinimap({ players, progress, event, seed }: { players: MapPlayer[]; progress: number; event?: TimelineEvent; seed: string }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-700 bg-[#102b24] shadow-inner">
      <BattlefieldArt compact />
      {players.map((entry) => (
        <MapToken
          key={entry.player.id}
          entry={entry}
          compact
          position={playerPosition(entry, progress, event, seed)}
          status={mapStatus(entry.player.role, progress, event, entry.side, entry.player.id)}
        />
      ))}
      <div className="absolute inset-[14%] border border-white/20" />
    </div>
  );
}


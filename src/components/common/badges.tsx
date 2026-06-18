'use client';

import { Badge } from '@/components/ui/primitives';
import { FORMAT_META, REGION_META, TIER_META, regionBadge } from '@/lib/constants';
import type { LeagueFormat, LeagueRunPhase, LeagueTier, MatchStatus, PlayerCategory, PlayerStatus } from '@/lib/types';
import { Sparkles } from 'lucide-react';
import { RUN_PHASE_LABELS } from '@/services/run';

export function TierBadge({ tier }: { tier: LeagueTier }) {
  const m = TIER_META[tier];
  return <Badge color={m.color}>{m.badge}</Badge>;
}

export function RegionBadge({ region }: { region: string }) {
  const m = regionBadge(region);
  return <Badge color={m.color}>{m.label}</Badge>;
}

export function FormatBadge({ format }: { format: LeagueFormat }) {
  return <Badge color="#64748b">{FORMAT_META[format]?.label ?? format}</Badge>;
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const map = {
    scheduled: { c: '#64748b', t: 'Scheduled' },
    live: { c: '#ef4444', t: 'LIVE' },
    completed: { c: '#22c55e', t: 'Final' },
  }[status];
  return (
    <Badge color={map.c}>
      {status === 'live' && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulseglow rounded-full bg-rift-red" />}
      {map.t}
    </Badge>
  );
}

export function PlayerStatusBadge({ status }: { status: PlayerStatus }) {
  const map: Record<PlayerStatus, { c: string; t: string }> = {
    active: { c: '#22c55e', t: 'Active' },
    benched: { c: '#eab308', t: 'Benched' },
    free_agent: { c: '#26d0ce', t: 'Free Agent' },
    retired: { c: '#64748b', t: 'Retired' },
  };
  return <Badge color={map[status].c}>{map[status].t}</Badge>;
}

export function RunPhaseBadge({ phase }: { phase: LeagueRunPhase }) {
  const color = phase === 'completed' ? '#c8a85a' : phase === 'regular_season' || phase === 'playoffs' ? '#22c55e' : '#26d0ce';
  return <Badge color={color}>{RUN_PHASE_LABELS[phase]}</Badge>;
}

export function PlayerCategoryBadge({ category }: { category: PlayerCategory }) {
  const colors: Record<PlayerCategory, string> = {
    Rookie: '#64748b', Prospect: '#3b82f6', Starter: '#22c55e', Pro: '#26d0ce',
    Star: '#8b5cf6', Superstar: '#c8a85a', Legend: '#ef4444',
  };
  return <Badge color={colors[category]}>{category}</Badge>;
}

// Marks plausibly-generated data so it is clearly distinguishable from real.
export function GeneratedBadge({ show }: { show?: boolean | null }) {
  if (!show) return null;
  return (
    <span title="This value was plausibly generated and is fully editable" className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
      <Sparkles size={10} /> gen
    </span>
  );
}

export function SourceBadge({ name }: { name?: string | null }) {
  if (!name) return null;
  const color = name === 'Generated' ? '#64748b' : name === 'Manual' || name === 'CSV' ? '#8b5cf6' : '#26d0ce';
  return <Badge color={color}>{name}</Badge>;
}

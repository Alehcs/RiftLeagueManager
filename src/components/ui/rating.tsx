'use client';

import { cn, ratingColor } from '@/lib/utils';
import { ROLE_META } from '@/lib/constants';
import type { Role } from '@/lib/types';

export function OverallBadge({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = ratingColor(value);
  const sz = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-lg' }[size];
  return (
    <div
      className={cn('flex items-center justify-center rounded-lg font-bold tabular-nums', sz)}
      style={{ backgroundColor: `${color}1f`, color, border: `1px solid ${color}55` }}
    >
      {value}
    </div>
  );
}

export function RatingBar({ label, value }: { label: string; value: number }) {
  const color = ratingColor(value);
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 shrink-0 text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-soft">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <div className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const meta = ROLE_META[role];
  return (
    <span
      className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide', className)}
      style={{ backgroundColor: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}
    >
      {meta.short}
    </span>
  );
}

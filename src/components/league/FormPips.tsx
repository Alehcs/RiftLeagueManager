'use client';

import { cn } from '@/lib/utils';

// Renders a W/L form string (most-recent-first) as colored pips.
export function FormPips({ form, max = 5, reverse }: { form: string; max?: number; reverse?: boolean }) {
  let chars = form.slice(0, max).split('');
  if (reverse) chars = chars.reverse(); // show oldest→newest left→right
  if (chars.length === 0) return <span className="text-xs text-slate-600">—</span>;
  return (
    <div className="flex gap-1">
      {chars.map((c, i) => (
        <span
          key={i}
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold',
            c === 'W' ? 'bg-rift-green/20 text-rift-green' : 'bg-rift-red/20 text-rift-red',
          )}
          title={c === 'W' ? 'Win' : 'Loss'}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

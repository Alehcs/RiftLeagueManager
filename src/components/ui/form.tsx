'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1 block text-xs font-medium text-slate-400', className)} {...props} />;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn('input-base', className)} {...props} />,
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn('input-base min-h-[80px] resize-y font-mono text-xs', className)} {...props} />,
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn('input-base cursor-pointer appearance-none bg-bg-soft pr-8', className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

// Shared visual switch track (no semantics of its own — the wrapping button
// carries role/aria). Kept shrink-0 so it never collides with wrapping labels.
function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? 'bg-rift-cyan' : 'bg-border-soft',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex items-center gap-2 text-sm text-slate-300 disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <SwitchTrack checked={checked} />
      {label}
    </button>
  );
}

// Settings-panel toggle tile: label (and optional helper text) on the left, the
// switch aligned top-right so long labels wrap cleanly without ever colliding
// with the switch. Selected state is shown by both the switch AND a border/bg
// tint (not colour alone) for accessibility.
export function SettingToggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed border-border bg-bg-soft/30 opacity-50'
          : checked
            ? 'border-rift-cyan/50 bg-rift-cyan/5 hover:border-rift-cyan/70'
            : 'border-border bg-bg-soft/40 hover:border-border-soft',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-snug text-slate-500">{description}</span>}
      </span>
      <span className="mt-0.5">
        <SwitchTrack checked={checked} />
      </span>
    </button>
  );
}

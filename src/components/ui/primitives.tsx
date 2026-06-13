'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'gold';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-rift-cyan/90 text-bg hover:bg-rift-cyan font-semibold shadow-glow',
  gold: 'bg-rift-gold/90 text-bg hover:bg-rift-gold font-semibold shadow-glow-gold',
  secondary: 'bg-bg-elevated text-slate-100 hover:bg-border border border-border',
  outline: 'border border-border-soft text-slate-200 hover:bg-bg-elevated',
  ghost: 'text-slate-300 hover:bg-bg-elevated hover:text-white',
  danger: 'bg-rift-red/90 text-white hover:bg-rift-red font-medium',
};
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-11 px-6 text-base rounded-xl gap-2',
  icon: 'h-9 w-9 rounded-lg justify-center',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({ className, hover, ...props }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return <div className={cn('card', hover && 'card-hover', className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between gap-3 border-b border-border px-4 py-3', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold tracking-wide text-slate-100', className)} {...props} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Badge / Pill
// ---------------------------------------------------------------------------
export function Badge({
  className,
  color,
  children,
  style,
}: {
  className?: string;
  color?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none', className)}
      style={color ? { backgroundColor: `${color}22`, color, border: `1px solid ${color}40`, ...style } : style}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stat
// ---------------------------------------------------------------------------
export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-100" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub != null && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-bold text-slate-100">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, hint, icon, action }: { title: string; hint?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="text-slate-600">{icon}</div>}
      <div>
        <div className="font-semibold text-slate-300">{title}</div>
        {hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('h-5 w-5 animate-spin rounded-full border-2 border-border border-t-rift-cyan', className)} />
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-border', className)} />;
}

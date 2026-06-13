'use client';

import { cn } from '@/lib/utils';
import { useReady } from '@/lib/store/hooks';
import { Spinner } from '@/components/ui/primitives';

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-7xl px-4 py-6', className)}>{children}</div>;
}

export function LoadingGate({ children }: { children: React.ReactNode }) {
  const ready = useReady();
  if (!ready) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Spinner className="h-7 w-7" />
        <p className="text-sm">Loading league data…</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-slate-400">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

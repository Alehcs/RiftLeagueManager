'use client';

import * as React from 'react';
import { Swords, ArrowLeftRight, Users, Download, Info, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import type { Toast } from '@/lib/store/store';

const ICONS: Record<Toast['kind'], React.ReactNode> = {
  match: <Swords size={16} />,
  trade: <ArrowLeftRight size={16} />,
  roster: <Users size={16} />,
  import: <Download size={16} />,
  info: <Info size={16} />,
  success: <CheckCircle2 size={16} />,
  error: <AlertTriangle size={16} />,
};
const COLORS: Record<Toast['kind'], string> = {
  match: '#26d0ce',
  trade: '#8b5cf6',
  roster: '#3b82f6',
  import: '#c8a85a',
  info: '#64748b',
  success: '#22c55e',
  error: '#ef4444',
};

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useStore((s) => s.dismissToast);
  React.useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), 4500);
    return () => clearTimeout(t);
  }, [toast.id, dismiss]);
  const color = COLORS[toast.kind];
  return (
    <div
      className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-bg-elevated/95 p-3 shadow-card backdrop-blur animate-slide-in"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="mt-0.5 shrink-0" style={{ color }}>
        {ICONS[toast.kind]}
      </div>
      <div className="flex-1 text-sm text-slate-200">{toast.message}</div>
      <button onClick={() => dismiss(toast.id)} className="shrink-0 text-slate-500 hover:text-slate-300">
        <X size={14} />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  return (
    // Full-width, viewport-anchored container (inset-x-0 avoids the `100vw`
    // scrollbar overflow); padding sits inside and a right-aligned, max-360px
    // column keeps the toasts bottom-right exactly as before — but it can never
    // push past the viewport, so it adds no horizontal page scroll on mobile.
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-end px-4">
      <div className="flex w-full max-w-[360px] flex-col gap-2">
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} />
        ))}
      </div>
    </div>
  );
}

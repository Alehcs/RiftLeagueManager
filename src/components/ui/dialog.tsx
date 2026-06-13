'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './primitives';

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={cn('relative z-10 my-auto w-full animate-fade-in rounded-2xl border border-border bg-bg-card shadow-card', width)}>
        {title != null && (
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="font-semibold text-slate-100">{title}</h3>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X size={16} />
            </Button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function useDialog(initial = false) {
  const [open, setOpen] = React.useState(initial);
  return { open, setOpen, openIt: () => setOpen(true), close: () => setOpen(false) };
}

// Lightweight confirm button (two-click pattern, no native confirm()).
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Confirm?',
  ...props
}: ButtonConfirmProps) {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      {...props}
      variant={armed ? 'danger' : props.variant ?? 'outline'}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) {
          onConfirm();
          setArmed(false);
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
type ButtonConfirmProps = React.ComponentProps<typeof Button> & { onConfirm: () => void; confirmLabel?: string };

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, Trophy, DownloadCloud, User, Menu, X, Swords, Database, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStatus, useSupabaseStatus } from '@/lib/store/hooks';
import type { SupabaseDiagnostics, SupabaseStatus } from '@/lib/supabase/client';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leagues/new', label: 'Create', icon: Trophy },
  { href: '/leagues/import', label: 'Import', icon: DownloadCloud },
  { href: '/import-center', label: 'Import Center', icon: Database },
  { href: '/profile', label: 'Profile', icon: User },
];

export function Navbar() {
  const pathname = usePathname();
  const { status, diagnostics, error } = useSupabaseStatus();
  const { saving } = useDataStatus();
  const [open, setOpen] = useState(false);

  const badge = buildBadge(status, diagnostics, error, saving);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rift-cyan/15 text-rift-cyan shadow-glow">
            <Swords size={18} />
          </span>
          <span className="hidden text-slate-100 sm:inline">
            Rift League <span className="text-rift-cyan">Manager</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== '/dashboard' && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  active ? 'bg-bg-elevated text-white' : 'text-slate-400 hover:bg-bg-elevated hover:text-slate-200',
                )}
              >
                <l.icon size={15} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <span
            className={cn('hidden items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold sm:inline-flex', badge.className)}
            title={badge.title}
          >
            {badge.warn && <AlertTriangle size={11} />}
            {badge.label}
          </span>
          <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-border px-4 py-2 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-bg-elevated"
            >
              <l.icon size={16} />
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function buildBadge(
  status: SupabaseStatus,
  diagnostics: SupabaseDiagnostics,
  error: string | null,
  saving: boolean,
): { label: string; className: string; title: string; warn: boolean } {
  if (status === 'misconfigured') {
    const missing = !diagnostics.hasUrl ? 'NEXT_PUBLIC_SUPABASE_URL is missing' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing';
    return {
      label: 'SUPABASE?',
      className: 'bg-rift-red/15 text-rift-red',
      title: `Supabase misconfigured — ${missing}. Set both vars in .env.local, then restart the dev server.`,
      warn: true,
    };
  }
  if (status === 'supabase') {
    if (error) {
      return { label: 'SUPABASE', className: 'bg-rift-red/15 text-rift-red', title: `Supabase error: ${error}`, warn: true };
    }
    const detail = `Supabase ${diagnostics.urlHost ?? '?'} · key ${diagnostics.keyHint ?? '?'}`;
    return saving
      ? { label: 'SYNCING', className: 'bg-rift-green/15 text-rift-green', title: `Saving to ${detail}`, warn: false }
      : { label: 'SUPABASE', className: 'bg-rift-green/15 text-rift-green', title: `Connected · ${detail}`, warn: false };
  }
  return {
    label: 'MOCK MODE',
    className: 'bg-rift-gold/15 text-rift-gold',
    title: 'Local mock mode — data persists in your browser & syncs across tabs',
    warn: false,
  };
}

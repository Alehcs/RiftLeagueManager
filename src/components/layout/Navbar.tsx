'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, Trophy, DownloadCloud, User, Menu, X, Swords, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMode } from '@/lib/store/hooks';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leagues/new', label: 'Create', icon: Trophy },
  { href: '/leagues/import', label: 'Import', icon: DownloadCloud },
  { href: '/import-center', label: 'Import Center', icon: Database },
  { href: '/profile', label: 'Profile', icon: User },
];

export function Navbar() {
  const pathname = usePathname();
  const mode = useMode();
  const [open, setOpen] = useState(false);

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
            className={cn(
              'hidden rounded-md px-2 py-1 text-[10px] font-semibold sm:inline',
              mode === 'mock' ? 'bg-rift-gold/15 text-rift-gold' : 'bg-rift-green/15 text-rift-green',
            )}
            title={mode === 'mock' ? 'Local mock mode — data persists in your browser & syncs across tabs' : 'Connected to Supabase'}
          >
            {mode === 'mock' ? 'MOCK MODE' : 'SUPABASE'}
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

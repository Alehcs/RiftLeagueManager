'use client';

import Link from 'next/link';
import { ArrowRight, DownloadCloud, Trophy, Swords, Users, Wand2, Activity, Sparkles } from 'lucide-react';
import { useDataStatus, useDb, useReady } from '@/lib/store/hooks';
import { FEATURED_SLUGS } from '@/data/rosters';
import { LeagueCard } from '@/components/league/LeagueCard';
import { PageContainer } from '@/components/common/layout';
import { Button, Card, Spinner } from '@/components/ui/primitives';

export default function LandingPage() {
  const ready = useReady();
  const { error } = useDataStatus();
  const db = useDb();
  const featured = FEATURED_SLUGS.map((s) => db.leagues.find((l) => l.slug === s)).filter(Boolean);
  const otherLeagues = db.leagues.filter((l) => !FEATURED_SLUGS.includes(l.slug));

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(800px 400px at 70% -30%, rgba(38,208,206,0.12), transparent), radial-gradient(600px 300px at 10% 120%, rgba(139,92,246,0.1), transparent)' }} />
        <PageContainer className="relative py-16 sm:py-24">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-bg-card/60 px-3 py-1 text-xs text-slate-400">
              <Sparkles size={13} className="text-rift-cyan" /> The complete LoL Esports league simulator & manager
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-50 sm:text-6xl">
              Manage every <span className="text-rift-cyan neon-text">Rift</span> league.
              <br />
              From <span className="text-rift-gold">LCK</span> to <span className="text-rift-purple">Worlds</span>.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-400">
              Create or import real LoL esports leagues — real teams, rosters, coaches and formats. Generate schedules,
              simulate matches, run transfers & trades, and watch standings update live across tabs.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/leagues/import">
                <Button variant="primary" size="lg">
                  <DownloadCloud size={18} /> Import a real league
                </Button>
              </Link>
              <Link href="/leagues/new">
                <Button variant="outline" size="lg">
                  <Wand2 size={18} /> Create from scratch
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="ghost" size="lg">
                  Open dashboard <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-500">
              <Feature icon={<Trophy size={15} />} text="LCK · LPL · LEC · LCS · CBLOL · Worlds · MSI" />
              <Feature icon={<Activity size={15} />} text="Live realtime across tabs" />
              <Feature icon={<Users size={15} />} text="Transfers, trades & rosters" />
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Featured leagues */}
      <PageContainer className="py-12">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Featured leagues</h2>
            <p className="text-sm text-slate-500">Seeded with real LoL esports structure — jump in and simulate.</p>
          </div>
          <Link href="/dashboard" className="text-sm text-rift-cyan hover:underline">
            View all →
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rift-red/30 bg-rift-red/10 px-4 py-3 text-sm text-red-200">{error}</div>
        )}
        {!ready ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="h-7 w-7" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((l) => l && <LeagueCard key={l.id} league={l} />)}
          </div>
        )}

        {ready && otherLeagues.length > 0 && (
          <>
            <h3 className="mb-3 mt-10 text-lg font-semibold text-slate-300">More leagues & tournaments</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherLeagues.map((l) => (
                <LeagueCard key={l.id} league={l} />
              ))}
            </div>
          </>
        )}
      </PageContainer>

      {/* How it works */}
      <PageContainer className="py-12">
        <h2 className="mb-6 text-2xl font-bold text-slate-100">How it works</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Card key={i} className="p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-rift-cyan/10 text-rift-cyan">{s.icon}</div>
              <div className="text-sm font-semibold text-slate-200">
                {i + 1}. {s.title}
              </div>
              <p className="mt-1 text-sm text-slate-500">{s.body}</p>
            </Card>
          ))}
        </div>
      </PageContainer>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-rift-cyan">{icon}</span>
      {text}
    </span>
  );
}

const STEPS = [
  { icon: <DownloadCloud size={18} />, title: 'Import or create', body: 'Pull a real league (teams, rosters, coaches, format) or build a custom one from scratch.' },
  { icon: <Swords size={18} />, title: 'Generate & simulate', body: 'Auto-generate the schedule then simulate matches, weeks, the full season or playoffs.' },
  { icon: <Users size={18} />, title: 'Manage & trade', body: 'Edit anything, sign/release/trade players, and standings update live across every open tab.' },
];

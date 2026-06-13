'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Search, DownloadCloud, Users2, User } from 'lucide-react';
import { useDb } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { importJobsOf } from '@/lib/store/selectors';
import { RAW_LEAGUES, getAdapter, type TeamHit, type PlayerHit } from '@/services/importers';
import { PageContainer, PageHeader } from '@/components/common/layout';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge, Spinner } from '@/components/ui/primitives';
import { Input, Select } from '@/components/ui/form';
import { TierBadge, RegionBadge } from '@/components/common/badges';
import { RoleBadge } from '@/components/ui/rating';
import { flagEmoji, timeAgo } from '@/lib/utils';
import type { Role } from '@/lib/types';

export default function ImportCenter() {
  const router = useRouter();
  const db = useDb();
  const importRaw = useStore((s) => s.importRawLeague);
  const [adapterKey] = useState('leaguepedia');
  const [tab, setTab] = useState<'teams' | 'players'>('teams');
  const [q, setQ] = useState('');
  const [teamHits, setTeamHits] = useState<TeamHit[]>([]);
  const [playerHits, setPlayerHits] = useState<PlayerHit[]>([]);
  const [loading, setLoading] = useState(false);

  const jobs = importJobsOf(db, null);
  const existingSlugs = new Set(db.leagues.map((l) => l.slug));

  useEffect(() => {
    let active = true;
    setLoading(true);
    const adapter = getAdapter(adapterKey);
    const run = tab === 'teams' ? adapter.searchTeams(q) : adapter.searchPlayers(q);
    run.then((r) => {
      if (!active) return;
      if (tab === 'teams') setTeamHits(r as TeamHit[]);
      else setPlayerHits(r as PlayerHit[]);
    }).finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [adapterKey, tab, q]);

  const quickImport = async (slug: string) => {
    const raw = await getAdapter(adapterKey).fetchLeague(slug);
    if (raw) {
      const id = importRaw(raw, { presimulate: true });
      router.push(`/leagues/${id}`);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Import Center" subtitle="Search & import real LoL esports data" icon={<Database className="text-rift-cyan" />} />

      {/* Quick import */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="flex items-center gap-1.5"><DownloadCloud size={15} /> Quick import leagues</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {RAW_LEAGUES.map((l) => (
              <div key={l.slug} className="flex flex-col gap-2 rounded-lg border border-border bg-bg-soft/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-100">{l.name}</span>
                  <TierBadge tier={l.tier} />
                </div>
                <div className="text-xs text-slate-500">{l.region} · {l.teams.length} teams</div>
                <Button variant={existingSlugs.has(l.slug) ? 'outline' : 'primary'} size="sm" onClick={() => quickImport(l.slug)}>
                  {existingSlugs.has(l.slug) ? 'Import again' : 'Import'}
                </Button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Search */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Search real data</CardTitle>
            <div className="flex gap-1">
              <Button variant={tab === 'teams' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('teams')}><Users2 size={14} /> Teams</Button>
              <Button variant={tab === 'players' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab('players')}><User size={14} /> Players</Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-500" />
              <Input className="pl-8" placeholder={`Search ${tab}…`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {loading ? (
              <div className="flex h-24 items-center justify-center"><Spinner /></div>
            ) : (
              <div className="max-h-96 space-y-1.5 overflow-y-auto">
                {tab === 'teams'
                  ? teamHits.slice(0, 50).map((t, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium text-slate-100">{t.name}</span>
                          <span className="ml-2 text-xs text-slate-500">{t.short} · {t.leagueName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RegionBadge region={t.region} />
                          <Badge color="#26d0ce">{t.source_name}</Badge>
                        </div>
                      </div>
                    ))
                  : playerHits.slice(0, 60).map((p, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{flagEmoji(p.nationality)}</span>
                          <span className="font-medium text-slate-100">{p.nickname}</span>
                          <RoleBadge role={p.role as Role} />
                          <span className="text-xs text-slate-500">{p.teamShort}</span>
                        </div>
                        <Badge color="#26d0ce">{p.source_name}</Badge>
                      </div>
                    ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Jobs */}
        <Card>
          <CardHeader><CardTitle>Import jobs</CardTitle></CardHeader>
          <CardBody className="space-y-2">
            {jobs.length === 0 && <p className="text-sm text-slate-500">No import jobs yet. Import a league to see live progress here.</p>}
            {jobs.slice(0, 12).map((j) => (
              <div key={j.id} className="rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-200">{j.source_name}</span>
                  <Badge color={j.status === 'completed' ? '#22c55e' : j.status === 'failed' ? '#ef4444' : '#eab308'}>{j.status}</Badge>
                </div>
                <div className="mt-0.5 text-slate-600">{j.import_type} · {timeAgo(j.created_at)}</div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}

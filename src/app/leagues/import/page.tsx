'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Check, Loader2, DownloadCloud, ArrowRight, Database, Users2, ExternalLink } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { listAdapters, getAdapter, type LeagueHit, type RawLeague } from '@/services/importers';
import { PageContainer } from '@/components/common/layout';
import { Card, CardBody, Button, Badge, Spinner } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form';
import { Toggle } from '@/components/ui/form';
import { TierBadge, RegionBadge } from '@/components/common/badges';
import { FORMAT_META } from '@/lib/constants';
import { cn } from '@/lib/utils';

type Step = 'source' | 'select' | 'preview' | 'importing';

export default function ImportWizard() {
  const router = useRouter();
  const importRaw = useStore((s) => s.importRawLeague);
  const addJob = useStore((s) => s.addImportJob);
  const updateJob = useStore((s) => s.updateImportJob);

  const [step, setStep] = useState<Step>('source');
  const [adapterKey, setAdapterKey] = useState('leaguepedia');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<LeagueHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RawLeague | null>(null);
  const [presimulate, setPresimulate] = useState(true);
  const [log, setLog] = useState<string[]>([]);

  const adapters = listAdapters().filter((a) => a.type !== 'manual');

  // initial search when entering select
  useEffect(() => {
    if (step !== 'select') return;
    let active = true;
    setLoading(true);
    getAdapter(adapterKey)
      .searchLeagues(query)
      .then((r) => active && setHits(r))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [step, adapterKey, query]);

  const pickLeague = async (hit: LeagueHit) => {
    setLoading(true);
    const raw = await getAdapter(adapterKey).fetchLeague(hit.slug);
    setLoading(false);
    if (raw) {
      setSelected(raw);
      setStep('preview');
    }
  };

  const runImport = async () => {
    if (!selected) return;
    setStep('importing');
    const jobId = addJob({ league_id: null, source_name: selected.source_name ?? adapterKey, import_type: 'full', status: 'running', logs: '', completed_at: null });
    const steps = [
      `Connecting to ${selected.source_name}…`,
      `Fetching ${selected.name} (${selected.season})…`,
      `Importing ${selected.teams.length} teams & logos…`,
      `Resolving rosters, coaches & nationalities…`,
      `Generating ratings, values & contracts…`,
      presimulate ? 'Generating schedule & simulating season…' : 'Generating schedule…',
    ];
    const acc: string[] = [];
    for (const line of steps) {
      acc.push(line);
      setLog([...acc]);
      updateJob(jobId, { logs: acc.join('\n') });
      await new Promise((r) => setTimeout(r, 350));
    }
    const id = importRaw(selected, { presimulate });
    updateJob(jobId, { league_id: id, status: 'completed', logs: [...acc, 'Done ✓'].join('\n'), completed_at: new Date().toISOString() });
    await new Promise((r) => setTimeout(r, 400));
    router.push(`/leagues/${id}`);
  };

  const STEPS: { id: Step; label: string }[] = [
    { id: 'source', label: 'Source' },
    { id: 'select', label: 'League' },
    { id: 'preview', label: 'Preview' },
    { id: 'importing', label: 'Import' },
  ];
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <PageContainer className="max-w-4xl">
      <div className="mb-2 flex items-center gap-2">
        <DownloadCloud className="text-rift-cyan" />
        <h1 className="text-2xl font-bold text-slate-50">Import a real LoL esports league</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Pull real teams, rosters, coaches and formats from public sources. All imported data is fully editable afterwards.
      </p>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center gap-2">
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', i <= stepIndex ? 'bg-rift-cyan text-bg' : 'bg-bg-elevated text-slate-500')}>
              {i < stepIndex ? <Check size={14} /> : i + 1}
            </div>
            <span className={cn('text-sm', i === stepIndex ? 'text-slate-100' : 'text-slate-500')}>{s.label}</span>
            {i < STEPS.length - 1 && <div className={cn('h-px flex-1', i < stepIndex ? 'bg-rift-cyan/50' : 'bg-border')} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'source' && (
        <Card>
          <CardBody className="space-y-3">
            <h2 className="font-semibold text-slate-200">Choose a data source</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {adapters.map((a) => {
                const key = a.name.toLowerCase().replace(/\s+/g, '');
                const k = key === 'lolesports' ? 'lolesports' : key === 'genericwiki' ? 'genericwiki' : a.name.toLowerCase().split(' ')[0];
                return (
                  <button
                    key={a.name}
                    onClick={() => setAdapterKey(k)}
                    className={cn('flex items-start gap-3 rounded-lg border p-3 text-left transition-colors', adapterKey === k ? 'border-rift-cyan bg-rift-cyan/10' : 'border-border hover:border-border-soft')}
                  >
                    <Database size={18} className="mt-0.5 text-rift-cyan" />
                    <div>
                      <div className="font-medium text-slate-100">{a.name}</div>
                      <div className="text-xs text-slate-500">{a.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setStep('select')}>
                Continue <ArrowRight size={15} />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'select' && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('source')}>← Source</Button>
              <div className="relative flex-1">
                <Search size={15} className="absolute left-2.5 top-2.5 text-slate-500" />
                <Input className="pl-8" placeholder="Search leagues (LCK, LEC, Worlds…)" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
            {loading ? (
              <div className="flex h-32 items-center justify-center"><Spinner /></div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {hits.map((h) => (
                  <button key={h.slug} onClick={() => pickLeague(h)} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg-soft/40 p-3 text-left transition-colors hover:border-rift-cyan/40">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-100">{h.name}</span>
                        <TierBadge tier={h.tier} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <RegionBadge region={h.region} /> {h.season} · {h.teamCount} teams
                      </div>
                    </div>
                    <ArrowRight size={16} className="shrink-0 text-slate-600" />
                  </button>
                ))}
                {hits.length === 0 && <p className="col-span-2 py-6 text-center text-sm text-slate-500">No leagues found.</p>}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {step === 'preview' && selected && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-100">{selected.name}</h2>
                  <TierBadge tier={selected.tier} />
                  <RegionBadge region={selected.region} />
                </div>
                <div className="text-sm text-slate-500">
                  {selected.season} · {FORMAT_META[selected.format].label} · {selected.teams.length} teams · source {selected.source_name}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep('select')}>← Back</Button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {selected.teams.map((t) => (
                <div key={t.short} className="rounded-lg border border-border bg-bg-soft/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{t.name}</span>
                    <Badge color="#64748b">{t.short}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1 text-xs text-slate-500">
                    {(t.roster ?? []).slice(0, 5).map((p) => (
                      <span key={p.nick} className="rounded bg-bg-elevated px-1.5 py-0.5">{p.nick}</span>
                    ))}
                    {(!t.roster || t.roster.length < 5) && <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-slate-600">+ auto-filled</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Toggle checked={presimulate} onChange={setPresimulate} label="Generate schedule & simulate the regular season" />
              <Button variant="primary" onClick={runImport}>
                <DownloadCloud size={16} /> Import & activate
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'importing' && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2 text-slate-200">
              <Loader2 className="animate-spin text-rift-cyan" size={18} /> Importing {selected?.name}…
            </div>
            <div className="rounded-lg border border-border bg-black/40 p-3 font-mono text-xs text-slate-400">
              {log.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-rift-green">›</span> {l}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <p className="mt-4 flex items-center gap-1 text-xs text-slate-600">
        <ExternalLink size={12} /> Adapters resolve from the bundled real dataset and are structured to fetch live wiki/official data.
      </p>
    </PageContainer>
  );
}

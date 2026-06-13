'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Copy, FileJson, Sparkles, Plus } from 'lucide-react';
import { useDb } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { PageContainer } from '@/components/common/layout';
import { Card, CardBody, Button } from '@/components/ui/primitives';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { LEAGUE_FORMAT_OPTIONS, FORMAT_META, TIER_META } from '@/lib/constants';
import type { LeagueFormat, LeagueTier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { TierBadge } from '@/components/common/badges';

type Mode = 'manual' | 'clone' | 'json';

export default function NewLeaguePage() {
  const router = useRouter();
  const db = useDb();
  const createLeague = useStore((s) => s.createLeague);
  const createTeam = useStore((s) => s.createTeam);
  const regenerate = useStore((s) => s.regenerateSchedule);
  const cloneLeague = useStore((s) => s.cloneLeague);
  const importBundle = useStore((s) => s.importLeagueBundle);

  const [mode, setMode] = useState<Mode>('manual');

  // manual state
  const [form, setForm] = useState({ name: '', region: 'Custom', tier: 'custom' as LeagueTier, season: '2025', format: 'double_round_robin_bo1' as LeagueFormat, adminCode: '' });
  const [teamLines, setTeamLines] = useState('');
  const [genSchedule, setGenSchedule] = useState(true);

  // clone state
  const [cloneId, setCloneId] = useState('');
  // json state
  const [jsonText, setJsonText] = useState('');

  const setF = (p: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...p }));

  const createManual = () => {
    if (!form.name.trim()) return;
    const leagueId = createLeague(form);
    const names = teamLines.split('\n').map((l) => l.trim()).filter(Boolean);
    names.forEach((name) => {
      const short = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || name.slice(0, 3).toUpperCase();
      createTeam(leagueId, { name, short_name: short, region: form.region, tier: form.tier });
    });
    if (genSchedule && names.length >= 2) regenerate(leagueId, form.format);
    router.push(`/leagues/${leagueId}`);
  };

  const doClone = () => {
    if (!cloneId) return;
    const id = cloneLeague(cloneId);
    if (id) router.push(`/leagues/${id}`);
  };

  const doJson = () => {
    const id = importBundle(jsonText);
    if (id) router.push(`/leagues/${id}`);
  };

  const readFile = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setJsonText(String(r.result));
    r.readAsText(file);
  };

  return (
    <PageContainer className="max-w-3xl">
      <div className="mb-2 flex items-center gap-2">
        <Wand2 className="text-rift-cyan" />
        <h1 className="text-2xl font-bold text-slate-50">Create a league</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">Build a custom league, clone an existing one, or import from a JSON bundle.</p>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {([
          { id: 'manual', label: 'From scratch', icon: Sparkles },
          { id: 'clone', label: 'Clone existing', icon: Copy },
          { id: 'json', label: 'Import JSON', icon: FileJson },
        ] as const).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={cn('flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors', mode === m.id ? 'border-rift-cyan bg-rift-cyan/10 text-rift-cyan' : 'border-border text-slate-400 hover:border-border-soft')}
          >
            <m.icon size={18} />
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'manual' && (
        <Card>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="League name *" className="col-span-2"><Input value={form.name} onChange={(e) => setF({ name: e.target.value })} placeholder="My Custom League" /></Field>
              <Field label="Region"><Input value={form.region} onChange={(e) => setF({ region: e.target.value })} /></Field>
              <Field label="Season"><Input value={form.season} onChange={(e) => setF({ season: e.target.value })} /></Field>
              <Field label="Tier">
                <Select value={form.tier} onChange={(e) => setF({ tier: e.target.value as LeagueTier })}>
                  {(Object.keys(TIER_META) as LeagueTier[]).map((t) => <option key={t} value={t}>{TIER_META[t].label}</option>)}
                </Select>
              </Field>
              <Field label="Format">
                <Select value={form.format} onChange={(e) => setF({ format: e.target.value as LeagueFormat })}>
                  {LEAGUE_FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{FORMAT_META[f].label}</option>)}
                </Select>
              </Field>
            </div>
            <p className="text-xs text-slate-600">{FORMAT_META[form.format].description}</p>
            <Field label="Admin recovery code" hint="Optional. Use it to recover admin access from another guest session.">
              <Input type="password" autoComplete="new-password" value={form.adminCode} onChange={(e) => setF({ adminCode: e.target.value })} placeholder="Optional recovery code" />
            </Field>
            <Field label="Teams (one per line, optional)" hint="You can also add teams later from the admin panel.">
              <Textarea rows={5} value={teamLines} onChange={(e) => setTeamLines(e.target.value)} placeholder={'Team Alpha\nTeam Bravo\nTeam Charlie\nTeam Delta'} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={genSchedule} onChange={(e) => setGenSchedule(e.target.checked)} className="accent-rift-cyan" />
              Auto-generate schedule from these teams
            </label>
            <div className="flex justify-end">
              <Button variant="primary" disabled={!form.name.trim()} onClick={createManual}><Plus size={15} /> Create league</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {mode === 'clone' && (
        <Card>
          <CardBody className="space-y-3">
            <Field label="League to clone">
              <Select value={cloneId} onChange={(e) => setCloneId(e.target.value)}>
                <option value="">Select a league…</option>
                {db.leagues.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}
              </Select>
            </Field>
            {cloneId && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-soft/40 p-3 text-sm text-slate-400">
                <TierBadge tier={db.leagues.find((l) => l.id === cloneId)!.tier} />
                Creates an independent copy with all teams, rosters, coaches & schedule.
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="primary" disabled={!cloneId} onClick={doClone}><Copy size={15} /> Clone league</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {mode === 'json' && (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm text-slate-500">Import a league bundle exported from Rift League Manager (admin → Import/Export).</p>
            <input type="file" accept=".json,application/json" onChange={(e) => readFile(e.target.files?.[0])} className="text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-bg-elevated file:px-2 file:py-1 file:text-slate-300" />
            <Textarea rows={8} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder='{ "format": "rift-league-manager/v1", ... }' />
            <div className="flex justify-end">
              <Button variant="primary" disabled={!jsonText.trim()} onClick={doJson}><FileJson size={15} /> Import bundle</Button>
            </div>
          </CardBody>
        </Card>
      )}
    </PageContainer>
  );
}

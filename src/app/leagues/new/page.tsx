'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Copy, FileJson, Sparkles, Plus, Timer, Map, Globe2, Boxes } from 'lucide-react';
import { useDb } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { PageContainer } from '@/components/common/layout';
import { Card, CardBody, Button, Badge } from '@/components/ui/primitives';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { LEAGUE_FORMAT_OPTIONS, FORMAT_META, TIER_META } from '@/lib/constants';
import type { CompetitionMode, LeagueFormat, LeagueTier } from '@/lib/types';
import { cn, teamShortName } from '@/lib/utils';
import { TierBadge } from '@/components/common/badges';
import { COMPETITION_MODE_META } from '@/services/competition';
import { listDataPacks, getDataPack, competitionToRawLeague } from '@/lib/dataPacks';

type Mode = 'manual' | 'pack' | 'clone' | 'json';

export default function NewLeaguePage() {
  const router = useRouter();
  const db = useDb();
  const createLeague = useStore((s) => s.createLeague);
  const createTeam = useStore((s) => s.createTeam);
  const regenerate = useStore((s) => s.regenerateSchedule);
  const cloneLeague = useStore((s) => s.cloneLeague);
  const importBundle = useStore((s) => s.importLeagueBundle);
  const importRaw = useStore((s) => s.importRawLeague);

  const [mode, setMode] = useState<Mode>('manual');

  // manual state
  const [form, setForm] = useState({ name: '', region: 'Custom', tier: 'custom' as LeagueTier, season: '2026', format: 'double_round_robin_bo1' as LeagueFormat, competition_mode: 'regional_season' as CompetitionMode, adminCode: '' });
  const [teamLines, setTeamLines] = useState('');
  const [genSchedule, setGenSchedule] = useState(true);

  // data pack state
  const packs = listDataPacks();
  const [packId, setPackId] = useState(packs[0]?.id ?? '');
  const [competitionId, setCompetitionId] = useState('');
  const selectedPack = getDataPack(packId);
  const selectedCompetition = selectedPack?.competitions.find((c) => c.id === competitionId) ?? selectedPack?.competitions[0];

  // clone state
  const [cloneId, setCloneId] = useState('');
  // json state
  const [jsonText, setJsonText] = useState('');

  const setF = (p: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...p }));

  const createManual = () => {
    if (!form.name.trim()) return;
    const leagueId = createLeague(form);
    const names = teamLines.split('\n').map((l) => l.trim()).filter(Boolean);
    const usedShorts = new Set<string>();
    names.forEach((name) => {
      const short = teamShortName(name, usedShorts);
      createTeam(leagueId, { name, short_name: short, region: form.region, tier: form.tier });
    });
    if (genSchedule && names.length >= 2) regenerate(leagueId, form.format);
    router.push(`/leagues/${leagueId}/lobby`);
  };

  const doPack = () => {
    if (!selectedPack || !selectedCompetition) return;
    const raw = competitionToRawLeague(selectedPack, selectedCompetition);
    const id = importRaw(raw);
    if (id) router.push(`/leagues/${id}/lobby`);
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
      <p className="mb-6 text-sm text-slate-500">Build a custom league, seed teams from a data pack, clone an existing one, or import from a JSON bundle.</p>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([
          { id: 'manual', label: 'From scratch', icon: Sparkles },
          { id: 'pack', label: 'Data pack', icon: Boxes },
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
            <Field label="Competition mode">
              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  { id: 'quick_tournament', icon: Timer },
                  { id: 'regional_season', icon: Map },
                  { id: 'full_circuit', icon: Globe2 },
                ] as const).map(({ id, icon: Icon }) => {
                  const meta = COMPETITION_MODE_META[id];
                  const active = form.competition_mode === id;
                  return (
                    <button key={id} type="button" onClick={() => setF({ competition_mode: id })} className={cn('rounded-lg border p-3 text-left transition-colors', active ? 'border-rift-cyan bg-rift-cyan/10' : 'border-border bg-bg-soft/30 hover:border-border-soft')}>
                      <div className={cn('mb-1 flex items-center gap-2 text-sm font-semibold', active ? 'text-rift-cyan' : 'text-slate-200')}><Icon size={15} /> {meta.label}</div>
                      <p className="text-xs leading-relaxed text-slate-500">{meta.description}</p>
                    </button>
                  );
                })}
              </div>
            </Field>
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

      {mode === 'pack' && (
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm text-slate-500">Seed a league from a structured esports data pack — teams, rosters, regions and tiers. The bundled sample is fictional; private real-data packs can be added later.</p>
            {packs.length === 0 ? (
              <div className="rounded-lg border border-border bg-bg-soft/40 p-4 text-sm text-slate-500">No data packs are installed.</div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Data pack">
                    <Select value={packId} onChange={(e) => { setPackId(e.target.value); setCompetitionId(''); }}>
                      {packs.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.season}</option>)}
                    </Select>
                  </Field>
                  <Field label="Competition">
                    <Select value={selectedCompetition?.id ?? ''} onChange={(e) => setCompetitionId(e.target.value)}>
                      {selectedPack?.competitions.map((c) => <option key={c.id} value={c.id}>{c.name} · {TIER_META[c.tier].label}</option>)}
                    </Select>
                  </Field>
                </div>
                {selectedPack && (
                  <p className="text-xs text-slate-600">{selectedPack.description} · {selectedPack.regions.length} regions · {selectedPack.teams.length} teams · {selectedPack.players.length} players · v{selectedPack.version}</p>
                )}
                {selectedPack && selectedCompetition && (
                  <div className="space-y-2 rounded-lg border border-border bg-bg-soft/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <TierBadge tier={selectedCompetition.tier} />
                      <Badge color="#64748b">{FORMAT_META[selectedCompetition.format].label}</Badge>
                      <span className="text-xs text-slate-500">{selectedCompetition.team_ids.length} teams</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCompetition.team_ids.map((tid) => {
                        const team = selectedPack.teams.find((t) => t.id === tid);
                        return team ? <span key={tid} className="rounded-md border border-border bg-bg-card px-2 py-1 text-xs text-slate-300">{team.name} <span className="text-slate-600">{team.short_name}</span></span> : null;
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button variant="primary" disabled={!selectedCompetition} onClick={doPack}><Boxes size={15} /> Create from pack</Button>
                </div>
              </>
            )}
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

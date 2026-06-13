'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Settings, Users2, CalendarRange, Database, Shield, AlertOctagon, ScrollText,
  Download, Upload, Plus, Pencil, Trash2, Copy, RotateCcw, FileJson, FileSpreadsheet, Image as ImageIcon,
} from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canManage } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { teamsOf, playersOf, matchesOf, importJobsOf, auditLogsOf } from '@/lib/store/selectors';
import type { LeagueFormat, LeagueTier } from '@/lib/types';
import { LEAGUE_FORMAT_OPTIONS, FORMAT_META, TIER_META } from '@/lib/constants';
import { buildLeagueExport } from '@/services/leagueIO';
import { playersToCsv, teamsToCsv, coachesToCsv, matchesToCsv, CSV_HEADERS } from '@/services/csv';
import { TeamForm } from '@/components/team/TeamForm';
import { TeamLogo } from '@/components/ui/image';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge, EmptyState, Divider } from '@/components/ui/primitives';
import { Dialog, ConfirmButton, useDialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { cn, downloadFile, formatDateTime, timeAgo } from '@/lib/utils';

const SECTIONS = [
  { id: 'settings', label: 'League settings', icon: Settings },
  { id: 'teams', label: 'Teams', icon: Users2 },
  { id: 'schedule', label: 'Schedule', icon: CalendarRange },
  { id: 'assets', label: 'Assets', icon: ImageIcon },
  { id: 'io', label: 'Import / Export', icon: Database },
  { id: 'admins', label: 'Admins', icon: Shield },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'danger', label: 'Danger zone', icon: AlertOctagon },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

export default function AdminPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const [section, setSection] = useState<SectionId>('settings');

  if (!league) return null;
  if (!canManage(role)) {
    return <EmptyState title="Admin access required" hint="Only league owners and admins can manage settings." icon={<Shield size={36} />} />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
              section === s.id ? 'bg-rift-cyan/15 text-rift-cyan' : 'text-slate-400 hover:bg-bg-elevated hover:text-slate-200',
            )}
          >
            <s.icon size={15} /> {s.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        {section === 'settings' && <SettingsSection leagueId={league.id} />}
        {section === 'teams' && <TeamsSection leagueId={league.id} />}
        {section === 'schedule' && <ScheduleSection leagueId={league.id} />}
        {section === 'assets' && <AssetsSection leagueId={league.id} />}
        {section === 'io' && <IoSection leagueId={league.id} />}
        {section === 'admins' && <AdminsSection leagueId={league.id} />}
        {section === 'logs' && <LogsSection leagueId={league.id} />}
        {section === 'danger' && <DangerSection leagueId={league.id} />}
      </div>
    </div>
  );
}

// --- Settings ---------------------------------------------------------------
function SettingsSection({ leagueId }: { leagueId: string }) {
  const db = useDb();
  const league = db.leagues.find((l) => l.id === leagueId)!;
  const update = useStore((s) => s.updateLeague);
  const [d, setD] = useState({ ...league });
  const set = (p: Partial<typeof d>) => setD((prev) => ({ ...prev, ...p }));
  const tiers = Object.keys(TIER_META) as LeagueTier[];

  return (
    <Card>
      <CardHeader><CardTitle>League settings</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><Input value={d.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Season"><Input value={d.season} onChange={(e) => set({ season: e.target.value })} /></Field>
          <Field label="Region"><Input value={d.region} onChange={(e) => set({ region: e.target.value })} /></Field>
          <Field label="Tier">
            <Select value={d.tier} onChange={(e) => set({ tier: e.target.value as LeagueTier })}>
              {tiers.map((t) => <option key={t} value={t}>{TIER_META[t].label}</option>)}
            </Select>
          </Field>
          <Field label="Format" className="col-span-2">
            <Select value={d.format} onChange={(e) => set({ format: e.target.value as LeagueFormat })}>
              {LEAGUE_FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{FORMAT_META[f].label}</option>)}
            </Select>
          </Field>
          <Field label="Logo URL" className="col-span-2"><Input value={d.logo_url ?? ''} onChange={(e) => set({ logo_url: e.target.value || null })} placeholder="https://…" /></Field>
          <Field label="External URL" className="col-span-2"><Input value={d.external_url ?? ''} onChange={(e) => set({ external_url: e.target.value || null })} /></Field>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => update(leagueId, d)}>Save settings</Button>
        </div>
      </CardBody>
    </Card>
  );
}

// --- Teams ------------------------------------------------------------------
function TeamsSection({ leagueId }: { leagueId: string }) {
  const db = useDb();
  const teams = teamsOf(db, leagueId);
  const create = useStore((s) => s.createTeam);
  const update = useStore((s) => s.updateTeam);
  const del = useStore((s) => s.deleteTeam);
  const addDialog = useDialog();
  const [editId, setEditId] = useState<string | null>(null);
  const editTeam = teams.find((t) => t.id === editId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team manager ({teams.length})</CardTitle>
        <Button variant="primary" size="sm" onClick={addDialog.openIt}><Plus size={14} /> Add team</Button>
      </CardHeader>
      <CardBody className="space-y-2">
        {teams.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2">
            <TeamLogo name={t.name} shortName={t.short_name} src={t.logo_url} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-100">{t.name}</div>
              <div className="text-xs text-slate-500">{t.short_name} · {t.region}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditId(t.id)}><Pencil size={14} /></Button>
            <ConfirmButton variant="ghost" size="sm" confirmLabel="Delete?" onConfirm={() => del(t.id)}><Trash2 size={14} /></ConfirmButton>
          </div>
        ))}
        {teams.length === 0 && <EmptyState title="No teams" hint="Add a team to get started." />}
      </CardBody>

      <Dialog open={addDialog.open} onClose={addDialog.close} title="Add team" size="lg">
        <TeamForm initial={{ name: '', short_name: '' }} submitLabel="Create team" onCancel={addDialog.close} onSave={(d) => { create(leagueId, { ...d, name: d.name, short_name: d.short_name }); addDialog.close(); }} />
      </Dialog>
      <Dialog open={!!editTeam} onClose={() => setEditId(null)} title={`Edit ${editTeam?.short_name ?? ''}`} size="lg">
        {editTeam && <TeamForm initial={editTeam} submitLabel="Save" onCancel={() => setEditId(null)} onSave={(d) => { update(editTeam.id, d); setEditId(null); }} />}
      </Dialog>
    </Card>
  );
}

// --- Schedule ---------------------------------------------------------------
function ScheduleSection({ leagueId }: { leagueId: string }) {
  const db = useDb();
  const league = db.leagues.find((l) => l.id === leagueId)!;
  const matches = matchesOf(db, leagueId);
  const regenerate = useStore((s) => s.regenerateSchedule);
  const reset = useStore((s) => s.resetLeagueResults);
  const [format, setFormat] = useState<LeagueFormat>(league.format);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Schedule generator</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-slate-500">{matches.length} matches currently scheduled.</p>
          <Field label="Format">
            <Select value={format} onChange={(e) => setFormat(e.target.value as LeagueFormat)}>
              {LEAGUE_FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{FORMAT_META[f].label}</option>)}
            </Select>
          </Field>
          <p className="text-xs text-slate-600">{FORMAT_META[format].description}</p>
          <div className="flex flex-wrap gap-2">
            <ConfirmButton variant="primary" confirmLabel="Regenerate (clears matches)?" onConfirm={() => regenerate(leagueId, format)}>
              <CalendarRange size={15} /> Regenerate schedule
            </ConfirmButton>
            <ConfirmButton variant="outline" confirmLabel="Reset all results?" onConfirm={() => reset(leagueId)}>
              <RotateCcw size={15} /> Reset results
            </ConfirmButton>
            <Link href={`/leagues/${leagueId}/schedule`}><Button variant="ghost">Open schedule →</Button></Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// --- Assets -----------------------------------------------------------------
function AssetsSection({ leagueId }: { leagueId: string }) {
  const db = useDb();
  const teams = teamsOf(db, leagueId);
  const players = playersOf(db, leagueId).filter((p) => p.team_id);
  const updateTeam = useStore((s) => s.updateTeam);
  const updatePlayer = useStore((s) => s.updatePlayer);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Team logos</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          <p className="mb-2 text-xs text-slate-500">Paste a public image URL. Blank uses a generated initials tile.</p>
          {teams.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <TeamLogo name={t.name} shortName={t.short_name} src={t.logo_url} size="sm" />
              <span className="w-20 shrink-0 truncate text-xs text-slate-400">{t.short_name}</span>
              <Input defaultValue={t.logo_url ?? ''} placeholder="https://…" onBlur={(e) => updateTeam(t.id, { logo_url: e.target.value || null })} />
            </div>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Player images</CardTitle></CardHeader>
        <CardBody className="max-h-96 space-y-2 overflow-y-auto">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-xs text-slate-400">{p.nickname}</span>
              <Input defaultValue={p.image_url ?? ''} placeholder="https://…" onBlur={(e) => updatePlayer(p.id, { image_url: e.target.value || null })} />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

// --- Import / Export --------------------------------------------------------
function IoSection({ leagueId }: { leagueId: string }) {
  const db = useDb();
  const league = db.leagues.find((l) => l.id === leagueId)!;
  const teams = teamsOf(db, leagueId);
  const players = playersOf(db, leagueId);
  const coaches = db.coaches.filter((c) => c.league_id === leagueId);
  const matches = matchesOf(db, leagueId);
  const importCsv = useStore((s) => s.importCsv);
  const importBundle = useStore((s) => s.importLeagueBundle);

  const [csvType, setCsvType] = useState<'players' | 'coaches' | 'teams' | 'matches'>('players');
  const [csvText, setCsvText] = useState('');
  const [jsonText, setJsonText] = useState('');

  const exportJson = () => {
    const bundle = buildLeagueExport(db, leagueId);
    if (bundle) downloadFile(`${league.slug}.json`, JSON.stringify(bundle, null, 2));
  };
  const exportCsv = (kind: typeof csvType) => {
    const content =
      kind === 'players' ? playersToCsv(players, teams) :
      kind === 'coaches' ? coachesToCsv(coaches, teams) :
      kind === 'teams' ? teamsToCsv(teams) :
      matchesToCsv(matches, teams);
    downloadFile(`${league.slug}-${kind}.csv`, content, 'text/csv');
  };
  const readFile = (file: File | undefined, cb: (text: string) => void) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => cb(String(r.result));
    r.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-1.5"><Download size={15} /> Export</CardTitle></CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportJson}><FileJson size={14} /> League JSON</Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv('teams')}><FileSpreadsheet size={14} /> Teams CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv('players')}><FileSpreadsheet size={14} /> Players CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv('coaches')}><FileSpreadsheet size={14} /> Coaches CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv('matches')}><FileSpreadsheet size={14} /> Matches CSV</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-1.5"><Upload size={15} /> Import CSV</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={csvType} onChange={(e) => setCsvType(e.target.value as typeof csvType)} className="w-36">
              <option value="players">Players</option>
              <option value="coaches">Coaches</option>
              <option value="teams">Teams</option>
              <option value="matches">Matches</option>
            </Select>
            <input type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0], setCsvText)} className="text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-bg-elevated file:px-2 file:py-1 file:text-slate-300" />
          </div>
          <p className="text-[11px] text-slate-600">Columns: {CSV_HEADERS[({ players: 'player', coaches: 'coach', teams: 'team', matches: 'match' } as const)[csvType]].join(', ')}</p>
          <Textarea rows={5} placeholder="Paste CSV rows (with header)…" value={csvText} onChange={(e) => setCsvText(e.target.value)} />
          <div className="flex justify-end">
            <Button variant="primary" size="sm" disabled={!csvText.trim()} onClick={() => { importCsv(leagueId, csvType, csvText); setCsvText(''); }}>
              Import {csvType}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-1.5"><FileJson size={15} /> Import league JSON</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          <p className="text-xs text-slate-500">Imports a full league bundle exported above as a brand-new league.</p>
          <input type="file" accept=".json,application/json" onChange={(e) => readFile(e.target.files?.[0], setJsonText)} className="text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-bg-elevated file:px-2 file:py-1 file:text-slate-300" />
          <Textarea rows={4} placeholder="…or paste exported JSON" value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
          <div className="flex justify-end">
            <Button variant="primary" size="sm" disabled={!jsonText.trim()} onClick={() => { importBundle(jsonText); setJsonText(''); }}>Import bundle</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// --- Admins -----------------------------------------------------------------
function AdminsSection({ leagueId }: { leagueId: string }) {
  const db = useDb();
  const admins = db.league_admins.filter((a) => a.league_id === leagueId);
  const teams = teamsOf(db, leagueId);
  const setAdmin = useStore((s) => s.setLeagueAdmin);
  const removeAdmin = useStore((s) => s.removeLeagueAdmin);
  const [name, setName] = useState('');
  const [r, setR] = useState<'admin' | 'manager' | 'viewer'>('manager');
  const [team, setTeam] = useState('');

  return (
    <Card>
      <CardHeader><CardTitle>Manage admins & managers</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        <div className="space-y-2">
          {admins.map((a) => {
            const profile = db.profiles.find((p) => p.id === a.user_id);
            const team = teams.find((t) => t.id === a.team_id);
            return (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-sm">
                <span className="flex-1 text-slate-200">{profile?.username ?? a.user_id}</span>
                {team && <Badge color="#3b82f6">{team.short_name}</Badge>}
                <Badge color={a.role === 'owner' ? '#c8a85a' : '#26d0ce'}>{a.role}</Badge>
                {a.role !== 'owner' && (
                  <Button variant="ghost" size="sm" onClick={() => removeAdmin(leagueId, a.user_id)}><Trash2 size={13} /></Button>
                )}
              </div>
            );
          })}
        </div>
        <Divider />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Input placeholder="User name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={r} onChange={(e) => setR(e.target.value as typeof r)}>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
          </Select>
          <Select value={team} onChange={(e) => setTeam(e.target.value)} disabled={r !== 'manager'}>
            <option value="">No team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.short_name}</option>)}
          </Select>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              const uid = `user-${name.trim().toLowerCase().replace(/\s+/g, '-')}`;
              if (!db.profiles.find((p) => p.id === uid)) {
                db.profiles.push({ id: uid, email: `${uid}@local`, username: name.trim(), avatar_url: null, created_at: new Date().toISOString() });
              }
              setAdmin(leagueId, uid, r, r === 'manager' ? team || null : null);
              setName('');
            }}
          >
            <Plus size={14} /> Add
          </Button>
        </div>
        <p className="text-[11px] text-slate-600">Managers can be scoped to a team. In mock mode users are local placeholders.</p>
      </CardBody>
    </Card>
  );
}

// --- Logs -------------------------------------------------------------------
function LogsSection({ leagueId }: { leagueId: string }) {
  const db = useDb();
  const jobs = importJobsOf(db, leagueId);
  const audit = auditLogsOf(db, leagueId).slice(0, 30);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Import jobs</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {jobs.length === 0 && <p className="text-sm text-slate-500">No import jobs.</p>}
          {jobs.map((j) => (
            <div key={j.id} className="rounded-lg border border-border bg-bg-soft/40 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-200">{j.source_name} · {j.import_type}</span>
                <Badge color={j.status === 'completed' ? '#22c55e' : j.status === 'failed' ? '#ef4444' : '#eab308'}>{j.status}</Badge>
              </div>
              {j.logs && <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-500">{j.logs}</pre>}
            </div>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
        <CardBody className="max-h-96 space-y-1.5 overflow-y-auto">
          {audit.length === 0 && <p className="text-sm text-slate-500">No actions logged.</p>}
          {audit.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-400"><span className="text-slate-200">{a.action_type}</span> {a.entity_type}</span>
              <span className="text-slate-600">{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

// --- Danger -----------------------------------------------------------------
function DangerSection({ leagueId }: { leagueId: string }) {
  const db = useDb();
  const league = db.leagues.find((l) => l.id === leagueId)!;
  const clone = useStore((s) => s.cloneLeague);
  const reset = useStore((s) => s.resetLeagueResults);
  const del = useStore((s) => s.deleteLeague);

  return (
    <Card className="border-rift-red/30">
      <CardHeader><CardTitle className="text-rift-red">Danger zone</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        <Row title="Duplicate league" desc="Create an independent copy with all teams, rosters & schedule.">
          <Button variant="secondary" size="sm" onClick={() => clone(leagueId)}><Copy size={14} /> Duplicate</Button>
        </Row>
        <Divider />
        <Row title="Reset results" desc="Set all matches back to scheduled and clear standings.">
          <ConfirmButton variant="outline" size="sm" confirmLabel="Reset all?" onConfirm={() => reset(leagueId)}><RotateCcw size={14} /> Reset</ConfirmButton>
        </Row>
        <Divider />
        <Row title="Delete league" desc="Permanently remove this league and everything in it.">
          <ConfirmButton variant="danger" size="sm" confirmLabel="Delete forever?" onConfirm={() => { del(leagueId); window.location.href = '/dashboard'; }}>
            <Trash2 size={14} /> {`Delete "${league.name}"`}
          </ConfirmButton>
        </Row>
      </CardBody>
    </Card>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-slate-200">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      {children}
    </div>
  );
}

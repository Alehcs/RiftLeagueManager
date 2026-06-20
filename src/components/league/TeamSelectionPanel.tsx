'use client';

import { useMemo, useState } from 'react';
import { Bot, Check, Dice5, Lock, Plus, Shield, Sparkles, UserMinus, X } from 'lucide-react';
import { useCurrentGuestId, useDb, useLeagueRole, useManagedTeamId, canAdminister } from '@/lib/store/hooks';
import { membersOf } from '@/lib/store/selectors';
import { useStore } from '@/lib/store/store';
import type { League, LeagueTier } from '@/lib/types';
import { TIER_META } from '@/lib/constants';
import { buildTeamPool, selectionRules, type PoolFilters, type SelectionOptions } from '@/services/teamSelection';
import { TeamLogo } from '@/components/ui/image';
import { Badge, Button, Card, CardBody, EmptyState } from '@/components/ui/primitives';
import { Field, Input, Select, Toggle } from '@/components/ui/form';
import { TierBadge } from '@/components/common/badges';
import { cn, teamShortName } from '@/lib/utils';

export function TeamSelectionPanel({ league }: { league: League }) {
  const db = useDb();
  const role = useLeagueRole(league.id);
  const currentGuestId = useCurrentGuestId();
  const managedTeamId = useManagedTeamId(league.id);
  const claimTeam = useStore((s) => s.claimTeam);
  const setBotTeam = useStore((s) => s.setBotTeam);
  const assignManager = useStore((s) => s.assignManager);
  const removeManager = useStore((s) => s.removeManager);
  const createTeam = useStore((s) => s.createTeam);
  const randomFillBots = useStore((s) => s.randomFillBots);

  const isAdmin = canAdminister(role);
  const members = membersOf(db, league.id);
  const viewers = members.filter((m) => m.role === 'viewer');

  const [options, setOptions] = useState<SelectionOptions>({ allowGuests: false, fantasy: false });
  const [filters, setFilters] = useState<PoolFilters>({ search: '', region: 'all', tier: 'all', status: 'all' });
  const [showCustom, setShowCustom] = useState(false);

  const pool = useMemo(() => buildTeamPool(db, league, options, filters), [db, league, options, filters]);
  const rules = selectionRules(league, options);
  const setFilter = (p: Partial<PoolFilters>) => setFilters((f) => ({ ...f, ...p }));

  return (
    <section className="space-y-3">
      {/* Mode rules banner */}
      <Card className={rules.regionLocked ? 'border-rift-cyan/30' : 'border-rift-gold/30'}>
        <CardBody className="space-y-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {rules.regionLocked ? <Lock size={15} className="text-rift-cyan" /> : <Sparkles size={15} className="text-rift-gold" />}
              <h3 className="font-semibold text-slate-100">{rules.title}</h3>
              {pool.fantasy.active && <Badge color="#c8a85a">Custom / Fantasy</Badge>}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              <span><strong className="text-slate-300">{pool.counts.eligible}</strong> available</span>
              <span><strong className="text-slate-300">{pool.counts.managed}</strong> managers</span>
              <span><strong className="text-slate-300">{pool.counts.bot}</strong> bots</span>
              {pool.counts.ineligible > 0 && <span><strong className="text-slate-400">{pool.counts.ineligible}</strong> locked</span>}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">{rules.hint}</p>
          {pool.fantasy.active && pool.fantasy.reason && (
            <div className="rounded-md border border-rift-gold/30 bg-rift-gold/10 px-3 py-2 text-xs text-rift-gold">{pool.fantasy.reason}</div>
          )}
          {isAdmin && rules.mode === 'regional_season' && (
            <Toggle checked={options.allowGuests} onChange={(allowGuests) => setOptions((o) => ({ ...o, allowGuests }))} label="Allow guest / custom teams (other regions, historic, custom)" />
          )}
          {isAdmin && rules.mode === 'full_circuit' && (
            <Toggle checked={options.fantasy} onChange={(fantasy) => setOptions((o) => ({ ...o, fantasy }))} label="Fantasy placement (any team into any region / era)" />
          )}
        </CardBody>
      </Card>

      {/* Filters + admin actions */}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Search" className="min-w-40 flex-1"><Input value={filters.search} placeholder="Team or region…" onChange={(e) => setFilter({ search: e.target.value })} /></Field>
        <Field label="Region">
          <Select value={filters.region} onChange={(e) => setFilter({ region: e.target.value })}>
            <option value="all">All regions</option>
            {pool.regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Tier">
          <Select value={filters.tier} onChange={(e) => setFilter({ tier: e.target.value })}>
            <option value="all">All tiers</option>
            {pool.tierOptions.map((t) => <option key={t} value={t}>{TIER_META[t]?.label ?? t}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={filters.status} onChange={(e) => setFilter({ status: e.target.value as PoolFilters['status'] })}>
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="selected">Selected</option>
          </Select>
        </Field>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" disabled={pool.counts.eligible === 0} onClick={() => randomFillBots(league.id)} title="Fill all open teams with bots"><Dice5 size={14} /> Random fill</Button>
            <Button variant={showCustom ? 'outline' : 'primary'} onClick={() => setShowCustom((v) => !v)}>{showCustom ? <X size={14} /> : <Plus size={14} />} Custom team</Button>
          </div>
        )}
      </div>

      {isAdmin && showCustom && <CustomTeamForm league={league} onCreate={(input) => { createTeam(league.id, input); setShowCustom(false); }} />}

      {/* Team pool */}
      {pool.entries.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pool.entries.map((entry) => {
            const team = entry.team;
            const ineligible = entry.status === 'ineligible';
            const committed = entry.status === 'managed' || entry.status === 'bot';
            const manager = entry.status === 'managed' ? membersOf(db, league.id).find((m) => m.team_id === team.id && m.role === 'manager') : undefined;
            return (
              <Card key={team.id} className={cn(ineligible && 'opacity-60', committed && 'border-border-soft')}>
                <CardBody className="space-y-3">
                  <div className="flex items-center gap-3">
                    <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-100">{team.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500"><span>{team.region} · {team.short_name}</span></div>
                    </div>
                    <TierBadge tier={team.tier} />
                    {committed && <Check size={16} className="text-rift-cyan" />}
                  </div>
                  <div className="min-h-7 text-xs text-slate-400">
                    {entry.status === 'bot' ? <span className="flex items-center gap-1.5"><Bot size={13} /> {entry.managerName}</span>
                      : entry.status === 'managed' ? <span className="flex items-center gap-1.5"><Shield size={13} /> {entry.managerName}</span>
                      : ineligible ? <span className="flex items-center gap-1.5 text-amber-500/80"><Lock size={12} /> {entry.reason}</span>
                      : 'Available'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.status === 'eligible' && !managedTeamId && <Button size="sm" variant="primary" onClick={() => void claimTeam(league.id, team.id)}>Pick team</Button>}
                    {entry.status === 'eligible' && isAdmin && <Button size="sm" variant="secondary" onClick={() => setBotTeam(team.id, true)}><Bot size={13} /> Use bot</Button>}
                    {entry.status === 'bot' && isAdmin && <Button size="sm" variant="outline" onClick={() => setBotTeam(team.id, false)}><Bot size={13} /> Remove bot</Button>}
                    {entry.status === 'managed' && manager && (manager.guest_id === currentGuestId || isAdmin) && (
                      <Button size="sm" variant="outline" onClick={() => removeManager(league.id, manager.guest_id)}><UserMinus size={13} /> {manager.guest_id === currentGuestId ? 'Release' : 'Remove'}</Button>
                    )}
                  </div>
                  {isAdmin && entry.status === 'eligible' && viewers.length > 0 && (
                    <Select defaultValue="" onChange={(e) => e.target.value && assignManager(league.id, e.target.value, team.id)}>
                      <option value="">Assign joined guest…</option>
                      {viewers.map((m) => <option key={m.id} value={m.guest_id}>{db.guest_sessions.find((g) => g.id === m.guest_id)?.display_name ?? 'Guest'}</option>)}
                    </Select>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No teams match" hint="Adjust the filters, enable guest/custom teams, or add a custom team." />
      )}
    </section>
  );
}

function CustomTeamForm({ league, onCreate }: { league: League; onCreate: (input: { name: string; short_name: string; region: string; tier: LeagueTier; logo_url: string | null }) => void }) {
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [region, setRegion] = useState(league.region ?? 'Custom');
  const [tier, setTier] = useState<LeagueTier>('custom');
  const [logo, setLogo] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), short_name: short.trim() || teamShortName(name.trim()), region: region.trim() || (league.region ?? 'Custom'), tier, logo_url: logo.trim() || null });
    setName(''); setShort(''); setLogo('');
  };

  return (
    <Card className="border-rift-cyan/30">
      <CardBody className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">New custom team</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Team name *"><Input value={name} placeholder="Expansion Esports" onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Short name" hint="Auto-derived if blank"><Input value={short} placeholder="EXP" maxLength={5} onChange={(e) => setShort(e.target.value.toUpperCase())} /></Field>
          <Field label="Region"><Input value={region} onChange={(e) => setRegion(e.target.value)} /></Field>
          <Field label="Tier"><Select value={tier} onChange={(e) => setTier(e.target.value as LeagueTier)}>{(Object.keys(TIER_META) as LeagueTier[]).map((t) => <option key={t} value={t}>{TIER_META[t].label}</option>)}</Select></Field>
          <Field label="Logo URL" hint="Optional — falls back to initials" className="sm:col-span-2 lg:col-span-1"><Input value={logo} placeholder="https://… (optional)" onChange={(e) => setLogo(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end"><Button variant="primary" disabled={!name.trim()} onClick={submit}><Plus size={14} /> Add team</Button></div>
        <p className="text-[11px] text-slate-600">Custom teams get generated players when the run starts. Assign them to a region to use them in realistic modes.</p>
      </CardBody>
    </Card>
  );
}

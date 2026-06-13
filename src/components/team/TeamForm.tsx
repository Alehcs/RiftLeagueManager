'use client';

import { useState } from 'react';
import type { LeagueTier, Team } from '@/lib/types';
import { TIER_META } from '@/lib/constants';
import { Field, Input, Select } from '@/components/ui/form';
import { Button } from '@/components/ui/primitives';

export type TeamDraft = Partial<Team> & { name: string; short_name: string };
const TIERS = Object.keys(TIER_META) as LeagueTier[];

export function TeamForm({
  initial,
  onSave,
  onCancel,
  submitLabel = 'Save',
}: {
  initial: TeamDraft;
  onSave: (d: TeamDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [d, setD] = useState<TeamDraft>({ ...initial });
  const set = (p: Partial<TeamDraft>) => setD((prev) => ({ ...prev, ...p }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!d.name.trim() || !d.short_name.trim()) return;
        onSave(d);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *"><Input value={d.name} onChange={(e) => set({ name: e.target.value })} required /></Field>
        <Field label="Short name *"><Input value={d.short_name} maxLength={5} onChange={(e) => set({ short_name: e.target.value.toUpperCase() })} required /></Field>
        <Field label="Region"><Input value={d.region ?? ''} onChange={(e) => set({ region: e.target.value })} /></Field>
        <Field label="Country (ISO-2)"><Input value={d.country ?? ''} maxLength={3} onChange={(e) => set({ country: e.target.value.toUpperCase() })} /></Field>
        <Field label="Tier">
          <Select value={d.tier ?? 'custom'} onChange={(e) => set({ tier: e.target.value as LeagueTier })}>
            {TIERS.map((t) => <option key={t} value={t}>{TIER_META[t].label}</option>)}
          </Select>
        </Field>
        <Field label="Budget ($)"><Input type="number" value={d.budget ?? ''} onChange={(e) => set({ budget: Number(e.target.value) })} /></Field>
        <Field label="Logo URL" className="col-span-2"><Input value={d.logo_url ?? ''} onChange={(e) => set({ logo_url: e.target.value || null })} placeholder="https://… (blank = generated tile)" /></Field>
        <Field label="External URL" className="col-span-2"><Input value={d.external_url ?? ''} onChange={(e) => set({ external_url: e.target.value || null })} /></Field>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}

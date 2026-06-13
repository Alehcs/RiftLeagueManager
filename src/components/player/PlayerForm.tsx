'use client';

import { useState } from 'react';
import type { Player, Role, Team, PlayerStatus } from '@/lib/types';
import { PLAYER_ROLES } from '@/lib/types';
import { ROLE_META } from '@/lib/constants';
import { Field, Input, Select } from '@/components/ui/form';
import { Button } from '@/components/ui/primitives';

const ROLES: Role[] = [...PLAYER_ROLES, 'SUBSTITUTE', 'COACH'];
const STATUSES: PlayerStatus[] = ['active', 'benched', 'free_agent', 'retired'];

export type PlayerDraft = Partial<Player> & { nickname: string; role: Role };

export function PlayerForm({
  initial,
  teams,
  onSave,
  onCancel,
  submitLabel = 'Save',
}: {
  initial: PlayerDraft;
  teams: Team[];
  onSave: (draft: PlayerDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [d, setD] = useState<PlayerDraft>({ ...initial });
  const set = (patch: Partial<PlayerDraft>) => setD((prev) => ({ ...prev, ...patch }));
  const numField = (k: keyof PlayerDraft, v: string) => set({ [k]: v === '' ? undefined : Number(v) } as Partial<PlayerDraft>);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!d.nickname.trim()) return;
        onSave(d);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nickname *">
          <Input value={d.nickname} onChange={(e) => set({ nickname: e.target.value })} required />
        </Field>
        <Field label="Real name">
          <Input value={d.real_name ?? ''} onChange={(e) => set({ real_name: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select value={d.role} onChange={(e) => set({ role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_META[r].label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Nationality (ISO-2)">
          <Input value={d.nationality ?? ''} maxLength={3} onChange={(e) => set({ nationality: e.target.value.toUpperCase() })} placeholder="KR" />
        </Field>
        <Field label="Age">
          <Input type="number" value={d.age ?? ''} onChange={(e) => numField('age', e.target.value)} />
        </Field>
        <Field label="Team">
          <Select value={d.team_id ?? ''} onChange={(e) => set({ team_id: e.target.value || null })}>
            <option value="">— Free agent —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={d.status ?? 'active'} onChange={(e) => set({ status: e.target.value as PlayerStatus })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Value ($)">
          <Input type="number" value={d.value ?? ''} onChange={(e) => numField('value', e.target.value)} />
        </Field>
        <Field label="Salary ($)">
          <Input type="number" value={d.salary ?? ''} onChange={(e) => numField('salary', e.target.value)} />
        </Field>
        <Field label="Image URL">
          <Input value={d.image_url ?? ''} onChange={(e) => set({ image_url: e.target.value || null })} placeholder="https://…" />
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
        <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Ratings (0–99)</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(['rating_overall', 'rating_laning', 'rating_teamfighting', 'rating_macro', 'rating_mechanics', 'rating_consistency'] as const).map((k) => (
            <Field key={k} label={k.replace('rating_', '').slice(0, 5)}>
              <Input type="number" min={0} max={99} value={d[k] ?? ''} onChange={(e) => numField(k, e.target.value)} />
            </Field>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

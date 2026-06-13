'use client';

import { useState } from 'react';
import { Pencil, Trash2, LogOut, UserPlus } from 'lucide-react';
import type { Coach, CoachStatus, Team } from '@/lib/types';
import { useStore } from '@/lib/store/store';
import { useDb } from '@/lib/store/hooks';
import { teamById } from '@/lib/store/selectors';
import { Dialog, ConfirmButton } from '@/components/ui/dialog';
import { Button } from '@/components/ui/primitives';
import { Field, Input, Select } from '@/components/ui/form';
import { PlayerAvatar, TeamLogo } from '@/components/ui/image';
import { RatingBar, OverallBadge } from '@/components/ui/rating';
import { GeneratedBadge } from '@/components/common/badges';
import { flagEmoji, formatMoney } from '@/lib/utils';

function coachOverall(c: Coach) {
  return Math.round((c.rating_draft + c.rating_macro + c.rating_development + c.rating_leadership) / 4);
}

export function CoachRow({ coach, teams, canEdit }: { coach: Coach; teams: Team[]; canEdit: boolean }) {
  const db = useDb();
  const team = teamById(db, coach.team_id);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-left transition-colors hover:border-border-soft hover:bg-bg-elevated/70"
      >
        <PlayerAvatar name={coach.nickname} src={coach.image_url} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-slate-100">{coach.nickname}</span>
            <span className="rounded bg-rift-cyan/15 px-1.5 py-0.5 text-[9px] font-bold text-rift-cyan">COACH</span>
            <GeneratedBadge show={coach.generated} />
          </div>
          <div className="truncate text-xs text-slate-500">
            {flagEmoji(coach.nationality)} {coach.real_name || '—'}
          </div>
        </div>
        {team ? (
          <div className="hidden items-center gap-1.5 sm:flex">
            <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} size="xs" />
            <span className="text-xs text-slate-400">{team.short_name}</span>
          </div>
        ) : (
          <span className="hidden rounded bg-bg-elevated px-2 py-0.5 text-[10px] text-slate-400 sm:block">Free agent</span>
        )}
        <OverallBadge value={coachOverall(coach)} size="sm" />
      </button>

      {open && <CoachDialog coach={coach} teams={teams} canEdit={canEdit} onClose={() => setOpen(false)} />}
    </>
  );
}

function CoachDialog({ coach, teams, canEdit, onClose }: { coach: Coach; teams: Team[]; canEdit: boolean; onClose: () => void }) {
  const update = useStore((s) => s.updateCoach);
  const del = useStore((s) => s.deleteCoach);
  const sign = useStore((s) => s.signCoach);
  const release = useStore((s) => s.releaseCoach);
  const [editing, setEditing] = useState(false);
  const [signTeam, setSignTeam] = useState('');
  const [d, setD] = useState<Partial<Coach>>(coach);
  const set = (p: Partial<Coach>) => setD((prev) => ({ ...prev, ...p }));

  return (
    <Dialog open onClose={onClose} size="lg" title={`${flagEmoji(coach.nationality)} ${coach.nickname} · Coach`}>
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nickname"><Input value={d.nickname ?? ''} onChange={(e) => set({ nickname: e.target.value })} /></Field>
            <Field label="Real name"><Input value={d.real_name ?? ''} onChange={(e) => set({ real_name: e.target.value })} /></Field>
            <Field label="Nationality"><Input value={d.nationality ?? ''} maxLength={3} onChange={(e) => set({ nationality: e.target.value.toUpperCase() })} /></Field>
            <Field label="Age"><Input type="number" value={d.age ?? ''} onChange={(e) => set({ age: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Team">
              <Select value={d.team_id ?? ''} onChange={(e) => set({ team_id: e.target.value || null })}>
                <option value="">— Free agent —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Salary ($)"><Input type="number" value={d.salary ?? ''} onChange={(e) => set({ salary: Number(e.target.value) })} /></Field>
          </div>
          <div className="grid grid-cols-4 gap-2 rounded-lg border border-border bg-bg-soft/40 p-3">
            {(['rating_draft', 'rating_macro', 'rating_development', 'rating_leadership'] as const).map((k) => (
              <Field key={k} label={k.replace('rating_', '')}>
                <Input type="number" min={0} max={99} value={d[k] ?? ''} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<Coach>)} />
              </Field>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { update(coach.id, d); setEditing(false); }}>Save</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <PlayerAvatar name={coach.nickname} src={coach.image_url} size="xl" />
            <div className="flex-1">
              <div className="text-lg font-bold text-slate-100">{coach.nickname}</div>
              <div className="text-sm text-slate-400">{coach.real_name || '—'} {coach.age ? `· ${coach.age}y` : ''}</div>
              <div className="mt-1 text-xs text-slate-500">Salary {formatMoney(coach.salary)}/yr</div>
            </div>
            <OverallBadge value={coachOverall(coach)} size="lg" />
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-bg-soft/40 p-3">
            <RatingBar label="Draft" value={coach.rating_draft} />
            <RatingBar label="Macro" value={coach.rating_macro} />
            <RatingBar label="Develop" value={coach.rating_development} />
            <RatingBar label="Leader" value={coach.rating_leadership} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {!coach.team_id ? (
              <div className="flex items-center gap-2">
                <Select value={signTeam} onChange={(e) => setSignTeam(e.target.value)} className="w-44">
                  <option value="">Hire to team…</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
                <Button variant="primary" size="sm" disabled={!signTeam} onClick={() => { sign(coach.id, signTeam); onClose(); }}>
                  <UserPlus size={14} /> Hire
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => release(coach.id)}>
                <LogOut size={14} /> Release
              </Button>
            )}
            {canEdit && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</Button>
                <ConfirmButton variant="ghost" size="sm" confirmLabel="Delete?" onConfirm={() => { del(coach.id); onClose(); }}>
                  <Trash2 size={14} />
                </ConfirmButton>
              </>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

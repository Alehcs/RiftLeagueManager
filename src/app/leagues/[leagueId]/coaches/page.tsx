'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canManage } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { coachesOf, teamsOf } from '@/lib/store/selectors';
import { CoachRow } from '@/components/coach/CoachRow';
import { Dialog, useDialog } from '@/components/ui/dialog';
import { Button, EmptyState } from '@/components/ui/primitives';
import { Field, Input, Select } from '@/components/ui/form';

export default function CoachesPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const createCoach = useStore((s) => s.createCoach);
  const addDialog = useDialog();
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState({ nickname: '', real_name: '', nationality: '', team_id: '' });

  if (!league) return null;
  const teams = teamsOf(db, league.id);
  const coaches = coachesOf(db, league.id).filter((c) => `${c.nickname} ${c.real_name}`.toLowerCase().includes(q.toLowerCase()));
  const manage = canManage(role);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Coaches</h2>
          <p className="text-sm text-slate-500">{coaches.length} coaches</p>
        </div>
        {manage && (
          <Button variant="primary" size="sm" onClick={addDialog.openIt}>
            <Plus size={14} /> Add coach
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-2.5 top-2.5 text-slate-500" />
        <Input className="pl-8" placeholder="Search coaches…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {coaches.length === 0 ? (
        <EmptyState title="No coaches" hint="Add a coach or import a league." />
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {coaches.map((c) => (
            <CoachRow key={c.id} coach={c} teams={teams} canEdit={manage} />
          ))}
        </div>
      )}

      <Dialog
        open={addDialog.open}
        onClose={addDialog.close}
        title="Add coach"
        footer={
          <>
            <Button variant="ghost" onClick={addDialog.close}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!draft.nickname.trim()}
              onClick={() => {
                createCoach(league.id, { nickname: draft.nickname, real_name: draft.real_name, nationality: draft.nationality, team_id: draft.team_id || null });
                setDraft({ nickname: '', real_name: '', nationality: '', team_id: '' });
                addDialog.close();
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nickname *"><Input value={draft.nickname} onChange={(e) => setDraft({ ...draft, nickname: e.target.value })} /></Field>
          <Field label="Real name"><Input value={draft.real_name} onChange={(e) => setDraft({ ...draft, real_name: e.target.value })} /></Field>
          <Field label="Nationality"><Input value={draft.nationality} maxLength={3} onChange={(e) => setDraft({ ...draft, nationality: e.target.value.toUpperCase() })} /></Field>
          <Field label="Team">
            <Select value={draft.team_id} onChange={(e) => setDraft({ ...draft, team_id: e.target.value })}>
              <option value="">— Free agent —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canManage } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { playersOf, teamsOf } from '@/lib/store/selectors';
import { PLAYER_ROLES, type Role } from '@/lib/types';
import { ROLE_META } from '@/lib/constants';
import { PlayerRow } from '@/components/player/PlayerRow';
import { PlayerForm } from '@/components/player/PlayerForm';
import { Dialog, useDialog } from '@/components/ui/dialog';
import { Button, EmptyState } from '@/components/ui/primitives';
import { Input, Select } from '@/components/ui/form';

export default function PlayersPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  const createPlayer = useStore((s) => s.createPlayer);
  const addDialog = useDialog();

  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [sort, setSort] = useState<'overall' | 'value' | 'name'>('overall');

  const teams = league ? teamsOf(db, league.id) : [];
  const players = league ? playersOf(db, league.id) : [];

  // Computed inline (not memoized): the store mutates `db` in place and signals
  // updates via a revision counter, so a `db`-keyed useMemo would go stale.
  const filtered = players
    .filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (teamFilter === 'free' && p.team_id) return false;
      if (teamFilter !== 'all' && teamFilter !== 'free' && p.team_id !== teamFilter) return false;
      if (q && !`${p.nickname} ${p.real_name}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) =>
      sort === 'overall' ? b.rating_overall - a.rating_overall : sort === 'value' ? b.value - a.value : a.nickname.localeCompare(b.nickname),
    );

  if (!league) return null;
  const manage = canManage(role);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Player database</h2>
          <p className="text-sm text-slate-500">{players.length} players · {filtered.length} shown</p>
        </div>
        {manage && (
          <Button variant="primary" size="sm" onClick={addDialog.openIt}>
            <Plus size={14} /> Add player
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="absolute left-2.5 top-2.5 text-slate-500" />
          <Input className="pl-8" placeholder="Search players…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-32" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}>
          <option value="all">All roles</option>
          {PLAYER_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_META[r].label}</option>
          ))}
        </Select>
        <Select className="w-40" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          <option value="all">All teams</option>
          <option value="free">Free agents</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.short_name}</option>
          ))}
        </Select>
        <Select className="w-32" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="overall">Sort: Rating</option>
          <option value="value">Sort: Value</option>
          <option value="name">Sort: Name</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No players match" hint="Try adjusting the filters." />
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {filtered.map((p) => (
            <PlayerRow key={p.id} player={p} teams={teams} canEdit={manage} />
          ))}
        </div>
      )}

      <Dialog open={addDialog.open} onClose={addDialog.close} title="Add player" size="lg">
        <PlayerForm
          initial={{ nickname: '', role: 'MID', status: 'free_agent' }}
          teams={teams}
          submitLabel="Create player"
          onCancel={addDialog.close}
          onSave={(d) => {
            createPlayer(league.id, { ...d, nickname: d.nickname, role: d.role });
            addDialog.close();
          }}
        />
      </Dialog>
    </div>
  );
}

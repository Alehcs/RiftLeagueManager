'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useDb, useLeague, useLeagueRole, canManage } from '@/lib/store/hooks';
import { teamsOf, matchesOf } from '@/lib/store/selectors';
import { standingsTable } from '@/services/standings';
import { TeamCard } from '@/components/team/TeamCard';
import { Button, EmptyState } from '@/components/ui/primitives';

export default function TeamsPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  if (!league) return null;

  const teams = teamsOf(db, league.id);
  const matches = matchesOf(db, league.id);
  // order by standings
  const ordered = standingsTable(teams, matches).map((r) => r.team);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Teams</h2>
          <p className="text-sm text-slate-500">{teams.length} teams</p>
        </div>
        {canManage(role) && (
          <Link href={`/leagues/${league.id}/admin`}>
            <Button variant="secondary" size="sm">
              <Plus size={14} /> Manage teams
            </Button>
          </Link>
        )}
      </div>

      {teams.length === 0 ? (
        <EmptyState title="No teams yet" hint="Import a league or add teams from the admin panel." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((t) => (
            <TeamCard key={t.id} team={t} />
          ))}
        </div>
      )}
    </div>
  );
}

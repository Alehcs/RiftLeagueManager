'use client';

import { useDb, useLeague, useLeagueRole, canAdminister } from '@/lib/store/hooks';
import { teamsOf, matchesOf, groupLabels } from '@/lib/store/selectors';
import { StandingsTable } from '@/components/league/StandingsTable';
import { SimControls } from '@/components/league/SimControls';
import { Card, CardHeader, CardTitle, CardBody, EmptyState } from '@/components/ui/primitives';

export default function StandingsPage({ params }: { params: { leagueId: string } }) {
  const db = useDb();
  const league = useLeague(params.leagueId);
  const role = useLeagueRole(league?.id);
  if (!league) return null;

  const teams = teamsOf(db, league.id);
  const matches = matchesOf(db, league.id);
  const groups = groupLabels(db, league.id);
  const cutoff = league.tier === 'international' ? undefined : Math.min(6, Math.max(2, Math.floor(teams.length / 2)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Standings</h2>
          <p className="text-sm text-slate-500">
            Ranked by series wins, then game differential. {cutoff != null && <span className="text-rift-cyan">Top {cutoff} qualify.</span>}
          </p>
        </div>
        {canAdminister(role) && <SimControls leagueId={league.id} compact />}
      </div>

      {teams.length === 0 ? (
        <EmptyState title="No teams" hint="Add teams to build standings." />
      ) : groups.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {groups.map((g) => {
            const groupTeamIds = new Set(
              matches.filter((m) => m.bracket_slot === `GROUP-${g}`).flatMap((m) => [m.blue_team_id, m.red_team_id]),
            );
            const groupTeams = teams.filter((t) => groupTeamIds.has(t.id));
            return (
              <Card key={g}>
                <CardHeader>
                  <CardTitle>Group {g}</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <StandingsTable teams={groupTeams} matches={matches} leagueId={league.id} group={`GROUP-${g}`} playoffCutoff={2} />
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardBody className="p-0">
            <StandingsTable teams={teams} matches={matches} leagueId={league.id} playoffCutoff={cutoff} />
          </CardBody>
        </Card>
      )}

      <p className="text-xs text-slate-600">
        Tiebreakers: series record → game differential → head-to-head (placeholder). Player ratings used by the simulator are
        synthesized and editable in the admin panel.
      </p>
    </div>
  );
}

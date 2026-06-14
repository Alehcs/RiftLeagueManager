import type { AdminRole, Coach, Database, Game, League, LeagueMember, Match, Player, Team, Trade } from '@/lib/types';

// ============================================================================
// Pure selectors over the Database. Components call these with the live db
// returned by useDb().
// ============================================================================

export const leagueBySlug = (db: Database, slug: string): League | undefined =>
  db.leagues.find((l) => l.slug === slug);

export const leagueById = (db: Database, id: string): League | undefined =>
  db.leagues.find((l) => l.id === id);

export const leagueByIdOrSlug = (db: Database, key: string): League | undefined =>
  db.leagues.find((l) => l.id === key || l.slug === key);

export const teamsOf = (db: Database, leagueId: string): Team[] =>
  db.teams.filter((t) => t.league_id === leagueId);

export const teamById = (db: Database, id: string | null): Team | undefined =>
  id ? db.teams.find((t) => t.id === id) : undefined;

export const playersOf = (db: Database, leagueId: string): Player[] =>
  db.players.filter((p) => p.league_id === leagueId);

export const playersOfTeam = (db: Database, teamId: string): Player[] =>
  db.players.filter((p) => p.team_id === teamId);

export const playerById = (db: Database, id: string): Player | undefined =>
  db.players.find((p) => p.id === id);

export const coachesOf = (db: Database, leagueId: string): Coach[] =>
  db.coaches.filter((c) => c.league_id === leagueId);

export const coachesOfTeam = (db: Database, teamId: string): Coach[] =>
  db.coaches.filter((c) => c.team_id === teamId);

export const freeAgents = (db: Database, leagueId: string): Player[] =>
  db.players.filter((p) => p.league_id === leagueId && !p.team_id);

export const freeAgentCoaches = (db: Database, leagueId: string): Coach[] =>
  db.coaches.filter((c) => c.league_id === leagueId && !c.team_id);

export const matchesOf = (db: Database, leagueId: string): Match[] =>
  db.matches.filter((m) => m.league_id === leagueId);

export const matchById = (db: Database, id: string): Match | undefined =>
  db.matches.find((m) => m.id === id);

export const gamesOf = (db: Database, matchId: string): Game[] =>
  db.games.filter((g) => g.match_id === matchId).sort((a, b) => a.game_number - b.game_number);

export const tradesOf = (db: Database, leagueId: string): Trade[] =>
  db.trades.filter((t) => t.league_id === leagueId).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

export const tradeItemsOf = (db: Database, tradeId: string) =>
  db.trade_items.filter((ti) => ti.trade_id === tradeId);

export const transferHistoryOf = (db: Database, leagueId: string) =>
  db.transfer_history.filter((t) => t.league_id === leagueId).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

export const importJobsOf = (db: Database, leagueId: string | null) =>
  db.import_jobs.filter((j) => (leagueId ? j.league_id === leagueId : true)).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

export const auditLogsOf = (db: Database, leagueId: string) =>
  db.audit_logs.filter((a) => a.league_id === leagueId).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

// --- Membership / roles / team management -----------------------------------
export const membersOf = (db: Database, leagueId: string): LeagueMember[] =>
  db.league_members.filter((m) => m.league_id === leagueId);

export const memberOf = (db: Database, leagueId: string, guestId: string): LeagueMember | undefined =>
  db.league_members.find((m) => m.league_id === leagueId && m.guest_id === guestId);

const RANK: Record<AdminRole, number> = { owner: 3, admin: 2, manager: 1, viewer: 0 };

// Effective role of a guest in a league — highest of league ownership,
// league_admins (owner/admin) and league_members (manager/viewer).
export function roleInLeague(db: Database, leagueId: string, guestId: string): AdminRole {
  if (!guestId) return 'viewer';
  let best: AdminRole = 'viewer';
  const bump = (r: AdminRole) => {
    if (RANK[r] > RANK[best]) best = r;
  };
  if (db.leagues.some((l) => l.id === leagueId && l.owner_guest_id === guestId)) bump('owner');
  const admin = db.league_admins.find((a) => a.league_id === leagueId && a.guest_id === guestId);
  if (admin) bump(admin.role);
  const member = db.league_members.find((m) => m.league_id === leagueId && m.guest_id === guestId);
  if (member) bump(member.role);
  return best;
}

// Team a guest manages in a league (their league_members manager row), if any.
export function managedTeamId(db: Database, leagueId: string, guestId: string): string | null {
  const member = db.league_members.find(
    (m) => m.league_id === leagueId && m.guest_id === guestId && m.role === 'manager',
  );
  return member?.team_id ?? null;
}

// The guest currently managing a team (one main manager per team).
export function teamManager(db: Database, leagueId: string, teamId: string): LeagueMember | undefined {
  return db.league_members.find((m) => m.league_id === leagueId && m.role === 'manager' && m.team_id === teamId);
}

// Teams in a league without an assigned manager.
export const unmanagedTeams = (db: Database, leagueId: string): Team[] => {
  const claimed = new Set(
    db.league_members.filter((m) => m.league_id === leagueId && m.role === 'manager' && m.team_id).map((m) => m.team_id),
  );
  return teamsOf(db, leagueId).filter((t) => !claimed.has(t.id));
};

export const bracketMatches = (db: Database, leagueId: string): Match[] =>
  db.matches
    .filter((m) => m.league_id === leagueId && ['playoffs', 'final'].includes(m.stage))
    .sort((a, b) => a.week - b.week || a.match_day - b.match_day);

export const groupStageMatches = (db: Database, leagueId: string): Match[] =>
  db.matches.filter((m) => m.league_id === leagueId && m.stage === 'group_stage');

// Distinct groups present (by bracket_slot "GROUP-X").
export const groupLabels = (db: Database, leagueId: string): string[] => {
  const set = new Set<string>();
  for (const m of db.matches) {
    if (m.league_id === leagueId && m.bracket_slot?.startsWith('GROUP-')) set.add(m.bracket_slot.replace('GROUP-', ''));
  }
  return [...set].sort();
};

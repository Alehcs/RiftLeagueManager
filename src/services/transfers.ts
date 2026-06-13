import type { Coach, Player, Role, Team } from '@/lib/types';
import { PLAYER_ROLES } from '@/lib/types';

// ============================================================================
// Roster / budget validation + transfer helpers (pure).
// The store calls these; the UI renders the issues.
// ============================================================================

export type IssueLevel = 'error' | 'warn' | 'ok';
export interface RosterIssue {
  level: IssueLevel;
  message: string;
}

export interface RosterValidation {
  issues: RosterIssue[];
  missingRoles: Role[];
  duplicateRoles: Role[];
  complete: boolean;
  starters: Record<string, Player[]>;
}

export function validateRoster(team: Team, players: Player[], coaches: Coach[]): RosterValidation {
  const roster = players.filter((p) => p.team_id === team.id);
  const active = roster.filter((p) => p.status === 'active');
  const byRole: Record<string, Player[]> = {};
  for (const role of PLAYER_ROLES) byRole[role] = active.filter((p) => p.role === role);

  const issues: RosterIssue[] = [];
  const missingRoles: Role[] = [];
  const duplicateRoles: Role[] = [];

  for (const role of PLAYER_ROLES) {
    const n = byRole[role].length;
    if (n === 0) {
      missingRoles.push(role);
      issues.push({ level: 'error', message: `No active ${role}` });
    } else if (n > 1) {
      duplicateRoles.push(role);
      issues.push({ level: 'warn', message: `${n} active players at ${role}` });
    }
  }

  const teamCoaches = coaches.filter((c) => c.team_id === team.id && c.status === 'active');
  if (teamCoaches.length === 0) issues.push({ level: 'warn', message: 'No active coach' });

  if (team.budget < 0) issues.push({ level: 'error', message: 'Budget is negative' });

  // Salary load vs budget — a soft warning.
  const salaryLoad = roster.reduce((a, p) => a + p.salary, 0) + teamCoaches.reduce((a, c) => a + c.salary, 0);
  if (salaryLoad > team.budget) {
    issues.push({ level: 'warn', message: 'Annual salaries exceed remaining budget' });
  }

  if (issues.length === 0) issues.push({ level: 'ok', message: 'Roster is valid and complete' });

  return {
    issues,
    missingRoles,
    duplicateRoles,
    complete: missingRoles.length === 0,
    starters: byRole,
  };
}

export function canAfford(team: Team, amount: number): boolean {
  return team.budget - amount >= 0;
}

// Total guaranteed money a team has committed (player + coach salaries).
export function salaryCommitment(team: Team, players: Player[], coaches: Coach[]): number {
  return (
    players.filter((p) => p.team_id === team.id).reduce((a, p) => a + p.salary, 0) +
    coaches.filter((c) => c.team_id === team.id).reduce((a, c) => a + c.salary, 0)
  );
}

export interface TradeBalance {
  fromGives: number; // value leaving "from" team (players + cash)
  toGives: number;
  netToFrom: number; // positive = "from" team gains value
  fromCash: number;
  toCash: number;
}

export function tradeBalance(
  playersFrom: Player[], // players the "from" team sends
  playersTo: Player[], // players the "to" team sends
  moneyFromTeam: number,
  moneyToTeam: number,
): TradeBalance {
  const fromPlayerValue = playersFrom.reduce((a, p) => a + p.value, 0);
  const toPlayerValue = playersTo.reduce((a, p) => a + p.value, 0);
  return {
    fromGives: fromPlayerValue + moneyFromTeam,
    toGives: toPlayerValue + moneyToTeam,
    netToFrom: toPlayerValue + moneyToTeam - (fromPlayerValue + moneyFromTeam),
    fromCash: moneyFromTeam,
    toCash: moneyToTeam,
  };
}

import type { Coach, League, Player, PlayerCategory, Role, Team } from '@/lib/types';
import { PLAYER_ROLES } from '@/lib/types';
import { Rng } from '@/lib/rng';
import { clamp, nowISO, uid } from '@/lib/utils';
import { playerValue } from '@/services/ratings';

// ============================================================================
// Contracts, salaries, renewals and wage budgets.
//
// No schema change: the contract model is derived from existing persisted
// fields. `salary` is the annual wage; `contract_until` (a timestamptz) encodes
// the END SEASON via its year; `team_id`/`status` give free-agency/retirement;
// release clauses and wage rooms are computed. Season keys like "2026" are read
// for their trailing 4-digit year, so the contract length is measured in
// seasons relative to the league's current season.
// ============================================================================

export type ContractStatus = 'contracted' | 'expiring' | 'free_agent' | 'retiring';

export const CONTRACT_STATUS_META: Record<ContractStatus, { label: string; color: string }> = {
  contracted: { label: 'Contracted', color: '#22c55e' },
  expiring: { label: 'Expiring', color: '#eab308' },
  free_agent: { label: 'Free agent', color: '#26d0ce' },
  retiring: { label: 'Retired', color: '#ef4444' },
};

export function seasonYear(season: string | undefined | null): number {
  const match = (season ?? '').match(/(\d{4})/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

// End-of-season anchor date (mid-November) for a given year.
export function seasonEndDate(year: number): string {
  return new Date(Date.UTC(year, 10, 15)).toISOString();
}

export function contractEndYear(player: Player): number | null {
  if (!player.contract_until) return null;
  const year = new Date(player.contract_until).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
}

// Seasons left on the contract relative to the league's current season.
// null when no contract date is recorded (legacy data) — treated as open-ended.
export function yearsRemaining(player: Player, season: string): number | null {
  const end = contractEndYear(player);
  if (end == null) return null;
  return end - seasonYear(season);
}

export interface ContractInfo {
  status: ContractStatus;
  years_remaining: number | null;
  salary: number;
  buyout: number;
  end_year: number | null;
}

export function contractInfo(player: Player, season: string): ContractInfo {
  const yr = yearsRemaining(player, season);
  let status: ContractStatus;
  if (player.status === 'retired') status = 'retiring';
  else if (!player.team_id || player.status === 'free_agent') status = 'free_agent';
  else if (yr != null && yr <= 1) status = 'expiring';
  else status = 'contracted';
  return { status, years_remaining: yr, salary: player.salary, buyout: releaseClause(player, yr), end_year: contractEndYear(player) };
}

// Fee to prise a contracted player away — longer deals cost more.
export function releaseClause(player: Player, yearsLeft: number | null): number {
  const years = Math.max(0, yearsLeft ?? 1);
  return Math.max(25_000, Math.round((player.value * (1 + 0.25 * years)) / 5_000) * 5_000);
}

// Believable annual wage from rating/role/age, weighted by category/potential.
export function estimateSalary(
  overall: number,
  role: Role,
  age: number | null,
  category?: PlayerCategory,
  potential?: number,
  rng?: Rng,
): number {
  const value = playerValue(overall, role, age);
  let mult = 0.16;
  if (category === 'Superstar' || category === 'Legend') mult = 0.24;
  else if (category === 'Star') mult = 0.2;
  else if (category === 'Pro') mult = 0.17;
  else if (category === 'Rookie' || category === 'Prospect') mult = 0.12;
  if (age != null && age <= 20 && (potential ?? overall) - overall >= 8) mult += 0.03;
  const jitter = rng ? rng.range(0.92, 1.12) : 1;
  return Math.max(15_000, Math.round((value * mult * jitter) / 1_000) * 1_000);
}

// Believable contract length in seasons. Stars/starters longer; prospects and
// veterans shorter.
export function contractYears(opts: { category?: PlayerCategory; age?: number | null; isStarter?: boolean; rng?: Rng }): number {
  const { category, age, isStarter, rng } = opts;
  let base = 2;
  if (category === 'Star' || category === 'Superstar' || category === 'Legend') base = 3;
  else if (category === 'Rookie' || category === 'Prospect') base = rng ? rng.int(1, 2) : 1;
  if (isStarter) base = Math.max(base, 2);
  if (age != null && age >= 28) base = Math.min(base, rng && rng.bool(0.5) ? 2 : 1);
  return clamp(base + (rng ? rng.int(0, 1) : 0), 1, 4);
}

// Assign (or refresh) a contract on a player, anchored to the league season.
export function assignContract(
  player: Player,
  season: string,
  opts?: { salary?: number; years?: number; isStarter?: boolean; rng?: Rng },
): void {
  const years = opts?.years ?? contractYears({ category: player.category, age: player.age, isStarter: opts?.isStarter, rng: opts?.rng });
  player.contract_until = seasonEndDate(seasonYear(season) + Math.max(1, years));
  if (opts?.salary != null) player.salary = Math.max(15_000, Math.round(opts.salary));
  player.updated_at = nowISO();
}

// --- Wage budget ------------------------------------------------------------

export function wageBill(teamId: string, players: Player[], coaches: Coach[]): number {
  return (
    players.filter((p) => p.team_id === teamId && p.status !== 'retired').reduce((a, p) => a + (p.salary ?? 0), 0) +
    coaches.filter((c) => c.team_id === teamId).reduce((a, c) => a + (c.salary ?? 0), 0)
  );
}

// Soft annual wage cap derived from the league's starting budget plus a slice of
// the team's transfer budget. Exceeding it is allowed but warned about.
export function wageCap(team: Team, league: League): number {
  return Math.round(((league.starting_budget ?? 5_000_000) * 0.6 + team.budget * 0.12) / 50_000) * 50_000;
}

export interface WageSummary { transferBudget: number; wageBill: number; wageCap: number; wageRoom: number; over: boolean }

export function wageSummary(team: Team, league: League, players: Player[], coaches: Coach[]): WageSummary {
  const bill = wageBill(team.id, players, coaches);
  const cap = wageCap(team, league);
  return { transferBudget: team.budget, wageBill: bill, wageCap: cap, wageRoom: cap - bill, over: bill > cap };
}

// --- Renewal acceptance (free agents + extensions) --------------------------

export interface RenewalOffer { salary: number; years: number; rolePromise?: 'starter' | 'rotation' | 'development' }

// Score a contract offer from a player's perspective (money, opportunity, team
// strength, morale, plus a small seeded factor). Used for FA decisions and bots.
export function offerAcceptanceScore(player: Player, team: Team, offer: RenewalOffer, seed: string): number {
  const rng = new Rng(`accept:${seed}:${player.id}:${team.id}`);
  const expected = estimateSalary(player.rating_overall, player.role, player.age, player.category, player.potential);
  const money = (offer.salary / Math.max(1, expected)) * 45;
  const length = clamp(offer.years, 1, 4) * 4;
  const role = offer.rolePromise === 'starter' ? 16 : offer.rolePromise === 'rotation' ? 7 : 2;
  const strength = ((team.wins + 1) / Math.max(1, team.wins + team.losses + 2)) * 12;
  const morale = ((player.morale ?? 50) - 50) * 0.1;
  return money + length + role + strength + morale + (team.synergy ?? 50) * 0.04 + rng.range(0, 12);
}

// --- Offseason bot contract behavior ----------------------------------------

export type ContractActivityKind = 'renew' | 'release' | 'expire';
export interface ContractActivity {
  id: string; created_at: string; kind: ContractActivityKind; message: string; team_id: string; player_id: string;
}

const activeAtRole = (players: Player[], teamId: string, role: Role, exceptId?: string) =>
  players.filter((p) => p.team_id === teamId && p.role === role && p.status === 'active' && p.id !== exceptId);

const WEAK_RATING = 66;

// Bots renew key expiring players and release weak/surplus expiring ones, while
// keeping every roster valid (never empties a role). Mutates players in place.
export function runContractsOffseason(league: League, teams: Team[], players: Player[], seed: string): ContractActivity[] {
  const out: ContractActivity[] = [];
  const bots = teams.filter((t) => t.is_bot && t.run_active !== false);
  for (const bot of bots) {
    const rng = new Rng(`${seed}:contracts:${bot.id}`);
    const expiring = players.filter((p) => {
      if (p.team_id !== bot.id || p.status === 'retired') return false;
      const yr = yearsRemaining(p, league.season);
      return yr != null && yr <= 1;
    });
    for (const player of expiring) {
      const isStarter = player.status === 'active';
      const soleStarter = isStarter && activeAtRole(players, bot.id, player.role, player.id).length === 0;
      const weak = player.rating_overall < WEAK_RATING || player.status === 'benched';
      // Keep the roster valid: a sole starter is always renewed.
      if (soleStarter || (!weak && rng.bool(0.85))) {
        const salary = Math.max(player.salary, estimateSalary(player.rating_overall, player.role, player.age, player.category, player.potential, rng));
        assignContract(player, league.season, { salary: Math.round(salary), years: contractYears({ category: player.category, age: player.age, isStarter: true, rng }) });
        out.push({ id: uid('contract'), created_at: nowISO(), kind: 'renew', message: `${bot.short_name} renewed ${player.role.toLowerCase()} ${player.nickname}.`, team_id: bot.id, player_id: player.id });
      } else if (weak && rng.bool(0.7)) {
        player.team_id = null;
        player.status = 'free_agent';
        player.updated_at = nowISO();
        out.push({ id: uid('contract'), created_at: nowISO(), kind: 'release', message: `${bot.short_name} let ${player.nickname} leave on a free transfer.`, team_id: bot.id, player_id: player.id });
      }
    }
  }
  return out;
}

// At a new season, expire contracts whose end year has passed. A player who is
// the sole active starter at their role is auto-renewed one year so no roster is
// left invalid; everyone else enters global free agency.
export function expireContracts(league: League, players: Player[], newSeason: string): ContractActivity[] {
  const out: ContractActivity[] = [];
  const newYear = seasonYear(newSeason);
  for (const player of players) {
    if (!player.team_id || player.status === 'retired') continue;
    const end = contractEndYear(player);
    if (end == null || end >= newYear) continue;
    const sole = player.status === 'active' && activeAtRole(players, player.team_id, player.role, player.id).length === 0;
    if (sole) {
      assignContract(player, newSeason, { years: 1 });
      out.push({ id: uid('contract'), created_at: nowISO(), kind: 'renew', message: `${player.nickname} signed a one-year extension to stay.`, team_id: player.team_id, player_id: player.id });
    } else {
      const from = player.team_id;
      player.team_id = null;
      player.status = 'free_agent';
      player.contract_until = null;
      player.updated_at = nowISO();
      out.push({ id: uid('contract'), created_at: nowISO(), kind: 'expire', message: `${player.nickname}'s contract expired — now a free agent.`, team_id: from, player_id: player.id });
    }
  }
  return out;
}

// Roles a team is missing an active starter at — used by bot FA pursuit.
export function missingRoles(teamId: string, players: Player[]): Role[] {
  return PLAYER_ROLES.filter((role) => activeAtRole(players, teamId, role).length === 0);
}

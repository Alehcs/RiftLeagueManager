import type { Coach, Player, Team } from '@/lib/types';
import { PLAYER_ROLES } from '@/lib/types';
import { clamp } from '@/lib/utils';

// ============================================================================
// Team strength — derived from roster, coach, budget and recent form.
// Robust to incomplete rosters (falls back to a budget/points proxy).
// ============================================================================

export interface TeamStrength {
  score: number; // composite 35..99
  byRole: Record<string, { nickname: string; overall: number } | null>;
  lineupAvg: number;
  macroAvg: number;
  consistencyAvg: number;
  coachBonus: number;
  budgetBonus: number;
  formBonus: number;
  starters: Player[];
}

function bestActiveByRole(players: Player[]) {
  const map: Record<string, Player | null> = { TOP: null, JUNGLE: null, MID: null, ADC: null, SUPPORT: null };
  for (const role of PLAYER_ROLES) {
    const candidates = players
      .filter((p) => p.role === role && p.status !== 'retired')
      .sort((a, b) => {
        // active beats benched; then higher overall
        const sa = a.status === 'active' ? 1 : 0;
        const sb = b.status === 'active' ? 1 : 0;
        if (sa !== sb) return sb - sa;
        return b.rating_overall - a.rating_overall;
      });
    map[role] = candidates[0] ?? null;
  }
  return map;
}

export function formBonus(form: string): number {
  // form is most-recent-first; weight recent games more.
  let bonus = 0;
  const last5 = form.slice(0, 5);
  for (let i = 0; i < last5.length; i++) {
    const w = (5 - i) / 5; // 1.0 .. 0.2
    bonus += (last5[i] === 'W' ? 1 : -1) * w;
  }
  return clamp(bonus * 1.1, -4, 4);
}

export function computeTeamStrength(team: Team, players: Player[], coaches: Coach[]): TeamStrength {
  const teamPlayers = players.filter((p) => p.team_id === team.id);
  const byRolePlayers = bestActiveByRole(teamPlayers);
  const starters = PLAYER_ROLES.map((r) => byRolePlayers[r]).filter((p): p is Player => !!p);

  // Budget proxy used when a role is missing (keeps int'l shells/empty teams sane).
  const budgetProxy = clamp(48 + Math.log10(Math.max(1, team.budget) / 1_000_000) * 9, 40, 86);

  const roleScores = PLAYER_ROLES.map((r) => byRolePlayers[r]?.rating_overall ?? budgetProxy);
  const lineupAvg = roleScores.reduce((a, b) => a + b, 0) / roleScores.length;

  const macroVals = starters.length ? starters.map((p) => p.rating_macro) : [budgetProxy];
  const consVals = starters.length ? starters.map((p) => p.rating_consistency) : [budgetProxy];
  const macroAvg = macroVals.reduce((a, b) => a + b, 0) / macroVals.length;
  const consistencyAvg = consVals.reduce((a, b) => a + b, 0) / consVals.length;

  const teamCoaches = coaches.filter((c) => c.team_id === team.id && c.status !== 'retired');
  let coachBonus = 0;
  if (teamCoaches.length) {
    const best = teamCoaches.reduce((acc, c) => {
      const avg = (c.rating_draft + c.rating_macro + c.rating_development + c.rating_leadership) / 4;
      return Math.max(acc, avg);
    }, 0);
    coachBonus = clamp((best - 62) * 0.08, -1, 3.5);
  }

  const budgetBonus = clamp(Math.log10(Math.max(1, team.budget) / 4_000_000) * 1.3, -1.5, 2);
  const form = formBonus(team.form);

  // Composite: lineup dominates; macro/consistency nudge; coach/budget/form small.
  const score = clamp(
    lineupAvg * 0.7 + macroAvg * 0.12 + consistencyAvg * 0.08 + coachBonus + budgetBonus + form * 0.5 + 6,
    35,
    99,
  );

  return {
    score: Math.round(score * 10) / 10,
    byRole: Object.fromEntries(
      PLAYER_ROLES.map((r) => [
        r,
        byRolePlayers[r] ? { nickname: byRolePlayers[r]!.nickname, overall: byRolePlayers[r]!.rating_overall } : null,
      ]),
    ),
    lineupAvg: Math.round(lineupAvg * 10) / 10,
    macroAvg: Math.round(macroAvg * 10) / 10,
    consistencyAvg: Math.round(consistencyAvg * 10) / 10,
    coachBonus: Math.round(coachBonus * 10) / 10,
    budgetBonus: Math.round(budgetBonus * 10) / 10,
    formBonus: Math.round(form * 10) / 10,
    starters,
  };
}

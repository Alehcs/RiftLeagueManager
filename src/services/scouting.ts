import type { Player } from '@/lib/types';
import { Rng } from '@/lib/rng';
import { clamp } from '@/lib/utils';
import { contractInfo, estimateSalary } from '@/services/contracts';

// ============================================================================
// Lightweight scouting — a first-pass fog of war with no schema change.
//
// Knowledge is the existing `confidence` field: well-known/imported players
// (high confidence) show exact ratings; lesser-known/generated players show an
// estimated RANGE until a manager scouts them, which raises confidence to full.
// ============================================================================

const SCOUTED_THRESHOLD = 0.6;

export function isScouted(player: Player): boolean {
  return (player.confidence ?? 0) >= SCOUTED_THRESHOLD;
}

// Half-width of the uncertainty band — wider for less-known players.
function band(player: Player): number {
  const confidence = clamp(player.confidence ?? 0.2, 0, 1);
  return Math.round(3 + (1 - confidence) * 7); // 3..10
}

export interface Estimate { low: number; high: number; mid: number; exact: boolean }

function estimateAround(trueValue: number, player: Player, salt: string): Estimate {
  if (isScouted(player)) return { low: trueValue, high: trueValue, mid: trueValue, exact: true };
  const b = band(player);
  // Seeded offset so the shown estimate is stable but slightly off the truth.
  const rng = new Rng(`scout:${player.id}:${salt}`);
  const offset = Math.round(rng.range(-b * 0.4, b * 0.4));
  const mid = clamp(trueValue + offset, 35, 99);
  return { low: clamp(mid - b, 35, 99), high: clamp(mid + b, 35, 99), mid, exact: false };
}

export function overallEstimate(player: Player): Estimate {
  return estimateAround(player.rating_overall, player, 'overall');
}

export function potentialEstimate(player: Player): Estimate {
  return estimateAround(player.potential ?? player.rating_overall, player, 'potential');
}

export type Recommendation = 'sign' | 'scout_more' | 'avoid' | 'prospect';

export interface ScoutReport {
  scouted: boolean;
  overall: Estimate;
  potential: Estimate;
  strengths: string[];
  weaknesses: string[];
  expectedSalary: number;
  contractStatus: ReturnType<typeof contractInfo>['status'];
  recommendation: Recommendation;
  recommendationLabel: string;
}

const AXES: { key: keyof Player; label: string }[] = [
  { key: 'rating_laning', label: 'Laning' },
  { key: 'rating_teamfighting', label: 'Teamfighting' },
  { key: 'rating_macro', label: 'Macro' },
  { key: 'rating_mechanics', label: 'Mechanics' },
  { key: 'rating_consistency', label: 'Consistency' },
];

const REC_LABEL: Record<Recommendation, string> = {
  sign: 'Sign now',
  prospect: 'Develop as a prospect',
  scout_more: 'Scout further',
  avoid: 'Pass for now',
};

export function scoutReport(player: Player, season: string): ScoutReport {
  const overall = overallEstimate(player);
  const potential = potentialEstimate(player);
  const ranked = [...AXES].sort((a, b) => (player[b.key] as number) - (player[a.key] as number));
  const strengths = ranked.slice(0, 2).map((axis) => axis.label);
  const weaknesses = ranked.slice(-2).reverse().map((axis) => axis.label);
  const info = contractInfo(player, season);
  const expectedSalary = estimateSalary(player.rating_overall, player.role, player.age, player.category, player.potential);
  const age = player.age ?? 22;
  const gap = (player.potential ?? player.rating_overall) - player.rating_overall;

  let recommendation: Recommendation;
  if (!isScouted(player)) recommendation = 'scout_more';
  else if (player.rating_overall >= 80) recommendation = 'sign';
  else if (age <= 21 && gap >= 8) recommendation = 'prospect';
  else if (player.rating_overall < 64 && age >= 26) recommendation = 'avoid';
  else recommendation = player.rating_overall >= 72 ? 'sign' : 'scout_more';

  return {
    scouted: isScouted(player),
    overall,
    potential,
    strengths,
    weaknesses,
    expectedSalary,
    contractStatus: info.status,
    recommendation,
    recommendationLabel: REC_LABEL[recommendation],
  };
}

// Display helpers used by the UI.
export function formatEstimate(estimate: Estimate): string {
  return estimate.exact ? String(estimate.mid) : `${estimate.low}–${estimate.high}`;
}

import type { LeagueTier, Role } from '@/lib/types';
import { Rng } from '@/lib/rng';
import { clamp } from '@/lib/utils';

// ============================================================================
// Rating generation
// Real per-player ratings don't exist publicly, so we synthesize stable,
// plausible ratings from team strength + tier + role + star status. Everything
// produced here is editable from the admin panel.
// ============================================================================

const STRENGTH_CENTER: Record<number, number> = { 1: 56, 2: 62, 3: 68, 4: 75, 5: 83 };

const TIER_ADJUST: Record<LeagueTier, number> = {
  tier1: 0,
  tier2: -9,
  regional: -4,
  erl: -6,
  international: 1,
  custom: -2,
};

export function strengthCenter(strength: number, tier: LeagueTier): number {
  const base = STRENGTH_CENTER[clamp(Math.round(strength), 1, 5)] ?? 68;
  return base + (TIER_ADJUST[tier] ?? 0);
}

export interface PlayerRatings {
  rating_overall: number;
  rating_laning: number;
  rating_teamfighting: number;
  rating_macro: number;
  rating_mechanics: number;
  rating_consistency: number;
}

// Per-axis bias by role (sums roughly to zero) — gives each role a flavor.
const ROLE_AXIS: Record<Role, Partial<PlayerRatings>> = {
  TOP: { rating_laning: 3, rating_teamfighting: 1, rating_mechanics: 1, rating_macro: -1 },
  JUNGLE: { rating_macro: 4, rating_teamfighting: 2, rating_laning: -4 },
  MID: { rating_mechanics: 3, rating_laning: 2, rating_teamfighting: 1 },
  ADC: { rating_mechanics: 4, rating_teamfighting: 3, rating_macro: -2 },
  SUPPORT: { rating_macro: 3, rating_teamfighting: 1, rating_laning: -1, rating_mechanics: -2 },
  SUBSTITUTE: {},
  COACH: {},
};

export function generatePlayerRatings(
  seed: string,
  opts: {
    strength: number;
    tier: LeagueTier;
    role: Role;
    star?: boolean;
    // When set (e.g. from reputation-biased init), the overall is taken as-is
    // and per-axis ratings cluster around it instead of the tier center.
    overrideOverall?: number;
    // Extra consistency added on top (veterans/stars are steadier).
    consistencyBias?: number;
  },
): PlayerRatings {
  const rng = new Rng('rating:' + seed);
  const center = strengthCenter(opts.strength, opts.tier);
  const starBump = opts.star ? rng.range(6, 11) : 0;
  const overall =
    opts.overrideOverall != null
      ? clamp(Math.round(opts.overrideOverall), 35, 99)
      : clamp(Math.round(center + rng.noise(6) + starBump), 35, 99);

  const axis = ROLE_AXIS[opts.role] ?? {};
  const axisVal = (k: keyof PlayerRatings, extra = 0) =>
    clamp(Math.round(overall + rng.noise(5) + (axis[k] ?? 0) + extra), 35, 99);

  return {
    rating_overall: overall,
    rating_laning: axisVal('rating_laning'),
    rating_teamfighting: axisVal('rating_teamfighting'),
    rating_macro: axisVal('rating_macro'),
    rating_mechanics: axisVal('rating_mechanics'),
    // Stars are more consistent; pull consistency toward overall.
    rating_consistency: clamp(
      Math.round(overall + rng.noise(4) + (opts.star ? 3 : 0) + (opts.consistencyBias ?? 0)),
      35,
      99,
    ),
  };
}

export interface CoachRatings {
  rating_draft: number;
  rating_macro: number;
  rating_development: number;
  rating_leadership: number;
}

export function generateCoachRatings(
  seed: string,
  opts: { strength: number; tier: LeagueTier },
): CoachRatings {
  const rng = new Rng('coach:' + seed);
  const center = strengthCenter(opts.strength, opts.tier) - 2;
  const r = () => clamp(Math.round(center + rng.noise(6)), 35, 97);
  return {
    rating_draft: r(),
    rating_macro: r(),
    rating_development: r(),
    rating_leadership: r(),
  };
}

// Market value (USD). Exponential-ish in overall; role + age modifiers.
export function playerValue(overall: number, role: Role, age: number | null): number {
  const base = Math.pow(Math.max(0, overall - 38), 2) * 240; // ~ up to ~880k at 99
  const roleFactor = role === 'MID' || role === 'ADC' ? 1.18 : role === 'JUNGLE' ? 1.08 : 1;
  let ageFactor = 1;
  if (age != null) {
    if (age <= 18) ageFactor = 1.15; // prospect premium
    else if (age >= 26) ageFactor = 0.78;
    else if (age >= 24) ageFactor = 0.9;
  }
  const value = base * roleFactor * ageFactor;
  return Math.max(25_000, Math.round(value / 5_000) * 5_000);
}

export function playerSalary(value: number, rng?: Rng): number {
  const jitter = rng ? rng.range(0.9, 1.15) : 1;
  return Math.max(15_000, Math.round((value * 0.16 * jitter) / 1_000) * 1_000);
}

export function coachSalary(ratings: CoachRatings, rng?: Rng): number {
  const avg = (ratings.rating_draft + ratings.rating_macro + ratings.rating_development + ratings.rating_leadership) / 4;
  const jitter = rng ? rng.range(0.9, 1.2) : 1;
  return Math.max(40_000, Math.round((Math.pow(avg - 40, 1.8) * 700 * jitter) / 1_000) * 1_000);
}

// Team budget from strength + tier.
export function teamBudget(seed: string, strength: number, tier: LeagueTier): number {
  const rng = new Rng('budget:' + seed);
  const tierBase: Record<LeagueTier, number> = {
    tier1: 6_000_000,
    tier2: 1_500_000,
    regional: 3_000_000,
    erl: 1_200_000,
    international: 7_000_000,
    custom: 2_000_000,
  };
  const base = tierBase[tier] ?? 2_000_000;
  const mult = 0.6 + strength * 0.42; // 1.02 .. 2.7
  return Math.round((base * mult * rng.range(0.85, 1.2)) / 100_000) * 100_000;
}

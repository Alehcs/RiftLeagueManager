import type {
  InitArchetype,
  LeagueTier,
  PlayerCategory,
  ReputationMeta,
  ReputationTier,
  VarianceProfile,
} from '@/lib/types';
import { Rng } from '@/lib/rng';
import { clamp } from '@/lib/utils';
import { playerCategory } from '@/services/run';

// ============================================================================
// Reputation-biased career initialization.
//
// Known players (from data packs, or flagged stars) start their careers with
// ratings/potential that usually resemble their real-world reputation, while a
// seeded ~80/20 "realism variance" preserves replay value: ~80% of the time a
// player starts near their canon band, ~20% in a slightly different
// alternate-timeline state. Everything is seed-based and reproducible for the
// same league/run, and fully editable in-app afterwards.
//
// Pure & framework-agnostic. No schema change — results are written to the
// existing optional Player fields (potential, category, init_archetype, ...).
// ============================================================================

// Gameplay-balanced canon rating bands per reputation tier. Kept deliberately
// loose so we resemble reputation without overfitting exact real-world ratings.
const TIER_RATING_BAND: Record<ReputationTier, [number, number]> = {
  superstar: [90, 97],
  star: [85, 92],
  veteran: [80, 90],
  pro: [75, 84],
  prospect: [66, 80],
  rookie: [58, 74],
  unknown: [60, 80],
};

// Extra upside added on top of overall to form the potential band.
const TIER_POTENTIAL_UPSIDE: Record<ReputationTier, [number, number]> = {
  superstar: [1, 4],
  star: [2, 6],
  veteran: [0, 2],
  pro: [2, 6],
  prospect: [8, 16],
  rookie: [10, 20],
  unknown: [3, 9],
};

const ARCHETYPE_LABEL: Record<InitArchetype, string> = {
  realistic: 'Realistic baseline',
  high_variance: 'High variance prospect',
  alternate: 'Alternate timeline',
  legacy: 'Legacy star',
  generated: 'Generated profile',
};

const ARCHETYPE_COLOR: Record<InitArchetype, string> = {
  realistic: '#26d0ce',
  high_variance: '#3b82f6',
  alternate: '#8b5cf6',
  legacy: '#c8a85a',
  generated: '#64748b',
};

const ARCHETYPE_HINT: Record<InitArchetype, string> = {
  realistic: 'Started near their real-world reputation band.',
  high_variance: 'Young, high-upside prospect — outcome is volatile.',
  alternate: 'An alternate-timeline roll: started better or worse than canon.',
  legacy: 'A historic legend initialized with legacy strength.',
  generated: 'No reputation data — generated from team/tier defaults.',
};

export function archetypeLabel(a: InitArchetype): string {
  return ARCHETYPE_LABEL[a];
}
export function archetypeColor(a: InitArchetype): string {
  return ARCHETYPE_COLOR[a];
}
export function archetypeHint(a: InitArchetype): string {
  return ARCHETYPE_HINT[a];
}

const REPUTATION_LABEL: Record<ReputationTier, string> = {
  superstar: 'Superstar',
  star: 'Star',
  veteran: 'Veteran',
  pro: 'Pro',
  prospect: 'Prospect',
  rookie: 'Rookie',
  unknown: 'Unknown',
};
export function reputationLabel(t: ReputationTier): string {
  return REPUTATION_LABEL[t];
}

// Infer a reputation tier when a pack doesn't give one explicitly, from the
// 1..5 strength center, star flag and age.
export function inferReputationTier(opts: {
  strength: number;
  star?: boolean;
  age?: number | null;
}): ReputationTier {
  const { strength, star, age } = opts;
  if (star && strength >= 4.5) return 'superstar';
  if (star) return 'star';
  if (age != null && age >= 26 && strength >= 3.8) return 'veteran';
  if (age != null && age <= 19 && strength >= 3.6) return 'prospect';
  if (strength >= 4) return 'pro';
  if (strength >= 3) return 'pro';
  if (age != null && age <= 19) return 'rookie';
  return 'unknown';
}

export interface ReputationInitInput {
  seed: string; // stable per league + player (e.g. `${leagueId}:${nick}:${role}`)
  meta?: ReputationMeta; // explicit pack metadata (optional)
  star?: boolean;
  strength: number; // 1..5 center, used to infer tier / fallback
  age?: number | null;
  fallbackCenter: number; // generated overall center (strengthCenter) for unknowns
  hasReputation: boolean; // whether this player carries any reputation signal
}

export interface ReputationInit {
  overall: number;
  potential: number;
  category: PlayerCategory;
  consistencyBias: number; // added to consistency axis (veterans/stars steadier)
  archetype: InitArchetype;
  reputationTier: ReputationTier;
  popularity: number | null;
}

function midBand([lo, hi]: [number, number]): number {
  return (lo + hi) / 2;
}

// Resolve a known player's starting line. For players with no reputation signal
// this returns a `generated` archetype centered on `fallbackCenter` so callers
// can keep their existing generated behavior while still labeling the profile.
export function resolveReputationInit(input: ReputationInitInput): ReputationInit {
  const rng = new Rng('repvar:' + input.seed);
  const meta = input.meta ?? {};
  const tier: ReputationTier =
    meta.reputation ?? inferReputationTier({ strength: input.strength, star: input.star, age: input.age });
  const variance: VarianceProfile = meta.variance_profile ?? defaultVariance(tier);

  // No reputation signal at all → generated profile around the fallback center.
  if (!input.hasReputation && tier === 'unknown') {
    const overall = clamp(Math.round(input.fallbackCenter + rng.noise(6)), 35, 99);
    const upside = rng.int(3, 9);
    return {
      overall,
      potential: clamp(overall + upside, overall, 99),
      category: playerCategory(overall),
      consistencyBias: 0,
      archetype: 'generated',
      reputationTier: 'unknown',
      popularity: meta.popularity ?? null,
    };
  }

  const ratingBand = meta.canon_rating_band ?? TIER_RATING_BAND[tier];
  // 80/20 realism variance — seeded & reproducible per league/run.
  const alternate = rng.float() < 0.2;
  let overall: number;
  let archetype: InitArchetype;

  if (alternate) {
    // Slightly better OR worse than canon — widen and shift the band.
    const widen = variance === 'boom_or_bust' ? 7 : variance === 'volatile' ? 5 : 3;
    const dir = rng.bool() ? 1 : -1;
    const center = midBand(ratingBand) + dir * rng.range(2, widen);
    overall = clamp(Math.round(center + rng.noise(widen)), 35, 99);
    archetype = 'alternate';
  } else {
    // Realistic: land inside the canon band with mild noise.
    overall = clamp(Math.round(rng.range(ratingBand[0], ratingBand[1])), 35, 99);
    archetype = tier === 'rookie' || tier === 'prospect' ? 'high_variance' : 'realistic';
  }

  // Legacy status overrides the label (and floors the rating) for nostalgia.
  if ((meta.legacy_status === 'legend' || meta.legacy_status === 'hall_of_fame') && !alternate) {
    archetype = 'legacy';
    overall = Math.max(overall, ratingBand[0]);
  }

  // Potential band.
  const upsideBand = meta.canon_potential_band;
  let potential: number;
  if (upsideBand) {
    potential = clamp(Math.round(rng.range(upsideBand[0], upsideBand[1])), overall, 99);
  } else {
    const [ulo, uhi] = TIER_POTENTIAL_UPSIDE[tier];
    const upside = rng.int(ulo, uhi) + (variance === 'boom_or_bust' ? rng.int(0, 6) : 0);
    potential = clamp(overall + upside, overall, 99);
  }

  // Veterans & stars are steadier; rookies/volatile less so.
  const consistencyBias =
    tier === 'veteran' ? 4 : tier === 'superstar' || tier === 'star' ? 3 : variance === 'stable' ? 1 : tier === 'rookie' ? -3 : 0;

  return {
    overall,
    potential,
    category: playerCategory(overall),
    consistencyBias,
    archetype,
    reputationTier: tier,
    popularity: meta.popularity ?? defaultPopularity(tier),
  };
}

function defaultVariance(tier: ReputationTier): VarianceProfile {
  if (tier === 'rookie') return 'boom_or_bust';
  if (tier === 'prospect') return 'volatile';
  if (tier === 'veteran' || tier === 'superstar') return 'stable';
  return 'stable';
}

function defaultPopularity(tier: ReputationTier): number | null {
  const map: Partial<Record<ReputationTier, number>> = {
    superstar: 92,
    star: 80,
    veteran: 70,
    pro: 55,
    prospect: 45,
    rookie: 30,
  };
  return map[tier] ?? null;
}

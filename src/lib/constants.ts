import type { LeagueFormat, LeagueTier, Role } from './types';

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const ROLE_META: Record<Role, { label: string; short: string; color: string; order: number }> = {
  TOP: { label: 'Top', short: 'TOP', color: '#e5704b', order: 0 },
  JUNGLE: { label: 'Jungle', short: 'JNG', color: '#22c55e', order: 1 },
  MID: { label: 'Mid', short: 'MID', color: '#3b82f6', order: 2 },
  ADC: { label: 'Bot', short: 'ADC', color: '#eab308', order: 3 },
  SUPPORT: { label: 'Support', short: 'SUP', color: '#8b5cf6', order: 4 },
  SUBSTITUTE: { label: 'Substitute', short: 'SUB', color: '#64748b', order: 5 },
  COACH: { label: 'Coach', short: 'COACH', color: '#26d0ce', order: 6 },
};

// ---------------------------------------------------------------------------
// League tiers
// ---------------------------------------------------------------------------
export const TIER_META: Record<LeagueTier, { label: string; color: string; badge: string }> = {
  tier1: { label: 'Tier 1 — Major', color: '#c8a85a', badge: 'T1' },
  tier2: { label: 'Tier 2 — Academy', color: '#26d0ce', badge: 'T2' },
  regional: { label: 'Regional', color: '#3b82f6', badge: 'REG' },
  erl: { label: 'ERL', color: '#8b5cf6', badge: 'ERL' },
  international: { label: 'International', color: '#ef4444', badge: 'INTL' },
  custom: { label: 'Custom', color: '#64748b', badge: 'CST' },
};

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------
export const FORMAT_META: Record<
  LeagueFormat,
  { label: string; description: string; kind: 'league' | 'bracket' | 'hybrid' | 'international' }
> = {
  single_round_robin_bo1: {
    label: 'Single Round Robin (BO1)',
    description: 'Every team plays every other team once, best-of-1.',
    kind: 'league',
  },
  double_round_robin_bo1: {
    label: 'Double Round Robin (BO1)',
    description: 'Every team plays every other team twice, best-of-1.',
    kind: 'league',
  },
  bo3_regular_season: {
    label: 'BO3 Regular Season',
    description: 'Round robin played as best-of-3 series.',
    kind: 'league',
  },
  bo5_playoffs: {
    label: 'BO5 Playoffs',
    description: 'Knockout bracket played as best-of-5 series.',
    kind: 'bracket',
  },
  swiss: {
    label: 'Swiss Stage',
    description: 'Records-based pairing; advance/eliminate at set thresholds.',
    kind: 'hybrid',
  },
  groups_playoffs: {
    label: 'Groups + Playoffs',
    description: 'Group stage seeds a single/double elimination bracket.',
    kind: 'hybrid',
  },
  double_elim: {
    label: 'Double Elimination',
    description: 'Upper & lower bracket; two losses to be eliminated.',
    kind: 'bracket',
  },
  single_elim: {
    label: 'Single Elimination',
    description: 'One loss and you are out.',
    kind: 'bracket',
  },
  worlds: {
    label: 'Worlds-style',
    description: 'Swiss stage into a single-elimination BO5 bracket.',
    kind: 'international',
  },
  msi: {
    label: 'MSI-style',
    description: 'Bracket / play-in into double-elimination BO5.',
    kind: 'international',
  },
  custom_knockout: {
    label: 'Custom Knockout',
    description: 'Configurable single/double elimination bracket.',
    kind: 'bracket',
  },
  custom_league: {
    label: 'Custom League',
    description: 'Configurable round-robin league.',
    kind: 'league',
  },
};

export const LEAGUE_FORMAT_OPTIONS = Object.keys(FORMAT_META) as LeagueFormat[];

// ---------------------------------------------------------------------------
// Regions (used for badges / filters)
// ---------------------------------------------------------------------------
export const REGION_META: Record<string, { label: string; color: string }> = {
  Korea: { label: 'KR', color: '#3b82f6' },
  China: { label: 'CN', color: '#ef4444' },
  EMEA: { label: 'EU', color: '#c8a85a' },
  'North America': { label: 'NA', color: '#26d0ce' },
  Brazil: { label: 'BR', color: '#22c55e' },
  'Asia-Pacific': { label: 'APAC', color: '#8b5cf6' },
  Vietnam: { label: 'VN', color: '#ef4444' },
  Japan: { label: 'JP', color: '#ec4899' },
  'Latin America': { label: 'LATAM', color: '#f97316' },
  Turkey: { label: 'TR', color: '#dc2626' },
  Oceania: { label: 'OCE', color: '#0ea5e9' },
  International: { label: 'INTL', color: '#c8a85a' },
};

export function regionBadge(region: string): { label: string; color: string } {
  return REGION_META[region] ?? { label: region.slice(0, 4).toUpperCase(), color: '#64748b' };
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export const STORAGE_KEY = 'rlm.db.v1';
export const BROADCAST_CHANNEL = 'rlm.realtime.v1';
export const GUEST_STORAGE_KEY = 'rlm.guest.v1';
export const DEMO_USER_ID = 'user-demo';

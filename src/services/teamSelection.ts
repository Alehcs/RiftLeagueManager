import type { CompetitionMode, Database, League, LeagueTier, Team } from '@/lib/types';
import { teamManager } from '@/lib/store/selectors';
import { competitionMode } from '@/services/competition';

// ---------------------------------------------------------------------------
// Mode-aware team selection
//
// Each competition mode trades realism for freedom differently:
//  - quick_tournament : maximum freedom — any team from any region/tier.
//  - regional_season  : region-locked by default; an "allow guest/custom teams"
//                       option relaxes it and the run is labelled custom/fantasy.
//  - full_circuit     : open multi-region (teams keep their home region); a
//                       "fantasy placement" option flags a fantasy circuit.
//
// Pure helpers only — no store access — so they're easy to reuse and test.
// ---------------------------------------------------------------------------

export type PoolStatus = 'managed' | 'bot' | 'eligible' | 'ineligible';

export interface PoolEntry {
  team: Team;
  status: PoolStatus;
  reason?: string; // why ineligible
  managerName?: string;
}

export interface SelectionOptions {
  allowGuests: boolean; // regional_season: permit other-region / custom teams
  fantasy: boolean; // full_circuit: permit cross-region / cross-era placement
}

export interface PoolFilters {
  search: string;
  region: string; // 'all' or a region name
  tier: string; // 'all' or a LeagueTier
  status: 'all' | 'available' | 'selected';
}

export const EMPTY_FILTERS: PoolFilters = { search: '', region: 'all', tier: 'all', status: 'all' };

export interface SelectionRules {
  mode: CompetitionMode;
  regionLocked: boolean;
  title: string;
  hint: string;
}

export function selectionRules(league: League, options: SelectionOptions): SelectionRules {
  const mode = competitionMode(league);
  if (mode === 'quick_tournament') {
    return { mode, regionLocked: false, title: 'Quick Tournament — open selection', hint: 'Mix any teams from any region: current, historic, generated, or custom. Build a nostalgia or fantasy cup freely.' };
  }
  if (mode === 'regional_season') {
    return {
      mode,
      regionLocked: !options.allowGuests,
      title: options.allowGuests ? `Regional Season — guest teams enabled` : `Regional Season — ${league.region}`,
      hint: options.allowGuests
        ? `Adding teams from other regions, historic, or custom teams makes this a custom/fantasy run.`
        : `Pick teams from ${league.region}. Enable “Allow guest/custom teams” to add others.`,
    };
  }
  return {
    mode,
    regionLocked: false,
    title: options.fantasy ? 'Full Circuit — Fantasy placement' : 'Full Circuit — Realistic',
    hint: options.fantasy
      ? 'Fantasy circuit: any team (including historic/custom) can join any region.'
      : 'Each team competes in its real home region. Bots fill the remaining regional slots.',
  };
}

function eligibilityReason(team: Team, league: League, mode: CompetitionMode, options: SelectionOptions): string | undefined {
  if (mode === 'quick_tournament') return undefined;
  if (mode === 'regional_season') {
    if (options.allowGuests) return undefined;
    if ((team.region ?? '').toLowerCase() !== (league.region ?? '').toLowerCase()) {
      return `Plays in ${team.region || 'another region'} — enable guest/custom teams to add it`;
    }
    return undefined;
  }
  // full_circuit: open across regions; nothing to block at selection time.
  return undefined;
}

export function buildTeamPool(
  db: Database,
  league: League,
  options: SelectionOptions,
  filters: PoolFilters = EMPTY_FILTERS,
): {
  entries: PoolEntry[];
  regionOptions: string[];
  tierOptions: LeagueTier[];
  counts: { eligible: number; managed: number; bot: number; ineligible: number; total: number };
  fantasy: { active: boolean; reason?: string };
} {
  const mode = competitionMode(league);
  const teams = db.teams.filter((team) => team.league_id === league.id && team.run_active !== false);

  const all: PoolEntry[] = teams.map((team) => {
    const manager = teamManager(db, league.id, team.id);
    if (manager) {
      return { team, status: 'managed', managerName: db.guest_sessions.find((g) => g.id === manager.guest_id)?.display_name ?? 'Manager' };
    }
    if (team.is_bot) return { team, status: 'bot', managerName: team.bot_manager_name ?? 'Bot' };
    const reason = eligibilityReason(team, league, mode, options);
    return { team, status: reason ? 'ineligible' : 'eligible', reason };
  });

  const regionOptions = [...new Set(teams.map((t) => t.region).filter(Boolean))].sort();
  const tierOptions = [...new Set(teams.map((t) => t.tier))];

  const matchesFilters = (entry: PoolEntry): boolean => {
    const t = entry.team;
    if (filters.search && !(`${t.name} ${t.short_name} ${t.region}`.toLowerCase().includes(filters.search.toLowerCase()))) return false;
    if (filters.region !== 'all' && t.region !== filters.region) return false;
    if (filters.tier !== 'all' && t.tier !== filters.tier) return false;
    if (filters.status === 'available' && !(entry.status === 'eligible')) return false;
    if (filters.status === 'selected' && !(entry.status === 'managed' || entry.status === 'bot')) return false;
    return true;
  };

  const counts = {
    eligible: all.filter((e) => e.status === 'eligible').length,
    managed: all.filter((e) => e.status === 'managed').length,
    bot: all.filter((e) => e.status === 'bot').length,
    ineligible: all.filter((e) => e.status === 'ineligible').length,
    total: all.length,
  };

  return {
    entries: all.filter(matchesFilters),
    regionOptions,
    tierOptions,
    counts,
    fantasy: fantasyState(db, league, options, all),
  };
}

// A run is custom/fantasy when its committed (managed or bot) teams break the
// mode's realistic rule — e.g. a regional season that includes other-region
// teams, or a full circuit flagged for fantasy placement.
export function fantasyState(db: Database, league: League, options: SelectionOptions, entries?: PoolEntry[]): { active: boolean; reason?: string } {
  const mode = competitionMode(league);
  if (mode === 'quick_tournament') return { active: false };
  const pool = entries ?? buildTeamPool(db, league, options).entries;
  const committed = pool.filter((e) => e.status === 'managed' || e.status === 'bot');
  if (mode === 'regional_season') {
    const offRegion = committed.filter((e) => (e.team.region ?? '').toLowerCase() !== (league.region ?? '').toLowerCase());
    if (offRegion.length) {
      return { active: true, reason: `Custom/fantasy run: ${offRegion.length} team${offRegion.length > 1 ? 's' : ''} from outside ${league.region}.` };
    }
    return { active: false };
  }
  // full_circuit
  if (options.fantasy) return { active: true, reason: 'Fantasy circuit: teams may be placed outside their home region.' };
  return { active: false };
}

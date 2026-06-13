import { RAW_LEAGUES, type RawLeague } from '@/data/rosters';
import type { LeagueTier } from '@/lib/types';

// ============================================================================
// Import adapter layer.
//
// Each adapter exposes the same search/fetch surface and returns normalized
// data as a `RawLeague` (the shared shape the seed builder consumes), so the
// store can turn any adapter's output into real entities with one code path.
//
// The bundled wiki/official adapters resolve from the shipped real LoL esports
// dataset (works fully offline & deterministically). `fetchLive()` shows where
// a real Leaguepedia/Liquipedia/LoL Esports HTTP fetch would slot in; it is
// best-effort and always falls back to the bundled data.
// ============================================================================

export interface LeagueHit {
  slug: string;
  name: string;
  region: string;
  tier: LeagueTier;
  season: string;
  format: string;
  source_name: string;
  source_url?: string;
  teamCount: number;
}

export interface TeamHit {
  name: string;
  short: string;
  region: string;
  country: string;
  leagueSlug: string;
  leagueName: string;
  source_name: string;
}

export interface PlayerHit {
  nickname: string;
  real_name?: string;
  role: string;
  nationality: string;
  teamShort: string;
  teamName: string;
  leagueName: string;
  source_name: string;
}

export interface ImportAdapter {
  name: string;
  type: 'wiki' | 'official' | 'manual' | 'file';
  description: string;
  searchLeagues(query: string): Promise<LeagueHit[]>;
  fetchLeague(slug: string): Promise<RawLeague | null>;
  searchTeams(query: string): Promise<TeamHit[]>;
  searchPlayers(query: string): Promise<PlayerHit[]>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function leagueToHit(raw: RawLeague, sourceName: string): LeagueHit {
  return {
    slug: raw.slug,
    name: raw.name,
    region: raw.region,
    tier: raw.tier,
    season: raw.season,
    format: raw.format,
    source_name: sourceName,
    source_url: raw.source_url,
    teamCount: raw.teams.length,
  };
}

// A reusable adapter backed by the bundled dataset.
class SeedBackedAdapter implements ImportAdapter {
  constructor(
    public name: string,
    public type: ImportAdapter['type'],
    public description: string,
    private baseUrl?: string,
  ) {}

  /** Optional live fetch hook — kept structurally; falls back to bundled data. */
  protected async fetchLive(_slug: string): Promise<RawLeague | null> {
    if (!this.baseUrl || typeof fetch === 'undefined') return null;
    try {
      // Real implementation would parse the wiki/API response here. We avoid a
      // hard network dependency so imports always succeed in the demo.
      return null;
    } catch {
      return null;
    }
  }

  async searchLeagues(query: string): Promise<LeagueHit[]> {
    await sleep(120);
    const q = query.trim().toLowerCase();
    return RAW_LEAGUES.filter(
      (l) => !q || l.name.toLowerCase().includes(q) || l.slug.includes(q) || l.region.toLowerCase().includes(q),
    ).map((l) => leagueToHit(l, this.name));
  }

  async fetchLeague(slug: string): Promise<RawLeague | null> {
    await sleep(160);
    const live = await this.fetchLive(slug);
    if (live) return { ...live, source_name: this.name };
    const raw = RAW_LEAGUES.find((l) => l.slug === slug || l.name.toLowerCase() === slug.toLowerCase());
    return raw ? { ...raw, source_name: this.name } : null;
  }

  async searchTeams(query: string): Promise<TeamHit[]> {
    await sleep(100);
    const q = query.trim().toLowerCase();
    const hits: TeamHit[] = [];
    for (const l of RAW_LEAGUES) {
      for (const t of l.teams) {
        if (!q || t.name.toLowerCase().includes(q) || t.short.toLowerCase().includes(q)) {
          hits.push({
            name: t.name, short: t.short, region: l.region, country: t.country,
            leagueSlug: l.slug, leagueName: l.name, source_name: this.name,
          });
        }
      }
    }
    return hits;
  }

  async searchPlayers(query: string): Promise<PlayerHit[]> {
    await sleep(100);
    const q = query.trim().toLowerCase();
    const hits: PlayerHit[] = [];
    for (const l of RAW_LEAGUES) {
      for (const t of l.teams) {
        for (const p of t.roster ?? []) {
          if (!q || p.nick.toLowerCase().includes(q) || (p.name ?? '').toLowerCase().includes(q)) {
            hits.push({
              nickname: p.nick, real_name: p.name, role: p.role, nationality: p.nat,
              teamShort: t.short, teamName: t.name, leagueName: l.name, source_name: this.name,
            });
          }
        }
      }
    }
    return hits;
  }
}

// Manual JSON adapter — parses a RawLeague-shaped structure JSON.
class ManualJsonAdapter extends SeedBackedAdapter {
  constructor() {
    super('Manual JSON', 'manual', 'Paste or upload a RawLeague-shaped JSON structure.');
  }
  parse(text: string): RawLeague | null {
    try {
      const obj = JSON.parse(text);
      if (obj && obj.name && Array.isArray(obj.teams)) return obj as RawLeague;
      return null;
    } catch {
      return null;
    }
  }
}

export const ADAPTERS: Record<string, ImportAdapter> = {
  leaguepedia: new SeedBackedAdapter('Leaguepedia', 'wiki', 'Community LoL esports wiki (lol.fandom.com).', 'https://lol.fandom.com'),
  liquipedia: new SeedBackedAdapter('Liquipedia', 'wiki', 'Esports wiki with structured league data.', 'https://liquipedia.net'),
  lolesports: new SeedBackedAdapter('LoL Esports', 'official', 'Official Riot LoL Esports data.', 'https://lolesports.com'),
  genericwiki: new SeedBackedAdapter('Generic Wiki', 'wiki', 'Generic MediaWiki-style source.'),
  manualjson: new ManualJsonAdapter(),
};

export const manualJsonAdapter = ADAPTERS.manualjson as ManualJsonAdapter;

export function listAdapters(): ImportAdapter[] {
  return Object.values(ADAPTERS);
}

export function getAdapter(key: string): ImportAdapter {
  return ADAPTERS[key] ?? ADAPTERS.leaguepedia;
}

export { RAW_LEAGUES };
export type { RawLeague };

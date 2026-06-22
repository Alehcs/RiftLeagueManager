import type { Database, League, Match, Team } from '@/lib/types';
import { leagueTournaments, tournamentSummary } from '@/services/tournament';
import { seasonEndLogsOf } from '@/lib/store/selectors';

// ============================================================================
// Team / organization history — trophy cabinet, season records, results and
// roster movement, derived read-only from existing data. No schema change:
// trophies come from tournament summaries + persisted season-end recaps,
// results from matches, roster changes from transfer_history, and identity
// from the team's additive data-pack fields.
// ============================================================================

export type TrophyKind = 'worlds' | 'msi' | 'regional' | 'finalist' | 'playoff' | 'season';

export interface TeamTrophy {
  id: string;
  label: string;
  kind: TrophyKind;
  color: string;
  season?: string;
}

const TROPHY_COLOR: Record<TrophyKind, string> = {
  worlds: '#c8a85a',
  msi: '#8b5cf6',
  regional: '#22c55e',
  finalist: '#94a3b8',
  playoff: '#26d0ce',
  season: '#26d0ce',
};

export interface TeamResult {
  match: Match;
  opponent: Team | undefined;
  won: boolean;
  scoreFor: number;
  scoreAgainst: number;
}

export interface PastSeasonRecord {
  season: string;
  wins: number;
  losses: number;
  points: number;
  worlds: boolean;
  msi: boolean;
  regional: boolean;
}

export interface TeamIdentity {
  region: string;
  tier: Team['tier'];
  active: boolean;
  legacyLabel: string | null;
  color: string | null;
  nostalgia: boolean;
}

export interface TeamHistory {
  trophies: TeamTrophy[];
  worldsTitles: number;
  msiTitles: number;
  regionalTitles: number;
  finalsAppearances: number;
  playoffAppearances: number;
  recentResults: TeamResult[];
  nextMatch: Match | null;
  rosterChanges: { id: string; ts: string; message: string }[];
  biggestWin: TeamResult | null;
  biggestUpset: { match: Match; opponent: Team; seedGap: number } | null;
  pastSeasons: PastSeasonRecord[];
  identity: TeamIdentity;
}

const KEY_KIND: Record<string, TrophyKind> = {
  worlds: 'worlds',
  msi: 'msi',
  regional_playoffs: 'regional',
  regional_finals: 'regional',
  quick_tournament: 'regional',
};

export function teamIdentity(team: Team): TeamIdentity {
  const active = team.active ?? true;
  return {
    region: team.region,
    tier: team.tier,
    active,
    legacyLabel: team.legacy_label ?? null,
    color: team.color_primary ?? null,
    nostalgia: !active,
  };
}

export function teamHistory(db: Database, league: League, team: Team): TeamHistory {
  const trophies: TeamTrophy[] = [];
  let worldsTitles = 0;
  let msiTitles = 0;
  let regionalTitles = 0;
  let finalsAppearances = 0;
  let playoffAppearances = 0;

  // --- Current-season trophies & playoff participation ---------------------
  for (const def of leagueTournaments(league)) {
    const s = tournamentSummary(db, league, def.key);
    const inBracket = s.participants.some((p) => p.team.id === team.id);
    if (inBracket && (def.key === 'regional_playoffs' || def.key === 'regional_finals' || def.key === 'quick_tournament')) {
      playoffAppearances += 1;
    }
    const kind = KEY_KIND[def.key] ?? 'regional';
    if (s.champion?.id === team.id) {
      trophies.push({ id: `cur-champ-${def.key}`, label: `${def.name} Champion`, kind, color: TROPHY_COLOR[kind], season: league.season });
      if (kind === 'worlds') worldsTitles += 1;
      else if (kind === 'msi') msiTitles += 1;
      else regionalTitles += 1;
      finalsAppearances += 1;
    } else if (s.runnerUp?.id === team.id) {
      trophies.push({ id: `cur-fin-${def.key}`, label: `${def.name} Finalist`, kind: 'finalist', color: TROPHY_COLOR.finalist, season: league.season });
      finalsAppearances += 1;
    }
  }

  // --- Past-season trophies from persisted recaps --------------------------
  const pastSeasons: PastSeasonRecord[] = [];
  for (const log of seasonEndLogsOf(db, league.id)) {
    const r = (log.payload ?? {}) as {
      regional_champions?: { region: string; team_id: string }[];
      playoff_champion_team_id?: string | null;
      msi_champion_team_id?: string | null;
      worlds_champion_team_id?: string | null;
      team_summaries?: { team_id: string; wins: number; losses: number; points: number }[];
    };
    const season = log.season_key || 'Past season';
    const wonWorlds = r.worlds_champion_team_id === team.id;
    const wonMsi = r.msi_champion_team_id === team.id;
    const wonRegional =
      r.playoff_champion_team_id === team.id || (r.regional_champions ?? []).some((c) => c.team_id === team.id);
    if (wonWorlds) { worldsTitles += 1; trophies.push({ id: `${log.id}-worlds`, label: 'Worlds Champion', kind: 'worlds', color: TROPHY_COLOR.worlds, season }); }
    if (wonMsi) { msiTitles += 1; trophies.push({ id: `${log.id}-msi`, label: 'MSI Champion', kind: 'msi', color: TROPHY_COLOR.msi, season }); }
    if (wonRegional) { regionalTitles += 1; trophies.push({ id: `${log.id}-reg`, label: 'Regional Champion', kind: 'regional', color: TROPHY_COLOR.regional, season }); }
    const summary = (r.team_summaries ?? []).find((t) => t.team_id === team.id);
    if (summary || wonWorlds || wonMsi || wonRegional) {
      pastSeasons.push({
        season,
        wins: summary?.wins ?? 0,
        losses: summary?.losses ?? 0,
        points: summary?.points ?? 0,
        worlds: wonWorlds,
        msi: wonMsi,
        regional: wonRegional,
      });
    }
  }

  // --- Results & next match -------------------------------------------------
  const teamMatches = db.matches
    .filter((m) => m.league_id === league.id && (m.blue_team_id === team.id || m.red_team_id === team.id));
  const completed = teamMatches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => +new Date(b.date_time) - +new Date(a.date_time));
  const upcoming = teamMatches
    .filter((m) => m.status !== 'completed' && m.blue_team_id && m.red_team_id)
    .sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time));

  const toResult = (m: Match): TeamResult => {
    const isBlue = m.blue_team_id === team.id;
    const opponentId = isBlue ? m.red_team_id : m.blue_team_id;
    return {
      match: m,
      opponent: db.teams.find((t) => t.id === opponentId),
      won: m.winner_team_id === team.id,
      scoreFor: isBlue ? m.blue_score : m.red_score,
      scoreAgainst: isBlue ? m.red_score : m.blue_score,
    };
  };

  const recentResults = completed.slice(0, 8).map(toResult);
  const nextMatch = upcoming[0] ?? null;

  // Biggest win: largest game-score margin among wins.
  let biggestWin: TeamResult | null = null;
  for (const m of completed) {
    if (m.winner_team_id !== team.id) continue;
    const res = toResult(m);
    const margin = res.scoreFor - res.scoreAgainst;
    if (!biggestWin || margin > biggestWin.scoreFor - biggestWin.scoreAgainst) biggestWin = res;
  }

  // Biggest upset: surface a tournament upset this team pulled off.
  let biggestUpset: TeamHistory['biggestUpset'] = null;
  for (const def of leagueTournaments(league)) {
    const s = tournamentSummary(db, league, def.key);
    if (s.biggestUpset && s.biggestUpset.winner.id === team.id) {
      if (!biggestUpset || s.biggestUpset.seedGap > biggestUpset.seedGap) {
        biggestUpset = { match: s.biggestUpset.match, opponent: s.biggestUpset.loser, seedGap: s.biggestUpset.seedGap };
      }
    }
  }

  // --- Roster movement ------------------------------------------------------
  const shortOf = (id: string | null) => db.teams.find((t) => t.id === id)?.short_name ?? 'Free agency';
  const nickOf = (id: string) => db.players.find((p) => p.id === id)?.nickname ?? 'Player';
  const rosterChanges = db.transfer_history
    .filter((t) => t.league_id === league.id && (t.from_team_id === team.id || t.to_team_id === team.id))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 10)
    .map((t) => {
      const inbound = t.to_team_id === team.id;
      const msg = inbound
        ? `Signed ${nickOf(t.player_id)}${t.from_team_id ? ` from ${shortOf(t.from_team_id)}` : ''}`
        : `Released ${nickOf(t.player_id)}${t.to_team_id ? ` to ${shortOf(t.to_team_id)}` : ''}`;
      return { id: t.id, ts: t.created_at, message: t.amount > 0 ? `${msg} ($${(t.amount / 1000).toFixed(0)}K)` : msg };
    });

  // De-dupe trophies by label+season.
  const seen = new Set<string>();
  const dedupedTrophies = trophies.filter((t) => {
    const k = `${t.label}|${t.season ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    trophies: dedupedTrophies,
    worldsTitles,
    msiTitles,
    regionalTitles,
    finalsAppearances,
    playoffAppearances,
    recentResults,
    nextMatch,
    rosterChanges,
    biggestWin,
    biggestUpset,
    pastSeasons,
    identity: teamIdentity(team),
  };
}

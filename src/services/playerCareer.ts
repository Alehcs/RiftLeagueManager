import type { Database, League, Player, Role } from '@/lib/types';
import { leagueTournaments, tournamentSummary } from '@/services/tournament';
import { seasonEndLogsOf } from '@/lib/store/selectors';

// ============================================================================
// Player career profile — stats, transfer history, awards and a legacy tier.
//
// Pure and read-only. No schema change: stats come from match_simulations,
// history from transfer_history, and awards/trophies from the tournament
// summaries plus persisted season-end recaps. Everything degrades gracefully
// when older data is missing fields.
// ============================================================================

export interface CareerStats {
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  csPerGame: number;
  goldPerGame: number;
  mvps: number;
  avgImpact: number;
  byCompetition: { key: string; games: number; wins: number }[];
}

interface SimStat { player_id: string; team_id: string; kills?: number; deaths?: number; assists?: number; cs?: number; gold?: number; impact?: number; mvp_score?: number; games?: number }
interface SimFinal { winner_team_id?: string; mvp_player_id?: string }

const COMP_LABEL: Record<string, string> = {
  regional_league: 'Regional League',
  regional_playoffs: 'Regional Playoffs',
  second_regional_phase: 'Second Phase',
  regional_finals: 'Regional Finals',
  msi: 'MSI',
  worlds: 'Worlds',
  quick_tournament: 'Tournament',
};

// Aggregate a player's stats across all completed simulations currently stored
// (simulations are cleared at season rollover, so this reflects the live season).
export function playerCareerStats(db: Database, playerId: string): CareerStats {
  let games = 0, wins = 0, losses = 0, kills = 0, deaths = 0, assists = 0, cs = 0, gold = 0, mvps = 0, impactSum = 0, impactGames = 0;
  const byComp = new Map<string, { games: number; wins: number }>();
  for (const sim of db.match_simulations) {
    if (sim.status !== 'completed') continue;
    let stats: SimStat[] = [];
    let final: SimFinal = {};
    try { stats = JSON.parse(sim.player_stats) as SimStat[]; } catch { continue; }
    try { final = JSON.parse(sim.final_result) as SimFinal; } catch { final = {}; }
    const entry = stats.find((s) => s.player_id === playerId);
    if (!entry) continue;
    const gp = entry.games ?? 1;
    games += gp;
    const won = !!final.winner_team_id && entry.team_id === final.winner_team_id;
    if (won) wins += 1; else losses += 1;
    kills += entry.kills ?? 0; deaths += entry.deaths ?? 0; assists += entry.assists ?? 0;
    cs += entry.cs ?? 0; gold += entry.gold ?? 0;
    if (entry.impact != null) { impactSum += entry.impact; impactGames += 1; }
    if (final.mvp_player_id === playerId) mvps += 1;
    const match = db.matches.find((m) => m.id === sim.match_id);
    const key = match?.competition_key ?? 'other';
    const bc = byComp.get(key) ?? { games: 0, wins: 0 };
    bc.games += 1; if (won) bc.wins += 1;
    byComp.set(key, bc);
  }
  const series = wins + losses;
  return {
    games: series,
    wins,
    losses,
    kills, deaths, assists,
    kda: deaths > 0 ? Math.round(((kills + assists) / deaths) * 100) / 100 : kills + assists,
    csPerGame: games ? Math.round(cs / games) : 0,
    goldPerGame: games ? Math.round(gold / games) : 0,
    mvps,
    avgImpact: impactGames ? Math.round((impactSum / impactGames) * 10) / 10 : 0,
    byCompetition: [...byComp.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.games - a.games),
  };
}

export type CareerEventKind = 'signing' | 'sale' | 'trade' | 'release' | 'retire' | 'current';
export interface CareerEvent { id: string; ts: string; kind: CareerEventKind; message: string }

const TRANSFER_KIND: Record<string, CareerEventKind> = { signing: 'signing', sale: 'sale', trade: 'trade', release: 'release' };

// Career timeline from transfer history (persists across seasons) + status.
export function playerCareerHistory(db: Database, player: Player): CareerEvent[] {
  const short = (id: string | null) => db.teams.find((t) => t.id === id)?.short_name ?? 'Free agency';
  const events: CareerEvent[] = [];
  for (const t of db.transfer_history.filter((x) => x.player_id === player.id)) {
    const kind = TRANSFER_KIND[t.transfer_type] ?? 'trade';
    const msg =
      kind === 'signing' ? `Signed by ${short(t.to_team_id)} as a free agent`
        : kind === 'sale' ? `Sold by ${short(t.from_team_id)} to free agency`
          : kind === 'release' ? `Released by ${short(t.from_team_id)}`
            : `Transferred ${short(t.from_team_id)} → ${short(t.to_team_id)}`;
    events.push({ id: t.id, ts: t.created_at, kind, message: t.amount > 0 ? `${msg} ($${(t.amount / 1000).toFixed(0)}K)` : msg });
  }
  if (player.status === 'retired') events.push({ id: `retire-${player.id}`, ts: player.updated_at, kind: 'retire', message: 'Retired from competitive play' });
  events.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
  if (player.team_id) {
    events.unshift({ id: `current-${player.id}`, ts: player.updated_at, kind: 'current', message: `Currently with ${short(player.team_id)}` });
  }
  return events;
}

export type AwardKind = 'mvp' | 'champion' | 'finalist' | 'role' | 'season_mvp';
export interface PlayerAward { id: string; label: string; kind: AwardKind; color: string; season?: string }

const ROLE_AWARD: Record<Role, string> = { TOP: 'Best Top', JUNGLE: 'Best Jungle', MID: 'Best Mid', ADC: 'Best ADC', SUPPORT: 'Best Support', SUBSTITUTE: 'Best Sub', COACH: 'Best Coach' };
const AWARD_COLOR: Record<AwardKind, string> = { mvp: '#c8a85a', champion: '#c8a85a', finalist: '#94a3b8', role: '#8b5cf6', season_mvp: '#26d0ce' };

// Best player per role this season by total MVPs then average impact.
export function roleBests(db: Database, league: League): Partial<Record<Role, string>> {
  const rostered = db.players.filter((p) => p.league_id === league.id && p.team_id && p.status !== 'retired');
  const out: Partial<Record<Role, string>> = {};
  const byRole = new Map<Role, { id: string; score: number }[]>();
  for (const p of rostered) {
    const s = playerCareerStats(db, p.id);
    if (s.games === 0) continue;
    const list = byRole.get(p.role) ?? [];
    list.push({ id: p.id, score: s.mvps * 100 + s.avgImpact });
    byRole.set(p.role, list);
  }
  for (const [role, list] of byRole) {
    const best = list.sort((a, b) => b.score - a.score)[0];
    if (best && best.score > 0) out[role] = best.id;
  }
  return out;
}

export function playerAwards(db: Database, league: League, player: Player): PlayerAward[] {
  const awards: PlayerAward[] = [];
  // Tournament MVPs + trophies (current season).
  for (const def of leagueTournaments(league)) {
    const s = tournamentSummary(db, league, def.key);
    if (s.mvp?.player.id === player.id) awards.push({ id: `mvp-${def.key}`, label: `${def.name} MVP`, kind: 'mvp', color: AWARD_COLOR.mvp });
    if (s.champion && player.team_id === s.champion.id) awards.push({ id: `champ-${def.key}`, label: `${def.name} Champion`, kind: 'champion', color: AWARD_COLOR.champion });
    else if (s.runnerUp && player.team_id === s.runnerUp.id) awards.push({ id: `fin-${def.key}`, label: `${def.name} Finalist`, kind: 'finalist', color: AWARD_COLOR.finalist });
  }
  // Role best (current season).
  if (player.team_id) {
    const bests = roleBests(db, league);
    if (bests[player.role] === player.id) awards.push({ id: `role-${player.role}`, label: ROLE_AWARD[player.role], kind: 'role', color: AWARD_COLOR.role });
  }
  // Persisted past-season MVP awards (attributed by player id).
  for (const log of seasonEndLogsOf(db, league.id)) {
    const recap = (log.payload.recap ?? {}) as { mvp_player_id?: string | null };
    if (recap.mvp_player_id === player.id) awards.push({ id: `smvp-${log.id}`, label: `${log.season_key} Season MVP`, kind: 'season_mvp', color: AWARD_COLOR.season_mvp, season: log.season_key });
  }
  return awards;
}

export type LegacyTier = 'Prospect' | 'Rising Prospect' | 'Regional Star' | 'International Star' | 'World Champion' | 'Legend';
export const LEGACY_COLOR: Record<LegacyTier, string> = {
  Prospect: '#64748b',
  'Rising Prospect': '#3b82f6',
  'Regional Star': '#22c55e',
  'International Star': '#8b5cf6',
  'World Champion': '#c8a85a',
  Legend: '#ef4444',
};

// Conservative legacy tier from achievements + rating.
export function playerLegacy(player: Player, awards: PlayerAward[]): { tier: LegacyTier; color: string } {
  const worldsChamp = awards.some((a) => a.label === 'Worlds Champion');
  const intl = awards.some((a) => a.label === 'Worlds MVP' || a.label === 'MSI MVP' || a.label === 'MSI Champion' || a.label === 'Worlds Finalist');
  const regional = awards.some((a) => a.kind === 'champion' || a.kind === 'role');
  const seasonMvp = awards.some((a) => a.kind === 'season_mvp' || a.label.includes('Season MVP'));
  const majorCount = awards.filter((a) => a.kind === 'champion' || a.kind === 'mvp' || a.kind === 'season_mvp').length;
  const age = player.age ?? 22;
  const potentialGap = (player.potential ?? player.rating_overall) - player.rating_overall;

  let tier: LegacyTier;
  if (worldsChamp && (seasonMvp || majorCount >= 3 || player.rating_overall >= 95)) tier = 'Legend';
  else if (worldsChamp) tier = 'World Champion';
  else if (intl) tier = 'International Star';
  else if (regional || player.rating_overall >= 84) tier = 'Regional Star';
  else if (age <= 21 && potentialGap >= 8) tier = 'Rising Prospect';
  else tier = 'Prospect';
  return { tier, color: LEGACY_COLOR[tier] };
}

export function competitionLabel(key: string): string {
  return COMP_LABEL[key] ?? key;
}

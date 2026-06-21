import type { League, MarketOffer, Player, Role, TransferRecord, Team } from '@/lib/types';
import { PLAYER_ROLES } from '@/lib/types';
import { Rng } from '@/lib/rng';
import { nowISO, uid } from '@/lib/utils';

// ============================================================================
// Global transfer market — team-needs evaluation, player valuation, and a
// lightweight, deterministic bot market driver.
//
// All functions here are pure / framework-agnostic. `runBotMarket` mutates the
// arrays it is handed (teams/players/offers/transfer history) in place — the
// same pattern `applyMatchConsequences` uses — and returns a feed of activity
// entries the store persists. Competitions stay regional; the market is global,
// so bots may sign, sell, and trade across regions.
// ============================================================================

const WEAK_STARTER_RATING = 70; // a starter below this is a replacement target
const HEALTHY_DEPTH = 6; // active + benched players a roster wants

export interface TeamNeeds {
  team_id: string;
  missingRoles: Role[];
  weakRoles: { role: Role; rating: number }[];
  surplusRoles: Role[];
  starterByRole: Partial<Record<Role, Player>>;
  benchByRole: Partial<Record<Role, Player[]>>;
  depth: number;
  lowDepth: boolean;
  avgForm: number;
  avgMorale: number;
  avgFatigue: number;
  synergy: number;
  topNeed: Role | null;
  needScore: number;
}

function mean(values: number[], fallback = 50): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

/**
 * Evaluate a team's roster needs — missing roles, weak starters, role surplus,
 * depth, and the dominant need. Used to drive bot decisions and to surface
 * "why" summaries on incoming offers.
 */
export function evaluateTeamNeeds(team: Team, players: Player[]): TeamNeeds {
  const roster = players.filter(
    (p) => p.team_id === team.id && (p.status === 'active' || p.status === 'benched'),
  );
  const active = roster.filter((p) => p.status === 'active');
  const starterByRole: Partial<Record<Role, Player>> = {};
  const benchByRole: Partial<Record<Role, Player[]>> = {};
  const missingRoles: Role[] = [];
  const weakRoles: { role: Role; rating: number }[] = [];
  const surplusRoles: Role[] = [];

  for (const role of PLAYER_ROLES) {
    const inRole = active
      .filter((p) => p.role === role)
      .sort((a, b) => b.rating_overall - a.rating_overall);
    if (inRole.length === 0) {
      missingRoles.push(role);
    } else {
      starterByRole[role] = inRole[0];
      if (inRole[0].rating_overall < WEAK_STARTER_RATING) weakRoles.push({ role, rating: inRole[0].rating_overall });
      if (inRole.length > 1) {
        surplusRoles.push(role);
        benchByRole[role] = inRole.slice(1);
      }
    }
    const benched = roster.filter((p) => p.role === role && p.status === 'benched');
    if (benched.length) benchByRole[role] = [...(benchByRole[role] ?? []), ...benched];
  }

  const avgForm = mean(roster.map((p) => p.performance_form ?? 50));
  const avgMorale = mean(roster.map((p) => p.morale ?? 50));
  const avgFatigue = mean(roster.map((p) => p.fatigue ?? 0), 0);
  const weakest = [...weakRoles].sort((a, b) => a.rating - b.rating)[0];
  const topNeed = missingRoles[0] ?? weakest?.role ?? null;
  // Higher score = hungrier team. Missing roles dominate, then weak starters,
  // then thin depth and poor form/morale/fatigue.
  const needScore =
    missingRoles.length * 40 +
    weakRoles.reduce((sum, w) => sum + (WEAK_STARTER_RATING - w.rating), 0) +
    (roster.length < HEALTHY_DEPTH ? (HEALTHY_DEPTH - roster.length) * 6 : 0) +
    Math.max(0, 50 - avgForm) * 0.3 +
    Math.max(0, 50 - avgMorale) * 0.2 +
    Math.max(0, avgFatigue - 50) * 0.2;

  return {
    team_id: team.id,
    missingRoles,
    weakRoles,
    surplusRoles,
    starterByRole,
    benchByRole,
    depth: roster.length,
    lowDepth: roster.length < HEALTHY_DEPTH,
    avgForm,
    avgMorale,
    avgFatigue,
    synergy: team.synergy ?? 50,
    topNeed,
    needScore,
  };
}

/**
 * Market value of a player — starts from the stored `value` and adjusts for
 * potential upside, current form/morale, and age. Falls back safely when
 * optional fields are missing (no formal contract system required).
 */
export function marketValue(player: Player): number {
  const base = Math.max(50_000, player.value || 0);
  const overall = player.rating_overall || 60;
  const potential = player.potential ?? overall;
  const potentialBonus = Math.max(0, potential - overall) * base * 0.012;
  const formAdj = (((player.performance_form ?? 50) - 50) / 50) * 0.1;
  const moraleAdj = (((player.morale ?? 50) - 50) / 50) * 0.04;
  const ageAdj = player.age == null ? 0 : player.age <= 21 ? 0.08 : player.age >= 27 ? -0.08 : 0;
  const value = (base + potentialBonus) * (1 + formAdj + moraleAdj + ageAdj);
  return Math.max(50_000, Math.round(value));
}

/** Role-fit score of a player for a target role (same role is best). */
function roleFit(player: Player, role: Role): number {
  return player.role === role ? player.rating_overall : player.rating_overall - 14;
}

export type BotActivityKind = 'signing' | 'sale' | 'trade' | 'offer' | 'reject';

export interface BotMarketActivity {
  id: string;
  created_at: string;
  kind: BotActivityKind;
  message: string;
  team_id: string;
  player_id: string | null;
}

interface RunBotMarketParams {
  league: League;
  teams: Team[]; // run-active teams in the league (bots + humans)
  players: Player[]; // all league players (mutated in place)
  offers: MarketOffer[]; // db.market_offers (new offers pushed)
  transferHistory: TransferRecord[]; // db.transfer_history (records pushed)
  tick: number; // monotonically increasing per market action; seeds the RNG
  reason: string; // phase label, used in feed copy
  // A real guest id to own the bot's offer rows. `market_offers.offered_by_guest_id`
  // is a NOT NULL FK to guest_sessions, so bot offers are attributed to the guest
  // who triggered the tick (the buying team lives in `team_id`).
  offeredByGuestId: string;
}

const regionLabel = (team: Team | undefined) => team?.region || 'an international';

/**
 * Run one lightweight, bounded, deterministic market tick for bot teams.
 * Bots may: sign global free agents, sell weak bench players, trade with other
 * bots cross-region, and table buy-offers for human-managed players. Behaviour
 * is capped so rosters never churn unrealistically.
 */
export function runBotMarket(params: RunBotMarketParams): BotMarketActivity[] {
  const { league, teams, players, offers, transferHistory, tick, offeredByGuestId } = params;
  const seed = `${league.run_seed ?? league.id}:market:${tick}`;
  const rng = new Rng(seed);
  const activity: BotMarketActivity[] = [];

  const bots = teams
    .filter((t) => t.is_bot && t.run_active !== false)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (bots.length === 0) return activity;

  const humanTeams = teams.filter((t) => !t.is_bot && t.run_active !== false);
  const maxActions = Math.max(2, Math.min(5, Math.ceil(bots.length / 2)));

  const freeAgents = () => players.filter((p) => !p.team_id && p.status === 'free_agent');
  const hasActiveOffer = (playerId: string) =>
    offers.some((o) => o.player_id === playerId && o.status === 'active');

  const record = (kind: BotActivityKind, message: string, teamId: string, playerId: string | null) => {
    activity.push({ id: uid('botact'), created_at: nowISO(), kind, message, team_id: teamId, player_id: playerId });
  };

  let actions = 0;
  // Deterministic bot order, each acts with bounded probability.
  const order = [...bots].sort(() => (rng.bool() ? 1 : -1));
  for (const bot of order) {
    if (actions >= maxActions) break;
    if (!rng.bool(0.65)) continue;
    const botRng = new Rng(`${seed}:${bot.id}`);
    const needs = evaluateTeamNeeds(bot, players);

    // 1) Fill a missing/weak role from global free agency.
    const targetRole = needs.topNeed;
    if (targetRole) {
      const current = needs.starterByRole[targetRole];
      const pool = freeAgents()
        .filter((p) => marketValue(p) <= bot.budget * 0.6)
        .map((p) => ({ p, fit: roleFit(p, targetRole) }))
        .filter(({ p, fit }) => (current ? fit > current.rating_overall + 3 : roleFit(p, targetRole) > 58))
        .sort((a, b) => b.fit - a.fit);
      const pick = pool[0]?.p;
      if (pick && !hasActiveOffer(pick.id)) {
        const fee = marketValue(pick);
        bot.budget -= fee;
        bot.updated_at = nowISO();
        pick.team_id = bot.id;
        pick.status = current ? 'benched' : 'active';
        pick.updated_at = nowISO();
        transferHistory.push({
          id: uid('th'), league_id: league.id, player_id: pick.id, from_team_id: null,
          to_team_id: bot.id, transfer_type: 'signing', amount: fee, created_at: nowISO(),
        });
        record('signing', `${bot.short_name} signed free agent ${pick.role.toLowerCase()} ${pick.nickname}.`, bot.id, pick.id);
        actions++;
        continue;
      }
      // 1b) If a free agent is already contested, compete with an offer instead.
      const contested = freeAgents()
        .filter((p) => hasActiveOffer(p.id) && roleFit(p, targetRole) > 60 && marketValue(p) <= bot.budget)
        .sort((a, b) => roleFit(b, targetRole) - roleFit(a, targetRole))[0];
      if (contested) {
        const fee = Math.round(marketValue(contested) * botRng.range(1.02, 1.18));
        offers.push(buildOffer(league, contested, bot, fee, 'starter', `${bot.short_name} is competing for a free agent ${targetRole.toLowerCase()}.`, null, offeredByGuestId));
        record('offer', `${bot.short_name} made a competing offer for free agent ${contested.nickname}.`, bot.id, contested.id);
        actions++;
        continue;
      }
    }

    // 2) Table a buy-offer for a human-managed player that fills a real need.
    if (targetRole && humanTeams.length && botRng.bool(0.5)) {
      const candidates = humanTeams
        .filter((t) => t.id !== bot.id)
        .flatMap((t) => players.filter((p) => p.team_id === t.id && p.status === 'active' && roleFit(p, targetRole) > 66))
        .filter((p) => marketValue(p) <= bot.budget && !hasActiveOffer(p.id))
        .sort((a, b) => roleFit(b, targetRole) - roleFit(a, targetRole));
      const target = candidates[0];
      if (target) {
        const fee = Math.round(marketValue(target) * botRng.range(1.05, 1.3));
        const sellTeam = teams.find((t) => t.id === target.team_id);
        offers.push(buildOffer(league, target, bot, fee, 'starter',
          `${bot.short_name} wants a ${needs.missingRoles.includes(targetRole) ? 'starting' : 'stronger'} ${targetRole.toLowerCase()}${needs.lowDepth ? ' and more depth' : ''}.`,
          target.team_id ?? null, offeredByGuestId));
        record('offer', `${bot.short_name} made an offer to ${sellTeam?.short_name ?? 'a rival'} for ${target.nickname}.`, bot.id, target.id);
        actions++;
        continue;
      }
    }

    // 3) Sell a surplus / low-fit bench player back to global free agency.
    const benchPlayers = players.filter(
      (p) => p.team_id === bot.id && p.status === 'benched',
    );
    if (benchPlayers.length && needs.depth > HEALTHY_DEPTH && botRng.bool(0.45)) {
      const sale = [...benchPlayers].sort((a, b) => a.rating_overall - b.rating_overall)[0];
      const proceeds = Math.round(marketValue(sale) * 0.6);
      bot.budget += proceeds;
      bot.updated_at = nowISO();
      sale.team_id = null;
      sale.status = 'free_agent';
      sale.updated_at = nowISO();
      transferHistory.push({
        id: uid('th'), league_id: league.id, player_id: sale.id, from_team_id: bot.id,
        to_team_id: null, transfer_type: 'sale', amount: proceeds, created_at: nowISO(),
      });
      record('sale', `${bot.short_name} sold bench ${sale.role.toLowerCase()} ${sale.nickname} to free agency.`, bot.id, sale.id);
      actions++;
      continue;
    }

    // 4) Bot-to-bot cross-region trade: buy a needed starter from a bot with
    //    surplus at that role. Occasionally the seller declines (flavour).
    if (targetRole && botRng.bool(0.4)) {
      const sellers = bots.filter((t) => t.id !== bot.id);
      let done = false;
      for (const seller of sellers) {
        const sellerNeeds = evaluateTeamNeeds(seller, players);
        const spare = (sellerNeeds.benchByRole[targetRole] ?? [])
          .filter((p) => roleFit(p, targetRole) > (needs.starterByRole[targetRole]?.rating_overall ?? 0) + 2)
          .sort((a, b) => b.rating_overall - a.rating_overall)[0];
        if (!spare) continue;
        const fee = marketValue(spare);
        if (fee > bot.budget) continue;
        // Seller keeps key players: decline if it would drop them below depth.
        if (sellerNeeds.depth <= HEALTHY_DEPTH || botRng.bool(0.25)) {
          record('reject', `${seller.short_name} rejected an offer for ${spare.nickname}.`, seller.id, spare.id);
          done = true;
          break;
        }
        bot.budget -= fee;
        seller.budget += fee;
        bot.updated_at = nowISO();
        seller.updated_at = nowISO();
        spare.team_id = bot.id;
        spare.status = needs.missingRoles.includes(targetRole) ? 'active' : 'benched';
        spare.updated_at = nowISO();
        transferHistory.push({
          id: uid('th'), league_id: league.id, player_id: spare.id, from_team_id: seller.id,
          to_team_id: bot.id, transfer_type: 'trade', amount: fee, created_at: nowISO(),
        });
        record('trade', `${bot.short_name} bought ${spare.nickname} from ${regionLabel(seller)} side ${seller.short_name}.`, bot.id, spare.id);
        actions++;
        done = true;
        break;
      }
      if (done) continue;
    }
  }

  return activity;
}

function buildOffer(
  league: League,
  player: Player,
  buyer: Team,
  fee: number,
  rolePromise: MarketOffer['role_promise'],
  reason: string,
  fromTeamId: string | null,
  offeredByGuestId: string,
): MarketOffer {
  const submittedAt = nowISO();
  const expiresAt = new Date(Date.now() + Math.max(1, league.free_agent_offer_window_hours ?? 24) * 3600000).toISOString();
  return {
    id: uid('offer'),
    league_id: league.id,
    player_id: player.id,
    team_id: buyer.id,
    offered_by_guest_id: offeredByGuestId,
    transfer_fee: fee,
    salary: player.salary,
    role_promise: rolePromise,
    status: 'active',
    submitted_at: submittedAt,
    expires_at: expiresAt,
    resolved_at: null,
    reason,
    from_team_id: fromTeamId,
  };
}

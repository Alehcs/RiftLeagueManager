import type { Database, LeagueExport } from '@/lib/types';
import { createRoomCode, nowISO, uid } from '@/lib/utils';

// ============================================================================
// Full-league JSON export / import (bundle = one league + all its entities).
// On import everything is re-id'd so a league can be cloned/imported without
// colliding with existing rows.
// ============================================================================

export function buildLeagueExport(db: Database, leagueId: string): LeagueExport | null {
  const league = db.leagues.find((l) => l.id === leagueId);
  if (!league) return null;
  const teams = db.teams.filter((t) => t.league_id === leagueId);
  const players = db.players.filter((p) => p.league_id === leagueId);
  const coaches = db.coaches.filter((c) => c.league_id === leagueId);
  const matches = db.matches.filter((m) => m.league_id === leagueId);
  const matchIds = new Set(matches.map((m) => m.id));
  const games = db.games.filter((g) => matchIds.has(g.match_id));
  const trades = db.trades.filter((t) => t.league_id === leagueId);
  const tradeIds = new Set(trades.map((t) => t.id));
  const trade_items = db.trade_items.filter((ti) => tradeIds.has(ti.trade_id));
  const transfer_history = db.transfer_history.filter((th) => th.league_id === leagueId);

  return {
    format: 'rift-league-manager/v1',
    exported_at: nowISO(),
    league: { ...league, admin_code_hash: null },
    teams,
    players,
    coaches,
    matches,
    games,
    trades,
    trade_items,
    transfer_history,
  };
}

export function isLeagueExport(obj: unknown): obj is LeagueExport {
  return (
    !!obj &&
    typeof obj === 'object' &&
    (obj as LeagueExport).format === 'rift-league-manager/v1' &&
    !!(obj as LeagueExport).league
  );
}

type LeagueSlices = Pick<
  Database,
  'leagues' | 'teams' | 'players' | 'coaches' | 'matches' | 'games' | 'trades' | 'trade_items' | 'transfer_history' | 'league_admins'
>;

// Re-id an export bundle for safe insertion. Optionally override name/slug/owner
// (used by "Clone league").
export function reidLeagueExport(
  bundle: LeagueExport,
  opts?: { ownerId?: string; name?: string; slug?: string },
): LeagueSlices {
  const map = new Map<string, string>();
  const rid = (oldId: string, prefix: string) => {
    if (!oldId) return oldId;
    if (!map.has(oldId)) map.set(oldId, uid(prefix));
    return map.get(oldId)!;
  };
  const remap = (oldId: string | null): string | null =>
    oldId == null ? null : map.get(oldId) ?? oldId;

  const ts = nowISO();
  const leagueId = rid(bundle.league.id, 'lg');
  bundle.teams.forEach((t) => rid(t.id, 't'));
  bundle.players.forEach((p) => rid(p.id, 'p'));
  bundle.coaches.forEach((c) => rid(c.id, 'c'));
  bundle.matches.forEach((m) => rid(m.id, 'm'));
  bundle.games.forEach((g) => rid(g.id, 'g'));
  bundle.trades.forEach((t) => rid(t.id, 'tr'));

  const league = {
    ...bundle.league,
    id: leagueId,
    name: opts?.name ?? bundle.league.name,
    slug: opts?.slug ?? bundle.league.slug,
    owner_guest_id: opts?.ownerId ?? bundle.league.owner_guest_id ?? bundle.league.owner_user_id ?? '',
    room_code: createRoomCode(),
    admin_code_hash: null,
    is_seed: false,
    created_at: ts,
    updated_at: ts,
  };

  const teams = bundle.teams.map((t) => ({ ...t, id: map.get(t.id)!, league_id: leagueId }));
  const players = bundle.players.map((p) => ({
    ...p,
    id: map.get(p.id)!,
    league_id: leagueId,
    team_id: remap(p.team_id),
  }));
  const coaches = bundle.coaches.map((c) => ({
    ...c,
    id: map.get(c.id)!,
    league_id: leagueId,
    team_id: remap(c.team_id),
  }));
  const matches = bundle.matches.map((m) => ({
    ...m,
    id: map.get(m.id)!,
    league_id: leagueId,
    blue_team_id: remap(m.blue_team_id) ?? '',
    red_team_id: remap(m.red_team_id) ?? '',
    winner_team_id: remap(m.winner_team_id),
    feeds_winner_to: remap(m.feeds_winner_to ?? null),
    feeds_loser_to: remap(m.feeds_loser_to ?? null),
  }));
  const games = bundle.games.map((g) => ({
    ...g,
    id: map.get(g.id)!,
    match_id: map.get(g.match_id)!,
    blue_team_id: remap(g.blue_team_id) ?? '',
    red_team_id: remap(g.red_team_id) ?? '',
    winner_team_id: remap(g.winner_team_id) ?? '',
  }));
  const trades = bundle.trades.map((t) => ({
    ...t,
    id: map.get(t.id)!,
    league_id: leagueId,
    from_team_id: remap(t.from_team_id) ?? '',
    to_team_id: remap(t.to_team_id) ?? '',
  }));
  const trade_items = bundle.trade_items.map((ti) => ({
    ...ti,
    id: uid('ti'),
    trade_id: map.get(ti.trade_id)!,
    player_id: remap(ti.player_id) ?? '',
    from_team_id: remap(ti.from_team_id) ?? '',
    to_team_id: remap(ti.to_team_id) ?? '',
  }));
  const transfer_history = bundle.transfer_history.map((th) => ({
    ...th,
    id: uid('th'),
    league_id: leagueId,
    player_id: remap(th.player_id) ?? '',
    from_team_id: remap(th.from_team_id),
    to_team_id: remap(th.to_team_id),
  }));

  const league_admins = [
    {
      id: uid('la'),
      league_id: leagueId,
      guest_id: opts?.ownerId ?? bundle.league.owner_guest_id ?? bundle.league.owner_user_id ?? '',
      role: 'owner' as const,
      team_id: null,
    },
  ];

  return { leagues: [league], teams, players, coaches, matches, games, trades, trade_items, transfer_history, league_admins };
}

import type { Coach, Match, Player, Team } from '@/lib/types';
import { ROLE_META } from '@/lib/constants';

// ============================================================================
// CSV parsing + serialization for the documented import/export formats.
// ============================================================================

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') pushField();
    else if (c === '\n') {
      pushField();
      pushRow();
    } else if (c === '\r') {
      // ignore
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function toObjects(text: string): Record<string, string>[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (r[i] ?? '').trim()));
    return obj;
  });
}

function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function serialize(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

// --- Header definitions (the documented formats) ---------------------------
export const CSV_HEADERS = {
  player: [
    'nickname', 'real_name', 'role', 'nationality', 'age', 'value', 'salary',
    'rating_overall', 'rating_laning', 'rating_teamfighting', 'rating_macro',
    'rating_mechanics', 'rating_consistency', 'team_short_name', 'image_url', 'external_url',
  ],
  coach: [
    'nickname', 'real_name', 'nationality', 'age', 'rating_draft', 'rating_macro',
    'rating_development', 'rating_leadership', 'team_short_name', 'image_url', 'external_url',
  ],
  team: ['name', 'short_name', 'region', 'country', 'tier', 'logo_url', 'external_url', 'budget'],
  match: [
    'stage', 'week', 'match_day', 'date_time', 'blue_team_short_name', 'red_team_short_name',
    'format', 'status', 'winner_team_short_name', 'blue_score', 'red_score', 'patch',
    'venue_text', 'stream_url', 'external_url',
  ],
} as const;

// --- Exporters --------------------------------------------------------------
export function playersToCsv(players: Player[], teams: Team[]): string {
  const shortOf = (id: string | null) => teams.find((t) => t.id === id)?.short_name ?? '';
  return serialize(
    [...CSV_HEADERS.player],
    players.map((p) => [
      p.nickname, p.real_name, p.role, p.nationality, p.age, p.value, p.salary,
      p.rating_overall, p.rating_laning, p.rating_teamfighting, p.rating_macro,
      p.rating_mechanics, p.rating_consistency, shortOf(p.team_id), p.image_url, p.external_url,
    ]),
  );
}

export function coachesToCsv(coaches: Coach[], teams: Team[]): string {
  const shortOf = (id: string | null) => teams.find((t) => t.id === id)?.short_name ?? '';
  return serialize(
    [...CSV_HEADERS.coach],
    coaches.map((c) => [
      c.nickname, c.real_name, c.nationality, c.age, c.rating_draft, c.rating_macro,
      c.rating_development, c.rating_leadership, shortOf(c.team_id), c.image_url, c.external_url,
    ]),
  );
}

export function teamsToCsv(teams: Team[]): string {
  return serialize(
    [...CSV_HEADERS.team],
    teams.map((t) => [t.name, t.short_name, t.region, t.country, t.tier, t.logo_url, t.external_url, t.budget]),
  );
}

export function matchesToCsv(matches: Match[], teams: Team[]): string {
  const shortOf = (id: string | null) => teams.find((t) => t.id === id)?.short_name ?? '';
  return serialize(
    [...CSV_HEADERS.match],
    matches.map((m) => [
      m.stage, m.week, m.match_day, m.date_time, shortOf(m.blue_team_id), shortOf(m.red_team_id),
      m.format, m.status, shortOf(m.winner_team_id), m.blue_score, m.red_score, m.patch,
      m.venue_text, m.stream_url, m.external_url,
    ]),
  );
}

// --- Role normalization (forgiving of common aliases) ----------------------
export function normalizeRole(input: string): Player['role'] {
  const v = input.trim().toUpperCase();
  const map: Record<string, Player['role']> = {
    TOP: 'TOP', TOPLANE: 'TOP',
    JNG: 'JUNGLE', JUNGLE: 'JUNGLE', JUNGLER: 'JUNGLE',
    MID: 'MID', MIDDLE: 'MID',
    ADC: 'ADC', BOT: 'ADC', BOTTOM: 'ADC', AD: 'ADC', MARKSMAN: 'ADC',
    SUP: 'SUPPORT', SUPPORT: 'SUPPORT', SUPP: 'SUPPORT',
    SUB: 'SUBSTITUTE', SUBSTITUTE: 'SUBSTITUTE',
    COACH: 'COACH',
  };
  return map[v] ?? (ROLE_META[v as Player['role']] ? (v as Player['role']) : 'MID');
}

export const num = (v: string, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// ============================================================================
// Private LoL team logo manifest — single source of truth mapping team ids
// (and aliases) to local asset paths under /public/assets/teams/lol/.
//
// All bundled files today are IP-safe *placeholder* badges (brand colour +
// initials), so every entry is `status: 'placeholder'`. To wire a real,
// licensed logo: drop the file into the folder, point `path` at it (svg/png/
// webp all work), and flip `status` to 'real'. No other code changes needed —
// the data pack reads paths from here, and <TeamLogo> falls back gracefully if
// a file is missing or broken.
//
// See docs/missing-lol-logos.md for the drop-in checklist.
// ============================================================================

export type LolLogoStatus = 'real' | 'placeholder';
export type LolLogoFormat = 'svg' | 'png' | 'webp';

export interface LolLogoEntry {
  id: string; // pack organization/team id (matches the data pack)
  team: string; // display name
  short: string; // short code
  aliases?: string[]; // alternate / former names (also resolve to this logo)
  path: string; // public asset path served to <TeamLogo>
  format: LolLogoFormat;
  status: LolLogoStatus; // 'placeholder' until licensed artwork is dropped in
}

const DIR = '/assets/teams/lol';

export const LOL_LOGO_MANIFEST: LolLogoEntry[] = [
  // ---- Korea (LCK) ----
  { id: 't1', team: 'T1', short: 'T1', aliases: ['SK Telecom T1', 'SKT T1'], path: `${DIR}/t1.svg`, format: 'svg', status: 'placeholder' },
  { id: 'geng', team: 'Gen.G', short: 'GEN', aliases: ['Samsung Galaxy', 'KSV'], path: `${DIR}/geng.svg`, format: 'svg', status: 'placeholder' },
  { id: 'hle', team: 'Hanwha Life Esports', short: 'HLE', aliases: ['ROX Tigers lineage'], path: `${DIR}/hle.svg`, format: 'svg', status: 'placeholder' },
  { id: 'dk', team: 'Dplus KIA', short: 'DK', aliases: ['DAMWON Gaming', 'DWG KIA'], path: `${DIR}/dk.svg`, format: 'svg', status: 'placeholder' },
  { id: 'kt', team: 'KT Rolster', short: 'KT', path: `${DIR}/kt.svg`, format: 'svg', status: 'placeholder' },
  // ---- EMEA (LEC) ----
  { id: 'g2', team: 'G2 Esports', short: 'G2', aliases: ['Gamers2'], path: `${DIR}/g2.svg`, format: 'svg', status: 'placeholder' },
  { id: 'fnc', team: 'Fnatic', short: 'FNC', path: `${DIR}/fnc.svg`, format: 'svg', status: 'placeholder' },
  { id: 'kc', team: 'Karmine Corp', short: 'KC', path: `${DIR}/kc.svg`, format: 'svg', status: 'placeholder' },
  { id: 'th', team: 'Team Heretics', short: 'TH', path: `${DIR}/th.svg`, format: 'svg', status: 'placeholder' },
  { id: 'koi', team: 'Movistar KOI', short: 'KOI', aliases: ['Rogue', 'KOI'], path: `${DIR}/koi.svg`, format: 'svg', status: 'placeholder' },
  // ---- China (LPL) ----
  { id: 'blg', team: 'Bilibili Gaming', short: 'BLG', path: `${DIR}/blg.svg`, format: 'svg', status: 'placeholder' },
  { id: 'jdg', team: 'JD Gaming', short: 'JDG', path: `${DIR}/jdg.svg`, format: 'svg', status: 'placeholder' },
  { id: 'tes', team: 'Top Esports', short: 'TES', path: `${DIR}/tes.svg`, format: 'svg', status: 'placeholder' },
  { id: 'wbg', team: 'Weibo Gaming', short: 'WBG', path: `${DIR}/wbg.svg`, format: 'svg', status: 'placeholder' },
  { id: 'ig', team: 'Invictus Gaming', short: 'IG', path: `${DIR}/ig.svg`, format: 'svg', status: 'placeholder' },
  // ---- North America (LTA North) ----
  { id: 'c9', team: 'Cloud9', short: 'C9', path: `${DIR}/c9.svg`, format: 'svg', status: 'placeholder' },
  { id: 'tl', team: 'Team Liquid', short: 'TL', path: `${DIR}/tl.svg`, format: 'svg', status: 'placeholder' },
  { id: 'fly', team: 'FlyQuest', short: 'FLY', path: `${DIR}/fly.svg`, format: 'svg', status: 'placeholder' },
  { id: '100t', team: '100 Thieves', short: '100', path: `${DIR}/100t.svg`, format: 'svg', status: 'placeholder' },
  // ---- South America (LTA South) ----
  { id: 'loud', team: 'LOUD', short: 'LLL', path: `${DIR}/loud.svg`, format: 'svg', status: 'placeholder' },
  { id: 'pain', team: 'paiN Gaming', short: 'PNG', path: `${DIR}/pain.svg`, format: 'svg', status: 'placeholder' },
  { id: 'furia', team: 'FURIA', short: 'FUR', path: `${DIR}/furia.svg`, format: 'svg', status: 'placeholder' },
  // ---- Historic / legacy ----
  { id: 'losratones', team: 'Los Ratones', short: 'LR', path: `${DIR}/losratones.svg`, format: 'svg', status: 'placeholder' },
  { id: 'skt', team: 'SK Telecom T1', short: 'SKT', aliases: ['SKT', 'SKT T1'], path: `${DIR}/skt.svg`, format: 'svg', status: 'placeholder' },
  { id: 'ssg', team: 'Samsung Galaxy', short: 'SSG', aliases: ['Samsung White', 'Samsung Blue'], path: `${DIR}/ssg.svg`, format: 'svg', status: 'placeholder' },
  { id: 'fpx', team: 'FunPlus Phoenix', short: 'FPX', path: `${DIR}/fpx.svg`, format: 'svg', status: 'placeholder' },
  { id: 'tpa', team: 'Taipei Assassins', short: 'TPA', path: `${DIR}/tpa.svg`, format: 'svg', status: 'placeholder' },
];

const BY_KEY = new Map<string, string>();
for (const entry of LOL_LOGO_MANIFEST) {
  BY_KEY.set(entry.id.toLowerCase(), entry.path);
  for (const alias of entry.aliases ?? []) BY_KEY.set(alias.toLowerCase(), entry.path);
}

// Resolve a team id (or alias) to its bundled logo path, or undefined when the
// team has no manifest entry (it then falls back to a generated brand tile).
export function lolLogoPath(key: string | null | undefined): string | undefined {
  return key ? BY_KEY.get(key.trim().toLowerCase()) : undefined;
}

export function lolLogoEntry(id: string): LolLogoEntry | undefined {
  return LOL_LOGO_MANIFEST.find((entry) => entry.id === id);
}

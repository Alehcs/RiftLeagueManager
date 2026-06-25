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
  { id: 't1', team: 'T1', short: 'T1', aliases: ['SK Telecom T1', 'SKT T1'], path: `/assets/teams/lol/real/t1.png`, format: 'png', status: 'real' },
  { id: 'geng', team: 'Gen.G', short: 'GEN', aliases: ['Samsung Galaxy', 'KSV'], path: `/assets/teams/lol/real/geng.png`, format: 'png', status: 'real' },
  { id: 'hle', team: 'Hanwha Life Esports', short: 'HLE', aliases: ['ROX Tigers lineage'], path: `/assets/teams/lol/real/hle.png`, format: 'png', status: 'real' },
  { id: 'dk', team: 'Dplus KIA', short: 'DK', aliases: ['DAMWON Gaming', 'DWG KIA'], path: `/assets/teams/lol/real/dk.png`, format: 'png', status: 'real' },
  { id: 'kt', team: 'KT Rolster', short: 'KT', path: `/assets/teams/lol/real/kt.png`, format: 'png', status: 'real' },
  // ---- EMEA (LEC) ----
  { id: 'g2', team: 'G2 Esports', short: 'G2', aliases: ['Gamers2'], path: `/assets/teams/lol/real/g2.png`, format: 'png', status: 'real' },
  { id: 'fnc', team: 'Fnatic', short: 'FNC', path: `/assets/teams/lol/real/fnc.png`, format: 'png', status: 'real' },
  { id: 'kc', team: 'Karmine Corp', short: 'KC', path: `/assets/teams/lol/real/kc.png`, format: 'png', status: 'real' },
  { id: 'th', team: 'Team Heretics', short: 'TH', path: `/assets/teams/lol/real/th.png`, format: 'png', status: 'real' },
  { id: 'koi', team: 'Movistar KOI', short: 'KOI', aliases: ['Rogue', 'KOI'], path: `/assets/teams/lol/real/koi.png`, format: 'png', status: 'real' },
  // ---- China (LPL) ----
  { id: 'blg', team: 'Bilibili Gaming', short: 'BLG', path: `/assets/teams/lol/real/blg.png`, format: 'png', status: 'real' },
  { id: 'jdg', team: 'JD Gaming', short: 'JDG', path: `/assets/teams/lol/real/jdg.png`, format: 'png', status: 'real' },
  { id: 'tes', team: 'Top Esports', short: 'TES', path: `/assets/teams/lol/real/tes.png`, format: 'png', status: 'real' },
  { id: 'wbg', team: 'Weibo Gaming', short: 'WBG', path: `/assets/teams/lol/real/wbg.png`, format: 'png', status: 'real' },
  { id: 'ig', team: 'Invictus Gaming', short: 'IG', path: `/assets/teams/lol/real/ig.png`, format: 'png', status: 'real' },
  // ---- North America (LTA North) ----
  { id: 'c9', team: 'Cloud9', short: 'C9', path: `/assets/teams/lol/real/c9.png`, format: 'png', status: 'real' },
  { id: 'tl', team: 'Team Liquid', short: 'TL', path: `/assets/teams/lol/real/tl.png`, format: 'png', status: 'real' },
  { id: 'fly', team: 'FlyQuest', short: 'FLY', path: `/assets/teams/lol/real/fly.png`, format: 'png', status: 'real' },
  { id: '100t', team: '100 Thieves', short: '100', path: `/assets/teams/lol/real/100t.png`, format: 'png', status: 'real' },
  // ---- South America (LTA South) ----
  { id: 'loud', team: 'LOUD', short: 'LLL', path: `/assets/teams/lol/real/loud.png`, format: 'png', status: 'real' },
  { id: 'pain', team: 'paiN Gaming', short: 'PNG', path: `/assets/teams/lol/real/pain.png`, format: 'png', status: 'real' },
  { id: 'furia', team: 'FURIA', short: 'FUR', path: `/assets/teams/lol/real/furia.png`, format: 'png', status: 'real' },
  // ---- Added notable teams (LLA/LATAM, EMEA, LPL, PCS) ----
  { id: 'flamengo', team: 'Flamengo Esports', short: 'FLA', path: `/assets/teams/lol/real/flamengo.png`, format: 'png', status: 'real' },
  { id: 'isurus', team: 'Isurus', short: 'ISG', aliases: ['Isurus Gaming'], path: `/assets/teams/lol/real/isurus.png`, format: 'png', status: 'real' },
  { id: 'r7', team: 'Movistar R7', short: 'R7', aliases: ['Rainbow7'], path: `${DIR}/r7.svg`, format: 'svg', status: 'placeholder' },
  { id: 'bds', team: 'Team BDS', short: 'BDS', path: `${DIR}/bds.svg`, format: 'svg', status: 'placeholder' },
  { id: 'rareatom', team: 'Rare Atom', short: 'RA', aliases: ['Rogue Warriors'], path: `/assets/teams/lol/real/rareatom.png`, format: 'png', status: 'real' },
  { id: 'psg', team: 'PSG Talon', short: 'PSG', aliases: ['Talon Esports'], path: `/assets/teams/lol/real/psg.png`, format: 'png', status: 'real' },
  { id: 'astralis', team: 'Astralis', short: 'AST', path: `/assets/teams/lol/real/astralis.png`, format: 'png', status: 'real' },
  { id: 'saigonbuffalo', team: 'Saigon Buffalo', short: 'SGB', path: `/assets/teams/lol/real/saigonbuffalo.png`, format: 'png', status: 'real' },
  // ---- Historic / legacy ----
  { id: 'losratones', team: 'Los Ratones', short: 'LR', path: `/assets/teams/lol/real/losratones.png`, format: 'png', status: 'real' },
  { id: 'skt', team: 'SK Telecom T1', short: 'SKT', aliases: ['SKT', 'SKT T1'], path: `/assets/teams/lol/real/skt.png`, format: 'png', status: 'real' },
  { id: 'ssg', team: 'Samsung Galaxy', short: 'SSG', aliases: ['Samsung White', 'Samsung Blue'], path: `/assets/teams/lol/real/ssg.png`, format: 'png', status: 'real' },
  { id: 'fpx', team: 'FunPlus Phoenix', short: 'FPX', path: `/assets/teams/lol/real/fpx.png`, format: 'png', status: 'real' },
  { id: 'tpa', team: 'Taipei Assassins', short: 'TPA', path: `/assets/teams/lol/real/tpa.png`, format: 'png', status: 'real' },
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

import type { LeagueFormat, LeagueTier, ReputationMeta, Role } from '@/lib/types';

// ============================================================================
// Real LoL esports structure — compact source tables.
//
// Only players/coaches I'm reasonably confident are real are listed by name.
// The seed builder (src/data/seed.ts) fills any of the 5 core roles a team is
// missing with a plausibly-generated player, flagged `generated: true`, so
// every team always fields a full lineup. ALL ratings/values/contracts are
// generated and fully editable from the admin panel.
//
// `strength` (1=weak .. 5=elite) drives generated rating centers.
// `nat` is an ISO-3166 alpha-2 code used purely for the flag badge.
// ============================================================================

export interface RawPlayer {
  nick: string;
  name?: string;
  role: Role;
  nat: string;
  star?: boolean;
  age?: number;
  strength?: number; // 1..5 per-player center from a data pack, if known
  // Optional reputation/canon-bias metadata; drives career initialization.
  reputation?: ReputationMeta;
  // Optional portrait/avatar metadata (all fallback-safe).
  portrait?: string | null;
  avatar_seed?: string | null;
  avatar_style?: string | null;
}
export interface RawCoach {
  nick: string;
  name?: string;
  nat: string;
}
export interface RawTeam {
  name: string;
  short: string;
  country: string; // ISO alpha-2
  strength: number; // 1..5
  coach?: RawCoach;
  roster?: RawPlayer[];
  logo?: string | null; // optional pack asset path or external URL
  region?: string; // optional real home region; falls back to the league region
  tier?: LeagueTier; // optional real tier; falls back to the league tier
  active?: boolean; // false = historic / legacy / disbanded org
  legacy_label?: string | null; // nostalgia tag (e.g. "Worlds 2016 champion")
  color?: string | null; // primary brand color
  color_secondary?: string | null; // secondary brand color
  brand_gradient?: string | null; // optional CSS gradient accent
}
export interface RawLeague {
  name: string;
  slug: string;
  region: string;
  tier: LeagueTier;
  season: string;
  format: LeagueFormat;
  source_name?: string;
  source_url?: string;
  // For international shells: generate full lineups for teams with no roster.
  generateRosters?: boolean;
  // Pre-simulate the regular season at seed time for a populated demo.
  presimulate?: boolean;
  teams: RawTeam[];
}

const P = (nick: string, role: Role, nat: string, name?: string, star?: boolean): RawPlayer => ({
  nick,
  role,
  nat,
  name,
  star,
});

// ---------------------------------------------------------------------------
// LCK — Korea (Tier 1)
// ---------------------------------------------------------------------------
const LCK: RawLeague = {
  name: 'LCK',
  slug: 'lck',
  region: 'Korea',
  tier: 'tier1',
  season: '2025 Spring',
  format: 'bo3_regular_season',
  source_name: 'Leaguepedia',
  source_url: 'https://lol.fandom.com/wiki/LCK',
  presimulate: true,
  teams: [
    {
      name: 'T1', short: 'T1', country: 'KR', strength: 5,
      coach: { nick: 'kkOma', name: 'Kim Jeong-gyun', nat: 'KR' },
      roster: [
        P('Doran', 'TOP', 'KR', 'Choi Hyeon-joon'),
        P('Oner', 'JUNGLE', 'KR', 'Mun Hyeon-jun', true),
        P('Faker', 'MID', 'KR', 'Lee Sang-hyeok', true),
        P('Gumayusi', 'ADC', 'KR', 'Lee Min-hyeong', true),
        P('Keria', 'SUPPORT', 'KR', 'Ryu Min-seok', true),
      ],
    },
    {
      name: 'Gen.G', short: 'GEN', country: 'KR', strength: 5,
      coach: { nick: 'Score', name: 'Go Dong-bin', nat: 'KR' },
      roster: [
        P('Kiin', 'TOP', 'KR', 'Kim Gi-in'),
        P('Canyon', 'JUNGLE', 'KR', 'Kim Geon-bu', true),
        P('Chovy', 'MID', 'KR', 'Jeong Ji-hoon', true),
        P('Ruler', 'ADC', 'KR', 'Park Jae-hyuk', true),
        P('Duro', 'SUPPORT', 'KR', 'Joo Min-gyu'),
      ],
    },
    {
      name: 'Hanwha Life Esports', short: 'HLE', country: 'KR', strength: 5,
      coach: { nick: 'Daeny', name: 'Lee Jong-won', nat: 'KR' },
      roster: [
        P('Zeus', 'TOP', 'KR', 'Choi Woo-je', true),
        P('Peanut', 'JUNGLE', 'KR', 'Han Wang-ho'),
        P('Zeka', 'MID', 'KR', 'Kim Geon-woo', true),
        P('Viper', 'ADC', 'KR', 'Park Do-hyeon', true),
        P('Delight', 'SUPPORT', 'KR', 'Yoo Hwan-joong'),
      ],
    },
    {
      name: 'Dplus KIA', short: 'DK', country: 'KR', strength: 4,
      roster: [
        P('Siwoo', 'TOP', 'KR'),
        P('Lucid', 'JUNGLE', 'KR'),
        P('ShowMaker', 'MID', 'KR', 'Heo Su', true),
        P('Aiming', 'ADC', 'KR', 'Kim Ha-ram'),
        P('BeryL', 'SUPPORT', 'KR', 'Cho Geon-hee'),
      ],
    },
    {
      name: 'KT Rolster', short: 'KT', country: 'KR', strength: 4,
      roster: [
        P('PerfecT', 'TOP', 'KR'),
        P('Cuzz', 'JUNGLE', 'KR', 'Moon Woo-chan'),
        P('Bdd', 'MID', 'KR', 'Gwak Bo-seong'),
        P('Deft', 'ADC', 'KR', 'Kim Hyuk-kyu', true),
        P('Way', 'SUPPORT', 'KR'),
      ],
    },
    {
      name: 'Nongshim RedForce', short: 'NS', country: 'KR', strength: 3,
      roster: [
        P('DnDn', 'TOP', 'KR'),
        P('Sylvie', 'JUNGLE', 'KR'),
        P('Fisher', 'MID', 'KR'),
        P('Jiwoo', 'ADC', 'KR'),
        P('Lehends', 'SUPPORT', 'KR', 'Son Si-woo'),
      ],
    },
    {
      name: 'BNK FEARX', short: 'FOX', country: 'KR', strength: 3,
      roster: [
        P('Morgan', 'TOP', 'KR'),
        P('Raptor', 'JUNGLE', 'KR'),
        P('VicLa', 'MID', 'KR'),
        P('Diable', 'ADC', 'KR'),
        P('Kellin', 'SUPPORT', 'KR'),
      ],
    },
    {
      name: 'DRX', short: 'DRX', country: 'KR', strength: 2,
      roster: [
        P('Rich', 'TOP', 'KR'),
        P('Sponge', 'JUNGLE', 'KR'),
        P('kyeahoo', 'MID', 'KR'),
        P('Teddy', 'ADC', 'KR', 'Park Jin-seong'),
        P('Pleata', 'SUPPORT', 'KR'),
      ],
    },
    {
      name: 'OKSavingsBank BRION', short: 'BRO', country: 'KR', strength: 2,
      roster: [
        P('Sword', 'TOP', 'KR'),
        P('Karis', 'MID', 'KR'),
        P('Effort', 'SUPPORT', 'KR', 'Lee Sang-ho'),
      ],
    },
    {
      name: 'Kwangdong Freecs', short: 'KDF', country: 'KR', strength: 2,
      roster: [
        P('DuDu', 'TOP', 'KR'),
        P('YoungJae', 'JUNGLE', 'KR'),
        P('BuLLDoG', 'MID', 'KR'),
        P('Taeyoon', 'ADC', 'KR'),
        P('Andil', 'SUPPORT', 'KR'),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// LEC — EMEA (Tier 1)
// ---------------------------------------------------------------------------
const LEC: RawLeague = {
  name: 'LEC',
  slug: 'lec',
  region: 'EMEA',
  tier: 'tier1',
  season: '2025 Winter',
  format: 'double_round_robin_bo1',
  source_name: 'Leaguepedia',
  source_url: 'https://lol.fandom.com/wiki/LEC',
  presimulate: true,
  teams: [
    {
      name: 'G2 Esports', short: 'G2', country: 'EU', strength: 5,
      coach: { nick: 'Dylan Falco', nat: 'US' },
      roster: [
        P('BrokenBlade', 'TOP', 'DE', 'Sergen Çelik'),
        P('Yike', 'JUNGLE', 'FR', 'Martin Sundelin'),
        P('Caps', 'MID', 'DK', 'Rasmus Winther', true),
        P('Hans Sama', 'ADC', 'FR', 'Steven Liv'),
        P('Mikyx', 'SUPPORT', 'SI', 'Mihael Mehle'),
      ],
    },
    {
      name: 'Fnatic', short: 'FNC', country: 'EU', strength: 4,
      roster: [
        P('Oscarinin', 'TOP', 'ES'),
        P('Razork', 'JUNGLE', 'ES', 'Iván Martín'),
        P('Humanoid', 'MID', 'CZ', 'Marek Brázda', true),
        P('Noah', 'ADC', 'KR'),
        P('Jun', 'SUPPORT', 'KR'),
      ],
    },
    {
      name: 'MAD Lions KOI', short: 'MDK', country: 'EU', strength: 4,
      roster: [
        P('Myrwn', 'TOP', 'ES'),
        P('Elyoya', 'JUNGLE', 'ES', 'Javier Prades', true),
        P('Fresskowy', 'MID', 'PL'),
        P('Supa', 'ADC', 'ES'),
        P('Alvaro', 'SUPPORT', 'ES'),
      ],
    },
    {
      name: 'Karmine Corp', short: 'KC', country: 'EU', strength: 4,
      roster: [
        P('Canna', 'TOP', 'KR'),
        P('Bo', 'JUNGLE', 'KR', 'Zhao Liu-cheng'),
        P('Saken', 'MID', 'FR'),
        P('Caliste', 'ADC', 'FR'),
        P('Targamas', 'SUPPORT', 'BE'),
      ],
    },
    {
      name: 'Team Heretics', short: 'TH', country: 'EU', strength: 3,
      roster: [
        P('Evi', 'TOP', 'JP'),
        P('Jankos', 'JUNGLE', 'PL', 'Marcin Jankowski'),
        P('Perkz', 'MID', 'HR', 'Luka Perković', true),
        P('Flakked', 'ADC', 'ES'),
        P('Mersa', 'SUPPORT', 'GR'),
      ],
    },
    {
      name: 'Team BDS', short: 'BDS', country: 'EU', strength: 3,
      roster: [
        P('Adam', 'TOP', 'FR'),
        P('Sheo', 'JUNGLE', 'FR'),
        P('nuc', 'MID', 'BE'),
        P('Ice', 'ADC', 'ES'),
        P('Parus', 'SUPPORT', 'PL'),
      ],
    },
    {
      name: 'Team Vitality', short: 'VIT', country: 'EU', strength: 3,
      roster: [
        P('Photon', 'TOP', 'KR'),
        P('Daglas', 'JUNGLE', 'PL'),
        P('Vetheo', 'MID', 'FR'),
        P('Carzzy', 'ADC', 'CZ'),
        P('Hylissang', 'SUPPORT', 'BG'),
      ],
    },
    {
      name: 'Rogue', short: 'RGE', country: 'EU', strength: 3,
      roster: [
        P('Naak Nako', 'TOP', 'FR'),
        P('Malrang', 'JUNGLE', 'KR'),
        P('Larssen', 'MID', 'SE', 'Emil Larsson', true),
        P('Comp', 'ADC', 'SE'),
        P('Trymbi', 'SUPPORT', 'PL'),
      ],
    },
    {
      name: 'GIANTX', short: 'GX', country: 'EU', strength: 2,
      roster: [
        P('Odoamne', 'TOP', 'RO', 'Andrei Pascu'),
        P('Lyncas', 'JUNGLE', 'LT'),
        P('Jackies', 'MID', 'CZ'),
        P('Patrik', 'ADC', 'CZ'),
        P('IgNar', 'SUPPORT', 'KR'),
      ],
    },
    {
      name: 'SK Gaming', short: 'SK', country: 'EU', strength: 2,
      roster: [
        P('Irrelevant', 'TOP', 'DE'),
        P('Markoon', 'JUNGLE', 'BE'),
        P('Nisqy', 'MID', 'BE', 'Yasin Dinçer'),
        P('Exakick', 'ADC', 'FR'),
        P('Doss', 'SUPPORT', 'SE'),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// LCS / LTA North — North America (Tier 1)
// ---------------------------------------------------------------------------
const LCS: RawLeague = {
  name: 'LCS',
  slug: 'lcs',
  region: 'North America',
  tier: 'tier1',
  season: '2025 Spring',
  format: 'double_round_robin_bo1',
  source_name: 'Leaguepedia',
  source_url: 'https://lol.fandom.com/wiki/LCS',
  presimulate: true,
  teams: [
    {
      name: 'Team Liquid', short: 'TL', country: 'US', strength: 5,
      roster: [
        P('Impact', 'TOP', 'KR', 'Jung Eon-young'),
        P('UmTi', 'JUNGLE', 'KR'),
        P('APA', 'MID', 'US', 'Eain Stearns'),
        P('Yeon', 'ADC', 'US', 'Sean Sung'),
        P('CoreJJ', 'SUPPORT', 'KR', 'Jo Yong-in', true),
      ],
    },
    {
      name: 'Cloud9', short: 'C9', country: 'US', strength: 5,
      roster: [
        P('Fudge', 'TOP', 'AU'),
        P('Blaber', 'JUNGLE', 'US', 'Robert Huang', true),
        P('Jojopyun', 'MID', 'CA', 'Joseph Joon Pyun'),
        P('Berserker', 'ADC', 'KR', 'Kim Min-cheol', true),
        P('Vulcan', 'SUPPORT', 'CA'),
      ],
    },
    {
      name: 'FlyQuest', short: 'FLY', country: 'US', strength: 4,
      roster: [
        P('Bwipo', 'TOP', 'BE', 'Gabriël Rau'),
        P('Inspired', 'JUNGLE', 'PL', 'Kacper Słoma', true),
        P('Quad', 'MID', 'KR'),
        P('Massu', 'ADC', 'CL'),
        P('Busio', 'SUPPORT', 'US'),
      ],
    },
    {
      name: '100 Thieves', short: '100', country: 'US', strength: 4,
      roster: [
        P('Sniper', 'TOP', 'US'),
        P('River', 'JUNGLE', 'KR'),
        P('Quid', 'MID', 'KR'),
        P('FBI', 'ADC', 'AU', 'Ian Huang'),
        P('Eyla', 'SUPPORT', 'US'),
      ],
    },
    {
      name: 'NRG', short: 'NRG', country: 'US', strength: 3,
      roster: [
        P('Dhokla', 'TOP', 'US'),
        P('Contractz', 'JUNGLE', 'US'),
        P('Palafox', 'MID', 'US'),
      ],
    },
    {
      name: 'Dignitas', short: 'DIG', country: 'US', strength: 2,
      roster: [
        P('Kingen', 'TOP', 'KR'),
        P('Spica', 'JUNGLE', 'US', 'Mingyi Lu'),
        P('Jensen', 'MID', 'DK', 'Nicolaj Jensen'),
      ],
    },
    {
      name: 'Immortals', short: 'IMT', country: 'US', strength: 2,
      roster: [
        P('Castle', 'TOP', 'US'),
        P('Kenvi', 'JUNGLE', 'VN'),
        P('PowerOfEvil', 'MID', 'DE', 'Tristan Schrage'),
        P('Tactical', 'ADC', 'US'),
      ],
    },
    {
      name: 'Shopify Rebellion', short: 'SR', country: 'US', strength: 2,
      roster: [
        P('FakeGod', 'TOP', 'US'),
        P('Bugi', 'JUNGLE', 'KR'),
        P('Insanity', 'MID', 'US'),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// LPL — China (Tier 1)
// ---------------------------------------------------------------------------
const LPL: RawLeague = {
  name: 'LPL',
  slug: 'lpl',
  region: 'China',
  tier: 'tier1',
  season: '2025 Spring',
  format: 'bo3_regular_season',
  source_name: 'Leaguepedia',
  source_url: 'https://lol.fandom.com/wiki/LPL',
  presimulate: true,
  teams: [
    {
      name: 'Bilibili Gaming', short: 'BLG', country: 'CN', strength: 5,
      roster: [
        P('Bin', 'TOP', 'CN', 'Chen Ze-bin', true),
        P('Xun', 'JUNGLE', 'CN'),
        P('Knight', 'MID', 'CN', 'Zhuo Ding', true),
        P('Elk', 'ADC', 'CN', 'Zhao Jia-hao', true),
        P('ON', 'SUPPORT', 'CN'),
      ],
    },
    {
      name: 'Top Esports', short: 'TES', country: 'CN', strength: 5,
      roster: [
        P('Wayward', 'TOP', 'CN'),
        P('Tian', 'JUNGLE', 'CN', 'Gao Tian-liang'),
        P('Creme', 'MID', 'CN'),
        P('JackeyLove', 'ADC', 'CN', 'Yu Wen-bo', true),
        P('Meiko', 'SUPPORT', 'CN', 'Tian Ye', true),
      ],
    },
    {
      name: 'JD Gaming', short: 'JDG', country: 'CN', strength: 4,
      roster: [
        P('369', 'TOP', 'CN', 'Bai Jia-hao'),
        P('Kanavi', 'JUNGLE', 'KR', 'Seo Jin-hyeok', true),
      ],
    },
    {
      name: 'LNG Esports', short: 'LNG', country: 'CN', strength: 4,
      roster: [
        P('Zika', 'TOP', 'CN'),
        P('Tarzan', 'JUNGLE', 'KR', 'Lee Seung-yong', true),
        P('Scout', 'MID', 'KR', 'Lee Ye-chan', true),
        P('GALA', 'ADC', 'CN', 'Chen Wei', true),
        P('Hang', 'SUPPORT', 'CN'),
      ],
    },
    {
      name: 'Weibo Gaming', short: 'WBG', country: 'CN', strength: 4,
      roster: [
        P('TheShy', 'TOP', 'KR', 'Kang Seung-lok', true),
        P('Karsa', 'JUNGLE', 'TW', 'Hung Hao-hsuan'),
        P('Xiaohu', 'MID', 'CN', 'Li Yuan-hao', true),
        P('Light', 'ADC', 'CN'),
        P('Crisp', 'SUPPORT', 'CN'),
      ],
    },
    {
      name: 'EDward Gaming', short: 'EDG', country: 'CN', strength: 3,
      roster: [
        P('Flandre', 'TOP', 'CN'),
        P('Jiejie', 'JUNGLE', 'CN'),
        P('FoFo', 'MID', 'TW'),
        P('Leave', 'ADC', 'CN'),
        P('Wink', 'SUPPORT', 'CN'),
      ],
    },
    {
      name: 'Royal Never Give Up', short: 'RNG', country: 'CN', strength: 3,
      roster: [
        P('Breathe', 'TOP', 'CN'),
        P('Wei', 'JUNGLE', 'CN'),
        P('Tangyuan', 'MID', 'CN'),
      ],
    },
    {
      name: 'FunPlus Phoenix', short: 'FPX', country: 'CN', strength: 3,
      roster: [
        P('xiaolaohu', 'TOP', 'CN'),
        P('Milkyway', 'JUNGLE', 'CN'),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// CBLOL — Brazil (Tier 1 region)
// ---------------------------------------------------------------------------
const CBLOL: RawLeague = {
  name: 'CBLOL',
  slug: 'cblol',
  region: 'Brazil',
  tier: 'tier1',
  season: '2025 Split 1',
  format: 'double_round_robin_bo1',
  source_name: 'Leaguepedia',
  source_url: 'https://lol.fandom.com/wiki/CBLOL',
  presimulate: true,
  teams: [
    {
      name: 'LOUD', short: 'LOUD', country: 'BR', strength: 4,
      roster: [
        P('Robo', 'TOP', 'BR'),
        P('Shini', 'JUNGLE', 'BR'),
        P('Tinowns', 'MID', 'BR', 'Thiago Sartori', true),
        P('Route', 'ADC', 'BR'),
        P('RedBert', 'SUPPORT', 'BR'),
      ],
    },
    {
      name: 'paiN Gaming', short: 'PNG', country: 'BR', strength: 4,
      roster: [
        P('Wizer', 'TOP', 'BR'),
        P('CarioK', 'JUNGLE', 'BR'),
        P('Roamer', 'MID', 'BR'),
        P('TitaN', 'ADC', 'BR', 'Alexandre Lima', true),
        P('Kuri', 'SUPPORT', 'BR'),
      ],
    },
    {
      name: 'RED Canids', short: 'RED', country: 'BR', strength: 3,
      roster: [
        P('Guigo', 'TOP', 'BR'),
        P('Aegis', 'JUNGLE', 'BR'),
        P('Grevthar', 'MID', 'BR'),
        P('Brance', 'ADC', 'BR'),
        P('frosty', 'SUPPORT', 'BR'),
      ],
    },
    {
      name: 'FURIA', short: 'FUR', country: 'BR', strength: 3,
      roster: [
        P('Marvin', 'TOP', 'BR'),
        P('Tatu', 'JUNGLE', 'BR'),
        P('Tutsz', 'MID', 'BR'),
        P('Ayu', 'ADC', 'BR'),
        P('JoJo', 'SUPPORT', 'BR'),
      ],
    },
    { name: 'Vivo Keyd Stalons', short: 'VKS', country: 'BR', strength: 2, roster: [P('Boal', 'TOP', 'BR')] },
    { name: 'Fluxo', short: 'FLX', country: 'BR', strength: 2, roster: [P('Hauz', 'TOP', 'BR')] },
    { name: 'Los Grandes', short: 'LOS', country: 'BR', strength: 1, roster: [] },
    { name: 'Corinthians', short: 'COR', country: 'BR', strength: 1, roster: [] },
  ],
};

// ---------------------------------------------------------------------------
// LCK Challengers League — Korea (Tier 2 / academy) — fully generated rosters
// ---------------------------------------------------------------------------
const LCK_CL: RawLeague = {
  name: 'LCK Challengers League',
  slug: 'lck-cl',
  region: 'Korea',
  tier: 'tier2',
  season: '2025 Spring',
  format: 'single_round_robin_bo1',
  source_name: 'Leaguepedia',
  source_url: 'https://lol.fandom.com/wiki/LCK_Challengers_League',
  generateRosters: true,
  presimulate: true,
  teams: [
    { name: 'T1 Esports Academy', short: 'T1A', country: 'KR', strength: 3 },
    { name: 'Gen.G Global Academy', short: 'GENA', country: 'KR', strength: 3 },
    { name: 'Hanwha Life Challengers', short: 'HLEC', country: 'KR', strength: 2 },
    { name: 'Dplus KIA Challengers', short: 'DKC', country: 'KR', strength: 2 },
    { name: 'KT Rolster Challengers', short: 'KTC', country: 'KR', strength: 2 },
    { name: 'Nongshim Academy', short: 'NSA', country: 'KR', strength: 2 },
    { name: 'BNK FEARX Youth', short: 'FOXY', country: 'KR', strength: 1 },
    { name: 'DRX Challengers', short: 'DRXC', country: 'KR', strength: 1 },
    { name: 'OKBRION Challengers', short: 'BROC', country: 'KR', strength: 1 },
    { name: 'KDF Challengers', short: 'KDFC', country: 'KR', strength: 1 },
  ],
};

// ---------------------------------------------------------------------------
// International events — team shells (real names + region + strength).
// Rosters are generated so player/market pages aren't empty; fully editable.
// ---------------------------------------------------------------------------
const WORLDS: RawLeague = {
  name: 'Worlds 2025',
  slug: 'worlds-2025',
  region: 'International',
  tier: 'international',
  season: '2025',
  format: 'worlds',
  source_name: 'LoL Esports',
  source_url: 'https://lolesports.com',
  generateRosters: true,
  presimulate: true, // simulates the group stage only; knockout left for the user
  teams: [
    { name: 'T1', short: 'T1', country: 'KR', strength: 5 },
    { name: 'Gen.G', short: 'GEN', country: 'KR', strength: 5 },
    { name: 'Hanwha Life Esports', short: 'HLE', country: 'KR', strength: 5 },
    { name: 'Dplus KIA', short: 'DK', country: 'KR', strength: 4 },
    { name: 'Bilibili Gaming', short: 'BLG', country: 'CN', strength: 5 },
    { name: 'Top Esports', short: 'TES', country: 'CN', strength: 4 },
    { name: 'LNG Esports', short: 'LNG', country: 'CN', strength: 4 },
    { name: 'Weibo Gaming', short: 'WBG', country: 'CN', strength: 4 },
    { name: 'G2 Esports', short: 'G2', country: 'EU', strength: 4 },
    { name: 'Fnatic', short: 'FNC', country: 'EU', strength: 3 },
    { name: 'MAD Lions KOI', short: 'MDK', country: 'EU', strength: 3 },
    { name: 'Team Liquid', short: 'TL', country: 'US', strength: 3 },
    { name: 'FlyQuest', short: 'FLY', country: 'US', strength: 3 },
    { name: 'PSG Talon', short: 'PSG', country: 'TW', strength: 3 },
    { name: 'GAM Esports', short: 'GAM', country: 'VN', strength: 2 },
    { name: 'Fukuoka SoftBank Hawks', short: 'SHG', country: 'JP', strength: 2 },
  ],
};

const MSI: RawLeague = {
  name: 'MSI 2025',
  slug: 'msi-2025',
  region: 'International',
  tier: 'international',
  season: '2025',
  format: 'msi',
  source_name: 'LoL Esports',
  source_url: 'https://lolesports.com',
  generateRosters: true,
  teams: [
    { name: 'Gen.G', short: 'GEN', country: 'KR', strength: 5 },
    { name: 'T1', short: 'T1', country: 'KR', strength: 5 },
    { name: 'Bilibili Gaming', short: 'BLG', country: 'CN', strength: 5 },
    { name: 'Top Esports', short: 'TES', country: 'CN', strength: 4 },
    { name: 'G2 Esports', short: 'G2', country: 'EU', strength: 4 },
    { name: 'Fnatic', short: 'FNC', country: 'EU', strength: 3 },
    { name: 'Team Liquid', short: 'TL', country: 'US', strength: 3 },
    { name: 'PSG Talon', short: 'PSG', country: 'TW', strength: 3 },
  ],
};

export const RAW_LEAGUES: RawLeague[] = [LCK, LPL, LEC, LCS, CBLOL, LCK_CL, WORLDS, MSI];

// Slugs featured on the landing page (in display order).
export const FEATURED_SLUGS = ['lck', 'lpl', 'lec', 'lcs', 'cblol', 'worlds-2025'];

// ---------------------------------------------------------------------------
// Name pools for generated players/coaches (region-flavored, gamer-tag style).
// ---------------------------------------------------------------------------
export const NICK_POOL: Record<string, string[]> = {
  KR: ['Haru', 'Bvyu', 'Ssol', 'Jelly', 'Karon', 'Vital', 'Punch', 'Nova', 'Ghost', 'Reignover', 'Solo', 'Cloud', 'Pyro', 'Frost', 'Lava', 'Onyx', 'Sera', 'Vex', 'Rookie2', 'Ppath'],
  CN: ['Shanji', 'Aki', 'Hope', 'Photic', 'Assum', 'Cube', 'Jiazhi', 'Yuekai', 'Qiuqiu', 'Ahn', 'Plex', 'Forge', 'Lyn', 'Wind', 'Hua', 'Zhuo', 'Kael', 'Mole', 'Sheng', 'Bo2'],
  EU: ['Vapor', 'Riku', 'Zoelys', 'Kamiloo', 'Velja', 'Maxlore', 'Lider', 'Sertuss', 'Nuc2', 'Crownie', 'Whitelotus', 'Tynx', 'Reeker', 'Skeanz', 'Vetha', 'Erny', 'Jiru', 'Kaori', 'Norskeren', 'Raptor2'],
  US: ['Quasar', 'Wildturtle', 'Diamond', 'Spawn', 'Akida', 'Tomio', 'Brandini', 'Solo2', 'Cody', 'Pridestalker', 'Tony', 'Zeyzal', 'Huni2', 'Niles', 'River2', 'Kez', 'Frost2', 'Maya', 'Vincent', 'Cloud2'],
  BR: ['Robac', 'Dynquedo', 'Goku', ' Misa', 'Cariök2', 'Drakehero', 'Ranger', 'Avenger', 'Damage', 'Netuno', 'Trigo', 'Croc', 'Bischop', 'Trymb', 'Minerva', 'Hauz2', 'Disamis', 'Drako', 'Wos', 'Tinow2'],
  INTL: ['Apex', 'Vortex', 'Nimbus', 'Echo', 'Zephyr', 'Karma', 'Specter', 'Halo', 'Pulse', 'Drift'],
};

export const COACH_NICK_POOL: Record<string, string[]> = {
  KR: ['Reapered', 'Edgar', 'Helper', 'Bengi', 'Comet', 'Yang', 'Moor', 'Roach'],
  CN: ['Homme', 'Tabe', 'Mafa', 'Heart', 'Aoi', 'Lvmao', 'Diandian', 'Steak'],
  EU: ['GrabbZ', 'YamatoCannon', 'Mac', 'Striker', 'Nightshare', 'Duke', 'Peter', 'Kaas'],
  US: ['Reignover', 'Inero', 'Dodo', 'Reapered2', 'Bahamut', 'LS', 'Mendo', 'Curry'],
  BR: ['Robust', 'YoonADog', 'abaxial', 'Hidrico', 'Maestro', 'Mclosz', 'Tockers', 'Profit'],
  INTL: ['Atlas', 'Sage', 'Mentor', 'Vision', 'Anchor'],
};

// First/last name pools for generated "real names" (lightweight, region-flavored).
export const REAL_NAME_POOL: Record<string, { first: string[]; last: string[] }> = {
  KR: { first: ['Min-jae', 'Seung-ho', 'Ji-hoon', 'Dong-hyun', 'Tae-yang', 'Hyun-woo', 'Sang-min', 'Jun-seo'], last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon'] },
  CN: { first: ['Wei', 'Hao', 'Jie', 'Yu', 'Tian', 'Long', 'Feng', 'Chen'], last: ['Zhang', 'Wang', 'Li', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao'] },
  EU: { first: ['Lucas', 'Marcin', 'Erik', 'Daniel', 'Tomás', 'Niklas', 'Pierre', 'Matteo'], last: ['Schmidt', 'Nowak', 'Andersson', 'Dubois', 'García', 'Rossi', 'Müller', 'Novák'] },
  US: { first: ['Jordan', 'Tyler', 'Brandon', 'Kevin', 'Ethan', 'Mason', 'Lucas', 'Noah'], last: ['Smith', 'Johnson', 'Nguyen', 'Lee', 'Garcia', 'Brown', 'Davis', 'Martin'] },
  BR: { first: ['Gabriel', 'Lucas', 'Matheus', 'Pedro', 'Felipe', 'Rafael', 'Bruno', 'Thiago'], last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Pereira', 'Almeida'] },
  INTL: { first: ['Alex', 'Sam', 'Chris', 'Jamie', 'Robin'], last: ['Carter', 'Reed', 'Stone', 'Hale', 'Cross'] },
};

export function poolKeyForCountry(cc: string): keyof typeof NICK_POOL {
  if (cc === 'KR') return 'KR';
  if (cc === 'CN' || cc === 'TW') return 'CN';
  if (cc === 'BR') return 'BR';
  if (cc === 'US' || cc === 'CA') return 'US';
  if (cc === 'VN' || cc === 'JP') return 'INTL';
  // Most EU codes
  if (['DE', 'FR', 'ES', 'SE', 'PL', 'CZ', 'BE', 'SI', 'HR', 'GR', 'RO', 'LT', 'BG', 'DK', 'IT', 'GB', 'NL', 'PT'].includes(cc)) return 'EU';
  return 'INTL';
}

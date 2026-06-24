import type { DataPack, DataPackOrganization, DataPackPlayer, DataPackRoster, DataPackTeam } from '@/lib/dataPacks/types';
import type { LeagueTier, ReputationMeta, Role } from '@/lib/types';

// ---------------------------------------------------------------------------
// Private LoL Esports Data Pack — V1 (broad catalog).
//
// FOR PRIVATE PROTOTYPE / FRIENDS USE ONLY. Not for public/commercial use.
//
// Reference: Liquipedia "Portal:Teams" (current active main-league teams) plus
// well-known historic, legacy and disbanded organizations. Team identities
// (name / short_name / region) are real. Rosters list verified player handles
// only where known; every other slot is auto-filled by the seed pipeline with a
// clearly-flagged generated player — no invented names. Logos are NOT bundled
// (initials fallback). See TEAM_CATALOG.md for the full catalog + TODOs.
//
// Historic teams carry `active: false` and keep their original region for
// context but are NEVER placed in current regional competitions — they are
// reserved for the nostalgia templates and custom tournaments.
// ---------------------------------------------------------------------------

const STAR = 4.6; // marquee verified player
const TOP1 = 4.3; // baseline tier 1 verified player

type Slot = { handle: string; role: Role; star?: boolean; rep?: ReputationMeta };
interface Org {
  id: string;
  name: string;
  short: string;
  region: string;
  country: string;
  tier: LeagueTier;
  active?: boolean; // default true; false = historic / legacy / disbanded
  color?: string;
  color2?: string; // secondary brand color
  legacy_label?: string; // nostalgia tag for historic/legacy orgs
  aliases?: string[]; // alternate / former names
  roster?: Slot[]; // verified players only; partial/empty is fine (auto-filled)
}

// Team ids with a bundled placeholder badge under /public/assets/teams/lol/.
// Missing entries fall back to the generated brand tile — nothing breaks.
const LOGO_IDS = new Set([
  't1', 'geng', 'hle', 'dk', 'kt', 'g2', 'fnc', 'kc', 'th', 'koi',
  'blg', 'jdg', 'tes', 'wbg', 'ig', 'c9', 'tl', 'fly', '100t',
  'loud', 'pain', 'furia', 'losratones', 'skt', 'ssg', 'fpx', 'tpa',
]);
const logoFor = (id: string): string | undefined =>
  LOGO_IDS.has(id) ? `/assets/teams/lol/${id}.svg` : undefined;

const REGIONS = [
  { id: 'na', name: 'North America', short_name: 'NA' },
  { id: 'sa', name: 'South America', short_name: 'SA' },
  { id: 'emea', name: 'EMEA', short_name: 'EMEA' },
  { id: 'china', name: 'China', short_name: 'CN' },
  { id: 'korea', name: 'Korea', short_name: 'KR' },
  { id: 'pacific', name: 'Pacific', short_name: 'PAC' },
] as const;

const REGION_COUNTRY: Record<string, string> = { na: 'US', sa: 'BR', emea: 'EU', china: 'CN', korea: 'KR', pacific: 'TW' };

const ORGS: Org[] = [
  // ======================= CURRENT TIER 1 (active) =======================
  // ---- North America (LCS / LTA North) ----
  { id: 'c9', name: 'Cloud9', short: 'C9', region: 'na', country: 'US', tier: 'tier1', color: '#00aeef', color2: '#0a0a0a', roster: [{ handle: 'Blaber', role: 'JUNGLE' }, { handle: 'Berserker', role: 'ADC' }] },
  { id: 'dig', name: 'Dignitas', short: 'DIG', region: 'na', country: 'US', tier: 'tier1', color: '#fae500' },
  { id: 'dsg', name: 'Disguised', short: 'DSG', region: 'na', country: 'US', tier: 'tier1' },
  { id: 'fly', name: 'FlyQuest', short: 'FLY', region: 'na', country: 'US', tier: 'tier1', color: '#1c8a3b', roster: [{ handle: 'Bwipo', role: 'TOP' }, { handle: 'Inspired', role: 'JUNGLE' }] },
  { id: 'lyon', name: 'LYON', short: 'LYON', region: 'na', country: 'US', tier: 'tier1' },
  { id: 'sen', name: 'Sentinels', short: 'SEN', region: 'na', country: 'US', tier: 'tier1', color: '#e3000b' },
  { id: 'sr', name: 'Shopify Rebellion', short: 'SR', region: 'na', country: 'US', tier: 'tier1', color: '#95bf47' },
  { id: 'tl', name: 'Team Liquid', short: 'TL', region: 'na', country: 'US', tier: 'tier1', color: '#0b1f3a', color2: '#1f6feb', roster: [{ handle: 'CoreJJ', role: 'SUPPORT', star: true, rep: { reputation: 'veteran', popularity: 80, variance_profile: 'stable' } }, { handle: 'APA', role: 'MID' }] },
  // ---- South America (CBLOL / LTA South) ----
  { id: 'fluxo', name: 'Fluxo W7M', short: 'FXW', region: 'sa', country: 'BR', tier: 'tier1', color: '#7c3aed' },
  { id: 'furia', name: 'FURIA', short: 'FUR', region: 'sa', country: 'BR', tier: 'tier1', color: '#000000' },
  { id: 'keyd', name: 'Keyd Stars', short: 'KEYD', region: 'sa', country: 'BR', tier: 'tier1' },
  { id: 'leviatan', name: 'Leviatán', short: 'LEV', region: 'sa', country: 'AR', tier: 'tier1' },
  { id: 'los', name: 'LOS', short: 'LOS', region: 'sa', country: 'CL', tier: 'tier1' },
  { id: 'loud', name: 'LOUD', short: 'LLL', region: 'sa', country: 'BR', tier: 'tier1', color: '#16c60c', roster: [{ handle: 'Croc', role: 'JUNGLE' }, { handle: 'tinowns', role: 'MID' }] },
  { id: 'pain', name: 'paiN Gaming', short: 'PNG', region: 'sa', country: 'BR', tier: 'tier1', color: '#e10600', roster: [{ handle: 'TitaN', role: 'ADC' }] },
  { id: 'red', name: 'RED Canids', short: 'RED', region: 'sa', country: 'BR', tier: 'tier1', color: '#d7282f' },
  // ---- EMEA (LEC) ----
  { id: 'fnc', name: 'Fnatic', short: 'FNC', region: 'emea', country: 'GB', tier: 'tier1', color: '#ff5800', color2: '#000000', roster: [{ handle: 'Razork', role: 'JUNGLE' }, { handle: 'Humanoid', role: 'MID' }] },
  { id: 'g2', name: 'G2 Esports', short: 'G2', region: 'emea', country: 'DE', tier: 'tier1', color: '#ee3a35', color2: '#000000', aliases: ['Gamers2'], roster: [{ handle: 'BrokenBlade', role: 'TOP' }, { handle: 'Yike', role: 'JUNGLE' }, { handle: 'Caps', role: 'MID', star: true, rep: { reputation: 'superstar', popularity: 90, legacy_status: 'fan_favorite' } }, { handle: 'HansSama', role: 'ADC' }, { handle: 'Mikyx', role: 'SUPPORT' }] },
  { id: 'gx', name: 'GIANTX', short: 'GX', region: 'emea', country: 'ES', tier: 'tier1' },
  { id: 'kc', name: 'Karmine Corp', short: 'KC', region: 'emea', country: 'FR', tier: 'tier1', color: '#1f9be1' },
  { id: 'koi', name: 'Movistar KOI', short: 'KOI', region: 'emea', country: 'ES', tier: 'tier1', color: '#19e08b', color2: '#0a0a0a', aliases: ['Rogue', 'KOI'] },
  { id: 'navi', name: 'Natus Vincere', short: 'NAVI', region: 'emea', country: 'UA', tier: 'tier1', color: '#ffe500' },
  { id: 'shifters', name: 'Shifters', short: 'SHF', region: 'emea', country: 'EU', tier: 'tier1' },
  { id: 'sk', name: 'SK Gaming', short: 'SK', region: 'emea', country: 'DE', tier: 'tier1' },
  { id: 'th', name: 'Team Heretics', short: 'TH', region: 'emea', country: 'ES', tier: 'tier1', color: '#11131a' },
  { id: 'vit', name: 'Team Vitality', short: 'VIT', region: 'emea', country: 'FR', tier: 'tier1', color: '#f8d800' },
  // ---- China (LPL) ----
  { id: 'al', name: "Anyone's Legend", short: 'AL', region: 'china', country: 'CN', tier: 'tier1' },
  { id: 'blg', name: 'Bilibili Gaming', short: 'BLG', region: 'china', country: 'CN', tier: 'tier1', color: '#22a0e6', color2: '#ff6699', roster: [{ handle: 'Bin', role: 'TOP', star: true, rep: { reputation: 'superstar', popularity: 85 } }, { handle: 'Xun', role: 'JUNGLE' }, { handle: 'Elk', role: 'ADC' }] },
  { id: 'edg', name: 'EDward Gaming', short: 'EDG', region: 'china', country: 'CN', tier: 'tier1', color: '#000000' },
  { id: 'ig', name: 'Invictus Gaming', short: 'IG', region: 'china', country: 'CN', tier: 'tier1' },
  { id: 'jdg', name: 'JD Gaming', short: 'JDG', region: 'china', country: 'CN', tier: 'tier1', color: '#c8102e', roster: [{ handle: '369', role: 'TOP' }, { handle: 'Kanavi', role: 'JUNGLE', star: true, rep: { reputation: 'star', popularity: 78, variance_profile: 'stable' } }] },
  { id: 'lgd', name: 'LGD Gaming', short: 'LGD', region: 'china', country: 'CN', tier: 'tier1' },
  { id: 'lng', name: 'LNG Esports', short: 'LNG', region: 'china', country: 'CN', tier: 'tier1', color: '#e60012', roster: [{ handle: 'Scout', role: 'MID', star: true, rep: { reputation: 'star', popularity: 76 } }] },
  { id: 'nip', name: 'Ninjas in Pyjamas', short: 'NIP', region: 'china', country: 'CN', tier: 'tier1' },
  { id: 'omg', name: 'Oh My God', short: 'OMG', region: 'china', country: 'CN', tier: 'tier1' },
  { id: 'rng', name: 'Royal Never Give Up', short: 'RNG', region: 'china', country: 'CN', tier: 'tier1', color: '#d4af37' },
  { id: 'we', name: 'Team WE', short: 'WE', region: 'china', country: 'CN', tier: 'tier1' },
  { id: 'ttg', name: 'ThunderTalk Gaming', short: 'TTG', region: 'china', country: 'CN', tier: 'tier1' },
  { id: 'tes', name: 'Top Esports', short: 'TES', region: 'china', country: 'CN', tier: 'tier1', color: '#d7282f', roster: [{ handle: 'JackeyLove', role: 'ADC', star: true, rep: { reputation: 'superstar', popularity: 88 } }] },
  { id: 'up', name: 'Ultra Prime', short: 'UP', region: 'china', country: 'CN', tier: 'tier1' },
  { id: 'wbg', name: 'Weibo Gaming', short: 'WBG', region: 'china', country: 'CN', tier: 'tier1', color: '#d4002a', roster: [{ handle: 'TheShy', role: 'TOP', star: true, rep: { reputation: 'star', popularity: 84, variance_profile: 'volatile' } }] },
  // ---- Korea (LCK) ----
  { id: 'brion', name: 'BRION', short: 'BRO', region: 'korea', country: 'KR', tier: 'tier1' },
  { id: 'dk', name: 'Dplus KIA', short: 'DK', region: 'korea', country: 'KR', tier: 'tier1', color: '#00aee6', color2: '#111111', aliases: ['DAMWON Gaming', 'DWG KIA'], roster: [{ handle: 'Kingen', role: 'TOP' }, { handle: 'Lucid', role: 'JUNGLE' }, { handle: 'ShowMaker', role: 'MID', star: true, rep: { reputation: 'superstar', popularity: 87 } }, { handle: 'Aiming', role: 'ADC' }, { handle: 'Kellin', role: 'SUPPORT' }] },
  { id: 'drx', name: 'DRX', short: 'DRX', region: 'korea', country: 'KR', tier: 'tier1', color: '#3b82f6' },
  { id: 'fearx', name: 'FEARX', short: 'FX', region: 'korea', country: 'KR', tier: 'tier1' },
  { id: 'geng', name: 'Gen.G', short: 'GEN', region: 'korea', country: 'KR', tier: 'tier1', color: '#aa8500', color2: '#000000', aliases: ['Samsung Galaxy', 'KSV'], roster: [{ handle: 'Kiin', role: 'TOP' }, { handle: 'Canyon', role: 'JUNGLE', star: true, rep: { reputation: 'superstar', popularity: 85, legacy_status: 'fan_favorite' } }, { handle: 'Chovy', role: 'MID', star: true, rep: { reputation: 'superstar', popularity: 89 } }, { handle: 'Peyz', role: 'ADC' }, { handle: 'Lehends', role: 'SUPPORT' }] },
  { id: 'hle', name: 'Hanwha Life Esports', short: 'HLE', region: 'korea', country: 'KR', tier: 'tier1', color: '#ff7a00', color2: '#0a0a0a', aliases: ['ROX Tigers lineage'], roster: [{ handle: 'Doran', role: 'TOP' }, { handle: 'Peanut', role: 'JUNGLE' }, { handle: 'Zeka', role: 'MID', star: true }, { handle: 'Viper', role: 'ADC', star: true, rep: { reputation: 'star', popularity: 80 } }, { handle: 'Delight', role: 'SUPPORT' }] },
  { id: 'kt', name: 'KT Rolster', short: 'KT', region: 'korea', country: 'KR', tier: 'tier1', color: '#e4002b', color2: '#000000', roster: [{ handle: 'PerfecT', role: 'TOP' }, { handle: 'Cuzz', role: 'JUNGLE' }, { handle: 'Bdd', role: 'MID' }, { handle: 'Deft', role: 'ADC', star: true, rep: { reputation: 'veteran', popularity: 86, legacy_status: 'fan_favorite' } }, { handle: 'BeryL', role: 'SUPPORT' }] },
  { id: 'ns', name: 'Nongshim RedForce', short: 'NS', region: 'korea', country: 'KR', tier: 'tier1' },
  { id: 'soop', name: 'SOOPers', short: 'SOP', region: 'korea', country: 'KR', tier: 'tier1' },
  { id: 't1', name: 'T1', short: 'T1', region: 'korea', country: 'KR', tier: 'tier1', color: '#e2012d', color2: '#000000', aliases: ['SK Telecom T1', 'SKT T1'], roster: [{ handle: 'Zeus', role: 'TOP' }, { handle: 'Oner', role: 'JUNGLE' }, { handle: 'Faker', role: 'MID', star: true, rep: { reputation: 'superstar', legacy_status: 'legend', popularity: 99, canon_rating_band: [94, 98], variance_profile: 'stable' } }, { handle: 'Gumayusi', role: 'ADC' }, { handle: 'Keria', role: 'SUPPORT', star: true }] },
  // ---- Pacific (LCP) ----
  { id: 'cfo', name: 'CTBC Flying Oyster', short: 'CFO', region: 'pacific', country: 'TW', tier: 'tier1', color: '#16a085' },
  { id: 'dcg', name: 'Deep Cross Gaming', short: 'DCG', region: 'pacific', country: 'TW', tier: 'tier1' },
  { id: 'dfm', name: 'DetonatioN FocusMe', short: 'DFM', region: 'pacific', country: 'JP', tier: 'tier1', color: '#e60012' },
  { id: 'sbh', name: 'SoftBank HAWKS gaming', short: 'SHG', region: 'pacific', country: 'JP', tier: 'tier1' },
  { id: 'gam', name: 'GAM Esports', short: 'GAM', region: 'pacific', country: 'VN', tier: 'tier1', color: '#b30000', roster: [{ handle: 'Levi', role: 'JUNGLE', star: true, rep: { reputation: 'veteran', popularity: 72, legacy_status: 'fan_favorite' } }] },
  { id: 'gzg', name: 'Ground Zero Gaming', short: 'GZG', region: 'pacific', country: 'AU', tier: 'tier1' },
  { id: 'mvk', name: 'MVK Esports', short: 'MVK', region: 'pacific', country: 'VN', tier: 'tier1' },
  { id: 'secret', name: 'Secret Whales', short: 'SW', region: 'pacific', country: 'VN', tier: 'tier1' },

  // ===================== TIER 2 / ACADEMY (active) =====================
  // ---- NACL (North America Challengers) ----
  { id: 'nacl-apex', name: 'Apex Mission Impossible', short: 'AMI', region: 'na', country: 'US', tier: 'tier2' },
  { id: 'nacl-blueotter', name: 'Blue Otter', short: 'BO', region: 'na', country: 'US', tier: 'tier2' },
  { id: 'nacl-ccg', name: 'CCG Esports', short: 'CCG', region: 'na', country: 'US', tier: 'tier2' },
  { id: 'nacl-citadel', name: 'Citadel Gaming', short: 'CIT', region: 'na', country: 'US', tier: 'tier2' },
  { id: 'nacl-conviction', name: 'Conviction', short: 'CNV', region: 'na', country: 'US', tier: 'tier2' },
  { id: 'nacl-dorado', name: 'Dorado Gaming', short: 'DOR', region: 'na', country: 'US', tier: 'tier2' },
  { id: 'nacl-maryville', name: 'Maryville University', short: 'MARY', region: 'na', country: 'US', tier: 'tier2' },
  { id: 'nacl-nrg', name: 'NRG', short: 'NRG', region: 'na', country: 'US', tier: 'tier2', color: '#ff5100' },
  { id: 'nacl-supernova', name: 'Supernova', short: 'SNV', region: 'na', country: 'US', tier: 'tier2' },
  { id: 'nacl-winthrop', name: 'Winthrop University', short: 'WIN', region: 'na', country: 'US', tier: 'tier2' },
  // ---- LCK Challengers League (Korea academies) ----
  { id: 'cl-brion', name: 'BRION Challengers', short: 'BRC', region: 'korea', country: 'KR', tier: 'tier2' },
  { id: 'cl-dplus', name: 'Dplus Challengers', short: 'DKC', region: 'korea', country: 'KR', tier: 'tier2' },
  { id: 'cl-drx', name: 'DRX Challengers', short: 'DRC', region: 'korea', country: 'KR', tier: 'tier2' },
  { id: 'cl-fearx', name: 'FEARX Youth', short: 'FXY', region: 'korea', country: 'KR', tier: 'tier2' },
  { id: 'cl-geng', name: 'Gen.G Global Academy', short: 'GGA', region: 'korea', country: 'KR', tier: 'tier2' },
  { id: 'cl-hle', name: 'HLE Challengers', short: 'HLC', region: 'korea', country: 'KR', tier: 'tier2' },
  { id: 'cl-kt', name: 'KT Rolster Challengers', short: 'KTC', region: 'korea', country: 'KR', tier: 'tier2' },
  { id: 'cl-ns', name: 'Nongshim Challengers', short: 'NSC', region: 'korea', country: 'KR', tier: 'tier2' },
  { id: 'cl-soop', name: 'SOOPers Challengers', short: 'SPC', region: 'korea', country: 'KR', tier: 'tier2' },
  { id: 'cl-t1', name: 'T1 Esports Academy', short: 'T1A', region: 'korea', country: 'KR', tier: 'tier2' },

  // ============ HISTORIC / LEGACY / DISBANDED (inactive) ============
  // ---- North America ----
  { id: 'tsm', name: 'TSM', short: 'TSM', region: 'na', country: 'US', tier: 'tier1', active: false, color: '#000000' },
  { id: 'clg', name: 'Counter Logic Gaming', short: 'CLG', region: 'na', country: 'US', tier: 'tier1', active: false, color: '#0033a0' },
  { id: 'optic', name: 'OpTic Gaming', short: 'OPT', region: 'na', country: 'US', tier: 'tier1', active: false, color: '#92d127' },
  { id: 'eg', name: 'Evil Geniuses', short: 'EG', region: 'na', country: 'US', tier: 'tier1', active: false, color: '#005bbb' },
  { id: 'ggs', name: 'Golden Guardians', short: 'GGS', region: 'na', country: 'US', tier: 'tier1', active: false, color: '#bfa14a' },
  { id: 'imt', name: 'Immortals', short: 'IMT', region: 'na', country: 'US', tier: 'tier1', active: false, color: '#1f2a44' },
  { id: 'echofox', name: 'Echo Fox', short: 'FOX', region: 'na', country: 'US', tier: 'tier1', active: false },
  { id: 'envyus', name: 'Team EnVyUs', short: 'NV', region: 'na', country: 'US', tier: 'tier1', active: false },
  { id: 'complexity', name: 'compLexity Gaming', short: 'COL', region: 'na', country: 'US', tier: 'tier1', active: false },
  { id: '100t', name: '100 Thieves', short: '100', region: 'na', country: 'US', tier: 'tier1', active: false, color: '#e3000b' },
  // ---- EMEA ----
  { id: 'origen', name: 'Origen', short: 'OG', region: 'emea', country: 'ES', tier: 'tier1', active: false },
  { id: 'splyce', name: 'Splyce', short: 'SPY', region: 'emea', country: 'GB', tier: 'tier1', active: false },
  { id: 'misfits', name: 'Misfits Gaming', short: 'MSF', region: 'emea', country: 'FR', tier: 'tier1', active: false, color: '#ffd200' },
  { id: 'h2k', name: 'H2k Gaming', short: 'H2K', region: 'emea', country: 'GB', tier: 'tier1', active: false },
  { id: 'gambit', name: 'Gambit Esports', short: 'GMB', region: 'emea', country: 'RU', tier: 'tier1', active: false },
  { id: 'uol', name: 'Unicorns of Love', short: 'UOL', region: 'emea', country: 'DE', tier: 'tier1', active: false, color: '#ff69b4' },
  { id: 'alliance', name: 'Alliance', short: 'ALL', region: 'emea', country: 'SE', tier: 'tier1', active: false },
  { id: 'schalke', name: 'FC Schalke 04 Esports', short: 'S04', region: 'emea', country: 'DE', tier: 'tier1', active: false, color: '#0a4ea2' },
  { id: 'madlions', name: 'MAD Lions', short: 'MAD', region: 'emea', country: 'ES', tier: 'tier1', active: false },
  { id: 'excel', name: 'Excel Esports', short: 'XL', region: 'emea', country: 'GB', tier: 'tier1', active: false },
  { id: 'm5', name: 'Moscow Five', short: 'M5', region: 'emea', country: 'RU', tier: 'tier1', active: false },
  // ---- Korea ----
  { id: 'skt', name: 'SK Telecom T1', short: 'SKT', region: 'korea', country: 'KR', tier: 'tier1', active: false, color: '#e2012d', legacy_label: '3× World Champion dynasty' },
  { id: 'ssg', name: 'Samsung Galaxy', short: 'SSG', region: 'korea', country: 'KR', tier: 'tier1', active: false, color: '#1428a0', legacy_label: 'Worlds 2017 champion' },
  { id: 'kootigers', name: 'KOO Tigers', short: 'KOO', region: 'korea', country: 'KR', tier: 'tier1', active: false },
  { id: 'longzhu', name: 'Longzhu Gaming', short: 'LZ', region: 'korea', country: 'KR', tier: 'tier1', active: false },
  { id: 'griffin', name: 'Griffin', short: 'GRF', region: 'korea', country: 'KR', tier: 'tier1', active: false },
  { id: 'roxtigers', name: 'ROX Tigers', short: 'ROX', region: 'korea', country: 'KR', tier: 'tier1', active: false },
  { id: 'cjentus', name: 'CJ Entus', short: 'CJ', region: 'korea', country: 'KR', tier: 'tier1', active: false },
  { id: 'najin', name: 'NaJin e-mFire', short: 'NJ', region: 'korea', country: 'KR', tier: 'tier1', active: false },
  { id: 'jinair', name: 'Jin Air Green Wings', short: 'JAG', region: 'korea', country: 'KR', tier: 'tier1', active: false },
  // ---- China ----
  { id: 'royalclub', name: 'Royal Club', short: 'RC', region: 'china', country: 'CN', tier: 'tier1', active: false },
  { id: 'snake', name: 'Snake Esports', short: 'SS', region: 'china', country: 'CN', tier: 'tier1', active: false },
  { id: 'vici', name: 'Vici Gaming', short: 'VG', region: 'china', country: 'CN', tier: 'tier1', active: false },
  { id: 'newbee', name: 'Newbee', short: 'NB', region: 'china', country: 'CN', tier: 'tier1', active: false },
  { id: 'suning', name: 'Suning', short: 'SN', region: 'china', country: 'CN', tier: 'tier1', active: false },
  // ---- Pacific ----
  { id: 'tpa', name: 'Taipei Assassins', short: 'TPA', region: 'pacific', country: 'TW', tier: 'tier1', active: false, legacy_label: 'Worlds 2012 champion' },
  { id: 'flashwolves', name: 'Flash Wolves', short: 'FW', region: 'pacific', country: 'TW', tier: 'tier1', active: false },
  { id: 'ahq', name: 'ahq e-Sports Club', short: 'AHQ', region: 'pacific', country: 'TW', tier: 'tier1', active: false },
  { id: 'albusnox', name: 'Albus NoX Luna', short: 'ANX', region: 'pacific', country: 'RU', tier: 'tier1', active: false },

  // ----- Missing-teams pass: additional notable / legacy / regional orgs -----
  // EMEA
  { id: 'losratones', name: 'Los Ratones', short: 'LR', region: 'emea', country: 'GB', tier: 'erl', active: false, color: '#f4c430' }, // NLC; founded 2024 by Caedrel, disbanded Feb 2026
  { id: 'rogue', name: 'Rogue', short: 'RGE', region: 'emea', country: 'FR', tier: 'tier1', active: false, color: '#0a7d2c' }, // legacy → KOI lineage
  { id: 'giants', name: 'Giants Gaming', short: 'GIA', region: 'emea', country: 'ES', tier: 'tier1', active: false }, // Vodafone Giants; merged into GIANTX
  { id: 'aaa', name: 'against All authority', short: 'AAA', region: 'emea', country: 'FR', tier: 'tier1', active: false }, // Season 1/2 era
  { id: 'copenhagenwolves', name: 'Copenhagen Wolves', short: 'CW', region: 'emea', country: 'DK', tier: 'tier1', active: false },
  // Korea
  { id: 'samsungwhite', name: 'Samsung Galaxy White', short: 'SSW', region: 'korea', country: 'KR', tier: 'tier1', active: false }, // Worlds 2014 champions
  { id: 'samsungblue', name: 'Samsung Galaxy Blue', short: 'SSB', region: 'korea', country: 'KR', tier: 'tier1', active: false },
  { id: 'azubufrost', name: 'Azubu Frost', short: 'AZF', region: 'korea', country: 'KR', tier: 'tier1', active: false }, // → CJ Entus Frost
  { id: 'mvpozone', name: 'MVP Ozone', short: 'OZ', region: 'korea', country: 'KR', tier: 'tier1', active: false },
  { id: 'afreeca', name: 'Afreeca Freecs', short: 'AF', region: 'korea', country: 'KR', tier: 'tier1', active: false }, // → Kwangdong Freecs
  { id: 'incrediblemiracle', name: 'Incredible Miracle', short: 'IM', region: 'korea', country: 'KR', tier: 'tier1', active: false },
  // China
  { id: 'fpx', name: 'FunPlus Phoenix', short: 'FPX', region: 'china', country: 'CN', tier: 'tier1', active: false, color: '#e4002b', legacy_label: 'Worlds 2019 champion' }, // Worlds 2019 champions
  // North America
  { id: 'curse', name: 'Team Curse', short: 'CRS', region: 'na', country: 'US', tier: 'tier1', active: false },
  // South America
  { id: 'kabum', name: 'KaBuM! e-Sports', short: 'KBM', region: 'sa', country: 'BR', tier: 'regional', active: false }, // Worlds 2014 wildcard
  { id: 'intz', name: 'INTZ e-Sports', short: 'ITZ', region: 'sa', country: 'BR', tier: 'regional', active: false },
  // Pacific / wildcard
  { id: 'saigonjokers', name: 'Saigon Jokers', short: 'SAJ', region: 'pacific', country: 'VN', tier: 'regional', active: false },
  { id: 'bangkoktitans', name: 'Bangkok Titans', short: 'BKT', region: 'pacific', country: 'TH', tier: 'regional', active: false },
  { id: 'direwolves', name: 'Dire Wolves', short: 'DW', region: 'pacific', country: 'AU', tier: 'regional', active: false },
  { id: 'chiefs', name: 'Chiefs Esports Club', short: 'CHF', region: 'pacific', country: 'AU', tier: 'regional', active: false },
];

// --- de-dupe guard: slug must be unique --------------------------------------
const slug = (o: Org) => o.id.trim();
const pid = (orgId: string, handle: string) => `p-${orgId.trim()}-${handle.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

const colorsOf = (o: Org) => (o.color || o.color2 ? { primary: o.color, secondary: o.color2 } : undefined);
const ASSET_CREDIT = 'Placeholder badge (brand color + initials). Replace with licensed artwork.';

const organizations: DataPackOrganization[] = ORGS.map((o) => ({
  id: `org-${slug(o)}`,
  name: o.name,
  short_name: o.short,
  region_id: o.region,
  logo: logoFor(o.id),
  colors: colorsOf(o),
  aliases: o.aliases,
  active: o.active ?? true,
}));

const teams: DataPackTeam[] = ORGS.map((o) => ({
  id: `t-${slug(o)}`,
  organization_id: `org-${slug(o)}`,
  name: o.name,
  short_name: o.short,
  region_id: o.region,
  tier: o.tier,
  logo: logoFor(o.id),
  colors: colorsOf(o),
  aliases: o.aliases,
  asset_credit: logoFor(o.id) ? ASSET_CREDIT : undefined,
  asset_source_label: logoFor(o.id) ? 'Bundled placeholder' : undefined,
  active: o.active ?? true,
  legacy_label: o.legacy_label ?? null,
}));

const players: DataPackPlayer[] = ORGS.flatMap((o) =>
  (o.roster ?? []).map((s) => ({
    id: pid(slug(o), s.handle),
    handle: s.handle,
    role: s.role,
    nationality: o.country || REGION_COUNTRY[o.region],
    strength: s.star ? STAR : TOP1,
    star: s.star,
    active: true,
    reputation: s.rep,
  })),
);

const rosters: DataPackRoster[] = ORGS
  .filter((o) => (o.roster?.length ?? 0) > 0)
  .map((o) => ({
    team_id: `t-${slug(o)}`,
    season: '2025',
    starters: (o.roster ?? []).map((s) => ({ player_id: pid(slug(o), s.handle), role: s.role })),
  }));

const tid = (s: string) => `t-${s}`;
const currentIn = (region: string) => ORGS.filter((o) => o.region === region && o.tier === 'tier1' && (o.active ?? true)).map((o) => tid(o.id));
const tier2In = (ids: string[]) => ids.map(tid);

export const LOL_ESPORTS_PRIVATE_V1: DataPack = {
  id: 'lol-esports-private-v1',
  name: 'LoL Esports (Private V1)',
  game: 'lol',
  season: '2025',
  version: '2.0.0',
  author: 'Private',
  source: 'https://liquipedia.net/leagueoflegends/Portal:Teams',
  description: 'Private LoL esports catalog: current Tier 1 teams across all major regions, Tier 2/academy examples, and historic/legacy/disbanded orgs (for nostalgia templates). Real team identities; verified rosters where known, rest auto-filled. Initials logos. See TEAM_CATALOG.md.',
  regions: REGIONS.map((r) => ({ id: r.id, name: r.name, short_name: r.short_name })),
  organizations,
  teams,
  players,
  rosters,
  competitions: [
    // Current regional Tier 1
    { id: 'comp-na', name: 'North America (LCS/LTA-N)', region_id: 'na', tier: 'tier1', format: 'double_round_robin_bo1', season: '2025', team_ids: currentIn('na') },
    { id: 'comp-sa', name: 'South America (CBLOL/LTA-S)', region_id: 'sa', tier: 'tier1', format: 'double_round_robin_bo1', season: '2025', team_ids: currentIn('sa') },
    { id: 'comp-emea', name: 'EMEA (LEC)', region_id: 'emea', tier: 'tier1', format: 'double_round_robin_bo1', season: '2025', team_ids: currentIn('emea') },
    { id: 'comp-china', name: 'China (LPL)', region_id: 'china', tier: 'tier1', format: 'double_round_robin_bo1', season: '2025', team_ids: currentIn('china') },
    { id: 'comp-korea', name: 'Korea (LCK)', region_id: 'korea', tier: 'tier1', format: 'double_round_robin_bo1', season: '2025', team_ids: currentIn('korea') },
    { id: 'comp-pacific', name: 'Pacific (LCP)', region_id: 'pacific', tier: 'tier1', format: 'double_round_robin_bo1', season: '2025', team_ids: currentIn('pacific') },
    // Tier 2 / academy examples
    { id: 'comp-lck-cl', name: 'LCK Challengers League', region_id: 'korea', tier: 'tier2', format: 'double_round_robin_bo1', season: '2025', team_ids: tier2In(['cl-brion', 'cl-dplus', 'cl-drx', 'cl-fearx', 'cl-geng', 'cl-hle', 'cl-kt', 'cl-ns', 'cl-soop', 'cl-t1']) },
    { id: 'comp-nacl', name: 'NACL (NA Challengers)', region_id: 'na', tier: 'tier2', format: 'single_round_robin_bo1', season: '2025', team_ids: tier2In(['nacl-apex', 'nacl-blueotter', 'nacl-ccg', 'nacl-citadel', 'nacl-conviction', 'nacl-dorado', 'nacl-maryville', 'nacl-nrg', 'nacl-supernova', 'nacl-winthrop']) },
    // Cross-region testing template
    { id: 'comp-tier1-global', name: 'Tier 1 Global', tier: 'international', format: 'groups_playoffs', season: '2025', team_ids: tier2In(['t1', 'geng', 'jdg', 'blg', 'g2', 'fnc', 'c9', 'gam']) },
    // Nostalgia / historic templates (generated rosters — no real players invented)
    { id: 'comp-historic-legends', name: 'Historic Legends Cup', tier: 'international', format: 'single_elim', season: 'All-Time', team_ids: tier2In(['skt', 'ssg', 'tpa', 'flashwolves', 'tsm', 'clg', 'origen', 'gambit']) },
    { id: 'comp-disbanded-cup', name: 'Disbanded Teams Cup', tier: 'international', format: 'double_round_robin_bo1', season: 'All-Time', team_ids: tier2In(['misfits', 'splyce', 'h2k', 'eg', 'optic', 'echofox', 'imt', 'roxtigers']) },
    { id: 'comp-alltime-invitational', name: 'Global All-Time Invitational', tier: 'international', format: 'groups_playoffs', season: 'All-Time', team_ids: tier2In(['t1', 'skt', 'ssg', 'geng', 'fnc', 'g2', 'tsm', 'rng']) },
    // Templates surfacing the newly added legacy/regional orgs (existing comps unchanged)
    { id: 'comp-eu-legends', name: 'EU Legends Cup', tier: 'international', format: 'single_elim', season: 'All-Time', team_ids: tier2In(['losratones', 'rogue', 'giants', 'aaa', 'copenhagenwolves', 'origen', 'misfits', 'gambit']) },
    { id: 'comp-worlds-throwback', name: 'Worlds Throwback', tier: 'international', format: 'groups_playoffs', season: 'All-Time', team_ids: tier2In(['samsungwhite', 'samsungblue', 'azubufrost', 'afreeca', 'fpx', 'kabum', 'tpa', 'skt']) },
    { id: 'comp-alltime-wildcards', name: 'All-Time Wildcards', tier: 'international', format: 'double_round_robin_bo1', season: 'All-Time', team_ids: tier2In(['saigonjokers', 'bangkoktitans', 'direwolves', 'chiefs', 'intz', 'mvpozone', 'incrediblemiracle', 'curse']) },
  ],
};

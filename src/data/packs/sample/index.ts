import type { DataPack } from '@/lib/dataPacks/types';

// ---------------------------------------------------------------------------
// Sample data pack — fictional & safe.
//
// Proves the data pack pipeline end to end without any real/copyrighted teams,
// players or logos. Two regions, six teams (Tier 1 + Tier 2) and two
// competitions. Logos are mostly omitted so the UI falls back to generated
// initials; one team points at a bundled placeholder SVG to exercise the
// local-asset path. Real LoL esports packs (LCK/LPL/LEC/…) can follow this same
// shape as a private pack later.
// ---------------------------------------------------------------------------

export const SAMPLE_PACK: DataPack = {
  id: 'sample-rift-2025',
  name: 'Sample Rift Circuit',
  game: 'lol',
  season: '2025',
  version: '1.0.0',
  author: 'Community Sample',
  description: 'A small fictional two-region scene used to demonstrate data pack imports.',
  regions: [
    { id: 'pcr', name: 'Pacific Rift', short_name: 'PCR', tier: 'tier1' },
    { id: 'atr', name: 'Atlantic Rift', short_name: 'ATR', tier: 'tier1' },
  ],
  organizations: [
    { id: 'org-aurora', name: 'Aurora Esports', short_name: 'AUR', region_id: 'pcr', logo: '/assets/packs/sample/aurora.svg', colors: { primary: '#26d0ce', secondary: '#0f2747' } },
    { id: 'org-crimson', name: 'Crimson Tide', short_name: 'CRT', region_id: 'pcr', colors: { primary: '#ef4444' } },
    { id: 'org-nova', name: 'Nova Collective', short_name: 'NVA', region_id: 'atr', colors: { primary: '#8b5cf6' } },
    { id: 'org-iron', name: 'Iron Wolves', short_name: 'IRW', region_id: 'atr', colors: { primary: '#64748b' } },
    { id: 'org-pacacad', name: 'Pacific Academy', short_name: 'PAC', region_id: 'pcr', colors: { primary: '#22c55e' } },
    { id: 'org-atlacad', name: 'Atlantic Academy', short_name: 'ATA', region_id: 'atr', colors: { primary: '#c8a85a' } },
  ],
  teams: [
    { id: 't-aurora', organization_id: 'org-aurora', name: 'Aurora Esports', short_name: 'AUR', region_id: 'pcr', tier: 'tier1', logo: '/assets/packs/sample/aurora.svg', active: true },
    { id: 't-crimson', organization_id: 'org-crimson', name: 'Crimson Tide', short_name: 'CRT', region_id: 'pcr', tier: 'tier1', active: true },
    { id: 't-nova', organization_id: 'org-nova', name: 'Nova Collective', short_name: 'NVA', region_id: 'atr', tier: 'tier1', active: true },
    { id: 't-iron', organization_id: 'org-iron', name: 'Iron Wolves', short_name: 'IRW', region_id: 'atr', tier: 'tier1', active: true },
    { id: 't-pacacad', organization_id: 'org-pacacad', name: 'Pacific Academy', short_name: 'PAC', region_id: 'pcr', tier: 'tier2', active: true },
    { id: 't-atlacad', organization_id: 'org-atlacad', name: 'Atlantic Academy', short_name: 'ATA', region_id: 'atr', tier: 'tier2', active: true },
  ],
  players: [
    // Aurora Esports (Tier 1)
    { id: 'p-aur-top', handle: 'Frostbyte', real_name: 'Min-jae Seo', role: 'TOP', nationality: 'KR', age: 21, strength: 4.3 },
    { id: 'p-aur-jng', handle: 'Nightfall', real_name: 'Lucas Brandt', role: 'JUNGLE', nationality: 'DE', age: 23, strength: 4.6, star: true },
    { id: 'p-aur-mid', handle: 'Lumen', real_name: 'Hae-won Park', role: 'MID', nationality: 'KR', age: 20, strength: 4.7, star: true },
    { id: 'p-aur-adc', handle: 'Vesper', real_name: 'Théo Marchand', role: 'ADC', nationality: 'FR', age: 22, strength: 4.4 },
    { id: 'p-aur-sup', handle: 'Halcyon', real_name: 'Erik Lund', role: 'SUPPORT', nationality: 'SE', age: 24, strength: 4.2 },
    { id: 'p-aur-sub', handle: 'Driftwave', role: 'MID', nationality: 'CA', age: 19, strength: 3.8 },
    // Crimson Tide (Tier 1)
    { id: 'p-crt-top', handle: 'Ironclad', role: 'TOP', nationality: 'CN', age: 22, strength: 4.1 },
    { id: 'p-crt-jng', handle: 'Riptide', role: 'JUNGLE', nationality: 'CN', age: 21, strength: 4.2 },
    { id: 'p-crt-mid', handle: 'Ember', role: 'MID', nationality: 'CN', age: 20, strength: 4.3 },
    { id: 'p-crt-adc', handle: 'Scarlet', real_name: 'Wei Zhang', role: 'ADC', nationality: 'CN', age: 21, strength: 4.5, star: true },
    { id: 'p-crt-sup', handle: 'Tempo', role: 'SUPPORT', nationality: 'CN', age: 23, strength: 4.0 },
    // Nova Collective (Tier 1)
    { id: 'p-nva-top', handle: 'Quasar', role: 'TOP', nationality: 'US', age: 22, strength: 4.0 },
    { id: 'p-nva-jng', handle: 'Pulsar', real_name: 'Diego Ramirez', role: 'JUNGLE', nationality: 'BR', age: 21, strength: 4.4, star: true },
    { id: 'p-nva-mid', handle: 'Stardust', role: 'MID', nationality: 'US', age: 20, strength: 4.3 },
    { id: 'p-nva-adc', handle: 'Comet', role: 'ADC', nationality: 'CA', age: 22, strength: 4.2 },
    { id: 'p-nva-sup', handle: 'Eclipse', role: 'SUPPORT', nationality: 'ES', age: 24, strength: 4.0 },
    { id: 'p-nva-sub', handle: 'Nebula', role: 'JUNGLE', nationality: 'US', age: 18, strength: 3.6 },
    // Iron Wolves (Tier 1)
    { id: 'p-irw-top', handle: 'Grimm', role: 'TOP', nationality: 'DK', age: 23, strength: 4.1 },
    { id: 'p-irw-jng', handle: 'Fenrir', role: 'JUNGLE', nationality: 'SE', age: 22, strength: 4.0 },
    { id: 'p-irw-mid', handle: 'Howl', role: 'MID', nationality: 'PL', age: 21, strength: 4.2 },
    { id: 'p-irw-adc', handle: 'Talon', real_name: 'Marek Nowak', role: 'ADC', nationality: 'PL', age: 22, strength: 4.4, star: true },
    { id: 'p-irw-sup', handle: 'Bastion', role: 'SUPPORT', nationality: 'GB', age: 25, strength: 3.9 },
    // Pacific Academy (Tier 2)
    { id: 'p-pac-top', handle: 'Sprout', role: 'TOP', nationality: 'KR', age: 18, strength: 2.9 },
    { id: 'p-pac-jng', handle: 'Pebble', role: 'JUNGLE', nationality: 'JP', age: 17, strength: 2.7 },
    { id: 'p-pac-mid', handle: 'Echoling', role: 'MID', nationality: 'KR', age: 18, strength: 3.1 },
    { id: 'p-pac-adc', handle: 'Minnow', role: 'ADC', nationality: 'VN', age: 19, strength: 2.8 },
    { id: 'p-pac-sup', handle: 'Coral', role: 'SUPPORT', nationality: 'JP', age: 18, strength: 2.6 },
    // Atlantic Academy (Tier 2)
    { id: 'p-ata-top', handle: 'Driftwood', role: 'TOP', nationality: 'US', age: 18, strength: 2.8 },
    { id: 'p-ata-jng', handle: 'Current', role: 'JUNGLE', nationality: 'BR', age: 19, strength: 2.9 },
    { id: 'p-ata-mid', handle: 'Marlin', role: 'MID', nationality: 'CA', age: 17, strength: 3.0 },
    { id: 'p-ata-adc', handle: 'Reef', role: 'ADC', nationality: 'ES', age: 18, strength: 2.7 },
    { id: 'p-ata-sup', handle: 'Anchor', role: 'SUPPORT', nationality: 'FR', age: 19, strength: 2.6 },
  ],
  rosters: [
    { team_id: 't-aurora', season: '2025', split: 'Spring', starters: [{ player_id: 'p-aur-top' }, { player_id: 'p-aur-jng' }, { player_id: 'p-aur-mid' }, { player_id: 'p-aur-adc' }, { player_id: 'p-aur-sup' }], substitutes: [{ player_id: 'p-aur-sub' }] },
    { team_id: 't-crimson', season: '2025', split: 'Spring', starters: [{ player_id: 'p-crt-top' }, { player_id: 'p-crt-jng' }, { player_id: 'p-crt-mid' }, { player_id: 'p-crt-adc' }, { player_id: 'p-crt-sup' }] },
    { team_id: 't-nova', season: '2025', split: 'Spring', starters: [{ player_id: 'p-nva-top' }, { player_id: 'p-nva-jng' }, { player_id: 'p-nva-mid' }, { player_id: 'p-nva-adc' }, { player_id: 'p-nva-sup' }], substitutes: [{ player_id: 'p-nva-sub' }] },
    { team_id: 't-iron', season: '2025', split: 'Spring', starters: [{ player_id: 'p-irw-top' }, { player_id: 'p-irw-jng' }, { player_id: 'p-irw-mid' }, { player_id: 'p-irw-adc' }, { player_id: 'p-irw-sup' }] },
    { team_id: 't-pacacad', season: '2025', split: 'Spring', starters: [{ player_id: 'p-pac-top' }, { player_id: 'p-pac-jng' }, { player_id: 'p-pac-mid' }, { player_id: 'p-pac-adc' }, { player_id: 'p-pac-sup' }] },
    { team_id: 't-atlacad', season: '2025', split: 'Spring', starters: [{ player_id: 'p-ata-top' }, { player_id: 'p-ata-jng' }, { player_id: 'p-ata-mid' }, { player_id: 'p-ata-adc' }, { player_id: 'p-ata-sup' }] },
  ],
  competitions: [
    { id: 'comp-premier', name: 'Rift Premier', region_id: 'pcr', tier: 'tier1', format: 'double_round_robin_bo1', season: '2025', split: 'Spring', team_ids: ['t-aurora', 't-crimson', 't-nova', 't-iron'] },
    { id: 'comp-challengers', name: 'Rift Challengers', region_id: 'pcr', tier: 'tier2', format: 'single_round_robin_bo1', season: '2025', split: 'Spring', team_ids: ['t-pacacad', 't-atlacad'] },
  ],
  assets: [
    { id: 'asset-aurora-logo', path: '/assets/packs/sample/aurora.svg', kind: 'logo' },
  ],
};

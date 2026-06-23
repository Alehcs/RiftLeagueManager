'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  ClipboardList,
  Copy,
  Crown,
  Dice5,
  FileJson,
  Gamepad2,
  Globe2,
  History,
  Link as LinkIcon,
  Lock,
  Map as MapIcon,
  Plus,
  Settings2,
  Shield,
  Sparkles,
  Timer,
  Trophy,
  Upload,
  Users2,
  Wand2,
  X,
} from 'lucide-react';
import { useCurrentGuestId, useDb } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { PageContainer } from '@/components/common/layout';
import { Badge, Button, Card, CardBody, Divider } from '@/components/ui/primitives';
import { Field, Input, Select, Textarea, Toggle } from '@/components/ui/form';
import { FORMAT_META, LEAGUE_FORMAT_OPTIONS, TIER_META } from '@/lib/constants';
import type { CompetitionMode, LeagueFormat, LeagueTier, ReputationMeta } from '@/lib/types';
import type { RawLeague, RawPlayer, RawTeam } from '@/data/rosters';
import type { DataPack, DataPackCompetition, DataPackTeam } from '@/lib/dataPacks/types';
import { getDataPack, listDataPacks } from '@/lib/dataPacks';
import { COMPETITION_MODE_META } from '@/services/competition';
import { cn, createRoomCode, slugify, teamShortName } from '@/lib/utils';
import { TierBadge } from '@/components/common/badges';

type StepId = 'mode' | 'data' | 'style' | 'role' | 'teams' | 'rules' | 'invite' | 'review';
type DataChoice = 'generated' | 'sample' | 'private' | 'future';
type ExperienceStyle = 'realistic' | 'fantasy' | 'historic' | 'sandbox';
type CreatorRole = 'owner_manager' | 'commissioner';
type BotFillBehavior = 'fill_open' | 'exact' | 'off';

interface SetupRules {
  teamCount: number;
  botTeamsEnabled: boolean;
  botFillBehavior: BotFillBehavior;
  botCount: number;
  startingBudget: number;
  preseasonWeeks: number;
  marketEnabled: boolean;
  globalTransferMarketEnabled: boolean;
  contractsEnabled: boolean;
  scoutingEnabled: boolean;
  careerVarianceEnabled: boolean;
  reputationBiasEnabled: boolean;
  fantasyPlacementEnabled: boolean;
  fantasyRegion: string;
  customTeamsEnabled: boolean;
  historicTeamsEnabled: boolean;
  simplifiedFormat: boolean;
}

interface CustomTeamDraft {
  id: string;
  name: string;
  shortName: string;
  region: string;
  tier: LeagueTier;
}

interface PoolTeam {
  id: string;
  name: string;
  shortName: string;
  region: string;
  tier: LeagueTier;
  active: boolean;
  legacyLabel: string | null;
  source: 'generated' | 'pack' | 'custom';
}

interface CreationTeam {
  setupId: string;
  raw: RawTeam;
}

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'mode', label: 'Mode' },
  { id: 'data', label: 'Data' },
  { id: 'style', label: 'Style' },
  { id: 'role', label: 'Role' },
  { id: 'teams', label: 'Teams' },
  { id: 'rules', label: 'Rules' },
  { id: 'invite', label: 'Invite' },
  { id: 'review', label: 'Review' },
];

const MODE_DETAILS: Record<CompetitionMode, { length: string; regional: string; international: string; offseason: string; tone: string }> = {
  quick_tournament: {
    length: 'Fast - one standalone league or bracket',
    regional: 'No regional league structure required',
    international: 'No MSI or Worlds',
    offseason: 'No offseason or next season loop',
    tone: 'Casual, fantasy-friendly, low commitment',
  },
  regional_season: {
    length: 'Medium - preseason, season, playoffs',
    regional: 'Built around one selected region or league',
    international: 'Can feed qualification-style slots',
    offseason: 'Season can complete cleanly',
    tone: 'Realistic regional management',
  },
  full_circuit: {
    length: 'Long - full annual competitive cycle',
    regional: 'Regional leagues run in parallel',
    international: 'MSI and Worlds-style events exist',
    offseason: 'Includes offseason and next season setup',
    tone: 'Most realistic and system-rich',
  },
};

const STYLE_DETAILS: Record<ExperienceStyle, { label: string; description: string; points: string[] }> = {
  realistic: {
    label: 'Realistic',
    description: 'Teams stay in their real region and international events use qualification rules.',
    points: ['Home regions are respected', 'Full Circuit runs regions in parallel', 'MSI and Worlds use qualifying slots'],
  },
  fantasy: {
    label: 'Fantasy / Custom',
    description: 'Mix regions, custom teams, and eras for a custom league identity.',
    points: ['Teams can enter any region', 'Custom teams are enabled', 'Historic teams can join modern leagues'],
  },
  historic: {
    label: 'Historic / Nostalgia',
    description: 'Prioritize legacy teams and throwback cups.',
    points: ['Historic and disbanded teams are highlighted', 'Nostalgia cups are preferred', 'Modern restrictions are relaxed'],
  },
  sandbox: {
    label: 'Sandbox',
    description: 'Maximum freedom with minimal setup restrictions.',
    points: ['Any team pool is valid', 'Custom teams are enabled', 'Fantasy placement is enabled'],
  },
};

const REGIONS = ['North America', 'South America', 'EMEA', 'China', 'Korea', 'Pacific', 'Custom'];
const REGION_COUNTRY: Record<string, string> = {
  'North America': 'US',
  'South America': 'BR',
  EMEA: 'EU',
  China: 'CN',
  Korea: 'KR',
  Pacific: 'JP',
  Custom: 'INTL',
};

const DEMO_NAMES = [
  'Rift Vanguard',
  'Neon Wolves',
  'Solar Drakes',
  'Iron Falcons',
  'Cloudbreak Esports',
  'Northstar Gaming',
  'Ember Collective',
  'Apex Sentinels',
  'Blue Harbor',
  'Crimson Circuit',
  'Verdant Kings',
  'Stormline',
  'Midnight Rally',
  'Golden Aegis',
  'Pulse United',
  'Arcadia Prime',
  'Summit Forge',
  'Nova Tide',
  'Quantum Crest',
  'Atlas Bloom',
  'Legacy Five',
  'Royal Eclipse',
  'Orion Guard',
  'Zero Meridian',
];

const HISTORIC_DEMO_NAMES = [
  'Classic Tacticians',
  'Dynasty Throwback',
  'Old Guard United',
  'Season One Stars',
  'Legacy Rift Club',
  'Vintage Five',
  'Final Boss Alumni',
  'Golden Era Esports',
];

const TIER_STRENGTH: Record<LeagueTier, number> = {
  tier1: 4.2,
  international: 4.5,
  regional: 3.3,
  tier2: 2.9,
  erl: 2.7,
  custom: 3,
};

function rulesForMode(mode: CompetitionMode): SetupRules {
  const full = mode === 'full_circuit';
  const quick = mode === 'quick_tournament';
  return {
    teamCount: quick ? 8 : full ? 24 : 10,
    botTeamsEnabled: true,
    botFillBehavior: 'fill_open',
    botCount: quick ? 7 : full ? 23 : 9,
    startingBudget: 5_000_000,
    preseasonWeeks: quick ? 1 : 3,
    marketEnabled: !quick,
    globalTransferMarketEnabled: full,
    contractsEnabled: !quick,
    scoutingEnabled: !quick,
    careerVarianceEnabled: true,
    reputationBiasEnabled: true,
    fantasyPlacementEnabled: false,
    fantasyRegion: 'Custom',
    customTeamsEnabled: quick,
    historicTeamsEnabled: false,
    simplifiedFormat: quick,
  };
}

function formatForMode(mode: CompetitionMode): LeagueFormat {
  if (mode === 'quick_tournament') return 'single_elim';
  if (mode === 'full_circuit') return 'double_round_robin_bo1';
  return 'double_round_robin_bo1';
}

function defaultCompetition(pack: DataPack, style: ExperienceStyle, mode: CompetitionMode): DataPackCompetition | undefined {
  if (style === 'historic') {
    return pack.competitions.find((competition) => /historic|all-time|throwback|legends|disbanded/i.test(competition.name))
      ?? pack.competitions[0];
  }
  if (mode === 'full_circuit') {
    return pack.competitions.find((competition) => /global|tier 1/i.test(competition.name))
      ?? pack.competitions[0];
  }
  return pack.competitions[0];
}

function packPreview(pack: DataPack | undefined) {
  if (!pack) return { regions: 0, teams: 0, players: 0, competitions: 0, current: 0, historic: 0 };
  const current = pack.teams.filter((team) => team.active !== false).length;
  return {
    regions: pack.regions.length,
    teams: pack.teams.length,
    players: pack.players.length,
    competitions: pack.competitions.length,
    current,
    historic: pack.teams.length - current,
  };
}

function regionName(pack: DataPack, id: string | undefined): string {
  if (!id) return pack.regions[0]?.name ?? 'Custom';
  return pack.regions.find((region) => region.id === id)?.name ?? id;
}

function regionShort(pack: DataPack, id: string | undefined): string {
  if (!id) return 'INTL';
  return pack.regions.find((region) => region.id === id)?.short_name ?? id.toUpperCase().slice(0, 4);
}

function poolFromPack(pack: DataPack): PoolTeam[] {
  return pack.teams.map((team) => ({
    id: team.id,
    name: team.name,
    shortName: team.short_name,
    region: regionName(pack, team.region_id),
    tier: team.tier,
    active: team.active !== false,
    legacyLabel: team.legacy_label ?? (team.active === false ? 'Historic / legacy' : null),
    source: 'pack',
  }));
}

function demoPool(count: number, mode: CompetitionMode, style: ExperienceStyle, region: string, includeHistoric: boolean): PoolTeam[] {
  const names = includeHistoric || style === 'historic'
    ? [...HISTORIC_DEMO_NAMES, ...DEMO_NAMES]
    : DEMO_NAMES;
  const used = new Set<string>();
  return Array.from({ length: Math.max(2, count) }, (_, index) => {
    const homeRegion = mode === 'full_circuit'
      ? REGIONS[index % (REGIONS.length - 1)]
      : region;
    const name = names[index % names.length];
    const historic = index < HISTORIC_DEMO_NAMES.length && (includeHistoric || style === 'historic');
    return {
      id: `generated:${index}`,
      name,
      shortName: teamShortName(name, used),
      region: homeRegion,
      tier: historic ? 'international' : 'custom',
      active: !historic,
      legacyLabel: historic ? 'Historic demo team' : null,
      source: 'generated',
    };
  });
}

function rawFromPoolTeam(team: PoolTeam, index: number, regionOverride?: string): RawTeam {
  const region = regionOverride || team.region || 'Custom';
  return {
    name: team.name,
    short: team.shortName,
    country: REGION_COUNTRY[region] ?? 'INTL',
    strength: team.tier === 'international' ? 4.5 : 3 + (index % 4) * 0.4,
    region,
    tier: team.tier,
    active: team.active,
    legacy_label: team.legacyLabel,
  };
}

function packTeamStrength(team: DataPackTeam, players: RawPlayer[]): number {
  const strengths = players.map((player) => player.strength).filter((value): value is number => typeof value === 'number');
  if (strengths.length) {
    const average = strengths.reduce((sum, value) => sum + value, 0) / strengths.length;
    return Math.round(average * 10) / 10;
  }
  return TIER_STRENGTH[team.tier] ?? 3;
}

function rawTeamsFromPack(pack: DataPack, teamIds: string[], opts: { fantasyRegion?: string | null; leagueRegion: string }): CreationTeam[] {
  const playerById = new Map(pack.players.map((player) => [player.id, player]));
  const rosterByTeam = new Map(pack.rosters.map((roster) => [roster.team_id, roster]));
  return teamIds.flatMap((teamId) => {
    const team = pack.teams.find((item) => item.id === teamId);
    if (!team) return [];
    const org = pack.organizations.find((item) => item.id === team.organization_id);
    const roster = rosterByTeam.get(team.id);
    const slots = [...(roster?.starters ?? []), ...(roster?.substitutes ?? [])];
    const players: RawPlayer[] = slots.flatMap((slot) => {
      const player = playerById.get(slot.player_id);
      if (!player) return [];
      return [{
        nick: player.handle,
        name: player.real_name,
        role: slot.role ?? player.role,
        nat: player.nationality ?? regionShort(pack, team.region_id),
        star: player.star,
        age: player.age,
        strength: player.strength,
        reputation: player.reputation as ReputationMeta | undefined,
      }];
    });
    const homeRegion = regionName(pack, team.region_id);
    const region = opts.fantasyRegion || homeRegion || opts.leagueRegion;
    return [{
      setupId: team.id,
      raw: {
        name: team.name,
        short: team.short_name,
        country: players[0]?.nat ?? regionShort(pack, team.region_id),
        strength: packTeamStrength(team, players),
        roster: players.length ? players : undefined,
        logo: team.logo ?? org?.logo ?? null,
        region,
        tier: team.tier,
        active: team.active ?? org?.active ?? true,
        legacy_label: team.legacy_label ?? (team.active === false ? 'Legacy organization' : null),
        color: team.colors?.primary ?? org?.colors?.primary ?? null,
      },
    }];
  });
}

function marketRulesSummary(rules: SetupRules, style: ExperienceStyle): string {
  const enabled = [
    rules.marketEnabled ? 'market' : 'market off',
    rules.globalTransferMarketEnabled ? 'global transfer market' : 'regional market',
    rules.contractsEnabled ? 'contracts' : 'contracts off',
    rules.scoutingEnabled ? 'scouting' : 'scouting off',
    rules.careerVarianceEnabled ? 'career variance' : 'stable careers',
    rules.reputationBiasEnabled ? 'reputation bias' : 'neutral reputation',
  ];
  return `${STYLE_DETAILS[style].label} setup. Systems: ${enabled.join(', ')}.`;
}

function expectedFlow(mode: CompetitionMode): string {
  if (mode === 'quick_tournament') return 'Team selection, roster reveal, standalone tournament, results.';
  if (mode === 'regional_season') return 'Team selection, preseason, regional season, playoffs, season complete.';
  return 'Team selection, preseason, parallel regional seasons, MSI qualification, MSI, second regional phase, regional finals, Worlds, offseason, next season setup.';
}

function dataChoiceLabel(choice: DataChoice, pack?: DataPack): string {
  if (choice === 'generated') return 'Generated / Demo teams';
  if (choice === 'future') return 'Imported / Custom pack placeholder';
  return pack?.name ?? (choice === 'sample' ? 'Sample fictional data pack' : 'Private LoL Esports data pack');
}

function uniqueRegions(teams: CreationTeam[], customTeams: CustomTeamDraft[]): string[] {
  const rawRegions = teams.map((team) => team.raw.region).filter((value): value is string => Boolean(value));
  return [...new Set([...rawRegions, ...customTeams.map((team) => team.region)])];
}

export default function NewLeaguePage() {
  const router = useRouter();
  const db = useDb();
  const currentGuestId = useCurrentGuestId();
  const createLeague = useStore((state) => state.createLeague);
  const createTeam = useStore((state) => state.createTeam);
  const assignManager = useStore((state) => state.assignManager);
  const cloneLeague = useStore((state) => state.cloneLeague);
  const importBundle = useStore((state) => state.importLeagueBundle);
  const importRaw = useStore((state) => state.importRawLeague);

  const packs = listDataPacks();
  const samplePackId = packs.find((pack) => /sample/i.test(pack.id))?.id ?? packs[0]?.id ?? '';
  const privatePackId = packs.find((pack) => /lol-esports-private/i.test(pack.id))?.id ?? packs.find((pack) => /private/i.test(pack.name))?.id ?? '';

  const [step, setStep] = useState(0);
  const [competitionMode, setCompetitionMode] = useState<CompetitionMode>('regional_season');
  const [dataChoice, setDataChoice] = useState<DataChoice>('generated');
  const [experienceStyle, setExperienceStyle] = useState<ExperienceStyle>('realistic');
  const [creatorRole, setCreatorRole] = useState<CreatorRole>('owner_manager');
  const [leagueName, setLeagueName] = useState('New Rift League');
  const [region, setRegion] = useState('North America');
  const [season, setSeason] = useState('2026');
  const [format, setFormat] = useState<LeagueFormat>('double_round_robin_bo1');
  const [rules, setRules] = useState<SetupRules>(() => rulesForMode('regional_season'));
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [ownerTeamKey, setOwnerTeamKey] = useState('');
  const [roomCode, setRoomCode] = useState(() => createRoomCode());
  const [adminCode, setAdminCode] = useState('');
  const [customDraft, setCustomDraft] = useState<CustomTeamDraft>({ id: '', name: '', shortName: '', region: 'Custom', tier: 'custom' });
  const [customTeams, setCustomTeams] = useState<CustomTeamDraft[]>([]);
  const [cloneId, setCloneId] = useState('');
  const [jsonText, setJsonText] = useState('');

  const selectedPack = dataChoice === 'sample'
    ? getDataPack(samplePackId)
    : dataChoice === 'private'
      ? getDataPack(privatePackId)
      : undefined;
  const selectedCompetition = selectedPack
    ? selectedPack.competitions.find((competition) => competition.id === selectedCompetitionId)
      ?? defaultCompetition(selectedPack, experienceStyle, competitionMode)
    : undefined;
  const defaultTeamIds = useMemo(
    () => selectedPack
      ? (competitionMode === 'full_circuit' && experienceStyle === 'realistic'
          ? selectedCompetition?.team_ids ?? selectedPack.teams.filter((team) => team.active !== false && team.tier === 'tier1').map((team) => team.id)
          : selectedCompetition?.team_ids ?? [])
      : [],
    [competitionMode, experienceStyle, selectedCompetition, selectedPack],
  );
  const effectiveSelectedTeamIds = useMemo(
    () => selectedPack ? (selectedTeamIds.length ? selectedTeamIds : defaultTeamIds) : [],
    [defaultTeamIds, selectedPack, selectedTeamIds],
  );
  const selectedPackPreview = packPreview(selectedPack);
  const runRegion = rules.fantasyPlacementEnabled
    ? rules.fantasyRegion.trim() || 'Custom'
    : selectedPack && selectedCompetition?.region_id && competitionMode !== 'full_circuit'
      ? regionName(selectedPack, selectedCompetition.region_id)
      : competitionMode === 'full_circuit'
        ? 'Global'
        : region;

  const packTeams = useMemo(() => selectedPack ? poolFromPack(selectedPack) : [], [selectedPack]);
  const generatedTeams = useMemo(
    () => demoPool(rules.teamCount, competitionMode, experienceStyle, region, rules.historicTeamsEnabled),
    [competitionMode, experienceStyle, region, rules.historicTeamsEnabled, rules.teamCount],
  );
  const visiblePackTeams = packTeams.filter((team) => {
    if (!rules.historicTeamsEnabled && !team.active) return false;
    const q = teamSearch.trim().toLowerCase();
    if (!q) return true;
    return [team.name, team.shortName, team.region, team.legacyLabel ?? ''].some((value) => value.toLowerCase().includes(q));
  });

  const creationTeams = useMemo<CreationTeam[]>(() => {
    if (dataChoice === 'generated') {
      const fantasyRegion = rules.fantasyPlacementEnabled ? rules.fantasyRegion.trim() || 'Custom' : undefined;
      return generatedTeams.map((team, index) => ({ setupId: team.id, raw: rawFromPoolTeam(team, index, fantasyRegion) }));
    }
    if (!selectedPack) return [];
    const fantasyRegion = rules.fantasyPlacementEnabled ? rules.fantasyRegion.trim() || 'Custom' : null;
    return rawTeamsFromPack(selectedPack, effectiveSelectedTeamIds, { fantasyRegion, leagueRegion: runRegion });
  }, [dataChoice, effectiveSelectedTeamIds, generatedTeams, runRegion, rules.fantasyPlacementEnabled, rules.fantasyRegion, selectedPack]);

  const customPoolTeams: PoolTeam[] = customTeams.map((team) => ({
    id: `custom:${team.id}`,
    name: team.name,
    shortName: team.shortName,
    region: team.region,
    tier: team.tier,
    active: true,
    legacyLabel: null,
    source: 'custom',
  }));

  const ownerOptions = [
    ...creationTeams.map((team) => ({
      key: team.setupId,
      label: `${team.raw.name} (${team.raw.short})`,
      region: team.raw.region ?? region,
    })),
    ...customPoolTeams.map((team) => ({
      key: team.id,
      label: `${team.name} (${team.shortName})`,
      region: team.region,
    })),
  ];
  const selectedTeamTotal = creationTeams.length + customTeams.length;
  const selectedRegions = uniqueRegions(creationTeams, customTeams);
  const selectedTier = selectedCompetition?.tier ?? (competitionMode === 'quick_tournament' ? 'custom' : 'tier1');
  const computedBotCount = rules.botTeamsEnabled
    ? rules.botFillBehavior === 'fill_open'
      ? Math.max(0, selectedTeamTotal - (creatorRole === 'owner_manager' ? 1 : 0))
      : rules.botFillBehavior === 'exact'
        ? Math.max(0, rules.botCount)
        : 0
    : 0;

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const inviteLink = `${origin}/join/${roomCode}`;
  const currentStep = STEPS[step];
  const ownerTeamStillValid = creatorRole === 'commissioner' || ownerOptions.some((option) => option.key === ownerTeamKey);
  const canCreate = leagueName.trim().length > 1 && selectedTeamTotal >= 2 && ownerTeamStillValid && dataChoice !== 'future';

  const chooseMode = (mode: CompetitionMode) => {
    setCompetitionMode(mode);
    setFormat(formatForMode(mode));
    setRules((previous) => {
      const next = rulesForMode(mode);
      return {
        ...next,
        customTeamsEnabled: previous.customTeamsEnabled || next.customTeamsEnabled,
        historicTeamsEnabled: previous.historicTeamsEnabled,
      };
    });
    setSelectedTeamIds([]);
    setOwnerTeamKey('');
  };

  const chooseStyle = (style: ExperienceStyle) => {
    setExperienceStyle(style);
    setRules((previous) => ({
      ...previous,
      customTeamsEnabled: style !== 'realistic' || previous.customTeamsEnabled,
      historicTeamsEnabled: style === 'historic' || style === 'sandbox' || previous.historicTeamsEnabled,
      fantasyPlacementEnabled: style === 'fantasy' || style === 'sandbox' ? true : previous.fantasyPlacementEnabled,
    }));
    setSelectedTeamIds([]);
    setOwnerTeamKey('');
  };

  const togglePackTeam = (teamId: string) => {
    const base = selectedTeamIds.length ? selectedTeamIds : defaultTeamIds;
    setSelectedTeamIds(base.includes(teamId) ? base.filter((id) => id !== teamId) : [...base, teamId]);
    if (ownerTeamKey === teamId) setOwnerTeamKey('');
  };

  const addCustomTeam = () => {
    const name = customDraft.name.trim();
    if (!name) return;
    const used = new Set([...ownerOptions.map((option) => option.label.split('(').pop()?.replace(')', '') ?? '')]);
    const shortName = customDraft.shortName.trim().toUpperCase() || teamShortName(name, used);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setCustomTeams((teams) => [...teams, { ...customDraft, id, name, shortName, region: customDraft.region.trim() || region }]);
    setCustomDraft({ id: '', name: '', shortName: '', region: region || 'Custom', tier: 'custom' });
  };

  const removeCustomTeam = (id: string) => {
    setCustomTeams((teams) => teams.filter((team) => team.id !== id));
    if (ownerTeamKey === `custom:${id}`) setOwnerTeamKey('');
  };

  const createGame = () => {
    if (!canCreate || !currentGuestId) return;
    const setupToCreated = new Map<string, string>();
    let leagueId = '';

    if (dataChoice === 'generated') {
      leagueId = createLeague({
        name: leagueName.trim(),
        slug: slugify(`${leagueName}-${season}-${roomCode}`),
        region: runRegion,
        tier: selectedTier,
        season,
        format,
        source_name: 'Generated setup wizard',
        source_url: null,
        room_code: roomCode,
        adminCode,
        run_phase: 'team_selection',
        competition_mode: competitionMode,
        starting_budget: rules.startingBudget,
        preparation_weeks: rules.preseasonWeeks,
        bot_teams_enabled: rules.botTeamsEnabled && computedBotCount > 0,
        bot_team_count: computedBotCount,
        friendlies_affect_development: rules.careerVarianceEnabled,
        market_rules: marketRulesSummary(rules, experienceStyle),
        free_agent_offer_window_hours: rules.marketEnabled ? 24 : 1,
      });
      for (const setupTeam of creationTeams) {
        const teamId = createTeam(leagueId, {
          name: setupTeam.raw.name,
          short_name: setupTeam.raw.short,
          region: setupTeam.raw.region ?? runRegion,
          country: setupTeam.raw.country,
          tier: setupTeam.raw.tier ?? selectedTier,
          source_name: 'Generated setup wizard',
          run_active: true,
        });
        if (teamId) setupToCreated.set(setupTeam.setupId, teamId);
      }
    } else {
      const raw: RawLeague = {
        name: leagueName.trim(),
        slug: slugify(`${leagueName}-${season}-${roomCode}`),
        region: runRegion,
        tier: selectedTier,
        season,
        format,
        source_name: selectedPack?.name,
        source_url: selectedPack?.source,
        generateRosters: true,
        presimulate: false,
        teams: creationTeams.map((team) => team.raw),
      };
      leagueId = importRaw(raw, {
        presimulate: false,
        skipSchedule: true,
        league: {
          name: raw.name,
          region: runRegion,
          tier: selectedTier,
          season,
          format,
          room_code: roomCode,
          adminCode,
          run_phase: 'team_selection',
          competition_mode: competitionMode,
          starting_budget: rules.startingBudget,
          preparation_weeks: rules.preseasonWeeks,
          bot_teams_enabled: rules.botTeamsEnabled && computedBotCount > 0,
          bot_team_count: computedBotCount,
          friendlies_affect_development: rules.careerVarianceEnabled,
          market_rules: marketRulesSummary(rules, experienceStyle),
          free_agent_offer_window_hours: rules.marketEnabled ? 24 : 1,
        },
      });
      const createdTeams = useStore.getState().db.teams.filter((team) => team.league_id === leagueId);
      for (const setupTeam of creationTeams) {
        const created = createdTeams.find((team) => team.name === setupTeam.raw.name && team.short_name === setupTeam.raw.short);
        if (created) setupToCreated.set(setupTeam.setupId, created.id);
      }
    }

    for (const custom of customTeams) {
      const teamId = createTeam(leagueId, {
        name: custom.name,
        short_name: custom.shortName,
        region: custom.region,
        tier: custom.tier,
        source_name: 'Custom',
        run_active: true,
      });
      if (teamId) setupToCreated.set(`custom:${custom.id}`, teamId);
    }
    const managerTeamId = creatorRole === 'owner_manager' ? setupToCreated.get(ownerTeamKey) : null;
    if (managerTeamId) assignManager(leagueId, currentGuestId, managerTeamId);
    router.push(managerTeamId ? `/leagues/${leagueId}/career` : `/leagues/${leagueId}/lobby`);
  };

  const doClone = () => {
    if (!cloneId) return;
    const id = cloneLeague(cloneId);
    if (id) router.push(`/leagues/${id}`);
  };

  const doJson = () => {
    const id = importBundle(jsonText);
    if (id) router.push(`/leagues/${id}`);
  };

  const readFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJsonText(String(reader.result));
    reader.readAsText(file);
  };

  const stepValid = currentStep.id === 'data'
    ? dataChoice !== 'future'
    : currentStep.id === 'role'
      ? creatorRole === 'commissioner' || ownerOptions.length > 0
      : currentStep.id === 'teams'
        ? selectedTeamTotal >= 2
        : true;

  return (
    <PageContainer className="max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Wand2 className="text-rift-cyan" />
            <h1 className="text-2xl font-bold text-slate-50">New Game Setup Wizard</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
            Create a league or run with mode, data, team pool, creator role, bots, and invite settings in one clear flow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <Badge color="#26d0ce">{COMPETITION_MODE_META[competitionMode].short}</Badge>
          <Badge color="#c8a85a">{STYLE_DETAILS[experienceStyle].label}</Badge>
          <Badge color="#8b5cf6">{selectedTeamTotal} teams</Badge>
        </div>
      </div>

      <div className="mb-5 overflow-x-auto rounded-lg border border-border bg-bg-card/70 p-2">
        <div className="flex min-w-max gap-1">
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(index)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                index === step ? 'bg-rift-cyan/15 text-rift-cyan' : index < step ? 'text-slate-300 hover:bg-bg-elevated' : 'text-slate-500 hover:bg-bg-elevated',
              )}
            >
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border text-[10px]', index <= step ? 'border-rift-cyan/60' : 'border-border-soft')}>
                {index < step ? <Check size={11} /> : index + 1}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardBody className="space-y-5">
            {currentStep.id === 'mode' && (
              <section className="space-y-4">
                <StepHeading icon={<Gamepad2 size={18} />} title="Choose Game Mode" detail="Pick the length and structure of this run." />
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    { id: 'quick_tournament', icon: Timer },
                    { id: 'regional_season', icon: MapIcon },
                    { id: 'full_circuit', icon: Globe2 },
                  ] as const).map(({ id, icon: Icon }) => {
                    const active = competitionMode === id;
                    const meta = MODE_DETAILS[id];
                    return (
                      <button key={id} type="button" onClick={() => chooseMode(id)} className={choiceClass(active)}>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-100"><Icon size={16} className={active ? 'text-rift-cyan' : 'text-slate-500'} /> {COMPETITION_MODE_META[id].label}</div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">{COMPETITION_MODE_META[id].description}</p>
                        <ul className="mt-3 space-y-1.5 text-left text-xs text-slate-400">
                          <li>{meta.length}</li>
                          <li>{meta.regional}</li>
                          <li>{meta.international}</li>
                          <li>{meta.offseason}</li>
                          <li>{meta.tone}</li>
                        </ul>
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="League name"><Input value={leagueName} onChange={(event) => setLeagueName(event.target.value)} /></Field>
                  <Field label="Base region"><Select value={region} onChange={(event) => setRegion(event.target.value)}>{REGIONS.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
                  <Field label="Season"><Input value={season} onChange={(event) => setSeason(event.target.value)} /></Field>
                </div>
              </section>
            )}

            {currentStep.id === 'data' && (
              <section className="space-y-4">
                <StepHeading icon={<Boxes size={18} />} title="Choose Data Pack" detail="Select the source for teams, players, and competitions." />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <DataChoiceButton active={dataChoice === 'generated'} icon={<Dice5 size={17} />} title="Generated / Demo teams" detail="Flexible generated teams and rosters." onClick={() => { setDataChoice('generated'); setSelectedTeamIds([]); setOwnerTeamKey(''); }} />
                  <DataChoiceButton active={dataChoice === 'sample'} icon={<Sparkles size={17} />} title="Sample fictional pack" detail={samplePackId ? 'Bundled safe fictional data.' : 'No sample pack installed.'} disabled={!samplePackId} onClick={() => { setDataChoice('sample'); setSelectedCompetitionId(''); setSelectedTeamIds([]); setOwnerTeamKey(''); }} />
                  <DataChoiceButton active={dataChoice === 'private'} icon={<Trophy size={17} />} title="Private LoL Esports pack" detail={privatePackId ? 'Private real-data catalog.' : 'Private pack not installed.'} disabled={!privatePackId} onClick={() => { setDataChoice('private'); setSelectedCompetitionId(''); setSelectedTeamIds([]); setOwnerTeamKey(''); }} />
                  <DataChoiceButton active={dataChoice === 'future'} icon={<Upload size={17} />} title="Imported / custom pack" detail="Placeholder for future imported packs." onClick={() => setDataChoice('future')} />
                </div>
                {dataChoice === 'generated' ? (
                  <div className="rounded-lg border border-border bg-bg-soft/40 p-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-4">
                      <PreviewStat label="Regions" value={competitionMode === 'full_circuit' ? Math.min(rules.teamCount, REGIONS.length - 1) : 1} />
                      <PreviewStat label="Teams" value={rules.teamCount} />
                      <PreviewStat label="Players" value="Generated at run start" />
                      <PreviewStat label="Competitions" value={competitionMode === 'full_circuit' ? 'Regional + MSI + Worlds' : '1'} />
                    </div>
                  </div>
                ) : selectedPack ? (
                  <div className="space-y-3 rounded-lg border border-border bg-bg-soft/40 p-4">
                    <div>
                      <div className="font-semibold text-slate-100">{selectedPack.name}</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{selectedPack.description}</p>
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                      <PreviewStat label="Regions" value={selectedPackPreview.regions} />
                      <PreviewStat label="Teams" value={selectedPackPreview.teams} />
                      <PreviewStat label="Players" value={selectedPackPreview.players} />
                      <PreviewStat label="Competitions" value={selectedPackPreview.competitions} />
                      <PreviewStat label="Current" value={selectedPackPreview.current} />
                      <PreviewStat label="Historic" value={selectedPackPreview.historic} />
                    </div>
                    <Field label="Competition seed">
                      <Select value={selectedCompetition?.id ?? ''} onChange={(event) => { setSelectedCompetitionId(event.target.value); const comp = selectedPack.competitions.find((item) => item.id === event.target.value); setSelectedTeamIds(comp?.team_ids ?? []); setOwnerTeamKey(''); }}>
                        {selectedPack.competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name} - {TIER_META[competition.tier].label} - {competition.team_ids.length} teams</option>)}
                      </Select>
                    </Field>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">This pack source is not available in this install.</div>
                )}
              </section>
            )}

            {currentStep.id === 'style' && (
              <section className="space-y-4">
                <StepHeading icon={<Sparkles size={18} />} title="Choose Experience Style" detail="Set how strict the team and region rules should be." />
                <div className="grid gap-3 md:grid-cols-2">
                  {(Object.keys(STYLE_DETAILS) as ExperienceStyle[]).map((style) => {
                    const active = experienceStyle === style;
                    const meta = STYLE_DETAILS[style];
                    return (
                      <button key={style} type="button" onClick={() => chooseStyle(style)} className={choiceClass(active)}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-100">{meta.label}</span>
                          {active && <Check size={16} className="text-rift-cyan" />}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">{meta.description}</p>
                        <ul className="mt-3 space-y-1.5 text-xs text-slate-400">
                          {meta.points.map((point) => <li key={point}>{point}</li>)}
                        </ul>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {currentStep.id === 'role' && (
              <section className="space-y-4">
                <StepHeading icon={<Crown size={18} />} title="Owner Role / Commissioner Setup" detail="Choose whether the creator also manages a team." />
                <div className="grid gap-3 md:grid-cols-2">
                  <button type="button" onClick={() => setCreatorRole('owner_manager')} className={choiceClass(creatorRole === 'owner_manager')}>
                    <div className="flex items-center gap-2 font-bold text-slate-100"><Shield size={16} /> Owner + Manager</div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">Keep owner/admin permissions and immediately claim one team to play.</p>
                  </button>
                  <button type="button" onClick={() => setCreatorRole('commissioner')} className={choiceClass(creatorRole === 'commissioner')}>
                    <div className="flex items-center gap-2 font-bold text-slate-100"><ClipboardList size={16} /> Commissioner only</div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">Keep owner/admin permissions without claiming a team. Managers can join later.</p>
                  </button>
                </div>
                {creatorRole === 'owner_manager' && (
                  <Field label="Creator team">
                    <Select value={ownerTeamKey} onChange={(event) => setOwnerTeamKey(event.target.value)}>
                      <option value="">Choose a team during setup...</option>
                      {ownerOptions.map((option) => <option key={option.key} value={option.key}>{option.label} - {option.region}</option>)}
                    </Select>
                  </Field>
                )}
              </section>
            )}

            {currentStep.id === 'teams' && (
              <section className="space-y-4">
                <StepHeading icon={<Users2 size={18} />} title="Choose Teams / Team Pool" detail="Build the playable team pool for this run." />
                {competitionMode === 'quick_tournament' && <RuleBanner icon={<Timer size={15} />} title="Quick Tournament" text="Any selected team can enter. Random fill, custom teams, and historic teams are available when enabled." />}
                {competitionMode === 'regional_season' && <RuleBanner icon={<MapIcon size={15} />} title="Regional Season" text="The default pool follows the selected region or competition. Off-region teams make the run custom or fantasy." />}
                {competitionMode === 'full_circuit' && <RuleBanner icon={<Globe2 size={15} />} title="Full Competitive Circuit" text="Realistic mode keeps teams in home regions. Fantasy placement can move selected teams into a custom region." />}

                {dataChoice === 'generated' ? (
                  <div className="space-y-3">
                    <Field label="Generated team count"><Input type="number" min={2} max={48} value={rules.teamCount} onChange={(event) => setRules((previous) => ({ ...previous, teamCount: Number(event.target.value) }))} /></Field>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {generatedTeams.slice(0, Math.min(12, generatedTeams.length)).map((team) => <TeamPoolRow key={team.id} team={team} selected />)}
                    </div>
                    {generatedTeams.length > 12 && <p className="text-xs text-slate-500">Showing 12 of {generatedTeams.length} generated teams.</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <Field label="Search teams" className="flex-1"><Input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="Team, short name, region..." /></Field>
                      <Button variant="secondary" onClick={() => { setSelectedTeamIds(defaultTeamIds); setOwnerTeamKey(''); }}><Dice5 size={14} /> Recommended pool</Button>
                      <Button variant="outline" onClick={() => { setSelectedTeamIds([]); setOwnerTeamKey(''); }}><X size={14} /> Clear</Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {visiblePackTeams.map((team) => (
                        <button key={team.id} type="button" onClick={() => togglePackTeam(team.id)} className="text-left">
                          <TeamPoolRow team={team} selected={effectiveSelectedTeamIds.includes(team.id)} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Divider />
                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-4">
                      <Toggle checked={rules.customTeamsEnabled} onChange={(customTeamsEnabled) => setRules((previous) => ({ ...previous, customTeamsEnabled }))} label="Custom teams enabled" />
                      <Toggle checked={rules.historicTeamsEnabled} onChange={(historicTeamsEnabled) => { setRules((previous) => ({ ...previous, historicTeamsEnabled })); setSelectedTeamIds([]); }} label="Historic teams enabled" />
                      <Toggle checked={rules.fantasyPlacementEnabled} onChange={(fantasyPlacementEnabled) => setRules((previous) => ({ ...previous, fantasyPlacementEnabled }))} label="Fantasy placement enabled" />
                    </div>
                    {rules.customTeamsEnabled && (
                      <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">New custom team</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <Input value={customDraft.name} placeholder="Team name" onChange={(event) => setCustomDraft((draft) => ({ ...draft, name: event.target.value }))} />
                          <Input value={customDraft.shortName} placeholder="Short" maxLength={5} onChange={(event) => setCustomDraft((draft) => ({ ...draft, shortName: event.target.value.toUpperCase() }))} />
                          <Input value={customDraft.region} placeholder="Region" onChange={(event) => setCustomDraft((draft) => ({ ...draft, region: event.target.value }))} />
                          <Select value={customDraft.tier} onChange={(event) => setCustomDraft((draft) => ({ ...draft, tier: event.target.value as LeagueTier }))}>
                            {(Object.keys(TIER_META) as LeagueTier[]).map((tier) => <option key={tier} value={tier}>{TIER_META[tier].label}</option>)}
                          </Select>
                        </div>
                        <div className="mt-3 flex justify-end"><Button variant="primary" size="sm" disabled={!customDraft.name.trim()} onClick={addCustomTeam}><Plus size={14} /> Add custom team</Button></div>
                      </div>
                    )}
                    {creatorRole === 'owner_manager' && (
                      <Field label="Creator team">
                        <Select value={ownerTeamKey} onChange={(event) => setOwnerTeamKey(event.target.value)}>
                          <option value="">Choose a team to manage...</option>
                          {ownerOptions.map((option) => <option key={option.key} value={option.key}>{option.label} - {option.region}</option>)}
                        </Select>
                      </Field>
                    )}
                  </div>
                  <div className="rounded-lg border border-border bg-bg-soft/40 p-3">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Selected pool</div>
                    <div className="space-y-2 text-sm">
                      <SummaryRow label="Teams" value={selectedTeamTotal} />
                      <SummaryRow label="Regions" value={selectedRegions.length || 1} />
                      <SummaryRow label="Custom teams" value={customTeams.length} />
                      <SummaryRow label="Bot fill plan" value={computedBotCount} />
                    </div>
                    {customTeams.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {customTeams.map((team) => (
                          <div key={team.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-card px-2 py-1 text-xs">
                            <span className="truncate">{team.name}</span>
                            <button type="button" onClick={() => removeCustomTeam(team.id)} className="text-slate-500 hover:text-rift-red"><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {currentStep.id === 'rules' && (
              <section className="space-y-4">
                <StepHeading icon={<Settings2 size={18} />} title="Configure Rules" detail="Set run defaults before the lobby opens." />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Number of teams"><Input type="number" min={2} max={64} value={rules.teamCount} onChange={(event) => setRules((previous) => ({ ...previous, teamCount: Number(event.target.value) }))} /></Field>
                  <Field label="Season format"><Select value={format} onChange={(event) => setFormat(event.target.value as LeagueFormat)}>{LEAGUE_FORMAT_OPTIONS.map((item) => <option key={item} value={item}>{FORMAT_META[item].label}</option>)}</Select></Field>
                  <Field label="Preseason weeks"><Select value={rules.preseasonWeeks} onChange={(event) => setRules((previous) => ({ ...previous, preseasonWeeks: Number(event.target.value) }))}><option value={1}>1 week</option><option value={2}>2 weeks</option><option value={3}>3 weeks</option></Select></Field>
                  <Field label="Starting budget"><Input type="number" min={0} step={100000} value={rules.startingBudget} onChange={(event) => setRules((previous) => ({ ...previous, startingBudget: Number(event.target.value) }))} /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Toggle checked={rules.botTeamsEnabled} onChange={(botTeamsEnabled) => setRules((previous) => ({ ...previous, botTeamsEnabled }))} label="Bot teams enabled" />
                  <Field label="Bot fill behavior">
                    <Select value={rules.botFillBehavior} disabled={!rules.botTeamsEnabled} onChange={(event) => setRules((previous) => ({ ...previous, botFillBehavior: event.target.value as BotFillBehavior }))}>
                      <option value="fill_open">Fill open slots at start</option>
                      <option value="exact">Use exact bot count</option>
                      <option value="off">No automatic bot fill</option>
                    </Select>
                  </Field>
                  <Field label="Exact bot count"><Input type="number" min={0} disabled={!rules.botTeamsEnabled || rules.botFillBehavior !== 'exact'} value={rules.botCount} onChange={(event) => setRules((previous) => ({ ...previous, botCount: Number(event.target.value) }))} /></Field>
                </div>
                {rules.fantasyPlacementEnabled && (
                  <Field label="Fantasy placement region" hint="Selected teams are placed here when fantasy placement is enabled.">
                    <Input value={rules.fantasyRegion} onChange={(event) => setRules((previous) => ({ ...previous, fantasyRegion: event.target.value }))} />
                  </Field>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Toggle checked={rules.marketEnabled} onChange={(marketEnabled) => setRules((previous) => ({ ...previous, marketEnabled }))} label="Market enabled" />
                  <Toggle checked={rules.globalTransferMarketEnabled} onChange={(globalTransferMarketEnabled) => setRules((previous) => ({ ...previous, globalTransferMarketEnabled }))} label="Global transfer market enabled" />
                  <Toggle checked={rules.contractsEnabled} onChange={(contractsEnabled) => setRules((previous) => ({ ...previous, contractsEnabled }))} label="Contracts enabled" />
                  <Toggle checked={rules.scoutingEnabled} onChange={(scoutingEnabled) => setRules((previous) => ({ ...previous, scoutingEnabled }))} label="Scouting enabled" />
                  <Toggle checked={rules.careerVarianceEnabled} onChange={(careerVarianceEnabled) => setRules((previous) => ({ ...previous, careerVarianceEnabled }))} label="Career realism variance enabled" />
                  <Toggle checked={rules.reputationBiasEnabled} onChange={(reputationBiasEnabled) => setRules((previous) => ({ ...previous, reputationBiasEnabled }))} label="Player reputation bias enabled" />
                  <Toggle checked={rules.simplifiedFormat} onChange={(simplifiedFormat) => setRules((previous) => ({ ...previous, simplifiedFormat }))} label="Simplified season format" />
                </div>
                <p className="text-xs leading-relaxed text-slate-500">{FORMAT_META[format].description}</p>
              </section>
            )}

            {currentStep.id === 'invite' && (
              <section className="space-y-4">
                <StepHeading icon={<LinkIcon size={18} />} title="Invite / Multiplayer Setup" detail="Review lobby access before creation." />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Room code">
                    <div className="flex gap-2">
                      <Input value={roomCode} maxLength={10} onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                      <Button variant="secondary" onClick={() => setRoomCode(createRoomCode())}><Dice5 size={14} /> New</Button>
                    </div>
                  </Field>
                  <Field label="Owner recovery code" hint="Optional. Used to recover admin access from another guest session.">
                    <Input type="password" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} placeholder="Optional recovery code" />
                  </Field>
                </div>
                <div className="rounded-lg border border-border bg-bg-soft/40 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <PreviewStat label="Invite link" value={origin ? inviteLink : `/join/${roomCode}`} />
                    <PreviewStat label="Creator role" value={creatorRole === 'owner_manager' ? 'Owner + Manager' : 'Commissioner only'} />
                    <PreviewStat label="Manager slots" value={Math.max(0, selectedTeamTotal - (creatorRole === 'owner_manager' ? 1 : 0))} />
                    <PreviewStat label="Teams claimable" value="Yes" />
                    <PreviewStat label="Viewers allowed" value="Yes" />
                    <PreviewStat label="Bot fill at start" value={computedBotCount} />
                  </div>
                </div>
              </section>
            )}

            {currentStep.id === 'review' && (
              <section className="space-y-4">
                <StepHeading icon={<ClipboardList size={18} />} title="Review & Confirm" detail="Confirm the setup before creating the run." />
                <div className="grid gap-3 lg:grid-cols-2">
                  <ReviewBlock title="Game setup">
                    <SummaryRow label="Mode" value={COMPETITION_MODE_META[competitionMode].label} />
                    <SummaryRow label="Data pack" value={dataChoiceLabel(dataChoice, selectedPack)} />
                    <SummaryRow label="Experience style" value={STYLE_DETAILS[experienceStyle].label} />
                    <SummaryRow label="Region / season" value={`${runRegion} / ${season}`} />
                    <SummaryRow label="Competition" value={selectedCompetition?.name ?? 'Generated competition'} />
                  </ReviewBlock>
                  <ReviewBlock title="Creator and teams">
                    <SummaryRow label="Creator role" value={creatorRole === 'owner_manager' ? 'Owner + Manager' : 'Commissioner only'} />
                    <SummaryRow label="Creator team" value={creatorRole === 'owner_manager' ? ownerOptions.find((option) => option.key === ownerTeamKey)?.label ?? 'Not selected' : 'None'} />
                    <SummaryRow label="Teams selected" value={selectedTeamTotal} />
                    <SummaryRow label="Regions" value={selectedRegions.join(', ') || runRegion} />
                    <SummaryRow label="Bot fill plan" value={computedBotCount ? `${computedBotCount} open slot(s) at start` : 'No automatic bots'} />
                  </ReviewBlock>
                  <ReviewBlock title="Enabled systems">
                    <SummaryRow label="Market" value={rules.marketEnabled ? 'Enabled' : 'Disabled preference'} />
                    <SummaryRow label="Global market" value={rules.globalTransferMarketEnabled ? 'Enabled' : 'Regional'} />
                    <SummaryRow label="Contracts" value={rules.contractsEnabled ? 'Enabled' : 'Disabled preference'} />
                    <SummaryRow label="Scouting" value={rules.scoutingEnabled ? 'Enabled' : 'Disabled preference'} />
                    <SummaryRow label="Variance / reputation" value={`${rules.careerVarianceEnabled ? 'Variance' : 'Stable'} / ${rules.reputationBiasEnabled ? 'Bias on' : 'Bias off'}`} />
                  </ReviewBlock>
                  <ReviewBlock title="Season flow">
                    <p className="text-sm leading-relaxed text-slate-400">{expectedFlow(competitionMode)}</p>
                    <div className="mt-3 space-y-1 text-sm">
                      <SummaryRow label="Room code" value={roomCode} />
                      <SummaryRow label="Invite link" value={origin ? inviteLink : `/join/${roomCode}`} />
                      <SummaryRow label="After creation" value={creatorRole === 'owner_manager' ? 'Career Hub' : 'League lobby / admin setup'} />
                    </div>
                  </ReviewBlock>
                </div>
                {!canCreate && <div className="rounded-lg border border-rift-red/30 bg-rift-red/10 p-3 text-sm text-rift-red">Choose at least two teams and a creator team when Owner + Manager is selected.</div>}
              </section>
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={14} /> Back</Button>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {step < STEPS.length - 1 ? (
                  <Button variant="primary" disabled={!stepValid} onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}>Continue <ArrowRight size={14} /></Button>
                ) : (
                  <Button variant="primary" disabled={!canCreate || !currentGuestId} onClick={createGame}><Plus size={15} /> Create league/run</Button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100"><Lock size={15} className="text-rift-cyan" /> Setup Summary</div>
              <div className="space-y-2 text-sm">
                <SummaryRow label="Mode" value={COMPETITION_MODE_META[competitionMode].short} />
                <SummaryRow label="Data" value={dataChoiceLabel(dataChoice, selectedPack)} />
                <SummaryRow label="Style" value={STYLE_DETAILS[experienceStyle].label} />
                <SummaryRow label="Role" value={creatorRole === 'owner_manager' ? 'Owner + Manager' : 'Commissioner'} />
                <SummaryRow label="Teams" value={selectedTeamTotal} />
                <SummaryRow label="Bots" value={computedBotCount} />
              </div>
              <Divider />
              <div className="text-xs leading-relaxed text-slate-500">{expectedFlow(competitionMode)}</div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100"><FileJson size={15} className="text-rift-gold" /> Other creation tools</div>
              <Field label="Clone existing league">
                <Select value={cloneId} onChange={(event) => setCloneId(event.target.value)}>
                  <option value="">Select a league...</option>
                  {db.leagues.map((league) => <option key={league.id} value={league.id}>{league.name} - {league.season}</option>)}
                </Select>
              </Field>
              <Button variant="secondary" className="w-full" disabled={!cloneId} onClick={doClone}><Copy size={14} /> Clone league</Button>
              <Divider />
              <Field label="Import JSON bundle">
                <input type="file" accept=".json,application/json" onChange={(event) => readFile(event.target.files?.[0])} className="w-full text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-bg-elevated file:px-2 file:py-1 file:text-slate-300" />
              </Field>
              <Textarea rows={4} value={jsonText} onChange={(event) => setJsonText(event.target.value)} placeholder='{ "format": "rift-league-manager/v1" }' />
              <Button variant="secondary" className="w-full" disabled={!jsonText.trim()} onClick={doJson}><FileJson size={14} /> Import JSON</Button>
            </CardBody>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function choiceClass(active: boolean): string {
  return cn(
    'rounded-lg border p-4 text-left transition-colors',
    active ? 'border-rift-cyan bg-rift-cyan/10' : 'border-border bg-bg-soft/30 hover:border-border-soft',
  );
}

function StepHeading({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-rift-cyan">{icon}<h2 className="text-lg font-bold text-slate-100">{title}</h2></div>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function DataChoiceButton({ active, icon, title, detail, disabled, onClick }: { active: boolean; icon: React.ReactNode; title: string; detail: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn(choiceClass(active), 'disabled:cursor-not-allowed disabled:opacity-50')}>
      <div className="flex items-center gap-2 font-bold text-slate-100">{icon}{title}</div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p>
    </button>
  );
}

function PreviewStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function RuleBanner({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-rift-cyan/30 bg-rift-cyan/10 px-3 py-2">
      <div className="mt-0.5 text-rift-cyan">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        <p className="text-xs leading-relaxed text-slate-400">{text}</p>
      </div>
    </div>
  );
}

function TeamPoolRow({ team, selected }: { team: PoolTeam; selected: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-bg-soft/40 p-3 transition-colors', selected ? 'border-rift-cyan bg-rift-cyan/10' : 'border-border hover:border-border-soft')}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg-card text-xs font-bold text-rift-cyan">{team.shortName.slice(0, 3)}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-100">{team.name}</div>
          <div className="truncate text-xs text-slate-500">{team.region} - {team.shortName}</div>
        </div>
        {selected && <Check size={15} className="text-rift-cyan" />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TierBadge tier={team.tier} />
        {!team.active && <Badge color="#c8a85a"><History size={10} /> Historic</Badge>}
        {team.source === 'custom' && <Badge color="#8b5cf6">Custom</Badge>}
      </div>
      {team.legacyLabel && <p className="mt-2 text-xs text-slate-500">{team.legacyLabel}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-slate-200">{value}</span>
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft/40 p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

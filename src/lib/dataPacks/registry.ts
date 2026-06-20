import { SAMPLE_PACK } from '@/data/packs/sample';
import { LOL_ESPORTS_PRIVATE_V1 } from '@/data/packs/lol-esports-private-v1';
import type { DataPack, DataPackSummary } from './types';
import { summarizeDataPack, validateDataPack } from './validate';

// Bundled packs available to every install. The sample pack ships publicly; the
// private LoL pack is for personal/prototype use. More packs (or JSON-loaded
// packs) can be added here without touching the importer or UI.
const BUNDLED_PACKS: DataPack[] = [SAMPLE_PACK, LOL_ESPORTS_PRIVATE_V1];

export function listDataPacks(): DataPackSummary[] {
  return BUNDLED_PACKS.map(summarizeDataPack);
}

export function getDataPack(id: string): DataPack | undefined {
  return BUNDLED_PACKS.find((pack) => pack.id === id);
}

// Parse + validate a pack supplied as JSON (e.g. a private pack file). Returns
// the pack only when it passes validation.
export function parseDataPack(json: string): { pack?: DataPack; errors: string[]; warnings: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { errors: ['Invalid JSON.'], warnings: [] };
  }
  const result = validateDataPack(parsed);
  return { pack: result.ok ? (parsed as DataPack) : undefined, errors: result.errors, warnings: result.warnings };
}

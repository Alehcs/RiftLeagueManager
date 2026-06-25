/**
 * ===========================================================================
 * Private Liquipedia logo importer for the LoL team pack.
 * ===========================================================================
 *
 * FOR PRIVATE PROTOTYPE / FRIENDS USE ONLY. Not for public/commercial use.
 *
 * Finds and imports real LoL team logos using the Liquipedia *MediaWiki API*
 * (api.php) — it NEVER scrapes rendered HTML pages and NEVER uses image search
 * engines. For each team it:
 *
 *   1. resolves the team's wiki page from name / aliases (action=query)
 *   2. reads only section 0 (the infobox) wikitext and extracts the logo file
 *      name from |image= / |imagedark= / |imagelight= / |logo=
 *   3. resolves the File: page to a real file URL + license metadata
 *      (prop=imageinfo, iiprop=url|size|mime|extmetadata)
 *   4. downloads the file into public/assets/teams/lol/real/<id>.<ext>
 *   5. (optionally) flips the matching manifest entry to status:'real'
 *   6. records provenance in docs/logo-attribution.md
 *
 * It respects Liquipedia's API terms: a descriptive User-Agent, gzip encoding,
 * a conservative request delay, on-disk response caching, and retries with
 * backoff. Official team logos are trademarked — imported files are treated as
 * "review required" private assets and are NOT claimed as owned by this repo.
 *
 * Runs on Node >= 22 with native TypeScript type-stripping — no extra deps:
 *
 *   node scripts/import-liquipedia-logos.ts --dry-run
 *   node scripts/import-liquipedia-logos.ts --team t1 --yes --write-manifest
 *   npm run import-logos -- --dry-run
 *
 * Safe by default: with no flags it runs a DRY RUN (no network downloads, no
 * file writes) and prints what it *would* do. Pass --yes (or --apply) to
 * actually download. See --help for all flags.
 * ===========================================================================
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// --- Project layout --------------------------------------------------------
const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const MANIFEST_PATH = join(ROOT, 'src/data/lolLogoManifest.ts');
const CATALOG_PATH = join(ROOT, 'src/data/packs/lol-esports-private-v1/index.ts');
const REAL_DIR = join(ROOT, 'public/assets/teams/lol/real');
const CACHE_DIR = join(ROOT, '.cache/liquipedia-logo-import');
const API_CACHE_DIR = join(CACHE_DIR, 'api');
const ATTRIBUTION_DOC = join(ROOT, 'docs/logo-attribution.md');
const UNMATCHED_REPORT = join(CACHE_DIR, 'unmatched-candidates.json');

// --- Liquipedia / MediaWiki API config -------------------------------------
const WIKI_API = 'https://liquipedia.net/leagueoflegends/api.php';
// Descriptive UA per liquipedia.net/api-terms-of-use — NOT a browser UA.
const USER_AGENT =
  'RiftLeagueTournament-LogoImporter/1.0 (private prototype data pack; contact: alejandro.cornejog4@gmail.com)';
// Infobox parameters that may hold the team logo, in preference order. The app
// UI is dark, so a dedicated dark-mode mark is preferred when present.
const LOGO_PARAMS = ['imagedark', 'image', 'logo', 'imagelight', 'logodark', 'logolight'];
const IMAGE_EXTS = ['svg', 'png', 'webp', 'jpg', 'jpeg'];

// ===========================================================================
// Types
// ===========================================================================
interface ManifestEntry {
  id: string;
  team: string;
  short: string;
  aliases?: string[];
  path: string;
  format: string;
  status: string;
}

interface CatalogOrg {
  id: string;
  name: string;
  short: string;
  region?: string;
  aliases: string[];
  legacyLabel?: string;
  color?: string;
}

interface Target {
  id: string;
  team: string;
  short: string;
  aliases: string[];
  region?: string;
  color?: string;
  inManifest: boolean;
  manifest?: ManifestEntry;
}

type Confidence = 'high' | 'medium' | 'low';

interface ResolvedLogo {
  fileTitle: string; // "File:T1 2019 full allmode.png"
  sourcePage: string; // wiki page the logo came from
  matchedCandidate: string; // the candidate title that resolved
  confidence: Confidence;
  fileUrl: string;
  mime: string;
  ext: string;
  width?: number;
  height?: number;
  license?: string;
  artist?: string;
  descriptionUrl?: string;
}

interface RunResult {
  target: Target;
  outcome: 'imported' | 'would-import' | 'skipped-existing' | 'unmatched' | 'failed' | 'low-confidence';
  detail: string;
  logo?: ResolvedLogo;
  localPath?: string; // public path written to manifest, e.g. /assets/teams/lol/real/t1.png
}

// ===========================================================================
// CLI parsing
// ===========================================================================
interface Options {
  dryRun: boolean;
  apply: boolean; // --yes / --apply: actually perform network downloads + writes
  limit: number | null;
  team: string | null;
  force: boolean;
  skipExisting: boolean;
  noDownload: boolean;
  writeManifest: boolean;
  includeCatalog: boolean; // also target catalog teams that have no manifest entry
  delayMs: number;
  verbose: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    dryRun: false,
    apply: false,
    limit: null,
    team: null,
    force: false,
    skipExisting: true,
    noDownload: false,
    writeManifest: false,
    includeCatalog: false,
    delayMs: 2200,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--yes':
      case '--apply':
        opts.apply = true;
        break;
      case '--force':
        opts.force = true;
        break;
      case '--skip-existing':
        opts.skipExisting = true;
        break;
      case '--no-skip-existing':
        opts.skipExisting = false;
        break;
      case '--no-download':
        opts.noDownload = true;
        break;
      case '--write-manifest':
        opts.writeManifest = true;
        break;
      case '--include-catalog':
        opts.includeCatalog = true;
        break;
      case '--verbose':
      case '-v':
        opts.verbose = true;
        break;
      case '--limit':
        opts.limit = Math.max(0, parseInt(argv[++i] ?? '', 10) || 0);
        break;
      case '--team':
        opts.team = (argv[++i] ?? '').trim();
        break;
      case '--delay':
        opts.delayMs = Math.max(0, parseInt(argv[++i] ?? '', 10) || 0);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (a.startsWith('--limit=')) opts.limit = Math.max(0, parseInt(a.slice(8), 10) || 0);
        else if (a.startsWith('--team=')) opts.team = a.slice(7).trim();
        else if (a.startsWith('--delay=')) opts.delayMs = Math.max(0, parseInt(a.slice(8), 10) || 0);
        else console.warn(`! unknown argument ignored: ${a}`);
    }
  }
  // Safe default: if the user did not explicitly opt in with --yes/--apply, we
  // run as a dry run regardless (confirmation-first).
  if (!opts.apply) opts.dryRun = true;
  return opts;
}

function printHelp(): void {
  console.log(`Private Liquipedia logo importer (LoL team pack)

Usage: node scripts/import-liquipedia-logos.ts [options]

Safe by default — without --yes this is always a DRY RUN (no downloads, no writes).

Options:
  --dry-run            Preview only; never downloads or writes (the default).
  --yes, --apply       Actually perform downloads / writes (opt-in confirmation).
  --team <id|short>    Import a single team by manifest id, short code, name or alias.
  --limit <n>          Process at most n teams.
  --force              Overwrite existing real logos / re-download.
  --skip-existing      Skip teams that already have a real logo on disk (default on).
  --no-skip-existing   Re-check teams even if a real logo already exists.
  --no-download        Resolve + report file URLs but never download images.
  --write-manifest     Flip matched manifest entries to status:'real' (with --yes).
  --include-catalog    Also target catalog teams that have no manifest entry yet.
  --delay <ms>         Delay between API requests (default 2200; be conservative).
  --verbose, -v        Extra logging.
  --help, -h           Show this help.

Examples:
  node scripts/import-liquipedia-logos.ts --dry-run
  node scripts/import-liquipedia-logos.ts --team t1 --yes --write-manifest
  node scripts/import-liquipedia-logos.ts --limit 5 --yes --write-manifest
`);
}

// ===========================================================================
// Load manifest (native TS import — the manifest has no imports) + catalog
// ===========================================================================
async function loadManifest(): Promise<ManifestEntry[]> {
  const mod = await import(pathToFileURL(MANIFEST_PATH).href);
  return mod.LOL_LOGO_MANIFEST as ManifestEntry[];
}

// The catalog (index.ts) imports project modules with "@/" aliases, so it can't
// be imported directly from a plain node script. We tolerantly text-parse the
// single-line ORG object literals to harvest id / name / short / region /
// aliases / color for richer matching. Best-effort: failures degrade to the
// manifest only.
async function loadCatalog(): Promise<Map<string, CatalogOrg>> {
  const byId = new Map<string, CatalogOrg>();
  let src: string;
  try {
    src = await readFile(CATALOG_PATH, 'utf8');
  } catch {
    return byId;
  }
  const objRe = /\{\s*id:\s*'([^']+)'[^]*?\}/g;
  for (const m of src.matchAll(objRe)) {
    const block = m[0];
    // Only ORG-shaped literals (must carry name + short + region).
    const name = field(block, 'name');
    const short = field(block, 'short');
    const region = field(block, 'region');
    if (!name || !short || !region) continue;
    const id = m[1];
    byId.set(id, {
      id,
      name,
      short,
      region,
      aliases: listField(block, 'aliases'),
      legacyLabel: field(block, 'legacy_label'),
      color: field(block, 'color'),
    });
  }
  return byId;
}

function field(block: string, key: string): string | undefined {
  const m = block.match(new RegExp(`\\b${key}:\\s*'([^']*)'`));
  return m?.[1];
}
function listField(block: string, key: string): string[] {
  const m = block.match(new RegExp(`\\b${key}:\\s*\\[([^\\]]*)\\]`));
  if (!m) return [];
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]).filter(Boolean);
}

// ===========================================================================
// Build the target list
// ===========================================================================
function buildTargets(manifest: ManifestEntry[], catalog: Map<string, CatalogOrg>, opts: Options): Target[] {
  const targets: Target[] = [];
  const seen = new Set<string>();

  for (const m of manifest) {
    const cat = catalog.get(m.id);
    const aliases = uniq([...(m.aliases ?? []), ...(cat?.aliases ?? []), cat?.legacyLabel].filter(Boolean) as string[]);
    targets.push({
      id: m.id,
      team: m.team,
      short: m.short,
      aliases,
      region: cat?.region,
      color: cat?.color,
      inManifest: true,
      manifest: m,
    });
    seen.add(m.id);
  }

  if (opts.includeCatalog) {
    for (const [id, cat] of catalog) {
      if (seen.has(id)) continue;
      targets.push({
        id,
        team: cat.name,
        short: cat.short,
        aliases: uniq([...cat.aliases, cat.legacyLabel].filter(Boolean) as string[]),
        region: cat.region,
        color: cat.color,
        inManifest: false,
      });
    }
  }

  // --team filter (id, short, name or alias — case-insensitive)
  let filtered = targets;
  if (opts.team) {
    const q = opts.team.toLowerCase();
    filtered = targets.filter(
      (t) =>
        t.id.toLowerCase() === q ||
        t.short.toLowerCase() === q ||
        t.team.toLowerCase() === q ||
        t.aliases.some((a) => a.toLowerCase() === q),
    );
    if (filtered.length === 0) {
      console.error(`No team matched --team "${opts.team}". Try a manifest id (e.g. t1), short code, name or alias.`);
      process.exit(1);
    }
  }

  if (opts.limit != null) filtered = filtered.slice(0, opts.limit);
  return filtered;
}

// ===========================================================================
// HTTP layer: gzip, UA, on-disk cache, rate-limit, retry/backoff
// ===========================================================================
let lastRequestAt = 0;

async function paceRequest(delayMs: number): Promise<void> {
  const wait = lastRequestAt + delayMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function cacheKey(url: string): string {
  return createHash('sha1').update(url).digest('hex');
}

async function apiGet(params: Record<string, string>, opts: Options): Promise<any> {
  const url = `${WIKI_API}?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' }).toString()}`;
  const keyFile = join(API_CACHE_DIR, `${cacheKey(url)}.json`);

  // Serve from cache (never re-request the same query within or across runs).
  if (existsSync(keyFile)) {
    try {
      const cached = JSON.parse(await readFile(keyFile, 'utf8'));
      if (opts.verbose) console.log(`  · cache hit ${params.titles ?? params.list ?? ''}`);
      return cached;
    } catch {
      /* fall through to refetch on a corrupt cache file */
    }
  }

  const body = await fetchWithRetry(url, opts, 'json');
  await mkdir(API_CACHE_DIR, { recursive: true });
  await writeFile(keyFile, body, 'utf8');
  return JSON.parse(body);
}

async function fetchWithRetry(url: string, opts: Options, kind: 'json' | 'binary'): Promise<string> {
  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await paceRequest(opts.delayMs);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          // Liquipedia requires gzip; undici transparently decompresses.
          'Accept-Encoding': 'gzip',
          Accept: kind === 'json' ? 'application/json' : '*/*',
        },
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '', 10);
        const backoff = Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000 * 2 ** (attempt - 1);
        console.warn(`  ! HTTP ${res.status} from API (attempt ${attempt}/${maxAttempts}); backing off ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      const backoff = 1000 * 2 ** (attempt - 1);
      console.warn(`  ! request failed (attempt ${attempt}/${maxAttempts}): ${(err as Error).message}; retry in ${backoff}ms`);
      if (attempt < maxAttempts) await sleep(backoff);
    }
  }
  throw new Error(`API request failed after ${maxAttempts} attempts: ${(lastErr as Error)?.message ?? 'unknown'}`);
}

async function downloadBinary(url: string, opts: Options): Promise<Buffer> {
  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await paceRequest(opts.delayMs);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' } });
      if (res.status === 429 || res.status >= 500) {
        const backoff = 1000 * 2 ** (attempt - 1);
        console.warn(`  ! HTTP ${res.status} downloading (attempt ${attempt}); backoff ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      const backoff = 1000 * 2 ** (attempt - 1);
      if (attempt < maxAttempts) await sleep(backoff);
    }
  }
  throw new Error(`download failed after ${maxAttempts} attempts: ${(lastErr as Error)?.message ?? 'unknown'}`);
}

// ===========================================================================
// Candidate generation + matching/confidence
// ===========================================================================
// Build wiki page-title candidates for a team, tagged with the confidence we'd
// assign to a logo resolved from each one.
function candidateTitles(t: Target): Array<{ title: string; confidence: Confidence }> {
  const out: Array<{ title: string; confidence: Confidence }> = [];
  const push = (raw: string | undefined, confidence: Confidence) => {
    const title = (raw ?? '').trim();
    if (!title) return;
    if (out.some((c) => c.title.toLowerCase() === title.toLowerCase())) return;
    out.push({ title, confidence });
  };
  push(t.team, 'high'); // exact display name → high confidence
  for (const a of t.aliases) push(a, 'medium'); // aliases / legacy names → medium
  // The short code alone is ambiguous (collides across games/regions) → low.
  if (t.short && t.short.toLowerCase() !== t.team.toLowerCase()) push(t.short, 'low');
  return out;
}

function parseInfoboxLogo(wikitext: string): string | null {
  // Strip wiki comments so commented-out params don't win.
  const clean = wikitext.replace(/<!--[^]*?-->/g, '');
  for (const param of LOGO_PARAMS) {
    // |param = Some File.png   (value runs until newline or next pipe)
    const re = new RegExp(`\\|\\s*${param}\\s*=\\s*([^\\n|]+)`, 'i');
    const m = clean.match(re);
    if (m) {
      const val = m[1].trim().replace(/^\[\[(?:File:)?/i, '').replace(/\|.*$/, '').replace(/\]\]$/, '').trim();
      if (val && /\.(png|svg|webp|jpe?g)$/i.test(val)) return val;
    }
  }
  return null;
}

// Convention-based logo file names Liquipedia uses when a team infobox derives
// its logo from the page title rather than an explicit param. Built from the
// canonical (post-redirect) page title.
function conventionFileTitles(pageTitle: string): string[] {
  const variants = ['darkmode', 'full darkmode', 'allmode', 'full allmode', 'lightmode', 'full lightmode', 'std', 'Logo'];
  const out = [`File:${pageTitle}.png`];
  for (const v of variants) for (const ext of ['png', 'svg', 'webp']) out.push(`File:${pageTitle} ${v}.${ext}`);
  return uniq(out);
}

// Dark UI: prefer the dark-background ("darkmode") mark, then "allmode", then a
// plain/std logo, and only fall back to "lightmode" (dark-on-light) last.
function modeRank(title: string): number {
  const s = title.toLowerCase();
  if (s.includes('darkmode')) return 0;
  if (s.includes('allmode')) return 1;
  if (s.includes('lightmode')) return 3;
  return 2; // plain / std / Logo
}

const STOPWORDS = new Set(['esports', 'esport', 'gaming', 'team', 'club', 'the', 'logo', 'full', 'std', 'darkmode', 'lightmode', 'allmode', 'pro', 'org']);
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\.(png|svg|webp|jpe?g)$/i, '')
    .replace(/\b(19|20)\d{2}\b/g, ' ') // years
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w.length > 1 && !STOPWORDS.has(w));
}

// Guard against identity-changing redirects (e.g. "Movistar R7" → LYON, "Team
// BDS" → Shifters): if the resolved file shares no meaningful token with the
// team's own names, the match is untrustworthy.
function fileMatchesTeam(t: Target, fileTitle: string): boolean {
  const teamTokens = new Set<string>();
  for (const s of [t.team, t.short, ...t.aliases]) for (const w of tokenize(s)) teamTokens.add(w);
  const base = fileTitle.replace(/^File:/i, '');
  return tokenize(base).some((w) => teamTokens.has(w));
}

interface ImageHit {
  title: string;
  url: string;
  mime: string;
  width?: number;
  height?: number;
  extmetadata: any;
  descriptionUrl?: string;
}

// Batch imageinfo lookup — returns only the File: titles that actually exist.
async function imageInfoBatch(titles: string[], opts: Options): Promise<ImageHit[]> {
  const hits: ImageHit[] = [];
  // MediaWiki caps multi-title queries at 50.
  for (let i = 0; i < titles.length; i += 40) {
    const chunk = titles.slice(i, i + 40);
    let data: any;
    try {
      data = await apiGet(
        { action: 'query', prop: 'imageinfo', titles: chunk.join('|'), iiprop: 'url|size|mime|extmetadata', redirects: '1' },
        opts,
      );
    } catch (err) {
      console.warn(`  ! imageinfo batch error: ${(err as Error).message}`);
      continue;
    }
    for (const p of data?.query?.pages ?? []) {
      const ii = p?.imageinfo?.[0];
      if (ii?.url) hits.push({ title: p.title, url: ii.url, mime: ii.mime ?? 'image/png', width: ii.width, height: ii.height, extmetadata: ii.extmetadata ?? {}, descriptionUrl: ii.descriptionurl });
    }
  }
  return hits;
}

function toResolved(t: Target, sourcePage: string, candidate: string, baseConfidence: Confidence, hit: ImageHit): ResolvedLogo {
  // Demote to low confidence when the file identity doesn't match the team.
  const confidence: Confidence = fileMatchesTeam(t, hit.title) ? baseConfidence : 'low';
  const em = hit.extmetadata ?? {};
  return {
    fileTitle: hit.title,
    sourcePage,
    matchedCandidate: candidate,
    confidence,
    fileUrl: hit.url,
    mime: hit.mime,
    ext: extFromUrlOrMime(hit.url, hit.mime),
    width: hit.width,
    height: hit.height,
    license: em.LicenseShortName?.value || em.License?.value,
    artist: stripHtml(em.Artist?.value),
    descriptionUrl: hit.descriptionUrl,
  };
}

function extFromUrlOrMime(url: string, mime: string): string {
  const fromUrl = url.split('?')[0].split('#')[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (fromUrl && IMAGE_EXTS.includes(fromUrl === 'jpeg' ? 'jpg' : fromUrl)) return fromUrl === 'jpeg' ? 'jpg' : fromUrl;
  const fromMime = mime.split('/')[1]?.toLowerCase();
  if (fromMime === 'svg+xml') return 'svg';
  if (fromMime === 'jpeg') return 'jpg';
  if (fromMime && IMAGE_EXTS.includes(fromMime)) return fromMime;
  return 'png';
}

// ===========================================================================
// Resolve a single team's logo via the API
// ===========================================================================
async function resolveLogo(t: Target, opts: Options): Promise<ResolvedLogo | null> {
  let lowConfidenceFallback: ResolvedLogo | null = null;

  for (const cand of candidateTitles(t)) {
    // 1) Read only the infobox (section 0) wikitext for this candidate page.
    let data: any;
    try {
      data = await apiGet(
        { action: 'query', prop: 'revisions', titles: cand.title, rvprop: 'content', rvslots: 'main', rvsection: '0', redirects: '1' },
        opts,
      );
    } catch (err) {
      console.warn(`  ! ${t.id}: API error for "${cand.title}": ${(err as Error).message}`);
      continue;
    }
    const page = data?.query?.pages?.[0];
    if (!page || page.missing || page.invalid) continue;
    const canonical: string = page.title ?? cand.title;
    const wikitext: string | undefined = page.revisions?.[0]?.slots?.main?.content;

    // 2a) Prefer an explicit infobox logo param.
    const explicit = wikitext ? parseInfoboxLogo(wikitext) : null;
    // When there's no explicit param, the logo file is named after the page —
    // but a redirect may make the canonical title differ from the alias that
    // actually names the file (e.g. "Isurus" page, "Isurus Gaming ..." file), so
    // try convention names from both.
    const fileTitles = explicit ? [`File:${explicit}`] : uniq([canonical, cand.title]).flatMap(conventionFileTitles);
    if (!explicit && opts.verbose) console.log(`  · ${t.id}: "${cand.title}" → no logo param, trying convention names for "${canonical}"`);

    // 2b) Resolve candidate File: titles, keep those that exist, pick best mode.
    const hits = await imageInfoBatch(fileTitles, opts);
    if (hits.length === 0) continue;
    hits.sort((a, b) => modeRank(a.title) - modeRank(b.title));
    const resolved = toResolved(t, canonical, cand.title, cand.confidence, hits[0]);

    // Trust high/medium identity matches immediately; stash low-confidence ones
    // and keep looking for a better-matching alias before giving up.
    if (resolved.confidence !== 'low') return resolved;
    if (!lowConfidenceFallback) lowConfidenceFallback = resolved;
  }
  return lowConfidenceFallback;
}

// ===========================================================================
// Manifest writing (in-place, format-preserving)
// ===========================================================================
async function writeManifestUpdates(updates: Array<{ id: string; publicPath: string; format: string }>): Promise<number> {
  if (updates.length === 0) return 0;
  let src = await readFile(MANIFEST_PATH, 'utf8');
  let changed = 0;
  for (const u of updates) {
    // Match the single-line entry: { id: '<id>', ... } and rewrite its
    // path/format/status without touching aliases or other fields. Greedy up to
    // the line's last brace so a `${DIR}` template literal in `path` (whose `}`
    // would otherwise stop a non-greedy match early) doesn't truncate the entry.
    const lineRe = new RegExp(`(\\{\\s*id:\\s*'${escapeRe(u.id)}'[^\\n]*\\})`);
    const m = src.match(lineRe);
    if (!m) {
      console.warn(`  ! manifest: no entry found for id '${u.id}' — skipped`);
      continue;
    }
    let line = m[1];
    line = setField(line, 'path', `\`/assets/teams/lol/real/${u.id}.${u.format}\``, true);
    line = setField(line, 'format', `'${u.format}'`);
    line = setField(line, 'status', `'real'`);
    src = src.replace(m[1], line);
    changed++;
  }
  if (changed > 0) await writeFile(MANIFEST_PATH, src, 'utf8');
  return changed;
}

// Replace `key: <...>` within a single object-literal line. `raw=true` means the
// replacement is inserted verbatim (used for template-literal paths).
function setField(line: string, key: string, value: string, raw = false): string {
  const v = raw ? value : value;
  const re = new RegExp(`(${key}:\\s*)(\`[^\`]*\`|'[^']*'|"[^"]*")`);
  if (re.test(line)) return line.replace(re, `$1${v}`);
  // Insert before the closing brace if the field is absent (e.g. format).
  return line.replace(/\s*\}$/, `, ${key}: ${v} }`);
}

// ===========================================================================
// Attribution doc
// ===========================================================================
async function writeAttribution(results: RunResult[], opts: Options, realDirIgnored: boolean): Promise<void> {
  const imported = results.filter((r) => r.logo && (r.outcome === 'imported' || r.outcome === 'would-import'));
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push('# LoL team logo attribution & provenance');
  lines.push('');
  lines.push('**For private prototype / friends use only. Not for public or commercial distribution.**');
  lines.push('');
  lines.push(
    'This file records the provenance of every real logo imported by ' +
      '`scripts/import-liquipedia-logos.ts`. Sources are the Liquipedia *MediaWiki API* ' +
      '(`api.php`), not scraped HTML. Official team logos are typically **trademarked / ' +
      'copyrighted**; entries are imported as private assets and marked **review required** — ' +
      'this repo does **not** claim ownership and they are **not** cleared for public redistribution.',
  );
  lines.push('');
  if (realDirIgnored) {
    lines.push(
      '> Entries below marked _(local/private)_ live under `public/assets/teams/lol/real/`, ' +
        'which is git-ignored by default — the image files are **not** committed to the repo.',
    );
    lines.push('');
  }
  lines.push('Liquipedia text content is CC-BY-SA 3.0; see https://liquipedia.net/leagueoflegends/Liquipedia:Copyrights');
  lines.push('');
  if (imported.length === 0) {
    lines.push('_No real logos have been imported yet. Run the importer with `--yes` to populate this file._');
  } else {
    for (const r of imported) {
      const l = r.logo!;
      const onDisk = existsSync(join(REAL_DIR, `${r.target.id}.${l.ext}`));
      lines.push(`## ${r.target.team} (${r.target.short}) — \`${r.target.id}\``);
      lines.push('');
      lines.push(`- **Source page:** ${l.sourcePage} (${WIKI_API.replace('/api.php', '')}/${encodeURIComponent(l.sourcePage.replace(/ /g, '_'))})`);
      lines.push(`- **File page:** ${l.fileTitle}${l.descriptionUrl ? ` (${l.descriptionUrl})` : ''}`);
      lines.push(`- **Original file URL:** ${l.fileUrl}`);
      lines.push(`- **Local path:** ${r.localPath ?? `/assets/teams/lol/real/${r.target.id}.${l.ext}`}${realDirIgnored ? ' _(local/private — git-ignored)_' : ''}`);
      lines.push(`- **License / status:** ${l.license ? l.license : 'unspecified on Liquipedia — **review required**'}`);
      lines.push(`- **Attribution:** ${l.artist ? l.artist : `© ${r.target.team} / respective rights holder. Logo sourced via Liquipedia.`}`);
      lines.push(`- **Dimensions:** ${l.width ?? '?'}×${l.height ?? '?'} (${l.mime})`);
      lines.push(`- **Match confidence:** ${l.confidence} (matched candidate: "${l.matchedCandidate}")`);
      lines.push(`- **Status on disk:** ${onDisk ? `downloaded ${today}` : 'resolved only — not downloaded (run with `--yes` to fetch)'}`);
      if (!l.license) lines.push(`- **Notes:** license metadata incomplete on Liquipedia; treat as trademark — do not redistribute publicly.`);
      lines.push('');
    }
  }
  await mkdir(dirname(ATTRIBUTION_DOC), { recursive: true });
  await writeFile(ATTRIBUTION_DOC, lines.join('\n') + '\n', 'utf8');
}

// ===========================================================================
// Helpers
// ===========================================================================
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripHtml = (s?: string) => (s ? s.replace(/<[^>]+>/g, '').trim() || undefined : undefined);

async function isRealDirGitIgnored(): Promise<boolean> {
  try {
    const gi = await readFile(join(ROOT, '.gitignore'), 'utf8');
    return /public\/assets\/teams\/lol\/real\//.test(gi);
  } catch {
    return false;
  }
}

async function realLogoExists(id: string): Promise<string | null> {
  try {
    const files = await readdir(REAL_DIR);
    const hit = files.find((f) => IMAGE_EXTS.some((e) => f.toLowerCase() === `${id}.${e}`));
    return hit ? join(REAL_DIR, hit) : null;
  } catch {
    return null;
  }
}

// ===========================================================================
// Main
// ===========================================================================
async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const realDirIgnored = await isRealDirGitIgnored();

  console.log('================================================================');
  console.log('Liquipedia LoL logo importer (private prototype)');
  console.log(`Mode: ${opts.dryRun ? 'DRY RUN (no downloads, no writes)' : 'APPLY (downloads enabled)'}`);
  if (opts.dryRun && !opts.apply) console.log('  → pass --yes (or --apply) to actually download. Showing a preview.');
  console.log(`API:  ${WIKI_API}`);
  console.log(`UA:   ${USER_AGENT}`);
  console.log(`Delay between requests: ${opts.delayMs}ms · cache: ${CACHE_DIR.replace(ROOT + '/', '')}`);
  console.log('================================================================\n');

  const manifest = await loadManifest();
  const catalog = await loadCatalog();
  const targets = buildTargets(manifest, catalog, opts);
  console.log(`Targets: ${targets.length} team(s)${opts.team ? ` (filter --team ${opts.team})` : ''}${opts.includeCatalog ? ' (incl. catalog)' : ' (manifest)'}\n`);

  const results: RunResult[] = [];
  const manifestUpdates: Array<{ id: string; publicPath: string; format: string }> = [];

  for (const t of targets) {
    process.stdout.write(`• ${t.id.padEnd(16)} ${t.team}\n`);

    // Skip teams that already have a real logo unless --force / --no-skip-existing.
    const existing = await realLogoExists(t.id);
    const alreadyRealInManifest = t.manifest?.status === 'real';
    if (existing && opts.skipExisting && !opts.force) {
      results.push({ target: t, outcome: 'skipped-existing', detail: `real logo already present: ${existing.replace(ROOT + '/', '')}` });
      console.log(`    ↳ skip (real logo exists; --force to overwrite)`);
      // Still wire the manifest if the file is on disk but not yet referenced.
      if (opts.writeManifest && t.inManifest && !alreadyRealInManifest) {
        const ext = existing.split('.').pop() ?? 'png';
        manifestUpdates.push({ id: t.id, publicPath: `/assets/teams/lol/real/${t.id}.${ext}`, format: ext });
      }
      continue;
    }

    const logo = await resolveLogo(t, opts);
    if (!logo) {
      results.push({ target: t, outcome: 'unmatched', detail: 'no infobox logo resolved from name/aliases' });
      console.log(`    ↳ unmatched (no logo found via API)`);
      continue;
    }

    // Low-confidence (short-code-only) matches are reported but NOT wired.
    if (logo.confidence === 'low' && !opts.force) {
      results.push({ target: t, outcome: 'low-confidence', detail: `low-confidence match via "${logo.matchedCandidate}" → ${logo.fileTitle}`, logo });
      console.log(`    ↳ low-confidence via "${logo.matchedCandidate}" → ${logo.fileTitle} (not wired; --force to accept)`);
      continue;
    }

    const dest = join(REAL_DIR, `${t.id}.${logo.ext}`);
    const publicPath = `/assets/teams/lol/real/${t.id}.${logo.ext}`;
    console.log(`    ↳ match (${logo.confidence}) ${logo.fileTitle}`);
    console.log(`      ${logo.fileUrl} → ${dest.replace(ROOT + '/', '')}`);

    if (opts.dryRun || opts.noDownload) {
      results.push({
        target: t,
        outcome: 'would-import',
        detail: opts.noDownload ? 'resolved (—no-download)' : 'resolved (dry-run)',
        logo,
        localPath: publicPath,
      });
      continue;
    }

    // Real download (dedupe: skip identical existing file unless --force).
    try {
      if (existsSync(dest) && !opts.force) {
        results.push({ target: t, outcome: 'skipped-existing', detail: `file already downloaded: ${dest.replace(ROOT + '/', '')}`, logo, localPath: publicPath });
        console.log(`      (already downloaded; --force to refetch)`);
      } else {
        const buf = await downloadBinary(logo.fileUrl, opts);
        await mkdir(REAL_DIR, { recursive: true });
        await writeFile(dest, buf);
        const sz = (await stat(dest)).size;
        console.log(`      saved ${sz.toLocaleString()} bytes`);
        results.push({ target: t, outcome: 'imported', detail: `downloaded ${sz} bytes`, logo, localPath: publicPath });
      }
      if (opts.writeManifest && t.inManifest) manifestUpdates.push({ id: t.id, publicPath, format: logo.ext });
    } catch (err) {
      results.push({ target: t, outcome: 'failed', detail: (err as Error).message, logo });
      console.warn(`    ! download failed: ${(err as Error).message}`);
    }
  }

  // Apply manifest updates + verify the real path exists on disk.
  let manifestChanged = 0;
  if (opts.writeManifest && !opts.dryRun && manifestUpdates.length > 0) {
    const verified = manifestUpdates.filter((u) => existsSync(join(REAL_DIR, `${u.id}.${u.format}`)));
    manifestChanged = await writeManifestUpdates(verified);
    console.log(`\nManifest: flipped ${manifestChanged} entr${manifestChanged === 1 ? 'y' : 'ies'} to status:'real'.`);
  } else if (opts.writeManifest && opts.dryRun) {
    console.log(`\nManifest: would flip ${results.filter((r) => r.outcome === 'would-import' && r.target.inManifest).length} entr(ies) (dry-run).`);
  }

  // Always (re)write the attribution doc + unmatched report.
  await writeAttribution(results, opts, realDirIgnored);
  const unmatched = results.filter((r) => r.outcome === 'unmatched' || r.outcome === 'low-confidence');
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    UNMATCHED_REPORT,
    JSON.stringify(unmatched.map((r) => ({ id: r.target.id, team: r.target.team, outcome: r.outcome, detail: r.detail, candidate: r.logo?.matchedCandidate, file: r.logo?.fileTitle })), null, 2),
    'utf8',
  );

  // -------------------------------- Summary --------------------------------
  const by = (o: RunResult['outcome']) => results.filter((r) => r.outcome === o);
  console.log('\n================================ Summary ================================');
  console.log(`Imported:         ${by('imported').length}`);
  console.log(`Would import:     ${by('would-import').length}${opts.dryRun ? ' (dry-run)' : ''}`);
  console.log(`Skipped existing: ${by('skipped-existing').length}`);
  console.log(`Low confidence:   ${by('low-confidence').length} (reported, not wired)`);
  console.log(`Unmatched:        ${by('unmatched').length}`);
  console.log(`Failed:           ${by('failed').length}`);
  console.log(`Manifest changed: ${manifestChanged}`);
  console.log(`Attribution doc:  ${ATTRIBUTION_DOC.replace(ROOT + '/', '')}`);
  console.log(`Unmatched report: ${UNMATCHED_REPORT.replace(ROOT + '/', '')}`);
  if (by('would-import').length) {
    console.log('\nWould import:');
    for (const r of by('would-import')) console.log(`  - ${r.target.id.padEnd(14)} ${r.logo?.fileTitle} (${r.logo?.confidence})`);
  }
  if (unmatched.length) {
    console.log('\nUnmatched / low-confidence (using placeholders):');
    for (const r of unmatched) console.log(`  - ${r.target.id.padEnd(14)} ${r.target.team} — ${r.detail}`);
  }
  console.log('========================================================================');
  if (opts.dryRun) console.log('Dry run complete — nothing downloaded or written (except docs/report). Re-run with --yes to apply.');
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});

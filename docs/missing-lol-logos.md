# Missing LoL team logos — checklist

**33 of 35** manifest teams now use **real** logos imported from the Liquipedia
MediaWiki API (see [`docs/logo-attribution.md`](logo-attribution.md) for
provenance). The remaining **2** keep IP-safe placeholder badges because their
Liquipedia match is low-confidence / identity-changed (review required). Real
files live under `public/assets/teams/lol/real/`; placeholder `*.svg` files are
kept in `public/assets/teams/lol/` as the fallback.

The logo paths are driven by `src/data/lolLogoManifest.ts` (single source of
truth). To (re)import a real logo, use the importer (see below) or do it manually:

1. Add the file to `public/assets/teams/lol/real/` (png/svg/webp).
2. Point the matching manifest entry's `path` at it and flip `status` to `real`.
3. Reload the app — `<TeamLogo>` picks it up automatically (no other code change).

**Status legend:** `real` = imported artwork in place · `placeholder` = bundled
brand tile · `missing` = no asset/path · `broken` = path set but file absent.

> ⚠️ Real logos are official **trademarked** artwork imported for private
> prototype use, marked **review required** in the attribution file. No ownership
> is claimed; they are not cleared for public redistribution.

| Team | Short | Current asset | Status | Placeholder fallback | Notes |
| --- | --- | --- | --- | --- | --- |
| T1 | T1 | `real/t1.png` | real | `t1.svg` | aliases: SK Telecom T1, SKT T1 |
| Gen.G | GEN | `real/geng.png` | real | `geng.svg` | aliases: Samsung Galaxy, KSV |
| Hanwha Life Esports | HLE | `real/hle.png` | real | `hle.svg` | |
| Dplus KIA | DK | `real/dk.png` | real | `dk.svg` | aliases: DAMWON Gaming, DWG KIA |
| KT Rolster | KT | `real/kt.png` | real | `kt.svg` | |
| G2 Esports | G2 | `real/g2.png` | real | `g2.svg` | alias: Gamers2 |
| Fnatic | FNC | `real/fnc.png` | real | `fnc.svg` | |
| Karmine Corp | KC | `real/kc.png` | real | `kc.svg` | |
| Team Heretics | TH | `real/th.png` | real | `th.svg` | |
| Movistar KOI | KOI | `real/koi.png` | real | `koi.svg` | aliases: Rogue, KOI |
| Bilibili Gaming | BLG | `real/blg.png` | real | `blg.svg` | LPL |
| JD Gaming | JDG | `real/jdg.png` | real | `jdg.svg` | LPL |
| Top Esports | TES | `real/tes.png` | real | `tes.svg` | LPL |
| Weibo Gaming | WBG | `real/wbg.png` | real | `wbg.svg` | LPL |
| Invictus Gaming | IG | `real/ig.png` | real | `ig.svg` | LPL |
| Cloud9 | C9 | `real/c9.png` | real | `c9.svg` | |
| Team Liquid | TL | `real/tl.png` | real | `tl.svg` | |
| FlyQuest | FLY | `real/fly.png` | real | `fly.svg` | |
| 100 Thieves | 100 | `real/100t.png` | real | `100t.svg` | historic in pack |
| LOUD | LLL | `real/loud.png` | real | `loud.svg` | CBLOL |
| paiN Gaming | PNG | `real/pain.png` | real | `pain.svg` | CBLOL |
| FURIA | FUR | `real/furia.png` | real | `furia.svg` | CBLOL |
| Los Ratones | LR | `real/losratones.png` | real | `losratones.svg` | legacy |
| SK Telecom T1 (legacy) | SKT | `real/skt.png` | real | `skt.svg` | legacy dynasty (T1 lineage) |
| Samsung Galaxy (legacy) | SSG | `real/ssg.png` | real | `ssg.svg` | legacy |
| FunPlus Phoenix (legacy) | FPX | `real/fpx.png` | real | `fpx.svg` | legacy |
| Taipei Assassins (legacy) | TPA | `real/tpa.png` | real | `tpa.svg` | legacy |
| Rare Atom | RA | `real/rareatom.png` | real | `rareatom.svg` | LPL; alias Rogue Warriors |
| PSG Talon | PSG | `real/psg.png` | real | `psg.svg` | PCS; alias Talon Esports |
| Isurus | ISG | `real/isurus.png` | real | `isurus.svg` | LLA |
| Flamengo Esports | FLA | `real/flamengo.png` | real | `flamengo.svg` | CBLOL |
| Astralis | AST | `real/astralis.png` | real | `astralis.svg` | EMEA legacy |
| Saigon Buffalo | SGB | `real/saigonbuffalo.png` | real | `saigonbuffalo.svg` | VCS legacy |
| Movistar R7 | R7 | `r7.svg` | placeholder | `r7.svg` | **review required** — API match resolves to LYON (org rebrand); not wired |
| Team BDS | BDS | `bds.svg` | placeholder | `bds.svg` | **review required** — API match resolves to Shifters (rebrand); not wired |

> The 2 placeholder teams above are intentionally **not** wired: their best
> Liquipedia match points at a different/rebranded organisation. Re-run the
> importer with `--team r7 --force` / `--team bds --force` only if you confirm the
> resolved logo is correct for your prototype.

## Teams with no logo path (generated brand/initials fallback)

Every other team in the private pack (academy/Tier 2, smaller regional and most
historic orgs) has **no manifest entry** and renders a generated brand tile or
initials badge. Add a manifest entry + asset only if you want a real logo for
one of them — nothing breaks without it.

> ⚠️ Official team logos are typically trademarked/copyrighted. Only add artwork
> you have the right to use. This repo intentionally ships placeholders only.

## Optional: the private Liquipedia logo importer

`scripts/import-liquipedia-logos.ts` can fetch real team logos for the teams in
this checklist via the **Liquipedia MediaWiki API** (`api.php`) — it reads each
team's infobox logo file, resolves the real file URL + metadata, downloads it to
`public/assets/teams/lol/real/`, and (optionally) flips the matching manifest
entry to `status: 'real'`. It **never** scrapes rendered HTML and **never** uses
image search engines. Requires Node ≥ 22 (native TypeScript) — no extra deps.

```bash
# Safe preview — resolves logos, downloads nothing, writes no files (the default)
npm run import-logos -- --dry-run

# Import a single team (downloads + wires the manifest locally)
npm run import-logos -- --team t1 --yes --write-manifest

# Import everything confidently matched and wire the manifest
npm run import-logos -- --yes --write-manifest

# Re-import / overwrite an existing real logo
npm run import-logos -- --team g2 --yes --force --write-manifest
```

Flags: `--dry-run`, `--yes`/`--apply`, `--team <id|short|name|alias>`,
`--limit <n>`, `--force`, `--skip-existing` (default on), `--no-download`,
`--write-manifest`, `--include-catalog`, `--delay <ms>`, `--verbose`. Run
`npm run import-logos -- --help` for details.

**Safe by default:** with no `--yes` it always runs a dry run (no downloads, no
writes). It respects Liquipedia's API terms — a descriptive User-Agent, gzip,
a conservative request delay, on-disk response caching (`.cache/liquipedia-logo-import/`),
and retries with backoff. Low-confidence / identity-changed matches (e.g. a team
that rebranded into a different org) are reported but **not** wired.

### Verify visual rendering

1. Run the importer for a few teams with `--write-manifest`, then `npm run dev`.
2. Create a league from the **Private LoL Esports pack** (New Game wizard) so the
   pack reads the updated manifest, and open a team profile / standings / career
   hub. The badge should be the real artwork, and in dev tools the `<img>` `src`
   should be `/assets/teams/lol/real/<id>.png` — not a `data:` URI (a `data:`
   URI means the file is missing and the generated fallback kicked in).

### Provenance, copyright & what is safe to commit

- Every imported logo's source page, file page, original URL, license/status and
  attribution are recorded in [`docs/logo-attribution.md`](logo-attribution.md).
- Official logos are **trademarked**; imported files are marked **review required**
  and are **not** cleared for public redistribution. This repo claims no ownership.
- **Placeholders are the safe, committed default.** Real logos are optional
  **private** assets: `public/assets/teams/lol/real/` is git-ignored, so the
  downloaded images and any `status: 'real'` manifest edits stay local unless you
  explicitly choose to commit artwork you have the right to use
  (`git add -f public/assets/teams/lol/real/<file>`).

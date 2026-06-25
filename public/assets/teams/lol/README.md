# Private LoL team badges

Drop-in folder for the private LoL esports data pack's team artwork.

The bundled `*.svg` files are **abstract, brand-coloured placeholder badges**
(a gradient tile + the team's short name). They are intentionally generic — they
are **not** reproductions of any official team logo. They exist so the UI shows
intentional, on-brand tiles instead of empty boxes, and so real artwork can be
dropped in later **without any code changes**.

## How it works

- `src/data/lolLogoManifest.ts` is the **single source of truth**: it maps each
  team id (and aliases) to an asset path here. The data pack reads paths from it.
- `<TeamLogo>` renders that path. If the file is missing or fails to load, it
  falls back to a deterministic, brand-coloured initials tile — nothing breaks.
- The drop-in checklist lives at `docs/missing-lol-logos.md`.

## Expected filenames

One file per team id (see the manifest / checklist). Current placeholders:

```
t1  geng  hle  dk  kt          (Korea / LCK)
g2  fnc  kc  th  koi           (EMEA / LEC)
blg  jdg  tes  wbg  ig         (China / LPL)
c9  tl  fly  100t              (North America)
loud  pain  furia              (South America)
losratones  skt  ssg  fpx  tpa (historic / legacy)
```

## Supported formats & sizing

- **Formats:** `.svg` (preferred), `.png`, or `.webp`.
- **Recommended size:** square, ~120×120 or larger (SVG scales freely).
- **Background:** transparent preferred so the tile reads on the dark UI.
- Keep the logo's aspect ratio intact and avoid cropping important detail; the
  component renders it in a square box, so very wide marks may look small.

## How to replace a placeholder with a real logo

### Manually

1. Add the file here, e.g. `t1.svg` (or `t1.png` / `t1.webp`).
2. In `src/data/lolLogoManifest.ts`, point that team's `path` at the file and
   set `format` + `status: 'real'`.
3. Reload the app. No other code changes are needed.

### With the importer (optional, private)

`scripts/import-liquipedia-logos.ts` automates the above using the **Liquipedia
MediaWiki API** (no HTML scraping, no image search). It downloads real logos to
the `real/` subfolder and wires the manifest for you:

```bash
npm run import-logos -- --dry-run                       # safe preview (default)
npm run import-logos -- --team t1 --yes --write-manifest # one team
npm run import-logos -- --yes --write-manifest           # all matched teams
```

See [`docs/missing-lol-logos.md`](../../../../docs/missing-lol-logos.md) for the
full flag list and [`docs/logo-attribution.md`](../../../../docs/logo-attribution.md)
for the provenance/license record of each imported file.

### Safe to commit vs. private-only

- **Safe to commit (and shipped):** the `*.svg` placeholder badges in this folder.
  They are the fallback default — keep them.
- **Private by default:** real logos downloaded to `real/`. That subfolder is
  **git-ignored** because official logos are trademarked. The downloaded files and
  any `status: 'real'` manifest edits stay local. To intentionally commit a logo
  you have the rights to: `git add -f public/assets/teams/lol/real/<file>`.

## How to verify the app loads the real logo

- Open a league using the private pack and visit that team's profile / a team
  card. The badge should be your artwork, not the initials tile.
- In dev tools, the `<img>` `src` should be the asset path (e.g.
  `/assets/teams/lol/t1.svg`), not a `data:` URI. A `data:` URI means the file
  was missing or failed to load and the fallback kicked in.

> ⚠️ Official team logos are typically trademarked/copyrighted. Only add artwork
> you have the right to use. This repo intentionally ships placeholders only and
> claims no ownership of any official logo.

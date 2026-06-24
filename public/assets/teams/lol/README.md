# Private LoL team badges

Drop-in folder for the private LoL esports data pack's team artwork.

The bundled `*.svg` files are **abstract, brand-coloured placeholder badges**
(a gradient tile + the team's short name). They are intentionally generic — they
are **not** reproductions of any official team logo. They exist so the UI shows
intentional, on-brand tiles instead of empty boxes, and so real artwork can be
dropped in later **without any code changes**.

## How it works

- The data pack (`src/data/packs/lol-esports-private-v1/index.ts`) points each
  enriched team's `logo` at `/assets/teams/lol/<id>.svg`.
- `<TeamLogo>` renders that path. If the file is missing or fails to load, it
  falls back to a deterministic, brand-coloured initials tile — nothing breaks.

## Adding your own assets

1. Replace `<id>.svg` (or add `<id>.png`) here, keeping a roughly square shape.
2. If the file name differs, update that team's `logo` path in the pack.
3. Light/dark variants can be supplied via the team's `logo_light` / `logo_dark`
   metadata fields.

Use only assets you have the right to use. Do not commit official logos you do
not have a licence for.

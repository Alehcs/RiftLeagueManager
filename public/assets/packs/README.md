# Data pack assets

Static logos and images referenced by data packs live here, served from
`/assets/packs/<pack-id>/<file>`.

A pack's `logo` / asset `path` can be either:

- a **local public path** like `/assets/packs/sample/aurora.svg` (a file in this folder), or
- an **external URL** like `https://example.com/logo.png`.

If a logo is missing or fails to load, the UI falls back to generated initials,
so packs never require bundled images.

`sample/aurora.svg` is a generic placeholder used by the bundled sample pack to
exercise the local-asset path. Do not commit real/copyrighted esports logos
here; private real-data packs should reference their own externally hosted or
locally provided assets.

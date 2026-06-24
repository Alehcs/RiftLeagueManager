# Missing LoL team logos — checklist

All bundled team badges under `public/assets/teams/lol/` are currently **IP-safe
placeholders** (brand colour + initials), not official logos. This table tracks
which teams still need real, licensed artwork dropped in.

The logo paths are driven by `src/data/lolLogoManifest.ts` (single source of
truth). To replace a placeholder with a real logo:

1. Add the file to `public/assets/teams/lol/` (svg preferred; png/webp also fine).
2. Point the matching manifest entry's `path` at it and flip `status` to `real`.
3. Reload the app — `<TeamLogo>` picks it up automatically (no other code change).

**Status legend:** `real` = licensed artwork in place · `placeholder` = bundled
brand tile · `missing` = no asset/path · `broken` = path set but file absent.

| Team | Short | Current asset | Status | Expected filename | Notes |
| --- | --- | --- | --- | --- | --- |
| T1 | T1 | `t1.svg` | placeholder | `t1.svg` | aliases: SK Telecom T1, SKT T1 |
| Gen.G | GEN | `geng.svg` | placeholder | `geng.svg` | aliases: Samsung Galaxy, KSV |
| Hanwha Life Esports | HLE | `hle.svg` | placeholder | `hle.svg` | |
| Dplus KIA | DK | `dk.svg` | placeholder | `dk.svg` | aliases: DAMWON Gaming, DWG KIA |
| KT Rolster | KT | `kt.svg` | placeholder | `kt.svg` | |
| G2 Esports | G2 | `g2.svg` | placeholder | `g2.svg` | alias: Gamers2 |
| Fnatic | FNC | `fnc.svg` | placeholder | `fnc.svg` | |
| Karmine Corp | KC | `kc.svg` | placeholder | `kc.svg` | |
| Team Heretics | TH | `th.svg` | placeholder | `th.svg` | |
| Movistar KOI | KOI | `koi.svg` | placeholder | `koi.svg` | aliases: Rogue, KOI |
| Bilibili Gaming | BLG | `blg.svg` | placeholder | `blg.svg` | |
| JD Gaming | JDG | `jdg.svg` | placeholder | `jdg.svg` | |
| Top Esports | TES | `tes.svg` | placeholder | `tes.svg` | |
| Weibo Gaming | WBG | `wbg.svg` | placeholder | `wbg.svg` | |
| Invictus Gaming | IG | `ig.svg` | placeholder | `ig.svg` | |
| Cloud9 | C9 | `c9.svg` | placeholder | `c9.svg` | |
| Team Liquid | TL | `tl.svg` | placeholder | `tl.svg` | |
| FlyQuest | FLY | `fly.svg` | placeholder | `fly.svg` | |
| 100 Thieves | 100 | `100t.svg` | placeholder | `100t.svg` | historic in pack |
| LOUD | LLL | `loud.svg` | placeholder | `loud.svg` | |
| paiN Gaming | PNG | `pain.svg` | placeholder | `pain.svg` | |
| FURIA | FUR | `furia.svg` | placeholder | `furia.svg` | |
| Los Ratones | LR | `losratones.svg` | placeholder | `losratones.svg` | legacy |
| SK Telecom T1 (legacy) | SKT | `skt.svg` | placeholder | `skt.svg` | legacy dynasty |
| Samsung Galaxy (legacy) | SSG | `ssg.svg` | placeholder | `ssg.svg` | legacy |
| FunPlus Phoenix (legacy) | FPX | `fpx.svg` | placeholder | `fpx.svg` | legacy |
| Taipei Assassins (legacy) | TPA | `tpa.svg` | placeholder | `tpa.svg` | legacy |
| Team BDS | BDS | `bds.svg` | placeholder | `bds.svg` | added — EMEA |
| Rare Atom | RA | `rareatom.svg` | placeholder | `rareatom.svg` | added — LPL; alias Rogue Warriors |
| PSG Talon | PSG | `psg.svg` | placeholder | `psg.svg` | added — PCS; alias Talon Esports |
| Isurus | ISG | `isurus.svg` | placeholder | `isurus.svg` | added — LLA |
| Movistar R7 | R7 | `r7.svg` | placeholder | `r7.svg` | added — LLA; alias Rainbow7 |
| Flamengo Esports | FLA | `flamengo.svg` | placeholder | `flamengo.svg` | added — CBLOL |
| Astralis | AST | `astralis.svg` | placeholder | `astralis.svg` | added — EMEA legacy |
| Saigon Buffalo | SGB | `saigonbuffalo.svg` | placeholder | `saigonbuffalo.svg` | added — VCS legacy |

> No real (licensed) logo files exist in the repo yet — **every team above uses a
> placeholder badge**. Drop real artwork in and flip the manifest `status` to
> `real` to update this list.

## Teams with no logo path (generated brand/initials fallback)

Every other team in the private pack (academy/Tier 2, smaller regional and most
historic orgs) has **no manifest entry** and renders a generated brand tile or
initials badge. Add a manifest entry + asset only if you want a real logo for
one of them — nothing breaks without it.

> ⚠️ Official team logos are typically trademarked/copyrighted. Only add artwork
> you have the right to use. This repo intentionally ships placeholders only.

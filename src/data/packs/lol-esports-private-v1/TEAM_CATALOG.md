# LoL Esports — Private Data Pack: Team Catalog

**For private prototype / friends use only. Not for public or commercial distribution.**

Primary reference: [Liquipedia Portal:Teams](https://liquipedia.net/leagueoflegends/Portal:Teams).
Team identities are real; rosters list verified handles only where known (rest
auto-filled); no logos bundled (initials fallback). 137 teams total.

## Current Active Teams (Tier 1, by region)

### North America (LCS / LTA North)
Cloud9, Dignitas, Disguised, FlyQuest, LYON, Sentinels, Shopify Rebellion, Team Liquid

### South America (CBLOL / LTA South)
Fluxo W7M, FURIA, Keyd Stars, Leviatán, LOS, LOUD, paiN Gaming, RED Canids

### EMEA (LEC)
Fnatic, G2 Esports, GIANTX, Karmine Corp, Movistar KOI, Natus Vincere, Shifters, SK Gaming, Team Heretics, Team Vitality

### China (LPL)
Anyone's Legend, Bilibili Gaming, EDward Gaming, Invictus Gaming, JD Gaming, LGD Gaming, LNG Esports, Ninjas in Pyjamas, Oh My God, Royal Never Give Up, Team WE, ThunderTalk Gaming, Top Esports, Ultra Prime, Weibo Gaming

### Korea (LCK)
BRION, Dplus KIA, DRX, FEARX, Gen.G, Hanwha Life Esports, KT Rolster, Nongshim RedForce, SOOPers, T1

### Pacific (LCP)
CTBC Flying Oyster, Deep Cross Gaming, DetonatioN FocusMe, SoftBank HAWKS gaming, GAM Esports, Ground Zero Gaming, MVK Esports, Secret Whales

## Tier 1 Teams
All 59 teams above are tier `tier1`, `active: true`, and seed the per-region
competitions (`comp-na`, `comp-sa`, `comp-emea`, `comp-china`, `comp-korea`,
`comp-pacific`) plus the cross-region `Tier 1 Global` template.

## Tier 2 / Academy / Challengers Teams (in pack data)

### NACL — North America Challengers (tier2)
Apex Mission Impossible, Blue Otter, CCG Esports, Citadel Gaming, Conviction, Dorado Gaming, Maryville University, NRG, Supernova, Winthrop University

### LCK Challengers League — Korea academies (tier2)
BRION Challengers, Dplus Challengers, DRX Challengers, FEARX Youth, Gen.G Global Academy, HLE Challengers, KT Rolster Challengers, Nongshim Challengers, SOOPers Challengers, T1 Esports Academy

Competitions: `comp-nacl`, `comp-lck-cl`.

## Historic / Legacy / Disbanded Teams (active: false)

These cover a mix of statuses — disbanded orgs, teams that left LoL, and legacy
names that were rebranded or absorbed (e.g. SK Telecom T1 → T1, Suning → Weibo
Gaming, MAD Lions → Movistar KOI, Royal Club → RNG). Not all are strictly
disbanded; all carry `active: false` and stay available for nostalgia / custom
tournaments.

### North America
TSM, Counter Logic Gaming, OpTic Gaming, Evil Geniuses, Golden Guardians, Immortals, Echo Fox, Team EnVyUs, compLexity Gaming, 100 Thieves

### EMEA
Origen, Splyce, Misfits Gaming, H2k Gaming, Gambit Esports, Unicorns of Love, Alliance, FC Schalke 04 Esports, MAD Lions, Excel Esports, Moscow Five

### Korea
SK Telecom T1, Samsung Galaxy, KOO Tigers, Longzhu Gaming, Griffin, ROX Tigers, CJ Entus, NaJin e-mFire, Jin Air Green Wings

### China
Royal Club, Snake Esports, Vici Gaming, Newbee, Suning

### Pacific
Taipei Assassins, Flash Wolves, ahq e-Sports Club, Albus NoX Luna

### Missing-teams pass — newly added (19, all `active: false`)
- **EMEA**: Los Ratones (LR — NLC, founded 2024 by Caedrel, disbanded Feb 2026), Rogue, Giants Gaming, against All authority, Copenhagen Wolves
- **Korea**: Samsung Galaxy White, Samsung Galaxy Blue, Azubu Frost, MVP Ozone, Afreeca Freecs, Incredible Miracle
- **China**: FunPlus Phoenix (Worlds 2019 champions)
- **North America**: Team Curse
- **South America**: KaBuM! e-Sports, INTZ e-Sports
- **Pacific / wildcard**: Saigon Jokers, Bangkok Titans, Dire Wolves, Chiefs Esports Club

## Nostalgia Templates
The historic / legacy / disbanded teams above carry `active: false` and keep
their original region for context but are **never placed in current regional
competitions**. They power six nostalgia templates (generated rosters — no
real players invented):

- **Historic Legends Cup** — SKT, Samsung Galaxy, Taipei Assassins, Flash Wolves, TSM, CLG, Origen, Gambit
- **Disbanded Teams Cup** — Misfits, Splyce, H2k, Evil Geniuses, OpTic, Echo Fox, Immortals, ROX Tigers
- **Global All-Time Invitational** — T1, SKT, Samsung Galaxy, Gen.G, Fnatic, G2, TSM, RNG
- **EU Legends Cup** — Los Ratones, Rogue, Giants Gaming, against All authority, Copenhagen Wolves, Origen, Misfits, Gambit
- **Worlds Throwback** — Samsung White, Samsung Blue, Azubu Frost, Afreeca Freecs, FunPlus Phoenix, KaBuM!, Taipei Assassins, SKT
- **All-Time Wildcards** — Saigon Jokers, Bangkok Titans, Dire Wolves, Chiefs, INTZ, MVP Ozone, Incredible Miracle, Team Curse

> The data model has no dedicated `category`/`era` field — historic status is
> expressed via `active: false`. Era notes live here in the catalog.

## Missing / Needs Verification

Secondary leagues listed on Portal:Teams but **catalogued only (not yet in pack
data)** — obscure short_names/tiers need verification before adding:

- **Liga Regional Norte / Sur** (LLA-region ERLs)
- **Circuito Desafiante** (Brazil challengers)
- **LDL** (China development league)
- **LoL Japan League (LJL)**, **VCS** (Vietnam), **PCS** academies — note these
  feed into LCP/Pacific now.
- **Active ERLs** (LFL, Prime League, SuperLiga, NLC, etc.) — only the notable
  Los Ratones was added; the wider ERL field is still a TODO.

Uncertain fields to confirm against the current split:
- Los Ratones is modelled as `erl` / EMEA / `active: false` (disbanded 2026);
  confirm tier/era if used in a historical season.
- Some legacy names overlap lineages (Samsung White/Blue → Samsung Galaxy → Gen.G;
  Azubu Frost → CJ Entus; Afreeca Freecs → Kwangdong) — kept as distinct era
  entries on purpose.
- short_names for newer/renamed orgs: **Shifters** (SHF?), **SOOPers** (SOP?),
  **FEARX** (FX?), **Deep Cross Gaming** (DCG?), **Ground Zero Gaming** (GZG?).
- Region model: NA + SA are modelled separately but now sit under **LTA**
  (North/South). Re-bucket if you want a single LTA region.
- Per-player nationality defaults to the org's home country and is approximate.
- Some org names reflect recent rebrands (e.g. Dplus KIA → Dplus, Movistar KOI).

## Roster TODOs
- Verified starters exist for: all LCK teams + G2 (full), plus partial anchors
  for JDG, BLG, TES, WBG, LNG, Fnatic, Cloud9, Team Liquid, FlyQuest, PSG/GAM,
  LOUD, paiN.
- Every other team (and every academy/historic team) is **auto-completed** by the
  seed pipeline with generated, clearly-flagged players. Fill in verified
  starters + substitutes by role per the current split — do not fabricate.

## Logo TODOs
- **No logos are bundled.** Every team renders generated initials.
- To add logos, drop files under `public/assets/packs/lol-esports-private-v1/`
  (or set remote URLs) and assign `logo` on each team/organization. Do not commit
  copyrighted official logos.

# Rift League Manager

A complete **League of Legends esports league manager & simulator** — create, import, manage, simulate and edit real LoL esports leagues, tournaments, teams, players, coaches, rosters, transfers, trades, schedules, standings, match results, playoffs and international events.

Inspired by tournament-manager apps, adapted end-to-end for **LoL Esports** (LCK, LPL, LEC, LCS, CBLOL, Worlds, MSI, ERLs, academy leagues and custom tournaments).

> **Runs with zero configuration.** `npm install && npm run dev` boots a fully-featured app in **mock mode** — data persists in your browser and syncs **live across tabs**. Supabase is an optional upgrade for a shared server database.

---

## ✨ Features

- **Create / import / clone leagues** via an 8-step wizard — real teams, rosters, coaches & formats.
- **Real LoL esports structure** — LCK, LPL, LEC, LCS, CBLOL + a Tier 2 academy league + Worlds & MSI, seeded with real team names, player nicknames, roles, nationalities and coaches.
- **Working simulation engine** — team strength from rosters + coach + budget + form; per-game variance; BO1/BO3/BO5; kills, gold & duration; live standings.
- **Schedule & bracket generators** — single/double round robin, single & double elimination, group stage, swiss, Worlds- & MSI-style.
- **Transfer market & trades** — sign / release / sell, multi-player + cash trades with budget validation, roster validation, contract tracking, full transfer history.
- **Playoffs** — generate a bracket from standings, simulate it, crown a champion (with bye seeding & winner/loser advancement).
- **Realtime** — every change broadcasts across open tabs with toast notifications (`"Gen.G defeated KT 2-1"`, `"Trade accepted"`, `"LCK data import completed"`).
- **Full admin panel** — league settings, team/player/coach managers, schedule regeneration, asset manager, import/export, admins, audit logs, danger zone.
- **Import / export** — League JSON bundles + Teams/Players/Coaches/Matches CSV (documented formats).
- **Editable everything** — all generated ratings/values/contracts and imported data can be edited from the UI. Generated values are clearly flagged.
- **Dark, responsive esports UI** — role/region/tier badges, rating bars, team logo & player avatar fallbacks (generated initials tiles), standings tables, fixture cards, bracket view.

---

## 🚀 Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

That's it — the app seeds demo leagues on first load. No database, no API keys.

Other scripts:

```bash
npm run build      # production build
npm run start      # run the production build
npm run typecheck  # tsc --noEmit
```

---

## 🧱 Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (dark, custom esports theme) + **lucide-react** icons
- **Zustand** store with `localStorage` persistence + **BroadcastChannel** realtime
- **Supabase** (Auth / Postgres / Storage / Realtime) — optional, schema + clients included

---

## ✅ Current Status

**Implemented in mock and Supabase modes:**

- League create / import / clone wizard; 8 seeded real leagues (LCK, LPL, LEC, LCS, CBLOL, a Tier 2 academy league, Worlds, MSI).
- Schedule & bracket generation; match / week / regular-season / playoff simulation.
- Standings calculation, team strength, roster validation.
- Transfer market: sign / release / sell, multi-player + cash trades with budget validation, transfer history.
- Admin panel: full CRUD, league settings, asset manager, audit logs, import/export.
- JSON league bundles + Teams/Players/Coaches/Matches CSV import & export.
- Adapter-backed CRUD for leagues, teams, players, coaches, matches, games, trades, transfer history, imports and audit logs.
- Mock realtime across browser tabs with `BroadcastChannel`; Supabase Realtime for matches, standings, rosters, trades and audit logs.
- Guest nickname sessions with persistent browser identity, room membership, invite links and realtime presence.
- Guest-aware owner/admin/manager checks in both the client adapter and Postgres RLS policies.

**Known data limitations:**

- Import adapters resolve from the **bundled dataset**; live wiki/official fetching is stubbed (`fetchLive`) with a graceful fallback.
- Player ratings, values and contracts are **generated**, not real — and editable in-app.

---

## 🗺️ Routes

| Route | Description |
| --- | --- |
| `/` | Landing page with featured leagues |
| `/dashboard` | All leagues grouped by tier |
| `/join/[roomCode]` | Join a shared league room as the current guest |
| `/leagues/new` | Create wizard (manual · clone · import JSON) |
| `/leagues/import` | Import a real LoL esports league (source → select → preview → import) |
| `/leagues/[id]` | League overview |
| `/leagues/[id]/standings` | Standings (with group support) |
| `/leagues/[id]/schedule` | Fixtures by week + per-week simulate |
| `/leagues/[id]/matches/[matchId]` | Match detail, games, win probability, result editor |
| `/leagues/[id]/teams` · `/teams/[teamId]` | Teams grid · team profile (roster, validation, strength) |
| `/leagues/[id]/players` · `/coaches` | Player & coach databases |
| `/leagues/[id]/market` | Transfer market |
| `/leagues/[id]/trades` | Trade proposals & history |
| `/leagues/[id]/playoffs` | Bracket view |
| `/leagues/[id]/admin` | Admin panel |
| `/import-center` | Global import center + live job logs |
| `/profile` | Profile & local-data controls |

---

## 🏗️ Architecture

The UI never talks to a database directly — it goes through a service layer and a single store.

```
src/
├── app/                      # Next.js App Router pages (mostly client components)
├── components/               # UI primitives + feature components (league, team, player, coach, trade)
├── lib/
│   ├── types.ts              # Domain types — mirror the Postgres schema 1:1
│   ├── constants.ts          # Roles, tiers, regions, formats
│   ├── rng.ts                # Deterministic PRNG (stable generated ratings)
│   ├── data/                 # Mock and Supabase repository adapters
│   ├── store/                # Zustand domain actions, optimistic state, selectors, hooks
│   └── supabase/             # Optional Supabase clients (browser/server)
├── services/                 # Framework-agnostic engine — no React, no UI
│   ├── ratings.ts            # Rating / value / salary / budget generation
│   ├── strength.ts           # Team strength from roster + coach + budget + form
│   ├── simulation.ts         # Match simulator
│   ├── standings.ts          # Standings calculation
│   ├── schedule.ts           # Round robin · elim brackets · groups · swiss
│   ├── transfers.ts          # Roster / budget validation, trade math
│   ├── assets.ts             # Logo/avatar fallbacks + candidate public URLs
│   ├── csv.ts                # CSV parse/serialize for the documented formats
│   ├── leagueIO.ts           # League JSON export + re-id import (clone-safe)
│   └── importers/            # Adapter layer (Leaguepedia, Liquipedia, LoL Esports, …)
└── data/
    ├── rosters.ts            # Compact real-data source tables (the only hand-authored data)
    └── seed.ts               # Seed builder — expands rosters into full entities
```

### Data layer (mock vs Supabase)

- **Mock mode (default):** `mockAdapter` loads and saves the full `Database` shape and guest ID in `localStorage`, and uses `BroadcastChannel` for data updates and room presence.
- **Supabase mode:** `supabaseAdapter` keeps the visible identity in `guest_sessions`, uses invisible anonymous auth only to bind RLS permissions, applies diff-based CRUD mutations, and refreshes data and presence through Supabase Realtime. Set `NEXT_PUBLIC_FORCE_MOCK=true` to keep local mode even when Supabase variables exist.

> The mock store and the Postgres schema share the exact same shape, so moving from one to the other is a mechanical swap rather than a rewrite.

### Data import adapters

`services/importers/` exposes a uniform `ImportAdapter` interface (`searchLeagues` / `fetchLeague` / `searchTeams` / `searchPlayers`) implemented by **Leaguepedia**, **Liquipedia**, **LoL Esports**, **Generic Wiki** and **Manual JSON** adapters. Each returns normalized data as a `RawLeague`, which the shared seed builder turns into full entities (with generated ratings/values).

The bundled adapters resolve from the shipped real-data tables, so **imports work fully offline and deterministically**. A `fetchLive()` seam shows exactly where a real wiki/official HTTP fetch slots in; it always falls back to bundled data so an import never fails in the demo.

---

## 📊 Generated data & accuracy

Real per-player ratings don't exist publicly, so the app **synthesizes** plausible ratings, market values, salaries and contracts from team strength, tier, role and star status — using a deterministic PRNG so values are stable. Rosters list real player nicknames where confidently known; any missing core role is **auto-filled** with a generated player so every team always fields a full lineup.

Everything generated is **clearly flagged** (a small `gen` badge / `Generated` source) and **fully editable** from the admin panel and entity dialogs. Accuracy is intentionally "good enough to be recognizable" — the priority is a working end-to-end manager, exactly as specified.

---

## 📥 CSV import formats

Import from the **Admin → Import/Export** panel. Headers (first row required):

**Players**
```
nickname,real_name,role,nationality,age,value,salary,rating_overall,rating_laning,rating_teamfighting,rating_macro,rating_mechanics,rating_consistency,team_short_name,image_url,external_url
```
**Coaches**
```
nickname,real_name,nationality,age,rating_draft,rating_macro,rating_development,rating_leadership,team_short_name,image_url,external_url
```
**Teams**
```
name,short_name,region,country,tier,logo_url,external_url,budget
```
**Matches**
```
stage,week,match_day,date_time,blue_team_short_name,red_team_short_name,format,status,winner_team_short_name,blue_score,red_score,patch,venue_text,stream_url,external_url
```

`team_short_name` resolves to a team in the current league. Roles accept common aliases (`JNG`, `BOT`, `SUPP`, …).

---

## 🔌 Optional: connecting Supabase

1. Create a Supabase project.
2. Enable **Anonymous Sign-Ins** under Authentication → Providers. No email/password UI is required.
3. Run `supabase/migrations/0001_init.sql` with `supabase db push` or the SQL editor.
4. Copy `.env.example` → `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...        # server-only
   ```
5. Restart `npm run dev` (env vars are read at server start). The navbar badge switches from **MOCK MODE** to **SUPABASE** (or **SUPABASE?** if only one var is set). Hover the badge for a masked diagnostic.

The anon key accepts the legacy anon JWT (`eyJ…`) or the new publishable key (`sb_publishable_…`).

Reads are public. The app creates an invisible anonymous auth session, then binds it to the browser's guest ID. League writes require an `owner`, `admin`, or `manager` guest role; league settings and role management remain owner/admin-only.

**Troubleshooting**
- Badge stays **MOCK MODE** with vars set → the dev server was started before `.env.local`; restart it.
- `Unable to start the guest session: … anonymous_provider_disabled` → enable **Anonymous Sign-Ins** (step 2).
- `permission denied for table …` → re-run `0001_init.sql`; it grants the `anon`/`authenticated` roles table access (some projects lack the default grants).

---

## 🎮 Main flow

1. Open the app and choose a temporary nickname. The guest ID persists in the browser.
2. **Import**, **create**, or **join** a league using its room code or invite link.
3. Review imported teams, rosters & coaches; **edit** anything that's off.
4. **Generate or regenerate** the schedule.
5. **Simulate** a match, a week, the regular season or the full tournament.
6. Standings update automatically; **generate playoffs** and crown a champion.
7. Manage rosters — **sign / release / sell**, propose **trades** with cash.
8. Share the invite link and watch data and active-room users update in realtime.

---

## 🧭 Next Steps

- **Improve real-data importers** — implement `fetchLive()` against Leaguepedia / Liquipedia / LoL Esports to pull live rosters, logos, schedules and results.
- **Expand regional rosters** — add VCS, LJL, LLA, PCS, TCL, LCP and ERLs (LFL, Prime League, SuperLiga, NLC, Ultraliga, EMEA Masters) with current rosters.
- **Improve the simulation / rating system** — richer per-game model (draft, side advantage, momentum), data-informed ratings and calibration.
- **Polish UI/UX** — refined loading/empty states, mobile tuning, motion, accessibility and keyboard navigation.
- **Prepare deploy** — production config, env management, and a Vercel + Supabase deployment with a seeding strategy.

---

## 📝 Notes & limitations

- Mock data lives in your browser. **Profile → Wipe & reseed** resets it; **Reset demo** on the dashboard reloads the seeded leagues.
- Supabase multi-entity operations are serialized but are not yet wrapped in a single Postgres transaction.
- Guest recovery codes are optional. Supabase stores a hash; mock mode keeps the code only in local browser data.
- Guest identity is browser-local. Clearing site data loses that identity unless the league has a recovery code.
- There is no email/password account or cross-device guest sync yet.
- Double elimination is generated for 4- and 8-team fields (used by MSI); other sizes fall back to single elimination.
- Swiss pairing is a simplified records-based implementation.
- Team logos / player images default to generated initials tiles; paste real public image URLs in **Admin → Assets** (or per entity) to replace them.

---

Built as a usable end-to-end MVP — actual CRUD, state, simulation, transfers, realtime, import/export and admin, with a mock fallback so it always just works.

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

**Implemented & working (mock mode — the default):**

- League create / import / clone wizard; 8 seeded real leagues (LCK, LPL, LEC, LCS, CBLOL, a Tier 2 academy league, Worlds, MSI).
- Schedule & bracket generation; match / week / regular-season / playoff simulation.
- Standings calculation, team strength, roster validation.
- Transfer market: sign / release / sell, multi-player + cash trades with budget validation, transfer history.
- Admin panel: full CRUD, league settings, asset manager, audit logs, import/export.
- JSON league bundles + Teams/Players/Coaches/Matches CSV import & export.
- Realtime updates across browser tabs (BroadcastChannel) with toast notifications.

**Still mock / localStorage-based (not yet server-backed):**

- All data lives in the in-app store, persisted to the browser's `localStorage`. There is **no shared backend** in the default setup — each browser keeps its own copy.
- "Realtime" is **cross-tab only** (same browser), via `BroadcastChannel` — not multi-user over a network.
- **Supabase is scaffolding only.** The SQL schema/RLS migration and client helpers are included and the store mirrors the schema 1:1, but entity reads/writes still go through the local store. Supabase env vars currently only switch a status badge.
- Import adapters resolve from the **bundled dataset**; live wiki/official fetching is stubbed (`fetchLive`) with a graceful fallback.
- Player ratings, values and contracts are **generated**, not real — and editable in-app.

---

## 🗺️ Routes

| Route | Description |
| --- | --- |
| `/` | Landing page with featured leagues |
| `/dashboard` | All leagues grouped by tier |
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
│   ├── store/                # Zustand store (actions, persistence, realtime), selectors, hooks
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

- **Mock mode (default):** the Zustand store holds the entire database (shape = `Database` in `lib/types.ts`), persists it to `localStorage`, and broadcasts changes over the `BroadcastChannel` API so multiple tabs stay in sync in realtime. Toasts surface live events.
- **Supabase mode:** if `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set (and `NEXT_PUBLIC_FORCE_MOCK` ≠ `true`), the app reports Supabase mode. The full schema, RLS policies and realtime publication live in `supabase/migrations/0001_init.sql`, and browser/server clients are in `src/lib/supabase/`. Apply the migration with the Supabase CLI (`supabase db push`) or the SQL editor.

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
2. Run `supabase/migrations/0001_init.sql` (CLI `supabase db push`, or paste into the SQL editor).
3. Copy `.env.example` → `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...        # server-only
   ```
4. Restart `npm run dev`. The navbar badge switches from **MOCK MODE** to **SUPABASE**.

The included RLS policies are demo-friendly (public read, authenticated write) — tighten them against `league_admins` for production.

---

## 🎮 Main flow

1. Open the app → browse featured leagues (seeded with real structure).
2. **Import** a real league or **create** one from scratch.
3. Review imported teams, rosters & coaches; **edit** anything that's off.
4. **Generate or regenerate** the schedule.
5. **Simulate** a match, a week, the regular season or the full tournament.
6. Standings update automatically; **generate playoffs** and crown a champion.
7. Manage rosters — **sign / release / sell**, propose **trades** with cash.
8. Watch every change appear **live in another tab** with toast notifications.

---

## 🧭 Next Steps

- **Connect real Supabase data operations** — implement a repository behind the store so reads/writes hit Postgres, wire Supabase Realtime + Auth, and enforce RLS against `league_admins`.
- **Improve real-data importers** — implement `fetchLive()` against Leaguepedia / Liquipedia / LoL Esports to pull live rosters, logos, schedules and results.
- **Expand regional rosters** — add VCS, LJL, LLA, PCS, TCL, LCP and ERLs (LFL, Prime League, SuperLiga, NLC, Ultraliga, EMEA Masters) with current rosters.
- **Improve the simulation / rating system** — richer per-game model (draft, side advantage, momentum), data-informed ratings and calibration.
- **Polish UI/UX** — refined loading/empty states, mobile tuning, motion, accessibility and keyboard navigation.
- **Prepare deploy** — production config, env management, and a Vercel + Supabase deployment with a seeding strategy.

---

## 📝 Notes & limitations

- Mock data lives in your browser. **Profile → Wipe & reseed** resets it; **Reset demo** on the dashboard reloads the seeded leagues.
- Double elimination is generated for 4- and 8-team fields (used by MSI); other sizes fall back to single elimination.
- Swiss pairing is a simplified records-based implementation.
- Team logos / player images default to generated initials tiles; paste real public image URLs in **Admin → Assets** (or per entity) to replace them.

---

Built as a usable end-to-end MVP — actual CRUD, state, simulation, transfers, realtime, import/export and admin, with a mock fallback so it always just works.

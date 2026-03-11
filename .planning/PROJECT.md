# Project: Velospill

## What This Is

A fantasy cycling web application where friends compete by drafting real professional cyclists, managing teams through a season, and scoring points based on actual race results. Inspired by Norwegian fantasy cycling culture (velospill).

## Core Value

The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **UI:** shadcn/ui component library
- **Database:** PostgreSQL via Neon (serverless), Drizzle ORM
- **Auth:** Better Auth
- **Real-time:** Pusher Channels (presence channels)
- **Background jobs:** QStash (serverless delayed execution)
- **Hosting:** Vercel (implied by Next.js + serverless stack)

## Constraints

- Norwegian cycling fantasy rules (custom scoring, strategic orders)
- Serverless architecture (no persistent WebSocket server)
- Data-driven scoring via JSONB config tables (no hardcoded scoring logic)
- drizzle-kit 0.18.x incompatible with drizzle-orm 0.45.x — migrations applied via direct SQL

## Key Decisions

| # | Decision | Rationale | Phase | Outcome |
|---|----------|-----------|-------|---------|
| 1 | Better Auth over NextAuth | Simpler Drizzle integration, better TypeScript support | 01 | Good |
| 2 | JSONB scoring config in DB | Flexibility for rule changes without code deployment | 01 | Good |
| 3 | Pusher for real-time draft | Presence channels for participant tracking, serverless-compatible | 04 | Good |
| 4 | QStash for auto-pick timer | Serverless-friendly delayed execution, 65s delay vs 60s timer | 04 | Good |
| 5 | On-demand SQL aggregation for scoring | No materialized views, compute standings per request | 05 | Good |
| 6 | Waiver wire transfers (not free market) | Priority by standings, admin approval, simpler UX | 06 | Good |
| 7 | Ownership-at-race-time scoring | Historical points stay with original team after transfer | 06 | Good |
| 8 | 12 strategic order types with counter mechanics | Core game differentiator — boost/sabotage with risk/reward | 07 | Good |
| 9 | league_races join table for per-league race scoping | All features scope to assigned races, not raw season | 08 | Good |
| 10 | grand_tour_tdf as new raceType text value | No schema change needed since raceType is text, not enum | 11 | Good |
| 11 | Category column on raceResults (not separate tables) | Minimal schema change, reuses existing result entry patterns | 12 | Good |
| 12 | Counter returns order to attacker (no blowback) | Simpler mechanics, more reuse, less punishing for attacker | 14 | Good |
| 13 | bonus_riders separate table (not raceResults) | Bonus riders have distinct lifecycle (per-GT, no race scoping) | 15 | Good |
| 14 | Three-query application-side assembly pattern | Avoids SQL JSON_AGG complexity; reusable across rider/team/standings queries | 16–19 | Good |
| 15 | COALESCE(parentRaceId, id) for stage roll-up | Groups stage results to parent race without schema changes | 19 | Good |
| 16 | IR max 2 slots per team; approved riders freed from active roster limit | Keeps gameplay balanced; IR slot is separate from active roster count | 20 | Good |
| 17 | IR status enum: pending/approved/rejected (no cancelled) | Simpler than transfer bids — IR doesn't have the same cancellation semantics | 20 | Good |
| 18 | dropRider hard-deletes draftPicks instantly | No waiver or approval period; instant roster management | 21 | Good |
| 19 | return_eligible riders free a roster slot until status becomes returned | Slot only closes again when rider fully returns | 22 | Good |
| 20 | roster_slots as separate table (not derived view) | Source of truth for current composition; write path enforces consistency | 23 | Good |
| 21 | roster_slot_status enum: active/on_ir/return_eligible only | No dropped/returned states — rows deleted instead; clean lifecycle | 23 | Good |
| 22 | Unique index on (leagueId, riderId) in roster_slots | Enforces single-slot-per-rider-per-league invariant at DB level | 23 | Good |
| 23 | draftPicks.pickedAt preserved for scoring; roster_slots.addedAt for audit only | Scoring ownership-at-race-time must use original pick timestamp | 23–25 | Good |
| 24 | All roster mutations wrapped in transactions with roster_slots writes | Atomicity guarantees — no orphaned draftPicks or out-of-sync slots | 24 | Good |
| 25 | getTeamRoster keeps draftPicks innerJoin for pickedAt/pickNumber | Roster display still shows pick metadata; scoring invariant preserved | 25 | Good |

## Current Milestone: v1.5 Multi-Stage Race Improvements

**Goal:** Fix multi-stage race (grand tour / mini tour) admin result entry scoping and add stage-level scoring visibility on the league page.

**Target features:**
- Admin result entry scoped to the correct stage (not bleeding across all same-type races)
- Admin stage status overview (which stages have results entered)
- Expandable multi-stage race rows on league standings with per-stage scoring breakdown

## Current State

- **Version:** v1.5 in progress (started 2026-03-11)
- **Phases:** 25 phases, 58+ plans executed (v1.0–v1.4)
- **Codebase:** ~26,500 LOC TypeScript

### What Shipped (v1.4)

- `roster_slots` table as single source of truth for current team composition (schema + backfill migration)
- All write paths (draft, drop, transfer, IR approval, return) atomically write to `roster_slots` in the same transaction as the primary `draftPicks` mutation
- All read paths (`getActiveRosterCount`, `getTeamRoster`, slot-check guards in transfer and IR actions) read directly from `roster_slots`
- Dead `draftPicks + irRequests` join-based roster count code removed
- Correctness fix: `isOnIR` now correctly includes `return_eligible` riders (not just `approved`)

### What Shipped (v1.3)

- IR placement flow — players request IR (max 2 slots), admin approves/rejects, approved riders freed from active roster limit
- Drop rider — instant roster removal, no approval required
- IR return flow — admin marks eligible, persistent banner, transfer block enforced, return with roster-full drop gate
- 16 quick tasks completed (including post-audit bug fixes for transfer form and return_eligible handling)

### Known Limitations / Tech Debt

- `npm run build` fails due to drizzle-kit 0.18.x type error (DEBT-01 — project source compiles cleanly)
- Hammer/Innlagt Spurt/Lagtempo orders use admin-entered bonus points (DEBT-02–04, no auto-calculation)
- Shimanobil counter uses simplified team matching (DEBT-05)

## Shipped Milestones

- ✓ v1.0 Core Platform — shipped 2026-02-20
- ✓ v1.1 Scoring & Rules Update — shipped 2026-02-26
- ✓ v1.2 Player Visibility — shipped 2026-03-06
- ✓ v1.3 IR List & Roster Management — shipped 2026-03-07
- ✓ v1.4 Roster Consolidation — shipped 2026-03-09

---
*Last updated: 2026-03-11 after v1.5 milestone started*

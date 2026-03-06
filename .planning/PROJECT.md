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

## Key Decisions (continued from v1.1)

| # | Decision | Rationale | Phase | Outcome |
|---|----------|-----------|-------|---------|
| 10 | grand_tour_tdf as new raceType text value | No schema change needed since raceType is text, not enum | 11 | Good |
| 11 | Category column on raceResults (not separate tables) | Minimal schema change, reuses existing result entry patterns | 12 | Good |
| 12 | Counter returns order to attacker (no blowback) | Simpler mechanics, more reuse, less punishing for attacker | 14 | Good |
| 13 | bonus_riders separate table (not raceResults) | Bonus riders have distinct lifecycle (per-GT, no race scoping) | 15 | Good |

## Key Decisions (continued from v1.2)

| # | Decision | Rationale | Phase | Outcome |
|---|----------|-----------|-------|---------|
| 14 | Three-query application-side assembly pattern | Avoids SQL JSON_AGG complexity; reusable across rider/team/standings queries | 16–19 | Good |
| 15 | COALESCE(parentRaceId, id) for stage roll-up | Groups stage results to parent race without schema changes | 19 | Good |
| 16 | recharts via shadcn chart component | Consistent with shadcn/ui stack; CSS chart vars already defined | 19 | Good |
| 17 | Separate /standings/history page (not inline tab) | More space for chart + table; keeps league page lean | 19 | Good |

## Current Milestone: v1.2 Player Visibility — SHIPPED 2026-03-06

**Delivered:** Full player visibility suite — rider profiles, team profiles, race lineup accordions, and season standings history with recharts chart.

## Current State

- **Version:** v1.2 shipped (2026-03-06)
- **Phases:** 19 phases, 44+ plans executed (v1.0 + v1.1 + v1.2)
- **Codebase:** ~26,011 LOC TypeScript
- **Next milestone:** TBD

### What Shipped (v1.2)

- Rider profile pages — `/riders/[riderId]` with season total, per-race breakdown, scoring categories, ownership history
- Team profile pages — `/leagues/[leagueId]/teams/[teamId]` with roster accordion + per-rider per-race points
- Race lineup accordion on league page — per-team lineup cards for upcoming races + recent results with fantasy team badges
- Season standings history — `/standings/history` with recharts cumulative line chart + scrollable race-by-race table

### Known Limitations / Tech Debt (carried from v1.1)

- `npm run build` fails due to drizzle-kit 0.18.x type error (DEBT-01)
- Hammer/Innlagt Spurt/Lagtempo orders use admin-entered bonus points (DEBT-02–04)
- Shimanobil counter uses simplified team matching (DEBT-05)
- Unused `Tooltip` import + unused `leagueId` prop in history-client.tsx (minor, non-blocking)

## Next Milestone

**Planned feature:** IR (Injured Reserve) list — players place up to 2 injured riders on IR, freeing a roster slot; admin approval required; admin alert when rider must return.

**Other candidates:** Tech debt cleanup (DEBT-01 drizzle-kit build fix), admin UX improvements.
- Season standings chart — cumulative points per team across all races
- Race-by-race breakdown table with running totals
- Team profile page — full squad roster + scoring history per race

## Current State

- **Version:** v1.1 shipped (2026-02-26)
- **Phases:** 15 phases, 38 plans executed (v1.0 + v1.1)
- **Codebase:** ~23,760 LOC TypeScript
- **Current milestone:** v1.2 Player Visibility

### What Shipped (v1.0 + v1.1)

Complete cycling fantasy league platform with 2026 season ruleset:
- User auth with admin RBAC
- Admin race management and result entry with scoring preview and audit trails — supports all categories (finish, sprint, mountain, jersey, TTT, end-of-tour)
- Private leagues with invite links, team registration, lifecycle state machine
- Real-time snake draft (Pusher presence channels, QStash auto-pick, auto-activation)
- Scoring engine with league standings, per-race breakdowns, ownership-at-race-time, TdF-specific scoring configs
- Waiver wire transfers with auto-generated windows, priority resolution, admin approval
- 13 strategic order types (incl. Uno-X bonus rider draft, Kaptein for women's WC) with updated counter mechanics and full scoring integration
- Per-league race calendar with downstream scoping across all features

### Known Limitations / Tech Debt

- `npm run build` fails due to drizzle-kit 0.18.x type error (DEBT-01 — project source compiles cleanly)
- Hammer/Innlagt Spurt/Lagtempo orders use admin-entered bonus points (DEBT-02–04, no auto-calculation)
- Shimanobil counter uses simplified team matching (DEBT-05)
- Phase 12 VERIFICATION.md never created (code works, integration verified — accepted gap)

---
*Last updated: 2026-03-06 after v1.2 milestone shipped*

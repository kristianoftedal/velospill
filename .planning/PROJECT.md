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

## Current Milestone: v1.1 Scoring & Rules Update

**Goal:** Update scoring rules, order mechanics, and result entry to match the 2026 season ruleset.

**Target features:**
- Updated scoring config (increased one-day points, TdF-specific stage/KOM/end-of-tour scoring)
- Updated order mechanics (adjusted multipliers, changed counter mechanic to return-order)
- New Uno-X order (bonus rider per GT from unowned pool, reverse standings draft)
- New Kaptein for women's WC
- Full result entry supporting all scoring categories (sprints, mountains, jerseys, TTT, end-of-tour)
- Tech debt: fix build error, cleanup

## Current State

- **Version:** v1.0 shipped (2026-02-20), v1.1 in progress
- **Phases:** 9 phases, 26 plans executed (v1.0)
- **Codebase:** 126 TypeScript files, 20,924 LOC
- **Known tech debt:** 11 items across 4 phases (see milestones/v1.0-MILESTONE-AUDIT.md)

### What Shipped

Complete cycling fantasy league platform:
- User auth with admin RBAC
- Admin race management and result entry with scoring preview and audit trails
- Private leagues with invite links, team registration, lifecycle state machine
- Real-time snake draft (Pusher presence channels, QStash auto-pick, auto-activation)
- Scoring engine with league standings, per-race breakdowns, ownership-at-race-time
- Waiver wire transfers with auto-generated windows, priority resolution, admin approval
- 12 strategic order types with counter mechanics and full scoring integration
- Per-league race calendar with downstream scoping across all features

### Known Limitations

- Result entry only supports finish/stage_finish categories (no sprint, mountain, jersey, TTT)
- Hammer/Innlagt Spurt/Lagtempo orders use admin-entered bonus points (no auto-calculation)
- Shimanobil counter uses simplified team matching (documented TODO)
- `npm run build` fails due to drizzle-kit 0.18.x type error in drizzle.config.ts (project source compiles cleanly)

---
*Last updated: 2026-02-20 after v1.0 milestone shipped*

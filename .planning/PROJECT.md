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

## Current State

- **Version:** v1.0 (Milestone 1: Core Platform)
- **Phases:** 8/8 complete
- **Last updated:** 2026-02-16

---
*Last updated: 2026-02-16 after v1.0 milestone*

---
phase: 23-roster-slots-schema-migration
plan: "01"
subsystem: database-schema
tags: [schema, migration, roster-slots, drizzle, postgresql]
dependency_graph:
  requires: []
  provides: [roster_slots-table, rosterSlots-drizzle-export]
  affects: [phase-24-write-path, plan-23-02-backfill]
tech_stack:
  added: [roster_slot_status-pg-enum]
  patterns: [direct-sql-migration, drizzle-pgTable-definition]
key_files:
  created:
    - src/db/schema/roster-slots.ts
    - src/db/migrations/0006_add_roster_slots.sql
  modified:
    - src/db/schema/index.ts
decisions:
  - "roster_slot_status enum has 3 values: active/on_ir/return_eligible — no dropped/returned states (those rows are deleted)"
  - "unique index on (leagueId, riderId) enforces single-slot-per-rider-per-league invariant at DB level"
  - "addedAt column for audit trail only — scoring continues to use draftPicks.pickedAt for ownership-at-race-time"
metrics:
  duration: 60s
  completed: "2026-03-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 23 Plan 01: Roster Slots Schema & Migration Summary

**One-liner:** PostgreSQL `roster_slots` table with `roster_slot_status` enum and three indexes created via direct SQL migration, Drizzle schema exported and typed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create roster-slots Drizzle schema file | b6ce107 | src/db/schema/roster-slots.ts |
| 2 | Export schema + write and apply SQL migration | a8403fd | src/db/schema/index.ts, src/db/migrations/0006_add_roster_slots.sql |

## What Was Built

**Database:** `roster_slots` table in Postgres with columns: `id` (serial PK), `leagueId` (FK→leagues CASCADE), `teamId` (FK→teams), `riderId` (FK→riders), `status` (roster_slot_status enum, default 'active'), `addedAt` (timestamptz, default now()).

**Enum:** `roster_slot_status` with values `active`, `on_ir`, `return_eligible`.

**Indexes:** Three indexes — unique on `(leagueId, riderId)` enforcing single-slot invariant, `leagueId` for query performance, `teamId` for team roster queries.

**Drizzle schema:** `rosterSlots` table, `rosterSlotStatusEnum`, `rosterSlotsRelations`, `RosterSlot` type all exported from `src/db/schema/roster-slots.ts`. Re-exported from `src/db/schema/index.ts`.

## Verification Results

- `\dt roster_slots` — table confirmed in DB
- `\dT+ roster_slot_status` — enum confirmed with 3 values: active, on_ir, return_eligible
- `\di roster_slots*` — 4 indexes confirmed (pkey + 3 explicit)
- `draft_picks` and `ir_requests` tables untouched
- `npx tsc --noEmit` — no TypeScript errors in roster-slots.ts or index.ts

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- src/db/schema/roster-slots.ts: FOUND
- src/db/migrations/0006_add_roster_slots.sql: FOUND
- src/db/schema/index.ts (modified): FOUND
- Commit b6ce107: FOUND
- Commit a8403fd: FOUND

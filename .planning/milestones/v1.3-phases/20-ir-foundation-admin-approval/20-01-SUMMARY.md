---
phase: 20-ir-foundation-admin-approval
plan: 01
subsystem: database
tags: [postgres, drizzle-orm, schema, migration, ir]

# Dependency graph
requires:
  - phase: 06-waiver-transfers
    provides: Transfer bid schema pattern (enum + table + relations) used as model
  - phase: 01-foundation
    provides: leagues, teams, riders, user tables referenced by FKs

provides:
  - ir_requests table in the database with ir_status enum
  - irRequests Drizzle schema with indexed FKs to leagues, teams, riders, user
  - irRequestsRelations for ORM joins
  - IrRequest inferred TypeScript type
  - Schema exported from @/db/schema

affects: [20-02, 20-03, 21-ir-roster-display, 22-return-from-ir]

# Tech tracking
tech-stack:
  added: []
  patterns: [pgEnum + pgTable + relations pattern (mirrors transfers.ts), raw SQL migration file]

key-files:
  created:
    - src/db/schema/ir.ts
    - src/db/migrations/0003_add_ir_requests.sql
  modified:
    - src/db/schema/index.ts

key-decisions:
  - "IR status enum has exactly 3 values: pending, approved, rejected (no cancelled unlike transfers)"
  - "Migration applied as raw SQL via psql, matching existing project migration style"

patterns-established:
  - "ir schema mirrors transfers.ts: pgEnum → pgTable → relations → inferred type"
  - "Migration SQL uses CREATE TYPE ... IF NOT EXISTS pattern with DO $$ BEGIN EXCEPTION block"

requirements-completed: [IR-01, IR-02]

# Metrics
duration: 1min
completed: 2026-03-06
---

# Phase 20 Plan 01: IR Foundation — Schema & Migration Summary

**Drizzle ir_requests table with ir_status enum, three indexed FKs (league/team/rider), and psql migration applied to Neon database**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-06T15:29:59Z
- **Completed:** 2026-03-06T15:31:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- irStatusEnum defined as `pgEnum("ir_status", ["pending", "approved", "rejected"])`
- ir_requests table with all required columns, indexes on leagueId/teamId/status, and FK to user for resolvedBy
- Drizzle relations (league, team, rider, resolvedByUser) enabling ORM joins
- Migration SQL applied via psql — table live in Neon database, queryable with 0 rows
- Schema re-exported from @/db/schema (export * from "./ir")

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/db/schema/ir.ts** - `af9e33e` (feat)
2. **Task 2: Export ir schema + write migration SQL** - `1ad3fc9` (feat)

## Files Created/Modified

- `src/db/schema/ir.ts` - irStatusEnum, irRequests table, irRequestsRelations, IrRequest type
- `src/db/schema/index.ts` - Added `export * from "./ir"` at end of export list
- `src/db/migrations/0003_add_ir_requests.sql` - DDL for ir_status enum and ir_requests table with indexes

## Decisions Made

- IR status enum has exactly 3 values (pending/approved/rejected), no "cancelled" value unlike the transfer bid enum — IR requests don't get cancelled, they get rejected
- Migration applied as raw psql execution, matching the existing manual SQL migration style in the project

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - `pg` module not available for Node inline verification, but psql direct query confirmed `SELECT COUNT(*) FROM ir_requests` returns 0 rows successfully.

## Next Phase Readiness

- ir_requests table is live and ready for server action / API development in plan 20-02
- All downstream plans (20-02 admin approval, 21 roster display, 22 return flow) can now import from @/db/schema

---
*Phase: 20-ir-foundation-admin-approval*
*Completed: 2026-03-06*

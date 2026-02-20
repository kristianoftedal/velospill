---
phase: 07-orders-polish-integration
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, pgEnum, schema, orders]

# Dependency graph
requires:
  - phase: 06-transfer-market
    provides: Pool.connect() DDL migration pattern, barrel export pattern
  - phase: 03-league-schema
    provides: leagues, teams tables
provides:
  - orders table in Neon with orderStatusEnum and all columns
  - ordersRelations for Drizzle query builder
  - OrderConfig TypeScript type for JSONB orderConfig field
  - Unique constraint on (teamId, raceId) enforcing one order per team per race
affects: [07-02, 07-03, 07-04, order submission, order resolution, admin order management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pgEnum for status columns (order_status follows transfer_bid_status pattern)"
    - "uniqueIndex for business-rule constraints at DB level"
    - "Pool.connect() for DDL migrations to Neon"
    - "JSONB with $type<T>() for typed optional config blobs"

key-files:
  created:
    - src/db/schema/orders.ts
  modified:
    - src/db/schema/index.ts

key-decisions:
  - "orderStatusEnum values: pending/active/rejected/countered (matches order lifecycle)"
  - "targetTeamId added alongside targetRiderId for bondestreik (team-targeted orders)"
  - "bonusPoints column for admin-entered complex order points (Hammer, Innlagt Spurt, Lagtempo)"
  - "orderConfig JSONB typed with $type<OrderConfig>() for kapteinChoice param"
  - "uniqueIndex on (teamId, raceId) enforced at DB level — one order per team per race"

patterns-established:
  - "Follow transfers.ts pattern for all new domain tables (pgEnum + pgTable + indexes + relations)"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 7 Plan 01: Orders Schema Summary

**orders table with orderStatusEnum, JSONB orderConfig, bonusPoints, and unique (teamId, raceId) constraint applied to Neon via Pool.connect() DDL migration**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-14T13:46:39Z
- **Completed:** 2026-02-14T13:51:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `src/db/schema/orders.ts` with orderStatusEnum, orders table (16 columns), ordersRelations, and OrderConfig type
- Updated barrel export in `src/db/schema/index.ts` to include orders
- Applied DDL migration to Neon: order_status enum, orders table, 3 regular indexes, 1 unique index on (teamId, raceId)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create orders schema file** - `f09e781` (feat)
2. **Task 2: Update barrel export and apply migration SQL** - `06cc741` (feat)

## Files Created/Modified
- `src/db/schema/orders.ts` - orderStatusEnum, orders pgTable with all columns, ordersRelations, OrderConfig type
- `src/db/schema/index.ts` - Added `export * from "./orders"` barrel export

## Decisions Made
- Used `$type<OrderConfig>()` on the JSONB `orderConfig` column for compile-time safety (same as LeagueConfig in leagues.ts)
- Used idiomatic `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null END $$` DDL pattern for the enum to make migration idempotent
- Followed transfers.ts exact pattern (pgEnum + pgTable + index/uniqueIndex + relations)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- orders table in Neon with all required columns, indexes, and unique constraint
- ordersRelations available for Drizzle query builder in subsequent plans
- orderStatusEnum exported and ready for use in API queries and actions
- Ready for 07-02: order submission UI and server action

---
*Phase: 07-orders-polish-integration*
*Completed: 2026-02-14*

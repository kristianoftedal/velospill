---
phase: 06-transfer-market
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, schema, scoring, transfers]

# Dependency graph
requires:
  - phase: 05-scoring-points-system
    provides: scoring-queries.ts with JOIN chain for standings/breakdown/races
  - phase: 04-live-draft-system
    provides: draftPicks table with pickedAt field and pickNumber uniqueness constraint
  - phase: 03-leagues-and-teams
    provides: leagues and teams tables that transfer tables reference
requires:
  - phase: 04-live-draft-system
    provides: draftPicks schema with pickedAt timestamp
provides:
  - PostgreSQL tables: transfer_bids, transfer_windows, transfer_audit
  - transfer_bid_status enum (pending/approved/rejected/cancelled)
  - Drizzle ORM schema for all three transfer tables with typed relations
  - Ownership-at-race-time scoring logic in all four scoring query functions
  - Partial unique index on draft_picks.pickNumber allowing negative sentinel values for transfers
affects:
  - 06-02: transfer bid submission UI reads transferBids/transferWindows tables
  - 06-03: admin transfer management uses transferBids/transferAudit
  - scoring pages: standings/breakdown now reflect ownership at race time

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ownership-at-race-time via pickedAt/startDate temporal JOIN condition"
    - "Partial unique index (WHERE pickNumber >= 0) to allow negative sentinel values"
    - "Transfer audit trail stored in separate transferAudit table for immutable log"

key-files:
  created:
    - src/db/schema/transfers.ts
    - scripts/apply-transfer-migration.ts
  modified:
    - src/db/schema/index.ts
    - src/db/schema/draft.ts
    - src/lib/scoring-queries.ts

key-decisions:
  - "06-01: pickedAt/startDate temporal condition uses gte() in LEFT JOIN (not WHERE) to preserve zero-point team semantics"
  - "06-01: getRaceScoreBreakdown adds races INNER JOIN and lte(pickedAt, startDate) on draftPicks to handle case where raceId is a parameter"
  - "06-01: getLeagueRacesWithScores uses lte(pickedAt, startDate) on draftPicks INNER JOIN (not races JOIN) since races is the FROM table"
  - "06-01: Pool.connect() used for DDL migration (not neon serverless sql.unsafe) as the latter did not commit DDL transactions"
  - "06-01: Negative pickNumbers used as sentinels for transfer-generated draftPick rows; partial index WHERE pickNumber >= 0 enforces uniqueness only for real draft picks"

patterns-established:
  - "Ownership-at-race-time: all scoring functions filter by draftPicks.pickedAt <= races.startDate"
  - "Transfer audit: immutable append-only log in transferAudit table for compliance/debugging"
  - "Migration via Pool.connect() client.query() for DDL; neon serverless http driver does not reliably commit DDL"

# Metrics
duration: 14min
completed: 2026-02-14
---

# Phase 6 Plan 1: Transfer Market Schema and Ownership-at-Race-Time Scoring Summary

**Three-table transfer market schema (transferBids, transferWindows, transferAudit) with Drizzle ORM types and ownership-at-race-time scoring via pickedAt/startDate temporal JOIN filtering in all four scoring query functions**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-14T11:38:42Z
- **Completed:** 2026-02-14T11:52:36Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created transfer_bids, transfer_windows, and transfer_audit PostgreSQL tables with correct columns, constraints, and indexes applied to Neon database
- Created Drizzle ORM schema (transfers.ts) with typed relations for all three tables; updated schema barrel (index.ts) to re-export
- Updated all four scoring query functions to implement ownership-at-race-time filtering using draftPicks.pickedAt vs races.startDate
- Fixed pickNumber partial unique index (WHERE pickNumber >= 0) to allow negative sentinel values for transfer-generated draft pick rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Create transfer schema and apply migration** - `594a32c` (feat)
2. **Task 2: Update scoring queries for ownership-at-race-time** - `5fd1320` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/db/schema/transfers.ts` - Drizzle table definitions for transferBids, transferWindows, transferAudit with relations
- `src/db/schema/index.ts` - Added `export * from "./transfers"` barrel re-export
- `src/db/schema/draft.ts` - Added comment documenting partial index for pickNumber (DB-maintained via direct SQL)
- `src/lib/scoring-queries.ts` - Updated all 4 functions with pickedAt/startDate ownership-at-race-time temporal filter; imported gte/lte from drizzle-orm
- `scripts/apply-transfer-migration.ts` - Migration script using Pool.connect() for DDL reliability

## Decisions Made
- **pickedAt/startDate in JOIN not WHERE:** The gte() condition is added to the races LEFT JOIN condition (not the WHERE clause) to preserve the existing LEFT JOIN zero-point team semantics — teams with no results still appear in standings.
- **getRaceScoreBreakdown uses lte on draftPicks JOIN:** This function already has raceId as parameter; added races INNER JOIN to get startDate, then added lte(draftPicks.pickedAt, races.startDate) on the draftPicks join condition.
- **Pool.connect() for DDL migrations:** The neon serverless http driver's `sql.unsafe()` does not reliably commit DDL. Using `Pool.connect()` with individual `client.query()` calls is the established pattern for DDL.
- **Negative pickNumber sentinels:** Transfer-generated draftPick rows use negative pickNumbers to distinguish from real draft picks. The partial unique index (WHERE pickNumber >= 0) enforces uniqueness only for real picks while allowing arbitrarily many transfer rows.

## Deviations from Plan

None - plan executed exactly as written.

**Note:** Used Pool.connect() instead of neon sql.unsafe() for the migration script — the first attempt with sql.unsafe() silently succeeded but DDL wasn't committed (empty table list returned). Switched to Pool-based approach which is consistent with how the rest of the project connects to Neon. This is a tooling nuance, not a plan deviation.

## Issues Encountered
- `neon()` http driver's `sql.unsafe()` appeared to succeed but DDL was not committed (tables not visible in subsequent queries). Fixed by using `Pool.connect()` / `client.query()` pattern consistent with the project's `db.ts` setup.

## User Setup Required
None - no external service configuration required. Migration was applied automatically using the existing DATABASE_URL from .env.local.

## Next Phase Readiness
- Transfer market database foundation is complete
- transferBids, transferWindows, transferAudit tables ready for Phase 6 Plan 2 (transfer bid submission UI)
- Scoring queries now correctly attribute historical points to the team that owned the rider at race time
- pickNumber partial index allows the transfer execution logic to insert negative-numbered draftPick rows

## Self-Check: PASSED

- src/db/schema/transfers.ts: FOUND
- src/db/schema/index.ts: FOUND
- src/lib/scoring-queries.ts: FOUND
- .planning/phases/06-transfer-market/06-01-SUMMARY.md: FOUND
- Commit 594a32c: FOUND
- Commit 5fd1320: FOUND
- DB tables (transfer_audit, transfer_bids, transfer_windows): FOUND

---
*Phase: 06-transfer-market*
*Completed: 2026-02-14*

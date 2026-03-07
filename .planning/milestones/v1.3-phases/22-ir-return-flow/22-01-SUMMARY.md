---
phase: 22-ir-return-flow
plan: "01"
subsystem: database
tags: [postgres, drizzle-orm, ir, enum, migration]

# Dependency graph
requires:
  - phase: 20-ir-foundation-admin-approval
    provides: irRequests table, irStatusEnum, getActiveRosterCount — foundation this plan extends
provides:
  - ir_status DB enum with return_eligible and returned values
  - Drizzle irStatusEnum with 5 values matching DB
  - IrSlot TypeScript type with new status values
  - getActiveRosterCount counts approved + return_eligible as freeing slots
  - getEligibleToReturnCount helper for UI banner and transfer blocking
affects:
  - 22-02 (admin mark eligible UI)
  - 22-03 (league page banner, transfer blocking)
  - Any code querying ir_status or using IrSlot type

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ALTER TYPE ir_status ADD VALUE IF NOT EXISTS — idempotent enum extension pattern"
    - "inArray(['approved', 'return_eligible']) for multi-status slot-freeing count"

key-files:
  created:
    - src/db/migrations/0005_add_ir_return_statuses.sql
  modified:
    - src/db/schema/ir.ts
    - src/lib/ir-queries.ts

key-decisions:
  - "return_eligible riders still free a roster slot — they haven't physically returned yet, so the slot remains freed until they are marked returned"
  - "getEligibleToReturnCount exported as standalone helper for use in Plan 03 UI banner and transfer form blocking"

patterns-established:
  - "Raw psql migration applied directly — drizzle-kit incompatible (DEBT-01)"

requirements-completed: [IR-06, IR-07]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 22 Plan 01: IR Return Status Foundation Summary

**PostgreSQL ir_status enum extended with return_eligible/returned, Drizzle schema synced, and getActiveRosterCount fixed to count both approved and return_eligible riders as freeing roster slots**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-07T10:00:00Z
- **Completed:** 2026-03-07T10:05:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Migration 0005 applied — ir_status DB enum now has 5 values: pending, approved, rejected, return_eligible, returned
- Drizzle irStatusEnum in schema/ir.ts updated to match DB (5 values)
- IrSlot TypeScript type updated to include return_eligible and returned
- getActiveRosterCount fixed to use inArray(['approved', 'return_eligible']) — return_eligible riders still free a slot
- getEligibleToReturnCount added as standalone exported helper

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration SQL — add return_eligible and returned to ir_status enum** - `71d7d07` (feat)
2. **Task 2: Schema + query layer — update Drizzle enum, IrSlot type, getActiveRosterCount, add getEligibleToReturnCount** - `fd62a38` (feat)

## Files Created/Modified

- `src/db/migrations/0005_add_ir_return_statuses.sql` - Adds return_eligible and returned to ir_status enum via ALTER TYPE
- `src/db/schema/ir.ts` - irStatusEnum updated from 3 to 5 values
- `src/lib/ir-queries.ts` - IrSlot type updated, getActiveRosterCount fixed to use inArray, getEligibleToReturnCount added

## Decisions Made

- return_eligible riders continue to free a roster slot because they have not yet returned — the slot only closes again when status becomes returned
- getEligibleToReturnCount added as a focused helper (not folded into getTeamIrSlots) so Plan 03 can call it without loading full IR slot data

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Migration applied cleanly with IF NOT EXISTS guard. TypeScript compilation clean after changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 22-02 (admin mark eligible action) can now use the return_eligible status value in both DB queries and Drizzle schema
- Plan 22-03 (league page banner + transfer blocking) can call getEligibleToReturnCount directly
- All TypeScript types are propagated — no further schema changes needed for Phase 22

---
*Phase: 22-ir-return-flow*
*Completed: 2026-03-07*

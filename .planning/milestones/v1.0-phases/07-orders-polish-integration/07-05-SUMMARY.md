---
phase: 07-orders-polish-integration
plan: 05
subsystem: api
tags: [drizzle, scoring, orders, nationality, kaptein, world-championship]

# Dependency graph
requires:
  - phase: 07-orders-polish-integration
    provides: applyOrderEffects with country_all kaptein branch comparing s.riderNationality === order.targetCountry
  - phase: 07-orders-polish-integration
    provides: getRaceScoreBreakdown joining riders table via innerJoin
provides:
  - riderNationality field in RaceScoreEntry type (scoring-queries.ts)
  - nationality selected from riders table in getRaceScoreBreakdown
  - riderNationality propagated into baseScores in both getOrderAdjustedStandings and getRaceScoreBreakdownWithOrders
  - TODO comment documenting Shimanobil counter pure-function limitation
affects: [kaptein-orders, world-championship-scoring, order-effects]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Select riders.nationality in getRaceScoreBreakdown, map to riderNationality, propagate through BaseScore to applyOrderEffects"

key-files:
  created: []
  modified:
    - src/lib/scoring-queries.ts
    - src/lib/order-queries.ts

key-decisions:
  - "riderNationality: string required (not optional) in RaceScoreEntry since all real DB rows have nationality NOT NULL; synthetic bonus rows use empty string ''"
  - "Shimanobil counter ownership-lookup limitation documented via TODO comment — pure-function cannot resolve rider ownership without targetTeamId; correct fix requires either storing targetTeamId at order submission or making resolveCounters async"

patterns-established:
  - "Nationality pattern: select riders.nationality in join query, map to riderNationality in return, include in BaseScore for applyOrderEffects comparison"

# Metrics
duration: 5min
completed: 2026-02-15
---

# Phase 07 Plan 05: Kaptein country_all Gap Closure Summary

**riderNationality field added to getRaceScoreBreakdown select and propagated into BaseScore arrays so Kaptein country_all World Championship orders correctly apply x1.5 multiplier by nationality**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-15T08:21:09Z
- **Completed:** 2026-02-15T08:27:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `getRaceScoreBreakdown` now selects `nationality: riders.nationality` from the already-joined riders table and maps it to `riderNationality` in returned rows
- `RaceScoreEntry` type updated to include `riderNationality: string` as required field; synthetic bonus rows use `riderNationality: ""`
- `riderNationality` propagated into `baseScores` construction in both `getOrderAdjustedStandings` and `getRaceScoreBreakdownWithOrders` so `applyOrderEffects` `country_all` branch now evaluates `s.riderNationality === order.targetCountry` against real data instead of `undefined`
- Shimanobil counter ownership limitation documented via TODO comment in `resolveCounters`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add riderNationality to getRaceScoreBreakdown and RaceScoreEntry** - `7e524d7` (feat)
2. **Task 2: Propagate riderNationality in getOrderAdjustedStandings and document Shimanobil limitation** - `ccf1951` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/scoring-queries.ts` - Added `nationality: riders.nationality` to select, `riderNationality` to map and RaceScoreEntry type, `riderNationality` to local BaseScore type and baseScores construction, `riderNationality: ""` to two synthetic bonus row pushes
- `src/lib/order-queries.ts` - Added `riderNationality: entry.riderNationality` to `getOrderAdjustedStandings` baseScores; added TODO comment in `resolveCounters` Shimanobil branch

## Decisions Made
- `riderNationality: string` required (not optional) in `RaceScoreEntry` since all real DB rows have `riders.nationality NOT NULL`; synthetic bonus rows (Hammer, Gammel Venn) use `riderNationality: ""` to satisfy the type
- Shimanobil counter ownership-lookup limitation documented via TODO comment — the pure function cannot determine rider ownership from `activeOrders` alone without `targetTeamId`; correct fix requires either storing `targetTeamId` at order submission time or making `resolveCounters` async (both out of scope for this gap-closure plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added riderNationality to synthetic bonus row push calls**
- **Found during:** Task 1 (TypeScript compilation after adding required field to RaceScoreEntry)
- **Issue:** Two bonus row `entries.push()` calls in `getRaceScoreBreakdownWithOrders` constructed objects without `riderNationality`, causing TS2345 errors since the field became required
- **Fix:** Added `riderNationality: ""` to both admin bonus and Gammel Venn bonus row push calls (these are synthetic rows with no real rider, so empty string is correct)
- **Files modified:** src/lib/scoring-queries.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** `7e524d7` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required to satisfy TypeScript after making riderNationality required in RaceScoreEntry. No scope creep.

## Issues Encountered
None — all changes were self-contained within the two target files with no circular dependency issues.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Kaptein `country_all` variant is now functionally correct for World Championship scoring
- Both `getOrderAdjustedStandings` and `getRaceScoreBreakdownWithOrders` have populated `riderNationality` in their base score arrays
- Remaining Shimanobil counter ownership limitation is documented but acceptable — the counter will still fire against any non-attacker defense order (existing behavior), just not precisely against the owning team; fixing requires model change at order submission (storing `targetTeamId` on Shimanobil orders)

---
*Phase: 07-orders-polish-integration*
*Completed: 2026-02-15*

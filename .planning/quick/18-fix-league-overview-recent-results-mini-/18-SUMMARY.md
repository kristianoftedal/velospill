---
phase: quick-18
plan: 01
subsystem: api
tags: [drizzle, postgresql, sql, league-overview, races]

requires: []
provides:
  - "Fixed stage fetch in getRecentRaceResults so mini tour stages appear in Recent Results accordion"
affects: []

tech-stack:
  added: []
  patterns:
    - "Use raw SQL subquery instead of Drizzle inArray() for nullable integer FK joins on Drizzle 0.45.x"

key-files:
  created: []
  modified:
    - src/lib/league-overview-queries.ts

key-decisions:
  - "Replace inArray(races.parentRaceId, multiStageRaceIds) with sql subquery IN (SELECT raceId FROM league_races WHERE leagueId = ?) to avoid Drizzle 0.45.x silent zero-row bug on nullable integer columns"

patterns-established:
  - "Pattern: Drizzle 0.45.x inArray on nullable integer columns silently returns zero rows — use raw SQL subquery instead"

requirements-completed: [QUICK-18]

duration: 5min
completed: 2026-03-13
---

# Quick Task 18: Fix League Overview Recent Results Mini Tour Stages Summary

**SQL subquery replaces Drizzle inArray() to fix silent zero-row bug on nullable parentRaceId in getRecentRaceResults Query 3**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-13T00:00:00Z
- **Completed:** 2026-03-13T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Removed `multiStageRaceIds` variable and its `if`-guard from `getRecentRaceResults`
- Replaced `inArray(races.parentRaceId, multiStageRaceIds)` with a raw SQL subquery: `IN (SELECT "raceId" FROM league_races WHERE "leagueId" = leagueId)`
- Stage rows now always fetched; expanding Paris-Nice or Tirreno-Adriatico in the Recent Results accordion shows stage list instead of empty list
- TypeScript compiles clean

## Task Commits

1. **Task 1: Replace inArray with SQL subquery in Query 3** - `0f79820` (fix)

## Files Created/Modified

- `src/lib/league-overview-queries.ts` - Query 3 WHERE clause replaced; multiStageRaceIds variable and guard removed

## Decisions Made

- Used raw SQL subquery `IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId})` instead of Drizzle's `inArray()` because Drizzle 0.45.x silently returns zero rows when `inArray` is used on a nullable integer column (`parentRaceId`). The same pattern is already in use in `getLeagueRacesWithScores` Query B and is the established workaround.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Fix is complete. No follow-up required.

---
*Phase: quick-18*
*Completed: 2026-03-13*

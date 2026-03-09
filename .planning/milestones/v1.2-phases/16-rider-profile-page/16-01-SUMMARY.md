---
phase: 16-rider-profile-page
plan: 01
subsystem: api
tags: [drizzle, postgres, typescript, query-layer, rider-profile]

requires:
  - phase: 12-result-entry-expansion
    provides: raceResults with category column for multi-category scoring
  - phase: 06-transfer-market
    provides: draftPicks ownership-at-race-time pattern
provides:
  - getRiderSeasonProfile query function returning rider metadata, total points, per-race breakdown with categories, and ownership history
  - RiderSeasonProfile, RiderRaceEntry, RiderOwnershipEntry, RiderCategoryScore TypeScript types
affects: [17-team-profile-page, 16-02 UI layer for rider profile page]

tech-stack:
  added: []
  patterns:
    - Three-query pattern for rider profile (metadata+totals, results breakdown, ownership history)
    - Application-side grouping of DB rows instead of complex SQL aggregation
    - Ownership resolution: most recent pickedAt <= race.startDate per league

key-files:
  created:
    - src/lib/rider-queries.ts
  modified: []

key-decisions:
  - "Three separate queries instead of one massive join — improves readability and maintainability"
  - "Group results by raceId in application code (not SQL GROUP BY + JSON_AGG) for simpler, portable code"
  - "Ownership resolution uses in-memory iteration: filter pickedAt <= startDate, keep latest per leagueId"
  - "categoryLabels map provides human-readable labels without DB overhead"

patterns-established:
  - "Rider profile data contract: rider + races[] + ownership[] from a single function call"
  - "Per-league ownership tracking: one RiderOwnershipEntry per (raceId, leagueId) pair"

requirements-completed: [RIDER-01, RIDER-02, RIDER-03, RIDER-04]

duration: 1min
completed: 2026-02-27
---

# Phase 16 Plan 01: Rider Profile Data Query Layer Summary

**Three-query Drizzle ORM function (getRiderSeasonProfile) delivering rider metadata, per-race category scoring breakdown, and per-league ownership history in a single call**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-27T11:40:48Z
- **Completed:** 2026-02-27T11:41:46Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `src/lib/rider-queries.ts` with `getRiderSeasonProfile(riderId)` returning `RiderSeasonProfile | null`
- Query 1 fetches rider metadata + total season points via LEFT JOIN + COALESCE(SUM(...))
- Query 2 fetches all race results with race metadata, then groups by raceId in application code to build per-race category score arrays
- Query 3 fetches all draftPicks for the rider across all leagues, then resolves active ownership per (race, league) by finding the most recent `pickedAt <= race.startDate`
- All four required types exported: `RiderSeasonProfile`, `RiderRaceEntry`, `RiderOwnershipEntry`, `RiderCategoryScore`
- TypeScript compiles cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create rider-queries.ts with getRiderSeasonProfile** - `92f3576` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/rider-queries.ts` - getRiderSeasonProfile function and all exported types for the rider profile data layer

## Decisions Made

- Used three separate queries instead of one complex join — keeps each query readable and the logic straightforward
- Application-side grouping for the category breakdown avoids complex JSON_AGG or subquery aggregation, making the code more portable and debuggable
- Ownership resolution iterates ownershipRows (sorted ASC by pickedAt) and overwrites per-league entries, so the last valid pick before the race date wins — matches the ownership-at-race-time pattern established in Phase 6
- `categoryLabels` map is defined inline (same keys as used throughout scoring code) — no DB lookup needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `getRiderSeasonProfile` is ready to be consumed by the UI layer (Plan 02: rider profile page component)
- The function returns a clean data contract with all fields needed for the profile page: rider bio, total points, race-by-race breakdown with category scores, and team ownership history per league
- No blockers for Plan 02

---
*Phase: 16-rider-profile-page*
*Completed: 2026-02-27*

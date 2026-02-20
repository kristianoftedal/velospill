---
phase: 08-ui-polish-let-admins-pick-races-from-global-list-to-leagues-they-admin
plan: 03
subsystem: query-layer
tags: [drizzle-orm, scoring, transfers, orders, sql, league-scoping]

# Dependency graph
requires:
  - phase: 08-01
    provides: leagueRaces join table in Neon and schema export
  - phase: 07-04
    provides: order-queries.ts getUpcomingRacesForLeague
  - phase: 06-04
    provides: transfer-queries.ts generateTransferWindows
  - phase: 05-01
    provides: scoring-queries.ts getLeagueStandings, getTeamRiderScores
  - phase: 05-02
    provides: scoring-queries.ts getLeagueRacesWithScores
provides:
  - getUpcomingRacesForLeague scoped to league-assigned races (parent + stages)
  - generateTransferWindows scoped to league-assigned parent races
  - getLeagueStandings aggregating only from league-assigned races
  - getTeamRiderScores aggregating only from league-assigned races
  - getLeagueRacesWithScores listing only league-assigned races
affects:
  - 08-02 (race picker UI now has functional downstream effect)
  - /leagues/[leagueId]/orders (order form shows only assigned races)
  - /admin/transfers (windows generated only for assigned races)
  - /leagues/[leagueId]/standings (points from assigned races only)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - sql template subquery for OR-based parent/stage filtering: sql`(id IN (SELECT raceId FROM league_races ...) OR parentRaceId IN (...))`
    - INNER JOIN on join table to restrict result set (generateTransferWindows)
    - league_races subquery condition placed in LEFT JOIN (not WHERE) to preserve zero-point team semantics

key-files:
  created: []
  modified:
    - src/lib/order-queries.ts
    - src/lib/transfer-queries.ts
    - src/lib/scoring-queries.ts

key-decisions:
  - "league_races subquery in LEFT JOIN condition (not WHERE) preserves zero-point team semantics for getLeagueStandings and getTeamRiderScores"
  - "OR-based subquery handles both parent races (races.id IN ...) and stages (races.parentRaceId IN ...) in a single condition"
  - "generateTransferWindows uses INNER JOIN on leagueRaces — cleaner than subquery since it only fetches parent races"
  - "parentRaces local variable renamed to parentRaceRows in generateTransferWindows to avoid shadowing module-level parentRaces alias"
  - "getRaceScoreBreakdown intentionally not modified — already receives specific raceId from a league-scoped caller"

# Metrics
duration: ~2min
completed: 2026-02-16
---

# Phase 08 Plan 03: Downstream Query Scoping by League-Assigned Races Summary

**All downstream query functions (orders, transfers, scoring) now filter results by races explicitly assigned to the league via `league_races`, making the race picker functional end-to-end**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-16T07:01:14Z
- **Completed:** 2026-02-16T07:02:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Updated `getUpcomingRacesForLeague` in `order-queries.ts` to filter by league-assigned parent races AND their stages via sql subquery
- Added `leagueRaces` import to `order-queries.ts` from `@/db/schema/leagues`
- Updated `generateTransferWindows` in `transfer-queries.ts` to INNER JOIN on `leagueRaces`, generating windows only for assigned parent races
- Renamed local variable `parentRaces` to `parentRaceRows` in `generateTransferWindows` to avoid conflict with module-level `parentRaces` alias
- Added `leagueRaces` import to `transfer-queries.ts`
- Updated `getLeagueStandings` in `scoring-queries.ts` to add league_races subquery in the races LEFT JOIN condition (preserving zero-point team semantics)
- Updated `getTeamRiderScores` in `scoring-queries.ts` with the same LEFT JOIN scoping pattern
- Updated `getLeagueRacesWithScores` in `scoring-queries.ts` to add league_races WHERE condition
- Added `leagueRaces` import to `scoring-queries.ts`
- All three files compile cleanly with `npx tsc --noEmit`

## Task Commits

Each task was committed atomically:

1. **Task 1: Update order and transfer queries** - `917681f` (feat)
2. **Task 2: Update scoring queries** - `709cdfc` (feat)

**Plan metadata:** (committed in final docs commit)

## Files Created/Modified

- `src/lib/order-queries.ts` - Added `leagueRaces` import; added `league_races` subquery to `getUpcomingRacesForLeague` WHERE clause (parent races AND stages of assigned parents)
- `src/lib/transfer-queries.ts` - Added `leagueRaces` import; added INNER JOIN on `leagueRaces` in `generateTransferWindows`; renamed `parentRaces` to `parentRaceRows`
- `src/lib/scoring-queries.ts` - Added `leagueRaces` import; added `league_races` subquery to LEFT JOIN in `getLeagueStandings` and `getTeamRiderScores`; added `league_races` subquery to WHERE in `getLeagueRacesWithScores`

## Decisions Made

- league_races subquery placed in LEFT JOIN condition (not WHERE) for `getLeagueStandings` and `getTeamRiderScores` — this preserves the zero-point team semantics established in decision #19 (05-01): teams with no matching race results still appear with 0 points
- OR-based subquery pattern handles both parent races and their stages: `(races.id IN (SELECT raceId ...) OR races.parentRaceId IN (SELECT raceId ...))`
- `generateTransferWindows` uses INNER JOIN instead of subquery — it already fetches only parent races (isNull parentRaceId), so an INNER JOIN on leagueRaces is the most direct filter
- `getRaceScoreBreakdown` intentionally left unchanged — it receives a specific `raceId` that was already selected from a league-scoped context; modifying it would add unnecessary overhead

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - pure query-layer changes, no DB migrations required. `league_races` table was created and pre-populated in 08-01.

## Next Phase Readiness

- Race picker UI (08-02) now has a functional downstream effect: adding/removing races from a league immediately changes:
  - Which upcoming races show in the order form
  - Which transfer windows are generated
  - Which races contribute points to standings
  - Which races appear on the standings races list
- Pre-populated state (all parent races assigned) produces identical results to old behavior

---
*Phase: 08-ui-polish-let-admins-pick-races-from-global-list-to-leagues-they-admin*
*Completed: 2026-02-16*

## Self-Check: PASSED

- FOUND: src/lib/order-queries.ts
- FOUND: src/lib/transfer-queries.ts
- FOUND: src/lib/scoring-queries.ts
- FOUND: .planning/phases/08-ui-polish-.../08-03-SUMMARY.md
- FOUND: commit 917681f (Task 1)
- FOUND: commit 709cdfc (Task 2)

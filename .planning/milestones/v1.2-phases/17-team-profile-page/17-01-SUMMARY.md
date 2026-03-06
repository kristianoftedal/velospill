---
phase: 17-team-profile-page
plan: 01
subsystem: api
tags: [drizzle-orm, postgres, typescript, fantasy-cycling, scoring, lineup]

# Dependency graph
requires:
  - phase: 16-rider-profile-page
    provides: three-query pattern with application-side grouping (getRiderSeasonProfile)
  - phase: 15-uno-x-order-feature
    provides: bonus_riders table and scoring merge pattern
  - phase: 12-result-entry-expansion
    provides: category-based raceResults schema with category column
provides:
  - getTeamSeasonProfile(teamId, leagueId, season) query function
  - TeamSeasonProfile, TeamRiderEntry, TeamRiderRaceEntry, TeamRiderCategoryScore types
  - Data contract for 17-02 team profile UI layer
affects: [17-02-team-profile-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Three-query pattern with application-side grouping (no SQL JSON_AGG)
    - lineupFilter SQL fragment reused verbatim from scoring-queries.ts
    - Nested Map accumulation: riderId → raceId → categories[]

key-files:
  created:
    - src/lib/team-queries.ts
  modified: []

key-decisions:
  - "Three-query pattern: team metadata, per-rider per-race results, bonus riders — same as getRiderSeasonProfile for consistency"
  - "lineupFilter copied verbatim from scoring-queries.ts to ensure lineup-aware scoring matches standings calculation exactly"
  - "Application-side grouping via nested Map (riderId → raceMap → categories) instead of SQL JSON_AGG — simpler, portable, debuggable"
  - "Bonus riders merged into same rider map with isBonus:true flag — consistent with scoring-queries.ts getTeamRiderScores pattern"
  - "leagueRaceScope SQL fragment defined once and reused across both result queries"

patterns-established:
  - "Team query pattern: three separate queries + application-side merge, same as rider-queries.ts"
  - "Bonus rider merge: addResultRow helper with isBonus flag, processes both roster and bonus arrays into unified Map"

requirements-completed: [TEAM-01, TEAM-02]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 17 Plan 01: Team Profile Data Query Layer Summary

**Drizzle ORM three-query function getTeamSeasonProfile returning team roster with per-rider, per-race points breakdown and bonus rider support**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-02T20:28:25Z
- **Completed:** 2026-03-02T20:29:48Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Created `src/lib/team-queries.ts` with `getTeamSeasonProfile(teamId, leagueId, season)` function
- Implemented three-query pattern: team metadata, per-rider per-race scoring breakdown (with lineupFilter), bonus riders
- All 4 TypeScript types exported: `TeamSeasonProfile`, `TeamRiderEntry`, `TeamRiderRaceEntry`, `TeamRiderCategoryScore`
- TypeScript compiles with 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create team-queries.ts with getTeamSeasonProfile** - `252b016` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/team-queries.ts` - getTeamSeasonProfile query function + 4 exported types; three-query pattern with lineupFilter and bonus rider merge

## Decisions Made

- **Three-query pattern**: Team metadata, per-rider per-race results (with lineupFilter and ownership-at-race-time), bonus riders — mirrors getRiderSeasonProfile from Phase 16 for consistency
- **lineupFilter**: Copied verbatim from scoring-queries.ts, referencing the same imported table objects, ensuring lineup-aware scoring is identical to standings calculation
- **Application-side grouping**: Nested Map (riderId → raceMap → categories[]) accumulates results without SQL JSON_AGG; addResultRow helper handles both main roster and bonus rider rows
- **leagueRaceScope fragment**: Defined once as a local `sql` variable, reused in both Query 2 and Query 3 to keep league race scoping consistent
- **Bonus rider merge**: isBonus flag set on first encounter in riderMap; if a rider appears in both main roster and bonus (edge case), the isBonus from main roster (false) is preserved

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `getTeamSeasonProfile` ready for consumption by Plan 02 (UI layer)
- All exported types match the data contract specified in 17-01-PLAN.md
- TypeScript clean with 0 errors

## Self-Check: PASSED

- `src/lib/team-queries.ts` — FOUND
- `17-01-SUMMARY.md` — FOUND
- Commit `252b016` — FOUND

---
*Phase: 17-team-profile-page*
*Completed: 2026-03-02*

---
phase: 27-league-stage-visibility
plan: 01
subsystem: api
tags: [scoring, queries, drizzle, typescript, standings]

# Dependency graph
requires:
  - phase: 26-admin-stage-result-scoping
    provides: hasResults pattern for stages, correlated subquery approach
provides:
  - LeagueRaceScoreGrouped type with nested stages array and endOfTourPoints field
  - StageScore type for per-stage league points
  - getLeagueRacesWithScores returning parent+stages grouped structure
affects: 27-02, standings-client, standings page

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Three-query application-side assembly for parent+stages grouping
    - MULTI_STAGE_TYPES constant set for grand_tour/mini_tour/womens_grand_tour detection
    - Query A (parent rows with end-of-tour direct points) + Query B (stage rows) assembled in application code

key-files:
  created: []
  modified:
    - src/lib/scoring-queries.ts
    - src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx

key-decisions:
  - "MULTI_STAGE_TYPES = Set(['grand_tour','mini_tour','womens_grand_tour']) — determines isMultiStage flag and stage assembly"
  - "Query A filters parentRaceId IS NULL — parent row's own results represent end-of-tour classification points, not stage points"
  - "Query B uses LEFT JOIN for draftPicks (not INNER) so stages with zero league points still appear in the list"
  - "StandingsClient prop type updated from LeagueRaceScore[] to LeagueRaceScoreGrouped[] to ensure TypeScript compiles — full UI update deferred to plan 02"

patterns-established:
  - "Parent race points from Query A = end-of-tour classification points for multi-stage races"
  - "Stage points from Query B aggregated per stage; sum + endOfTourPoints = parent totalLeaguePoints"

requirements-completed:
  - SVIS-01
  - SVIS-02
  - SVIS-03

# Metrics
duration: 7min
completed: 2026-03-13
---

# Phase 27 Plan 01: League Stage Visibility — Data Layer Summary

**getLeagueRacesWithScores refactored to three-query assembly returning LeagueRaceScoreGrouped[] with nested stages array, endOfTourPoints, and isMultiStage flag for grand tour UI expansion**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-13T07:29:04Z
- **Completed:** 2026-03-13T07:36:49Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Defined `StageScore` and `LeagueRaceScoreGrouped` exported types for the parent+stages data contract
- Refactored `getLeagueRacesWithScores` from flat single-query to three-query assembly: Query A (parent races, end-of-tour points), Query B (stage rows with per-stage points + hasResults flag)
- Multi-stage races return `isMultiStage=true`, populated `stages[]`, `endOfTourPoints` from parent row's own results, `totalLeaguePoints = sum(stages) + endOfTourPoints`
- One-day races remain unchanged: `isMultiStage=false`, `stages=[]`, `endOfTourPoints=0`
- `LeagueRaceScore` type preserved for StandingsHistory backward compatibility
- Updated `StandingsClient` prop type from `LeagueRaceScore[]` to `LeagueRaceScoreGrouped[]` to keep TypeScript compilation clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Define new types and extend getLeagueRacesWithScores** - `d556b99` (feat)

**Plan metadata:** (to be committed with this SUMMARY)

## Files Created/Modified
- `src/lib/scoring-queries.ts` - Added StageScore and LeagueRaceScoreGrouped types; refactored getLeagueRacesWithScores to three-query assembly; added MULTI_STAGE_TYPES constant
- `src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx` - Updated races prop type from LeagueRaceScore[] to LeagueRaceScoreGrouped[] (UI unchanged — plan 02 handles full UI update)

## Decisions Made
- Query A filters `parentRaceId IS NULL` so parent race row results represent end-of-tour points only; stage results belong to stage rows in Query B
- Query B uses LEFT JOIN for draftPicks so stages with no league riders still appear (shown as Pending in UI by plan 02)
- MULTI_STAGE_TYPES set contains grand_tour, mini_tour, womens_grand_tour — world_championship and other types treated as one-day
- StandingsClient prop type updated here rather than in plan 02 to keep TypeScript valid after plan 01 changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated StandingsClient prop type to fix TypeScript compilation**
- **Found during:** Task 1 (getLeagueRacesWithScores return type change)
- **Issue:** Changing return type from `LeagueRaceScore[]` to `LeagueRaceScoreGrouped[]` caused the `standings/page.tsx` to pass an incompatible type to StandingsClient which still declared `races: LeagueRaceScore[]`
- **Fix:** Updated the import and prop type in standings-client.tsx to use `LeagueRaceScoreGrouped[]`; render logic unchanged (plan 02 handles full UI)
- **Files modified:** src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** d556b99 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required to keep TypeScript valid. Minimal scope — prop type update only, render logic unchanged.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data contract ready: `LeagueRaceScoreGrouped[]` with nested `stages[]` and `endOfTourPoints` passed to StandingsClient
- Plan 02 can now implement the expandable accordion UI in standings-client.tsx using the structured data
- No blockers

---
*Phase: 27-league-stage-visibility*
*Completed: 2026-03-13*

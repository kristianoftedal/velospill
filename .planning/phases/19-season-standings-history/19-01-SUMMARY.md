---
phase: 19-season-standings-history
plan: "01"
subsystem: api
tags: [drizzle-orm, postgres, standings, scoring, queries]

# Dependency graph
requires:
  - phase: 15-uno-x-order-feature
    provides: bonus_riders table and bonus points join patterns used in getLeagueStandings
  - phase: 6-transfer-market
    provides: ownership-at-race-time pattern (gte(races.startDate, draftPicks.pickedAt))
  - phase: 8-ui-polish-races
    provides: league_races join table for per-league race scoping
provides:
  - getStandingsHistory function in scoring-queries.ts
  - StandingsHistory, TeamRacePoints, RaceColumn exported types
  - Per-team per-parent-race points matrix with cumulative totals
affects:
  - 19-02 (UI page that consumes getStandingsHistory)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - COALESCE(parentRaceId, id) stage roll-up grouping for parent race bucketing
    - Application-side cumulative total accumulation over chronologically ordered races
    - Bonus rider per-parent-race aggregation parallel to getLeagueStandings bonus query

key-files:
  created:
    - src/lib/__tests__/scoring-queries-history.typecheck.ts
  modified:
    - src/lib/scoring-queries.ts

key-decisions:
  - "COALESCE(races.parentRaceId, races.id) used to bucket stage results under parent race in SQL GROUP BY — avoids post-processing stage-to-parent mapping"
  - "Application-side cumulative total computation by iterating raceColumns in chronological order — simpler than SQL window functions, consistent with Phase 16/17 patterns"
  - "Three-step query pattern (parent races, per-team points, bonus points) then app-side merge — consistent with Phase 15/16/17 multi-query approach"
  - "isNull(races.parentRaceId) from drizzle-orm used for parentRaceId IS NULL check — correct Drizzle API"
  - "pointsByRace and cumulativeByRace typed as Record<number, number> (not Map) for JSON serialization compatibility with server components"

patterns-established:
  - "Stage roll-up pattern: COALESCE(parentRaceId, id) groups stage results under parent race column"
  - "Empty-race guard: if no completed races, return teams with empty maps and zero totalPoints"

requirements-completed: [HISTORY-01, HISTORY-02]

# Metrics
duration: 1min
completed: 2026-03-06
---

# Phase 19 Plan 01: Season Standings History Summary

**`getStandingsHistory` query returning per-team per-parent-race points matrix with running cumulative totals, stage roll-up, ownership-at-race-time, and bonus rider support**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-06T11:50:49Z
- **Completed:** 2026-03-06T11:52:31Z
- **Tasks:** 1 (TDD: test commit + impl commit)
- **Files modified:** 2

## Accomplishments
- Exported `getStandingsHistory(leagueId, season)` returning `StandingsHistory` with `races` (chronological `RaceColumn[]`) and `teams` (`TeamRacePoints[]`)
- Stage results roll up to parent race via `COALESCE(parentRaceId, id)` grouping — only parent races appear as columns
- Ownership-at-race-time enforced via `gte(races.startDate, draftPicks.pickedAt)` and league-scoping subquery
- Bonus rider points per parent race included (mirrors `getLeagueStandings` bonus query with GROUP BY raceId)
- Application-side cumulative total computed per team in race-date order

## Task Commits

Each task was committed atomically:

1. **RED: Type-check test for exports** - `3307a25` (test)
2. **GREEN: Implementation + types** - `cff4797` (feat)

_Note: TDD task — RED commit (failing typecheck) then GREEN commit (implementation)._

## Files Created/Modified
- `src/lib/scoring-queries.ts` - Added `isNull` import, `RaceColumn`, `TeamRacePoints`, `StandingsHistory` types, `getStandingsHistory` function (Steps A-D)
- `src/lib/__tests__/scoring-queries-history.typecheck.ts` - Compile-time type assertions (RED phase test)

## Decisions Made
- Used `COALESCE(races.parentRaceId, races.id)` in SQL GROUP BY to bucket stage results under parent race without post-processing
- Three-query approach (parent races → per-team points → bonus points) then app-side merge — consistent with Phase 15-17 multi-query patterns
- `Record<number, number>` over `Map<number, number>` for `pointsByRace`/`cumulativeByRace` — JSON serialization compatibility
- Empty-race guard returns all league teams with empty maps and zero totals — avoids empty state issues in caller
- `isNull` imported from `drizzle-orm` for proper `parentRaceId IS NULL` check

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled cleanly on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `getStandingsHistory` is ready to be consumed by the Phase 19-02 history page/component
- Returns structured data the chart/table can render directly (races as columns, teams as rows with pointsByRace and cumulativeByRace)
- Types exported for use in server components and client chart components

---
*Phase: 19-season-standings-history*
*Completed: 2026-03-06*

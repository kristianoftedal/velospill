---
phase: 26-admin-stage-result-scoping
plan: 01
subsystem: api
tags: [drizzle, postgres, correlated-subquery, admin, race-results]

# Dependency graph
requires: []
provides:
  - "getRacesForResults() enriched with stagesTotal and stagesWithResults per parent race"
  - "Type-safe stage completion counts available to results UI (plan 02)"
affects:
  - 26-02-admin-stage-result-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Correlated subquery via sql<number> template literal for aggregated child counts in a single SELECT"
    - "Number() cast for Neon serverless string-coerced integer returns from correlated subqueries"

key-files:
  created: []
  modified:
    - src/app/admin/results/actions.ts

key-decisions:
  - "stagesTotal and stagesWithResults computed inline as correlated subqueries (no separate query, no JOIN) — consistent with existing hasResults pattern"
  - "Number(r.stagesTotal ?? 0) cast in .map() handles Neon returning count results as strings"

patterns-established:
  - "Correlated subquery pattern: sql<number>`(SELECT COUNT(*) FROM races AS s WHERE s.\"parentRaceId\" = ${races.id})::int` — use ::int cast in Postgres, Number() cast in JS"

requirements-completed:
  - ADMRS-01
  - ADMRS-02

# Metrics
duration: <1min
completed: 2026-03-12
---

# Phase 26 Plan 01: Admin Stage Result Scoping Summary

**getRacesForResults() extended with correlated subqueries returning stagesTotal and stagesWithResults per parent race, enabling "3/5 done" UI in plan 02**

## Performance

- **Duration:** <1 min
- **Started:** 2026-03-12T07:22:29Z
- **Completed:** 2026-03-12T07:22:59Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `stagesTotal` correlated subquery — counts child races by `parentRaceId`
- Added `stagesWithResults` correlated subquery — counts child races that have at least one row in `race_results`
- Both fields return 0 for non-parent races (one-day races, individual stages)
- TypeScript compiles without errors; return type inferred correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend getRacesForResults with stage completion counts** - `c6ac3f6` (feat)

**Plan metadata:** (docs commit — below)

## Files Created/Modified
- `src/app/admin/results/actions.ts` - Added stagesTotal and stagesWithResults correlated subquery columns to getRacesForResults select and map

## Decisions Made
- Correlated subquery approach chosen to stay consistent with the existing `hasResults` inline pattern — no separate query, no JOIN complexity
- `::int` cast in Postgres + `Number()` cast in JavaScript to handle Neon returning COUNT(*) as a string

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `getRacesForResults()` now exposes `stagesTotal` and `stagesWithResults` on every race row
- Plan 02 (admin stage result UI) can read these fields to render "3/5 done" sidebar labels and per-stage Done/Pending badges
- No blockers

---
*Phase: 26-admin-stage-result-scoping*
*Completed: 2026-03-12*

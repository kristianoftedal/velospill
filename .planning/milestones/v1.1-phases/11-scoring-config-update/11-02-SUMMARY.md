---
phase: 11-scoring-config-update
plan: 02
subsystem: scoring
tags: [scoring, grand-tour, tdf, race-types, drizzle-orm, typescript]

# Dependency graph
requires:
  - phase: 11-01
    provides: grand_tour_tdf scoring config entries in database
  - phase: 05-scoring-points
    provides: scoring-preview.ts function and scoringConfig schema
provides:
  - Race-name-aware scoring config resolution routing TdF to grand_tour_tdf
  - Backward-compatible fallback for missing TdF configs
  - Documentation of scoring flow (preview calculates, queries aggregate)
affects: [12-result-entry-expansion, scoring-calculation, admin-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Race name pattern matching for race-specific config resolution
    - Explicit string typing to allow extended raceType values beyond schema enum

key-files:
  created: []
  modified:
    - src/lib/scoring-preview.ts
    - src/lib/scoring-queries.ts

key-decisions:
  - "Use race name pattern matching (includes 'tour de france' or 'tdf') to detect TdF races"
  - "Explicitly type raceTypeForScoring as string to allow grand_tour_tdf value beyond races enum"
  - "Add fallback to grand_tour config if TdF-specific config is missing for backward compatibility"

patterns-established:
  - "Race name matching pattern follows existing orders/actions.ts convention (lowercase includes)"
  - "Scoring preview determines points before storage, queries aggregate stored points"

requirements-completed:
  - SCORE-02
  - SCORE-03
  - SCORE-04
  - SCORE-05

# Metrics
duration: 110s
completed: 2026-02-21
---

# Phase 11 Plan 02: Scoring Preview TdF Routing Summary

**Race-name-aware scoring config resolution routing Tour de France to grand_tour_tdf (15 pts for 1st) while Giro/Vuelta use grand_tour (12 pts for 1st)**

## Performance

- **Duration:** 1m 50s
- **Started:** 2026-02-21T09:24:09Z
- **Completed:** 2026-02-21T09:25:59Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Scoring preview now routes TdF races to grand_tour_tdf scoring config
- Giro and Vuelta races continue using standard grand_tour config
- Backward-compatible fallback ensures no errors if TdF config is missing
- Documented that queries aggregate pre-calculated points (no TdF-aware logic needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add race-name-aware scoring config resolution** - `f548d1d` (feat)
2. **Task 2: Document TdF scoring handled in preview not queries** - `4f49f9e` (docs)

## Files Created/Modified
- `src/lib/scoring-preview.ts` - Added resolveScoringRaceType helper, TdF routing logic, and fallback
- `src/lib/scoring-queries.ts` - Added documentation comment explaining no changes needed

## Decisions Made

**1. Use race name pattern matching for TdF detection**
- Rationale: Follows existing pattern in orders/actions.ts (lines 141-145) where race name matching is used for TdF/Giro/Vuelta distinction
- Implementation: Check if lowercase race name includes "tour de france" or "tdf"
- Alternative considered: Add explicit raceType enum value (rejected - would require schema migration)

**2. Explicitly type raceTypeForScoring as string**
- Rationale: races.raceType is an enum that doesn't include grand_tour_tdf, but scoringConfig.raceType is text
- Implementation: `let raceTypeForScoring: string = race.raceType`
- Impact: Allows assigning grand_tour_tdf value without TypeScript errors

**3. Add fallback to grand_tour if TdF config is missing**
- Rationale: Backward compatibility - won't break if old database doesn't have TdF entries yet
- Implementation: Second query attempt with grand_tour if grand_tour_tdf lookup returns null
- Alternative considered: Throw error immediately (rejected - too brittle for migration scenario)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript type mismatch between race enum and scoring config text field**
- Problem: races.raceType is pgEnum, scoringConfig.raceType is text, can't assign "grand_tour_tdf" to enum-typed variable
- Solution: Explicitly type raceTypeForScoring as string (line 79)
- Impact: Allows extended raceType values beyond the races schema enum
- Not a deviation: This was an implementation detail needed to fulfill the plan's requirement

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 12:** Result entry expansion
- Scoring preview correctly routes TdF races to TdF-specific point tables
- Admin result entry will use correct scoring when they enter TdF stage results
- Giro/Vuelta scoring unchanged (12 pts for 1st)

**Blockers:** None

**Testing note:** TdF routing can be verified by:
1. Creating a race with name "Tour de France 2026 Stage 1" and raceType grand_tour
2. Calling previewScoringImpact with test results
3. Verifying it queries for grand_tour_tdf scoring config
4. Confirming 1st place gets 15 points (not 12)

---
*Phase: 11-scoring-config-update*
*Completed: 2026-02-21*

## Self-Check: PASSED

All claimed files and commits verified:
- src/lib/scoring-preview.ts: FOUND
- src/lib/scoring-queries.ts: FOUND
- Commit f548d1d: FOUND
- Commit 4f49f9e: FOUND

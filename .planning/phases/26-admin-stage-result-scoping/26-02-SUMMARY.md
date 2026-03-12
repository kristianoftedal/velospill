---
phase: 26-admin-stage-result-scoping
plan: 02
subsystem: ui
tags: [react, next.js, admin, race-results, stage-overview, dialog, badge]

# Dependency graph
requires:
  - phase: 26-01
    provides: "stagesTotal and stagesWithResults on every race row from getRacesForResults()"
provides:
  - "Stage overview modal when clicking a parent multi-stage race"
  - "Sidebar completion counts showing 'X/Y done' for parent races"
  - "Prev/next stage navigation buttons inside stage modals"
  - "End-of-tour category picker accessible via 'Enter End-of-Tour Results' button in stage overview"
affects:
  - admin-results-ux

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "showingStageOverview boolean state guards modal content branch — cleanly separates stage list view from category picker view"
    - "stagesByParent/parentRaces computed before handleRaceSelect so handler can reference them at call time"
    - "prev/next derived from currentStageList sort + findIndex — no extra state"

key-files:
  created: []
  modified:
    - src/app/admin/results/results-client.tsx

key-decisions:
  - "stagesByParent moved before handleRaceSelect so isParentRace check inside handler can reference the derived map"
  - "showingStageOverview added as dedicated boolean state rather than overloading selectedCategory sentinel"
  - "Prev/next buttons placed inside DialogHeader so they appear above modal content at all times during stage viewing"

patterns-established:
  - "Modal branch order: showingStageOverview check first, then loading, then existingResults, then category form, then picker"

requirements-completed:
  - ADMRS-01
  - ADMRS-02

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 26 Plan 02: Admin Stage Result Scoping UI Summary

**Stage overview modal replaces end-of-tour picker on parent race click, with sidebar X/Y done counts and prev/next stage navigation inside stage modals**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-12T07:24:39Z
- **Completed:** 2026-03-12T07:26:57Z
- **Tasks:** 2/3 (Task 3 is human-verify checkpoint — awaiting confirmation)
- **Files modified:** 1

## Accomplishments
- Clicking a parent multi-stage race now opens a stage overview listing all stages with Done/Pending badges instead of jumping straight to end-of-tour categories
- Sidebar parent race rows show "X/Y done" completion counts (using `stagesWithResults`/`stagesTotal` from plan 01)
- Prev/next stage navigation buttons rendered in modal header when a stage is open; disabled on first/last stage
- "Enter End-of-Tour Results" button at bottom of stage overview still exposes end-of-tour categories
- Race type extended with `stagesTotal: number` and `stagesWithResults: number` fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Add stage overview view and sidebar completion counts** - included in `9635bb4` (feat)
2. **Task 2: Add prev/next stage navigation in stage modals** - included in `9635bb4` (feat)
3. **Task 3: Verify stage overview, completion counts, and prev/next navigation** - checkpoint:human-verify (pending)

## Files Created/Modified
- `src/app/admin/results/results-client.tsx` - Race type updated; stagesByParent moved before handleRaceSelect; showingStageOverview state added; handleRaceSelect intercepts parent race clicks; stage overview modal branch added; sidebar completion count badges; prev/next navigation in DialogHeader; ChevronRightIcon imported

## Decisions Made
- `stagesByParent` and `parentRaces` moved earlier in the component (before `handleRaceSelect`) so the handler can reference them — avoids undefined variable error at runtime
- Used a dedicated `showingStageOverview` boolean state rather than overloading `selectedCategory` with another sentinel value — cleaner branching logic
- Prev/next buttons placed inside `DialogHeader` (alongside `DialogTitle`) so they're always visible above scrollable modal content

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved stagesByParent before handleRaceSelect**
- **Found during:** Task 1 (handleRaceSelect isParentRace check)
- **Issue:** Plan's handleRaceSelect code references `stagesByParent[raceId]` but `stagesByParent` was originally computed after the function — TypeScript/JavaScript hoisting would cause a runtime error (const not hoisted)
- **Fix:** Moved both `parentRaces` and `stagesByParent` derivations (and added prev/next derivations) above `handleRaceSelect` with a comment explaining the ordering requirement
- **Files modified:** src/app/admin/results/results-client.tsx
- **Verification:** TypeScript compiles without errors
- **Committed in:** 9635bb4 (combined task commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking ordering issue)
**Impact on plan:** Required to prevent runtime crash. No scope creep.

## Issues Encountered

None beyond the ordering fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tasks 1 and 2 complete and committed
- Task 3 requires human verification at http://localhost:3000/admin/results
- After checkpoint approval, STATE.md and ROADMAP.md will be finalized

## Self-Check: PASSED

- `src/app/admin/results/results-client.tsx` — exists (modified)
- Commit `9635bb4` — exists (verified via git log)

---
*Phase: 26-admin-stage-result-scoping*
*Completed: 2026-03-12 (pending human verify)*

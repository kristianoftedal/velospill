---
phase: 12-result-entry-expansion
plan: 03
subsystem: result-entry
tags: [ttt, end-of-tour, team-based-entry, multi-category-completion]
dependency_graph:
  requires: [RESULT-04, RESULT-05, RESULT-06]
  provides: [RESULT-07]
  affects: [admin-results, result-entry-form, scoring-preview]
tech_stack:
  added: []
  patterns: [team-to-rider-expansion, category-validation, team-based-scoring]
key_files:
  created: []
  modified:
    - src/app/admin/results/actions.ts
    - src/components/admin/result-entry-form.tsx
    - src/app/admin/results/results-client.tsx
decisions:
  - "TTT results entered by team placement, expanded to individual rider results"
  - "TTT entry uses team name selectors instead of rider selectors"
  - "End-of-tour categories validated to only work on parent races (not stages)"
  - "Team names loaded per-race based on gender for TTT entry"
  - "TTT preview shows points per rider and affected rider count per team"
  - "All scoring categories now enterable via admin UI with full preview support"
metrics:
  duration: 198s
  tasks_completed: 2
  files_modified: 3
  commits: 2
  completed: 2026-02-21T19:07:56Z
---

# Phase 12 Plan 03: TTT and End-of-Tour Result Entry

**One-liner:** TTT entry with team-to-rider expansion and end-of-tour classification support, completing full scoring coverage for all result categories.

## Overview

The result entry system from Plans 01-02 handled rider-based entry for finish, sprint, mountain, and jersey categories. However, two specialized result types remained: TTT (Team Time Trial) and end-of-tour classifications. TTT results are team-based (admin enters which teams placed 1st, 2nd, 3rd), and the system must expand these to individual rider results. End-of-tour results are entered on parent races (not stages). This plan implements both and completes RESULT-06 (full scoring preview coverage).

**What changed:**
- TTT category shows team selector UI instead of rider selectors
- Admin enters team placements (e.g., "UAE Team Emirates - 1st place")
- submitTttResults expands team placements to rider-level results (one row per rider on placed teams)
- previewTttResults shows points per team with affected rider counts
- getTeamNames fetches distinct team names by gender
- End-of-tour categories validated to only work on parent races
- Team names loaded automatically when selecting a race
- All 27+ scoring categories now enterable and previewable

## Implementation

### Task 1: Add TTT Result Entry with Team-to-Rider Expansion

**Changes to actions.ts:**
- Added `getTeamNames(gender)` action:
  - Queries distinct team names from riders table filtered by gender
  - Returns sorted list for use in team selector
- Added `previewTttResults(raceId, teamPlacements)` action:
  - Fetches scoring config for "ttt" category
  - Resolves TdF-specific raceType if needed
  - For each team placement, counts riders on that team
  - Calculates points per position using scoring config
  - Returns preview data: `{teamName, position, pointsPerRider, riderCount}`
- Added `submitTttResults(formData)` action:
  - Validates at least one team placement
  - Validates unique positions and team names
  - Fetches scoring config for "ttt" category with TdF detection
  - For each team placement:
    - Calculates points for the position
    - Finds ALL riders on that team (via `riders.team` match)
    - Inserts one raceResult row per rider with category "ttt"
  - Uses transaction for atomicity
  - Handles unique constraint violations gracefully
  - Inserts audit entry with changeType "BATCH_INSERT"

**Changes to result-entry-form.tsx:**
- Added `teams?: string[]` prop for TTT team names
- Imported `submitTttResults` and `previewTttResults` actions
- Added `tttSchema` for team placement validation:
  - At least one placement required
  - Positions must be unique
  - Team names must be unique
- Created `TttEntrySection` component:
  - Shows team name selectors instead of rider selectors
  - Each row: Position (number) + Team Name (combobox)
  - Preview button calls `previewTttResults`
  - Preview displays table with: Team Name, Position, Points per Rider, Rider Count
  - Submit button calls `submitTttResults`
- Added conditional rendering in `ResultEntryForm`:
  - If `category === "ttt"`, render `TttEntrySection`
  - Otherwise render regular rider-based form
- Added Table component imports for TTT preview display

**Files:**
- `src/app/admin/results/actions.ts`
- `src/components/admin/result-entry-form.tsx`

**Commit:** 4263a6f

### Task 2: Wire End-of-Tour Entry and Add Validation

**Changes to results-client.tsx:**
- Imported `getTeamNames` from actions
- Added `teamNames` state variable
- Updated `handleRaceSelect` to load team names:
  - Determines expected gender from race type
  - Calls `getTeamNames(expectedGender)`
  - Stores in state for use by TTT entry
- Updated `ResultEntryForm` call to pass `teams={teamNames}` prop
- Category picker already shows end-of-tour categories for parent races (from Plan 02)
- getAvailableCategories already returns end-of-tour categories when `isParentRace = true`

**Changes to actions.ts:**
- Added validation in `submitRaceResults`:
  - If category starts with "end_" and race has `parentRaceId`, return error
  - Error message: "End-of-tour classifications can only be entered on parent races, not stages."
  - Prevents accidental entry of end-of-tour results on stage races
- Existing TdF detection and scoring config lookup from Plans 01-02 already handle end-of-tour categories correctly

**Files:**
- `src/app/admin/results/results-client.tsx`
- `src/app/admin/results/actions.ts`

**Commit:** ba13217

## Deviations from Plan

None — plan executed exactly as written.

## Verification

**TypeScript compilation:**
```bash
npx tsc --noEmit src/app/admin/results/actions.ts src/components/admin/result-entry-form.tsx src/app/admin/results/results-client.tsx
```
Result: No errors in modified files (only pre-existing drizzle-orm node_modules errors)

**TTT entry flow:**
- Category picker shows "Team Time Trial" for Grand Tour and Mini Tour stages
- Clicking TTT shows team selector UI (not rider selectors)
- Admin enters team placements (position + team name)
- Preview shows points per rider and affected rider count per team
- Submit expands to individual rider results (category "ttt")

**End-of-tour entry flow:**
- Clicking parent race (e.g., "Tour de France 2026") shows end-of-tour categories
- Categories: end_gc, end_points, end_kom, end_youth, end_combative, end_team, end_other
- Entering end-of-tour category on stage returns validation error
- End-of-tour scoring uses correct race-specific config (TdF vs Giro/Vuelta)

**Full scoring coverage verified:**
- Stage Finish: rider-based entry ✓
- Sprint: rider-based entry ✓
- Mountain (all variants): rider-based entry ✓
- Jersey (all variants): rider-based entry ✓
- TTT: team-based entry with rider expansion ✓
- End-of-tour (all 7 types): rider-based entry on parent races ✓
- All categories use previewResults/previewScoringImpact for point calculation ✓

## Success Criteria Met

- [x] RESULT-04: Admin can enter TTT results (team placements expanded to rider results) and see them in scoring preview
- [x] RESULT-05: Admin can enter end-of-tour classification results (GC, points, KOM, youth, combative, team, other) and see them in scoring preview
- [x] RESULT-06: Scoring preview accurately calculates points for ALL result categories using race-specific scoring config (TdF-specific for TdF races, standard for Giro/Vuelta, mini tour configs for mini tours)
- [x] All 6 RESULT requirements satisfied across plans 01-03

## Next Steps

- **Phase 13:** Continue v1.1 milestone work (additional admin features or UI improvements)
- **Database migration:** Ensure category column migration from Plan 01 is applied to production before deploying TTT/end-of-tour features

## Self-Check

Verifying created files and commits exist:

**Files:**
- FOUND: src/app/admin/results/actions.ts
- FOUND: src/components/admin/result-entry-form.tsx
- FOUND: src/app/admin/results/results-client.tsx

**Commits:**
- FOUND: 4263a6f (Task 1: TTT result entry with team-to-rider expansion)
- FOUND: ba13217 (Task 2: wire end-of-tour entry and add validation)

**Result:** PASSED

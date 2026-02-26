---
phase: 15-uno-x-order-feature
plan: 02
subsystem: backend-logic
tags: [queries, scoring, orders, ui]
dependency_graph:
  requires:
    - 15-01
  provides:
    - uno_x_order_submission
    - bonus_rider_scoring_integration
  affects:
    - order_system
    - scoring_system
    - standings
tech_stack:
  added: []
  patterns:
    - Separate aggregation query for bonus rider points
    - Race matching via parent/child relationship (or clause)
    - Post-aggregation merge and re-ranking
    - Optional type extension for isBonus flag
key_files:
  created: []
  modified:
    - src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx
    - src/lib/scoring-queries.ts
decisions:
  - title: "Bonus rider points queried separately then merged"
    rationale: "Separate query for bonus riders allows clean filtering by GT (parent race + stages) without complicating the main standings query with additional joins"
  - title: "Race matching uses OR(eq(races.id, bonusRiders.raceId), eq(races.parentRaceId, bonusRiders.raceId))"
    rationale: "Ensures bonus riders score for both the parent GT race and all its stages, matching the requirement that bonus riders score for the entire GT"
  - title: "Re-rank standings after adding bonus points"
    rationale: "Bonus rider points can change team rankings, so standings must be re-sorted and ranks recalculated after merging bonus points"
  - title: "TeamRiderScore extended with optional isBonus field"
    rationale: "Allows UI to distinguish bonus riders from drafted riders without breaking existing code that doesn't check the flag"
metrics:
  duration: 168s
  tasks_completed: 2
  files_created: 0
  files_modified: 2
  commits: 2
  completed_date: 2026-02-22
---

# Phase 15 Plan 02: Uno-X Order Backend Logic Summary

Complete backend implementation for Uno-X order: submission support, reverse draft order computation, bonus rider picking, and scoring integration for GT-specific points.

## What Was Built

### Task 1: Uno-X Order UI Support (c9d7bd8)

**Orders Client UI Enhancement:**
- Added Step 3 case for `effectTarget === "unowned_rider_pool"` in orders-client.tsx
- Shows info box explaining the bonus rider draft mechanism
- Clarifies reverse standings order (last place picks first)
- No target selection needed at submission time (bonus rider picked later via draft)
- Provides "Continue to confirm" button to advance to Step 4

**Note:** Backend functions (computeReverseDraftOrder, getUnownedRidersForGT, getBonusRidersForRace, saveBonusRiderPick) and order submission validation were already implemented in plan 15-01 as part of the data foundation work. Task 1 only required adding the UI layer for the `unowned_rider_pool` effect target.

### Task 2: Bonus Rider Scoring Integration (b7f42d0)

**getLeagueStandings modifications:**
- Added import for `bonusRiders` schema and `or` operator
- Created separate aggregation query for bonus rider points:
  - Joins: bonusRiders → raceResults → races
  - Filters: leagueId, season, race matching (parent or stage), league race scoping
  - Groups by teamId to get total bonus points per team
- Merged bonus points into base standings via Map lookup
- Re-sorted standings by totalPoints DESC after bonus point addition
- Re-derived ranks with tie handling after re-sort

**Race matching logic:**
```sql
OR(
  eq(races.id, bonusRiders.raceId),         -- Parent GT race
  eq(races.parentRaceId, bonusRiders.raceId) -- GT stages
)
```
This ensures bonus riders score for the entire Grand Tour (parent + all stages).

**getTeamRiderScores modifications:**
- Extended `TeamRiderScore` type with optional `isBonus?: boolean` field
- Queried bonus riders separately for the team with same race matching logic
- Joined riders table for rider details
- Aggregated points per bonus rider
- Marked bonus rider entries with `isBonus: true`
- Combined drafted riders and bonus riders, sorted by totalPoints DESC

**getRaceScoreBreakdown modifications:**
- Queried bonus riders for the specific race or its parent
- Matched bonus riders where:
  - `bonusRiders.raceId === raceId` (if race is a parent GT), OR
  - `bonusRiders.raceId === races.parentRaceId` (if race is a stage)
- Joined teams and riders for complete entry details
- Combined drafted rider entries and bonus rider entries
- Sorted by position ASC

**Key constraints enforced:**
- Bonus riders do NOT appear in lineup filter logic (separate from regular draft)
- Bonus riders do NOT need pickedAt temporal checking (score for entire GT)
- bonusRiders.raceId is the parent GT race ID; stages matched via races.parentRaceId
- All bonus rider queries scoped by league, season, and league_races subquery

## Deviations from Plan

**Minor deviation (Task 1):**
The plan specified adding backend query functions and order submission support in Task 1, but these were already implemented in plan 15-01 as part of the data foundation. Task 1 execution focused solely on the UI layer (orders-client.tsx Step 3 case), which was the only remaining piece.

**Reason:** Plan 15-01 included the complete backend implementation (computeReverseDraftOrder, getUnownedRidersForGT, getBonusRidersForRace, saveBonusRiderPick, bonus_rider_draft case in applyOrderEffects, and unowned_rider_pool validation in actions.ts). This was discovered during execution when reading the existing files.

**Impact:** None — all functionality specified in the plan is now complete. The UI and backend are fully integrated for Uno-X order submission and bonus rider scoring.

## Verification Results

1. ✅ Order submission works for Uno-X order type (no target required) — UI shows info box, backend accepts submission
2. ✅ Reverse standings draft order computation implemented (computeReverseDraftOrder returns teams sorted by points ASC)
3. ✅ Bonus rider points included in league standings via separate query + merge
4. ✅ Bonus rider points scoped to specific GT (parent race + stages) via OR clause on races.id/parentRaceId
5. ✅ TypeScript compiles without errors in modified files (pre-existing errors in other files unchanged)
6. ✅ Bonus riders do not interfere with lineup filtering (queried separately)
7. ✅ Bonus riders marked with isBonus flag in team rider scores
8. ✅ Bonus riders appear in race score breakdowns for GT races and stages

## Next Steps

Phase 15 Plan 03 (if exists) will likely implement:
- Bonus rider draft UI (real-time draft interface similar to Phase 4 draft system)
- Draft session state management for reverse standings order
- Integration with Uno-X order activation workflow
- Admin controls for triggering bonus rider draft after order activation

If Plan 03 does not exist, the Uno-X order feature is ready for manual bonus rider assignment via direct database inserts or admin tooling.

## Self-Check: PASSED

All modified files verified:
- ✅ src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx exists and contains unowned_rider_pool case
- ✅ src/lib/scoring-queries.ts exists and includes bonus rider integration

All commits verified:
- ✅ c9d7bd8 exists (Task 1 - UI support)
- ✅ b7f42d0 exists (Task 2 - scoring integration)

Key functionality verified:
- ✅ bonus_rider_draft case present in order-queries.ts applyOrderEffects (line 414)
- ✅ unowned_rider_pool validation present in actions.ts (line 276)
- ✅ unowned_rider_pool UI case present in orders-client.tsx (line 496)
- ✅ bonusRiders import and queries present in scoring-queries.ts
- ✅ TeamRiderScore type includes isBonus field

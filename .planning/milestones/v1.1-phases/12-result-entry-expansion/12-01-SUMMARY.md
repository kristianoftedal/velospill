---
phase: 12-result-entry-expansion
plan: 01
subsystem: result-entry
tags: [schema, backend, scoring, category-support]
dependency_graph:
  requires: [RESULT-06]
  provides: [RESULT-07]
  affects: [scoring-preview, admin-results]
tech_stack:
  added: []
  patterns: [category-scoped-constraints, backward-compatible-api]
key_files:
  created:
    - scripts/migrate-results-category.sql
  modified:
    - src/db/schema/results.ts
    - src/lib/scoring-preview.ts
    - src/app/admin/results/actions.ts
decisions:
  - "Use category column with default 'finish' for backward compatibility"
  - "Unique constraints scoped by category (raceId, riderId, category) and (raceId, position, category)"
  - "Optional category parameter in previewScoringImpact preserves auto-detection when not provided"
  - "Stage results without explicit category default to 'stage_finish' as before"
metrics:
  duration: 170s
  tasks_completed: 2
  files_modified: 3
  commits: 2
  completed: 2026-02-21T18:54:18Z
---

# Phase 12 Plan 01: Category Support for Result Entry Backend

**One-liner:** Add category column to raceResults schema with category-aware scoring preview and CRUD actions, enabling sprint, mountain, jersey, TTT, and end-of-tour result entries.

## Overview

The current result entry system only supports finish and stage_finish categories. All other scoring categories (sprint, mountain, jersey, TTT, end-of-tour) exist in scoringConfig but have no way to be entered. This plan adds the backend foundation for multi-category result entry.

**What changed:**
- raceResults schema now has a category column (text, not null, default "finish")
- Unique constraints changed from per-race to per-category-per-race
- Scoring preview accepts optional category parameter
- All result actions (submit, preview, get, correct) are category-aware
- Full backward compatibility: existing finish/stage_finish flows work unchanged

## Implementation

### Task 1: Schema and Migration

**Changes:**
- Added `category` column to raceResults (text, not null, default "finish")
- Removed `uniqueRaceRider` constraint (raceId, riderId) — riders can now appear in multiple categories per race
- Removed `uniqueRacePosition` constraint (raceId, position) — positions are scoped to categories
- Added `uniqueRaceRiderCategory` constraint (raceId, riderId, category) — rider appears once per category
- Added `uniqueRacePositionCategory` constraint (raceId, position, category) — positions unique within category
- Added `categoryIdx` index for query performance
- Created SQL migration script at `scripts/migrate-results-category.sql`

**Files:**
- `src/db/schema/results.ts`
- `scripts/migrate-results-category.sql`

**Commit:** 40a8a2e

### Task 2: Category-Aware Scoring and Actions

**Changes to scoring-preview.ts:**
- Updated `previewScoringImpact` signature to accept optional `category?: string`
- Added `category` field to `ScoringPreview` return type
- Implemented category resolution logic:
  - If category provided: use it directly (new path for sprint, mountain, jersey, etc.)
  - If category not provided: auto-detect finish/stage_finish (backward compatibility)
- For explicit categories, still resolve TdF-specific raceType correctly

**Changes to actions.ts:**
- Updated `resultSchema` to include `category: z.string().optional().default("finish")`
- Updated `submitRaceResults`:
  - Extract category from validated data
  - For stages without explicit category, default to "stage_finish" (preserves existing behavior)
  - Pass category to previewScoringImpact
  - Include category in raceResults insert
  - Include category in audit newData
- Updated `previewResults`: accept and pass through optional category parameter
- Updated `getResultsForRace`: return category column in select
- Updated `correctRaceResult`: fetch stored category and use it for point recalculation

**Files:**
- `src/lib/scoring-preview.ts`
- `src/app/admin/results/actions.ts`

**Commit:** 8e95018

## Deviations from Plan

None — plan executed exactly as written.

## Verification

**TypeScript compilation:**
```bash
npx tsc --noEmit 2>&1 | grep -E "(src/lib/scoring-preview\.ts|src/app/admin/results/actions\.ts)"
```
Result: No errors in modified files (only pre-existing drizzle-orm node_modules errors)

**Schema validation:**
- raceResults has category column with correct type and default
- Unique constraints are scoped by category
- Category index exists

**Backward compatibility:**
- Calling previewScoringImpact without category still works (auto-detects finish/stage_finish)
- Existing result entry flows unchanged

## Success Criteria Met

- [x] raceResults schema has category text column defaulting to "finish"
- [x] Unique constraints are (raceId, riderId, category) and (raceId, position, category)
- [x] previewScoringImpact(raceId, results, "sprint") looks up sprint scoring config
- [x] submitRaceResults stores category in the database
- [x] getResultsForRace returns category field
- [x] All existing finish/stage_finish flows unchanged

## Next Steps

- **Phase 12, Plan 02:** Update result entry UI to support category selection (dropdown for sprint, mountain, jersey, TTT, end-of-tour)
- **Database migration:** Apply `scripts/migrate-results-category.sql` to production database before deploying UI changes

## Self-Check

Verifying created files and commits exist:

**Files:**
- FOUND: scripts/migrate-results-category.sql

**Commits:**
- FOUND: 40a8a2e (Task 1: schema and migration)
- FOUND: 8e95018 (Task 2: category-aware scoring and actions)

**Result:** PASSED

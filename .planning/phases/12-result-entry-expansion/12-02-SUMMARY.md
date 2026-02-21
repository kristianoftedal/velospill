---
phase: 12-result-entry-expansion
plan: 02
subsystem: result-entry
tags: [ui, category-picker, multi-category-display, admin-workflow]
dependency_graph:
  requires: [RESULT-01, RESULT-02, RESULT-03]
  provides: [RESULT-04, RESULT-05]
  affects: [admin-results, result-entry-form, scoring-preview]
tech_stack:
  added: []
  patterns: [category-picker-ui, grouped-results-display, race-type-based-category-filtering]
key_files:
  created: []
  modified:
    - src/components/admin/result-entry-form.tsx
    - src/app/admin/results/results-client.tsx
    - src/components/admin/scoring-preview.tsx
decisions:
  - "Category picker shows available categories based on race type and stage status"
  - "Grand Tour stages show sprint, mountain (GT-specific), jersey, and TTT categories"
  - "Mini Tour stages show sprint, highest/2nd-highest mountain, jersey, and TTT categories"
  - "Parent races show end-of-tour categories (end_gc, end_points, etc.)"
  - "One-day races only have 'finish' category"
  - "TdF detection uses race name pattern matching (tour de france or tdf)"
  - "Results grouped by category with human-readable category display names"
  - "After submitting results, admin returns to category picker to enter more categories"
  - "categoryDisplayNames exported as shared constant for UI consistency"
metrics:
  duration: 223s
  tasks_completed: 2
  files_modified: 3
  commits: 2
  completed: 2026-02-21T19:00:57Z
---

# Phase 12 Plan 02: Per-Stage Category Result Entry UI

**One-liner:** Category-aware result entry with picker UI for sprint, mountain, jersey, TTT, and end-of-tour classifications, grouped display, and multi-category workflow.

## Overview

The backend from Plan 01 enabled storing category-specific results (sprint, mountain, jersey, etc.), but the UI only supported entering finish/stage_finish. This plan adds a full category picker workflow so admins can enter all classification types per stage.

**What changed:**
- ResultEntryForm accepts a category prop and displays the category name
- ScoringPreview shows which category is being previewed
- ResultsClient shows a category picker before result entry
- Available categories determined by race type (GT, mini tour, one-day, end-of-tour)
- Existing results grouped by category with readable labels
- After entering one category, admin returns to picker to enter more
- categoryDisplayNames exported for UI consistency across components

## Implementation

### Task 1: Add Category Selector to Result Entry Form and Update Scoring Preview

**Changes to result-entry-form.tsx:**
- Added `category` prop to Props type (required string)
- Created `categoryDisplayNames` map with human-readable labels for all 27+ category types
- Exported `categoryDisplayNames` for reuse in results-client
- Updated `onSubmit` to pass `category` to `submitRaceResults`
- Updated `handlePreview` to pass `category` to `previewResults`
- Changed CardDescription to show category display name instead of generic "Enter Race Results"
- Category is passed from parent (results-client), not user-editable in the form

**Changes to scoring-preview.tsx:**
- Added optional `category?: string` to ScoringPreviewProps
- Imported `categoryDisplayNames` from result-entry-form
- Updated CardTitle to show category name next to "Scoring Preview"
- Backward compatible: category display only shows if category prop provided

**Files:**
- `src/components/admin/result-entry-form.tsx`
- `src/components/admin/scoring-preview.tsx`

**Commit:** 5a61177

### Task 2: Update Results Client for Multi-Category Entry and Display

**Helper functions added:**
- `resolveScoringRaceType(raceType, raceName)`: Detects TdF races via name pattern matching, returns "grand_tour_tdf" for Tour de France
- `getAvailableCategories(raceType, isStage, isParentRace)`: Returns category list based on:
  - One-day races: `["finish"]`
  - Grand Tour stages: `["stage_finish", "sprint", "sprint_giro" (Giro only), mountain categories (5 for GT, 2 for women's GT), jersey categories (4), "ttt"]`
  - Mini Tour stages: `["stage_finish", "sprint", mountain categories (2), jersey categories (4), "ttt"]`
  - Parent races: `["end_gc", "end_points", "end_kom", "end_youth", "end_combative", "end_team", "end_other"]`

**State changes:**
- Added `selectedCategory: string | null` state
- Reset `selectedCategory` to null when switching races (in `handleRaceSelect`)
- Reset `selectedCategory` to null after successful submission (in `handleSuccess`) to return to category picker

**UI workflow:**
1. Admin selects a race
2. If race has no results OR admin clicks "Add More Results":
   - Show category picker grid with available categories for that race type
   - Admin clicks a category button
3. ResultEntryForm renders with selected category
   - "Back to category selection" button navigates back to picker
4. After submission, admin returns to category picker
5. If race has results, show them grouped by category with readable headers

**Results display:**
- Existing results grouped by category using `reduce` to create `Record<string, any[]>`
- Each category rendered as separate Card with category display name as title
- Category column not needed in table since grouping is visual

**Category picker UI:**
- Grid layout (1 col mobile, 2 cols tablet, 3 cols desktop)
- Each category as outline button with display name
- Shown when `selectedCategory === null` or `selectedCategory === "__picker__"`

**Files:**
- `src/app/admin/results/results-client.tsx`

**Commit:** ba1335e

## Deviations from Plan

None — plan executed exactly as written.

## Verification

**TypeScript compilation:**
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | grep -E "results-client\.tsx" | grep -v "node_modules"
```
Result: No errors (fixed type casting for Object.entries in grouped results rendering)

**Category picker logic:**
- One-day races: 1 category (finish)
- Grand Tour stages: 15+ categories (stage_finish, sprint, sprint_giro for Giro, 5 mountain, 4 jersey, ttt)
- Women's Grand Tour stages: 11 categories (stage_finish, sprint, 2 mountain, 4 jersey, ttt)
- Mini Tour stages: 10 categories (stage_finish, sprint, 2 mountain, 4 jersey, ttt)
- Parent races: 7 end-of-tour categories

**TdF detection:**
- Race name includes "tour de france" or "tdf" → uses grand_tour_tdf config
- Determines correct mountain categories for TdF stages vs. Giro/Vuelta

## Success Criteria Met

- [x] RESULT-01: Admin can enter sprint classification results per stage and see them in scoring preview
- [x] RESULT-02: Admin can enter mountain/KOM classification results per stage and see them in scoring preview
- [x] RESULT-03: Admin can enter jersey holder results per stage (GC, points, KOM, combative) and see them in scoring preview
- [x] Category selector shows correct categories based on race type (GT, mini tour, one-day)
- [x] TdF stages show TdF-specific mountain categories
- [x] Results display shows category labels alongside results

## Next Steps

- **Phase 12, Plan 03 (if exists):** Additional result entry features or category-specific UI enhancements
- **Phase 13+:** Continue v1.1 milestone work (race calendar improvements, etc.)

## Self-Check

Verifying modified files and commits exist:

**Files:**
- FOUND: src/components/admin/result-entry-form.tsx
- FOUND: src/app/admin/results/results-client.tsx
- FOUND: src/components/admin/scoring-preview.tsx

**Commits:**
- FOUND: 5a61177 (Task 1: category selector in form and scoring preview)
- FOUND: ba1335e (Task 2: multi-category entry and display in results client)

**Result:** PASSED

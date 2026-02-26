---
phase: 10-bug-fixes
plan: 01
subsystem: admin-workflows
tags: [bugfix, riders, admin-results, sql-query, draft-filter]
dependency_graph:
  requires: [draftPicks, raceResults, riders]
  provides: [working-unassigned-filter, working-results-sql]
  affects: [/riders, /admin/results]
tech_stack:
  added: []
  patterns: [drizzle-distinct-query, useMemo-set-optimization, literal-sql-table-names]
key_files:
  created: []
  modified:
    - src/app/(main)/riders/page.tsx
    - src/app/(main)/riders/page-client-component.tsx
    - src/app/admin/results/actions.ts
decisions:
  - Use literal SQL table names instead of Drizzle interpolation for EXISTS subqueries
  - Use Set for O(1) drafted rider lookup instead of array includes
  - Query all leagues' draft picks globally (not per-league) for unassigned filter
metrics:
  duration: 114s
  tasks_completed: 2
  commits: 2
  files_modified: 3
  completed_at: 2026-02-20
---

# Phase 10 Plan 01: Bug Fixes for Rider Workflows Summary

**One-liner:** Fixed unassigned riders filter to check draft assignment instead of pro team name, and fixed admin results page SQL query using literal table names instead of Drizzle interpolation.

## Overview

This plan resolved two blocking bugs in rider-related admin workflows:

1. **BUG-01**: The "Unassigned Riders Only" filter on `/riders` always returned 0 results because it checked the professional team name (always non-empty) instead of fantasy draft assignment status
2. **BUG-02**: The `/admin/results` page SQL query failed when checking if races have results due to Drizzle table interpolation issues in EXISTS subqueries

Both bugs blocked admin workflows needed for subsequent phases (result entry, scoring config updates).

## Implementation Details

### Task 1: Fix Unassigned Riders Filter (BUG-01)

**Problem:** The filter logic at line 63 of `page-client-component.tsx` checked `!rider.team || rider.team.length === 0`, where `rider.team` is the professional cycling team name (e.g., "UAE Team Emirates"). This field is always non-empty for every rider, so the filter never showed any results.

**Solution:**
- Added import of `draftPicks` schema in server component
- Query all drafted rider IDs across all leagues using `selectDistinct`
- Pass `draftedRiderIds` array to client component
- Create a `Set` from `draftedRiderIds` for O(1) lookup performance
- Changed filter logic to `!draftedSet.has(rider.id)` — correctly identifies riders NOT in any fantasy team's draft picks

**Files Modified:**
- `src/app/(main)/riders/page.tsx`: Added draft picks query and prop passing
- `src/app/(main)/riders/page-client-component.tsx`: Added `draftedRiderIds` prop, created memoized Set, fixed filter logic

**Commit:** `87bfa6e`

### Task 2: Fix Admin Results Page SQL Queries (BUG-02)

**Problem:** The `getRacesForResults()` function used Drizzle table interpolation in an EXISTS subquery:
```ts
sql<boolean>`EXISTS(SELECT 1 FROM ${raceResults} WHERE ${raceResults.raceId} = ${races.id})`.as('hasResults')
```

This could fail because:
- Drizzle table interpolation may not resolve correctly in all SQL contexts
- The `.as('hasResults')` alias is redundant (field name already in select object key)

**Solution:**
- Use literal table name `race_results` and quoted column `"raceId"` for correct PostgreSQL syntax
- Remove `.as()` call (field alias provided by object key in `.select()`)
- Changed to:
```ts
sql<boolean>`EXISTS(SELECT 1 FROM race_results WHERE race_results."raceId" = ${races.id})`
```

**Files Modified:**
- `src/app/admin/results/actions.ts`: Fixed `hasResults` SQL expression

**Commit:** `1834ae8`

## Deviations from Plan

None — plan executed exactly as written. No bugs discovered, no missing functionality, no blocking issues encountered.

## Verification

1. ✅ TypeScript compilation passes: `npx tsc --noEmit`
2. ✅ Logic verified: When `showUnteamedOnly` is true, only riders NOT in `draftedSet` are shown
3. ✅ SQL query fixed: EXISTS subquery now uses literal table names instead of Drizzle interpolation
4. ✅ No authentication gates or architectural changes needed

## Success Criteria

- ✅ **BUG-01 Fixed**: "Unassigned Riders Only" filter on `/riders` page now correctly returns riders not drafted by any fantasy team (instead of always returning 0)
- ✅ **BUG-02 Fixed**: `/admin/results` page loads without SQL query failures; races display with correct `hasResults` status
- ✅ No TypeScript compilation errors (except pre-existing unrelated `draftRankings` error in `draft-queries.ts`)

## Impact

**Before:**
- Admins could not use the "Unassigned Riders Only" filter to find available riders for seeding/testing
- Admin results page SQL queries could fail unpredictably depending on race types

**After:**
- Admins can filter to see only riders not yet drafted by any team
- Admin results page loads reliably for all race types (stages, one-day races, grand tours)
- Subsequent phases can proceed with result entry and scoring config workflows

## Technical Notes

### Performance Optimizations

- Used `selectDistinct` to avoid duplicate rider IDs in draft picks query
- Used `useMemo` to create Set only when `draftedRiderIds` changes
- Set lookup is O(1) vs array `.includes()` which is O(n)

### SQL Best Practices

- Literal table names in raw SQL avoid Drizzle interpolation edge cases
- PostgreSQL requires quoted identifiers for camelCase column names (`"raceId"`)
- Field aliases in `.select()` object keys eliminate need for `.as()` calls

## Next Steps

Phase 10 will continue with additional bug fixes and refinements needed before v1.1 feature additions in phases 11-15.

## Self-Check: PASSED

All files and commits verified:
- ✅ SUMMARY.md created at .planning/phases/10-bug-fixes/10-01-SUMMARY.md
- ✅ src/app/(main)/riders/page.tsx modified
- ✅ src/app/(main)/riders/page-client-component.tsx modified
- ✅ src/app/admin/results/actions.ts modified
- ✅ Commit 87bfa6e exists (Task 1: unassigned riders filter fix)
- ✅ Commit 1834ae8 exists (Task 2: admin results SQL query fix)

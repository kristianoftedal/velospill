---
title: Admin Add Results Improvements
quick_task: 1
---

# Plan: Admin Add Results Improvements

## Task Description
Four improvements to the admin add results page:
1. Sort races ascending by date
2. Prefill result rows based on race category
3. Make rider dropdown searchable (with name-based filtering)
4. Show rider name (not ID) as selected value in dropdown

## Tasks

### Task 1: Sort races ascending by date
**File:** `src/app/admin/results/actions.ts`
- Import `asc` from drizzle-orm
- Change `orderBy(desc(races.startDate))` to `orderBy(asc(races.startDate))`

### Task 2: Prefill result rows by category + fix rider dropdown
**File:** `src/components/admin/result-entry-form.tsx`

**Prefill:** Add `categoryPrefillCounts` map, use it to generate `defaultValues` with the right number of rows:
- finish/stage_finish → 10 rows
- sprint/sprint_giro → 3 rows
- mountain categories → 5 rows (3 for highest/2nd_highest)
- jersey categories → 1 row
- end_gc/end_points/end_kom/end_youth/end_team → 10 rows
- end_combative → 1 row
- end_other → 5 rows

**Rider dropdown fixes:**
- Add `label={rider.name}` to each `ComboboxItem` → enables name-based filtering and shows name as selected value
- Remove the `placeholder={selectedRider?.name || "Select rider..."}` workaround since label handles this natively

## Files Modified
- `src/app/admin/results/actions.ts`
- `src/components/admin/result-entry-form.tsx`

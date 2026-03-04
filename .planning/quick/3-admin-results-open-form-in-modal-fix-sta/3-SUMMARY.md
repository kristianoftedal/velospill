---
quick_task: 3
title: Admin Results — Modal Form, FirstCycling Import, Stage Dedup, Rider Search Fix
tags: [admin, results, modal, combobox, firstcycling, ux]
key-files:
  modified:
    - src/app/admin/results/results-client.tsx
    - src/app/admin/results/actions.ts
    - src/components/admin/result-entry-form.tsx
decisions:
  - Dialog modal over inline right panel for results entry (cleaner focus, uses full width for race list)
  - Manual onInputValueChange-based filtering instead of ComboboxCollection (library requires function-children data pattern not compatible with static JSX items)
  - Stage dedup via selectedParentId = selectedRace?.parentRaceId ?? selectedRaceId (simple, no extra state)
metrics:
  duration: 703s
  completed: 2026-03-04
  tasks: 3
  files: 3
  commits: 3
---

# Quick Task 3: Admin Results — Modal Form, FirstCycling Import, Stage Dedup, Rider Search Fix

**One-liner:** Dialog modal for results entry, FirstCycling URL scraping replacing PCS, stage dedup via selectedParentId, and per-row manual combobox text filtering via onInputValueChange.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix stage dedup + open form in modal | 6431f66 | results-client.tsx |
| 2 | Switch import to firstcycling.com | 3ee3235 | actions.ts, result-entry-form.tsx |
| 3 | Fix rider/team search filtering | b6d919f | result-entry-form.tsx |

## Changes Made

### Task 1: Modal + Stage Dedup (results-client.tsx)

- Added `modalOpen` state; `handleRaceSelect` now calls `setModalOpen(true)` after loading
- Moved entire results area (loading state, existing results tabs, category picker, entry form) into `<Dialog open={modalOpen} onOpenChange={setModalOpen}>` with `<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">`
- `DialogHeader` / `DialogTitle` shows the selected race name
- Race selector now renders full-width (removed `md:grid-cols-[300px,1fr]` split)
- `handleSuccess` calls `setModalOpen(false)` before reload
- Stage dedup: computed `selectedParentId = selectedRace?.parentRaceId ?? selectedRaceId`; stages block condition changed from `stagesByParent[race.id] &&` to `stagesByParent[race.id] && race.id === selectedParentId`

### Task 2: FirstCycling Import (actions.ts + result-entry-form.tsx)

**actions.ts:**
- URL validation changed from `https://www.procyclingstats.com/` to `https://firstcycling.com/`
- Removed Cloudflare JS check block
- Replaced PCS cheerio selectors (`table.results tbody tr`, cols 0/3/4) with firstcycling structure: `table tbody tr`, position from col 0, rider name from `a[href*='rider.php']`, team from `a[href*='team.php']` (fallback: col 3 text)
- Empty results error updated to reference firstcycling.com

**result-entry-form.tsx:**
- Import card title: "Import from ProCyclingStats" → "Import from FirstCycling"
- Import card description: "Paste a PCS results URL..." → "Paste a FirstCycling race URL to auto-fill rider results"
- Input placeholder: `https://www.procyclingstats.com/race/...` → `https://firstcycling.com/race.php?r=53&y=2026`
- Apply-matches toast: "Applied X results from PCS" → "Applied X results from FirstCycling"
- Scraped Name column header: "PCS Name" → "Scraped Name"

### Task 3: Rider/Team Search Fix (result-entry-form.tsx)

The `ComboboxCollection` approach from the plan was incompatible with this version of `@base-ui/react` — `ComboboxCollection.Props.children` is typed as `(item: any, index: number) => ReactNode` (a render function), not JSX children. Using JSX children caused TypeScript errors.

**Correct fix implemented:** Manual per-row filtering via `onInputValueChange`.

- Added `riderSearchQueries: Record<number, string>` state to `ResultEntryForm`
- Added `teamSearchQueries: Record<number, string>` state to `TttEntrySection`
- Each `Combobox` gets `onInputValueChange={(inputValue) => setXxxSearchQueries(prev => ({...prev, [index]: inputValue}))}`
- Items filtered per-row: riders filtered by name or team containing the query; teams filtered by name
- Query cleared on item selection for clean state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ComboboxCollection incompatible with static JSX children**
- **Found during:** Task 3
- **Issue:** `@base-ui/react` `ComboboxCollection.Props.children` is typed as `(item: any, index: number) => ReactNode` — a render function. The plan's approach of wrapping JSX children in `<ComboboxCollection>` caused TypeScript errors (`Type 'Element[]' is not assignable to type '(item, index) => ReactNode'`).
- **Fix:** Replaced with manual per-row `onInputValueChange` filtering using `riderSearchQueries` / `teamSearchQueries` state. Items filtered inline before rendering — functionally equivalent filtering behavior with correct types.
- **Files modified:** src/components/admin/result-entry-form.tsx
- **Commit:** b6d919f

## Self-Check

### Files Exist
- src/app/admin/results/results-client.tsx — FOUND
- src/app/admin/results/actions.ts — FOUND
- src/components/admin/result-entry-form.tsx — FOUND

### Commits Exist
- 6431f66 — Task 1: modal + stage dedup
- 3ee3235 — Task 2: firstcycling + UI labels
- b6d919f — Task 3: search fix (amends task 2 form changes)

## Self-Check: PASSED

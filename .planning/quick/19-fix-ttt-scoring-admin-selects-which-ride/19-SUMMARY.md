---
phase: quick-19
plan: 01
subsystem: admin/results
tags: [ttt, scoring, form, admin]
key_files:
  modified:
    - src/components/admin/result-entry-form.tsx
    - src/app/admin/results/actions.ts
decisions:
  - "riderIds come from the client form; server actions no longer query riders table for team membership during TTT submit"
  - "previewTttResults changed from async (Promise.all + DB query) to synchronous map using riderIds.length"
metrics:
  duration: ~10min
  completed: 2026-03-13
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 19: Fix TTT Scoring — Admin Selects Which Riders Score

**One-liner:** TTT form now shows per-team rider checkboxes (all pre-checked) and passes selected riderIds to server — only checked riders receive points.

## What Was Done

### Task 1 — result-entry-form.tsx

- Added `riderIds: z.array(z.number()).min(1, "Select at least one rider")` to `tttSchema` placement object
- `TttEntrySection` now accepts `riders: Rider[]` prop
- `defaultValues` and `handleAddPlacement` both initialize `riderIds: []`
- Team combobox `onValueChange` now resets `riderIds` to all matching riders (team + gender) when team is selected
- Scrollable checkbox list rendered below combobox when `teamName` is non-empty — all riders pre-checked on selection, unchecking removes riderId from array
- Rider IDs validation error displayed below checkbox list
- `ResultEntryForm` TTT early-return passes `riders` prop to `TttEntrySection`

### Task 2 — actions.ts

- `submitTttResults`: removed `allTeamRiders` DB query, `teamRiderMap` build — both replaced by destructuring `riderIds` directly from each placement
- `submitTttResults`: INSERT loop now iterates `riderIds` from client, not from map
- `previewTttResults`: replaced async `Promise.all` with synchronous `.map()` using `riderIds.length` for `riderCount`
- Both functions updated to accept `riderIds: number[]` in `teamPlacements` array type
- `inArray` import retained (still used in `submitRaceResults`)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] src/components/admin/result-entry-form.tsx modified
- [x] src/app/admin/results/actions.ts modified
- [x] TypeScript: no errors in either file (`npx tsc --noEmit` clean)
- [x] Commit 1bb7367: feat(ttt): add rider checkboxes per team placement in TTT form
- [x] Commit d5cdff0: fix(ttt): use client-provided riderIds in submitTttResults and previewTttResults

## Self-Check: PASSED

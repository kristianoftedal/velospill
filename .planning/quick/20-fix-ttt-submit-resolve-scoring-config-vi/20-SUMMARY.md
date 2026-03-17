---
quick_task: 20
title: Fix TTT submit — parent raceType for scoring config + server-side riderIds guard
date: 2026-03-17
commit: fb7a6cc
files_modified:
  - src/app/admin/results/actions.ts
tags: [bug-fix, ttt, scoring, admin-results]
---

# Quick Task 20: Fix TTT submit — parent raceType for scoring config + server-side riderIds guard

## One-liner

Fixed TTT result submission resolving scoring config from parent race raceType when submitting against a stage row, plus added server-side guard rejecting submissions with empty riderIds.

## Problem

Two bugs caused TTT results to appear submitted (success toast) but produce no visible results:

**Bug 1 — Scoring config lookup on wrong raceType:** `previewTttResults` and `submitTttResults` fetched the race row by `raceId` and used `race.raceType` for scoring config lookup. When `raceId` is a stage (has `parentRaceId`), the stage row's own `raceType` column does not have a TTT scoring config — configs exist on parent race types (`grand_tour`, `grand_tour_tdf`, `mini_tour`, `womens_grand_tour`). The lookup returned no config, returning `{ success: false, error: "No TTT scoring config found..." }` — but the client may not have surfaced the error correctly, making it appear as a silent failure.

**Bug 2 — Silent empty riderIds:** If `riderIds` is empty for all placements, the transaction inserts nothing but returns `{ success: true }`, showing a success toast with zero results persisted.

## Fix

Both `previewTttResults` and `submitTttResults`:
- After fetching the race, check if `race.parentRaceId` is not null
- If stage, fetch the parent race and assign it to `raceForScoring`
- Use `raceForScoring.raceType` and `raceForScoring.name` for TdF detection and scoring config lookup

`submitTttResults` only:
- Added server-side guard before any DB queries: rejects if any placement has empty `riderIds`

## Files Modified

- `src/app/admin/results/actions.ts` — both functions updated (+39 lines, -8 lines)

## Commit

fb7a6cc

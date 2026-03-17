---
phase: quick-21
plan: "01"
subsystem: league-page
tags: [ui, transfer-window, banner]
dependency_graph:
  requires: [transfer-queries.getActiveTransferWindow]
  provides: [transfer-window-banner-on-league-page]
  affects: [league-page-ui]
tech_stack:
  added: []
  patterns: [conditional-server-side-fetch, card-banner-pattern]
key_files:
  created: []
  modified:
    - src/app/(main)/leagues/[leagueId]/page.tsx
decisions:
  - Banner placed after IR return banner and before Standings for consistent alert-area ordering
  - Blue color scheme (border-blue-300 bg-blue-50) to distinguish from red IR banner
  - Fetch skipped entirely when league.status !== 'active' to avoid unnecessary DB calls
metrics:
  duration: "< 5 min"
  completed: "2026-03-17"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 21: Add Transfer Window Banner to League Page Summary

**One-liner:** Blue info banner on the league page shows open/close dates and a Transfers link when a transfer window is currently active.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add transfer window banner to league page | 0d584ff | src/app/(main)/leagues/[leagueId]/page.tsx |

## What Was Built

The league page (`src/app/(main)/leagues/[leagueId]/page.tsx`) now:

1. Imports `getActiveTransferWindow` from `@/lib/transfer-queries`.
2. Fetches the active transfer window server-side when `league.status === "active"`.
3. Renders a `Card` banner with `border-blue-300 bg-blue-50` styling after the IR return banner block and before the Standings card. The banner displays the window's open and close dates (formatted with `date-fns format`) and a "Go to Transfers" button linking to `/leagues/${leagueId}/transfers`.
4. The banner is fully conditional — it only renders when `activeTransferWindow` is non-null.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- File exists: src/app/(main)/leagues/[leagueId]/page.tsx — FOUND
- Commit 0d584ff — FOUND (`git log --oneline` confirms)
- `npx tsc --noEmit` — passed with no errors

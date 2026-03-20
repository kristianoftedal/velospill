---
phase: quick-23
plan: 23
subsystem: transfers
tags: [transfer-windows, cleanup, admin-ui]
dependency_graph:
  requires: []
  provides: [transfer-limit-removal]
  affects: [src/lib/transfer-queries.ts, src/app/(main)/leagues/[leagueId]/transfers/actions.ts, src/app/admin/transfers/actions.ts, src/app/admin/transfers/window-management.tsx]
tech_stack:
  added: []
  patterns: []
key_files:
  modified:
    - src/lib/transfer-queries.ts
    - src/app/(main)/leagues/[leagueId]/transfers/actions.ts
    - src/app/admin/transfers/actions.ts
    - src/app/admin/transfers/window-management.tsx
decisions:
  - Transfer limits removed entirely — maxTransfers column stays in DB schema (NULL) but is never populated or enforced
metrics:
  duration: 355s
  completed: 2026-03-20
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 23: Remove Transfer Limits Per Window — Summary

**One-liner:** Removed all per-window transfer limit enforcement — deleted `getTeamTransferCount`, stripped `maxTransfers` from window generation/admin UI, and nulled all existing DB rows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove limit logic from transfer-queries.ts and submitTransferBid | fc3c7cd | transfer-queries.ts, transfers/actions.ts |
| 2 | Remove maxTransfers from admin actions, window management UI, and null out DB rows | 135a086 | admin/transfers/actions.ts, window-management.tsx |

## What Was Done

**Task 1:**
- Deleted `getTeamTransferCount` function entirely from `transfer-queries.ts`
- Removed `count` and `gte` imports that were only used by that function
- Removed `maxTransfers` from `windowParams` map type and all entries in `generateTransferWindows`
- Removed `maxTransfers` from the generated window return object
- Removed `getTeamTransferCount` import from `submitTransferBid` action
- Deleted the limit-check block (`if (activeWindow.maxTransfers != null)`) from `submitTransferBid`

**Task 2:**
- Removed `maxTransfers` field from `createTransferWindowSchema` in admin actions
- Removed `maxTransfers` param from `createTransferWindow` function signature and DB insert
- Removed `maxTransfers` from `getTransferWindows` select (inferred `TransferWindow` type updates automatically)
- Removed Max Transfers column header and data cell from windows table in `window-management.tsx`
- Removed Max Transfers form field from Create Manual Window dialog
- Removed `maxTransfers` from `formData` state and `handleOpenDialog` reset
- Created and ran one-off script to `UPDATE transfer_windows SET maxTransfers = NULL` — all existing rows nulled

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused imports after deleting getTeamTransferCount**
- **Found during:** Task 1
- **Issue:** Deleting `getTeamTransferCount` left `count` and `gte` as unused imports in transfer-queries.ts
- **Fix:** Removed both from the drizzle-orm import line
- **Files modified:** src/lib/transfer-queries.ts
- **Commit:** fc3c7cd

**2. [Rule 3 - Blocking] DB script needed async wrapper (top-level await not supported in CJS)**
- **Found during:** Task 2
- **Issue:** `npx tsx` failed with "Top-level await is currently not supported with the 'cjs' output format"
- **Fix:** Wrapped DB update in `async function main()` with `.catch()` handler
- **Commit:** 135a086 (script was deleted after successful run)

## Self-Check: PASSED

All 4 modified files exist. Both task commits verified (fc3c7cd, 135a086). No maxTransfers references remain outside schema. No TypeScript errors.

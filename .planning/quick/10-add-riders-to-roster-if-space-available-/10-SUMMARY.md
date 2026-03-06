---
phase: quick-10
plan: 10
subsystem: transfers
tags: [transfers, roster, free-slot, migration, admin]
dependency_graph:
  requires: []
  provides: [free-slot-pickup-bid, nullable-outRiderId]
  affects: [transfer-form, transfer-actions, admin-transfers]
tech_stack:
  added: []
  patterns: [nullable-FK-with-leftJoin, pickup-without-drop]
key_files:
  created: []
  modified:
    - src/db/migrations/0004_nullable_out_rider.sql
    - src/db/schema/transfers.ts
    - src/app/(main)/leagues/[leagueId]/transfers/actions.ts
    - src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx
    - src/app/admin/transfers/actions.ts
    - src/app/admin/transfers/bid-actions.tsx
    - src/app/admin/transfers/page.tsx
    - src/lib/transfer-queries.ts
decisions:
  - transfer-queries uses leftJoin for outRider so free-slot bids (null outRiderId) still appear in team bid history
metrics:
  duration: ~3min
  completed: 2026-03-06
  tasks_completed: 2
  files_modified: 8
---

# Quick Task 10: Add Riders to Roster if Space Available — Summary

**One-liner:** Free-slot rider pickup allowing teams with open roster slots to bid on free agents without dropping anyone, via nullable outRiderId throughout the transfer pipeline.

## What Was Done

Applied a database migration and committed all pre-written code changes to enable "pickup without drop" transfer bids.

### Task 1: Apply Migration

Applied `src/db/migrations/0004_nullable_out_rider.sql` directly via psql against the Neon production database. The migration drops the NOT NULL constraint from `transfer_bids."outRiderId"`, allowing free-slot bids to have a null outRider.

Verified: `\d transfer_bids` shows `outRiderId | integer | | |` with no "not null" constraint.

### Task 2: Commit Feature Changes

Committed 8 modified files as one cohesive feature commit (`59aed39`):

| File | Change |
|------|--------|
| `src/db/schema/transfers.ts` | `outRiderId` marked `.nullable()` in Drizzle schema |
| `src/app/(main)/leagues/[leagueId]/transfers/actions.ts` | Validates free-slot pickups using gender-specific slot counts |
| `src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx` | Shows free-slot info banner; makes drop-rider step optional |
| `src/app/admin/transfers/actions.ts` | `approveBid` skips draftPicks delete when outRiderId is null |
| `src/app/admin/transfers/bid-actions.tsx` | Handles null outRiderName in approve toast and reject dialog |
| `src/app/admin/transfers/page.tsx` | Renders "free slot" in grey italics when outRiderName is null |
| `src/db/migrations/0004_nullable_out_rider.sql` | Raw SQL migration file |
| `src/lib/transfer-queries.ts` | Changed `innerJoin` to `leftJoin` for outRider so free-slot bids appear in team bid history |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added transfer-queries.ts to commit**
- **Found during:** Task 2 inspection of git diff
- **Issue:** `getTeamBids` used `innerJoin` for outRider, which would exclude free-slot bids (null outRiderId) from team bid history
- **Fix:** Changed to `leftJoin` — free-slot bids now appear correctly in bid history
- **Files modified:** `src/lib/transfer-queries.ts`
- **Commit:** 59aed39

## Status

Tasks 1-2 complete. Stopped at Task 3 (checkpoint:human-verify) — awaiting human verification.

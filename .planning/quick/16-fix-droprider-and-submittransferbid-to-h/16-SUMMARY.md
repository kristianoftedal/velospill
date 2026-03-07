---
phase: quick-16
plan: 01
subsystem: roster, transfers
tags: [ir, bug-fix, status-enum]
key-files:
  modified:
    - src/app/(main)/leagues/[leagueId]/roster/actions.ts
    - src/app/(main)/leagues/[leagueId]/transfers/actions.ts
decisions:
  - "return_eligible is non-terminal and must be cleaned up on drop alongside pending/approved"
  - "submitTransferBid gender slot check now mirrors getActiveRosterCount: both use inArray([approved, return_eligible])"
metrics:
  duration: ~3min
  completed: 2026-03-07
---

# Quick-16 Summary: Fix dropRider and submitTransferBid return_eligible gaps

**One-liner:** Two one-line fixes close return_eligible status gaps in IR cleanup (dropRider) and gender slot counting (submitTransferBid), preventing transfer blocks and slot overcounts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix dropRider IR cleanup to include return_eligible | f4d7c10 | roster/actions.ts |
| 2 | Fix submitTransferBid gender slot check to include return_eligible | f4d7c10 | transfers/actions.ts |

## Changes Made

**Task 1 — roster/actions.ts line ~91:**
- Before: `inArray(irRequests.status, ["pending", "approved"])`
- After: `inArray(irRequests.status, ["pending", "approved", "return_eligible"])`
- Effect: Dropping a rider in return_eligible IR state now removes the stale IR row instead of leaving the team permanently transfer-blocked.

**Task 2 — transfers/actions.ts line ~150:**
- Added `inArray` to drizzle-orm import (was missing from this file).
- Before: `eq(irRequests.status, "approved")`
- After: `inArray(irRequests.status, ["approved", "return_eligible"])`
- Effect: Gender-specific active slot count now correctly excludes return_eligible IR riders, matching getActiveRosterCount behaviour.

## Deviations from Plan

**1. [Rule 2 - Missing import] Added inArray to transfers/actions.ts drizzle-orm import**
- Found during: Task 2
- Issue: `inArray` was not imported in transfers/actions.ts; required for the fix.
- Fix: Added `inArray` to the existing drizzle-orm import line.
- Files modified: transfers/actions.ts
- Commit: f4d7c10

## Self-Check: PASSED

- `return_eligible` present in roster/actions.ts IR cleanup inArray: confirmed
- `return_eligible` present in transfers/actions.ts slot-check JOIN: confirmed
- TypeScript: no errors in either file
- Commit f4d7c10 exists: confirmed

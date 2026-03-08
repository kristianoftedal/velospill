---
phase: 25-read-path-migration-cleanup
plan: "02"
subsystem: transfers, ir
tags: [roster-slots, write-path, slot-check, migration]
dependency_graph:
  requires: [25-01]
  provides: [RSLOT-11]
  affects: [transfers/actions, ir/actions]
tech_stack:
  added: []
  patterns: [rosterSlots-count-with-riders-join]
key_files:
  created: []
  modified:
    - src/app/(main)/leagues/[leagueId]/transfers/actions.ts
    - src/app/(main)/leagues/[leagueId]/ir/actions.ts
decisions:
  - "Slot-check guards now source from roster_slots WHERE status='active' joined to riders for gender — eliminates all draftPicks+irRequests join arithmetic for active roster size"
metrics:
  duration: 105s
  completed: "2026-03-08"
  tasks_completed: 2
  files_modified: 2
---

# Phase 25 Plan 02: Write-Path Slot-Check Migration Summary

**One-liner:** Replaced draftPicks-LEFT-JOIN-irRequests slot guards in submitTransferBid and returnRider with direct roster_slots active counts, completing RSLOT-11.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace slot-check guard in submitTransferBid | 85e02dc | transfers/actions.ts |
| 2 | Replace slot-check guard in returnRider | dca38cc | ir/actions.ts |

## What Was Done

### Task 1 — transfers/actions.ts

In the `submitTransferBid` free-slot pickup else branch, replaced:

```typescript
// OLD: draftPicks LEFT JOIN irRequests WHERE isNull(irRequests.id)
const currentGenderCount = await db
  .select({ count: sql<number>`count(*)` })
  .from(draftPicks)
  .leftJoin(irRequests, and(...))
  .where(and(..., isNull(irRequests.id)))
```

With:

```typescript
// NEW: roster_slots INNER JOIN riders WHERE status='active'
const [genderCountResult] = await db
  .select({ value: count() })
  .from(rosterSlots)
  .innerJoin(riders, eq(riders.id, rosterSlots.riderId))
  .where(and(eq(rosterSlots.teamId, ...), eq(rosterSlots.status, "active"), eq(riders.gender, ...)))
```

Import changes: removed `sql`, `isNull`, `inArray`; added `count`, `rosterSlots`. Kept `irRequests` (used by IR-09 guard).

### Task 2 — ir/actions.ts

In `returnRider`, replaced the same arithmetic pattern for `genderActiveCount` with the identical `rosterSlots + riders` join pattern.

Import changes: removed `sql`, `isNull`; retained `inArray` (still used in dropAndReturnRider IR guard and submitIrRequest). `count` and `rosterSlots` were already imported.

The `submitIrRequest` IR slot count (pending/approved irRequests, max 2) was left untouched — it is an IR slot limit, not a roster count.

## Verification Results

- `npx tsc --noEmit` — 0 errors
- No `leftJoin(irRequests)` pattern remains in slot-count context in either file
- `rosterSlots` used as the count source in both files (confirmed at lines 144 and 165)
- `submitIrRequest` IR slot count still queries `irRequests` with `status pending/approved`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Checking that commits exist:
- 85e02dc (transfers/actions.ts) — FOUND
- dca38cc (ir/actions.ts) — FOUND

## Self-Check: PASSED

---
phase: quick-22
plan: 01
subsystem: transfers
tags: [bug-fix, roster-slots, draft-picks, approveBid]
dependency_graph:
  requires: []
  provides: [approveBid-roster-slots-fallback]
  affects: [src/app/admin/transfers/actions.ts]
tech_stack:
  added: []
  patterns: [roster_slots fallback check, decoupled delete path]
key_files:
  created: []
  modified:
    - src/app/admin/transfers/actions.ts
decisions:
  - "Step 3 now checks roster_slots as fallback when draftPicks row is absent — throw only when rider is in neither table"
  - "Step 5 delete is now gated on outRiderId != null (not currentPick presence) so roster_slots is always cleaned up"
metrics:
  duration: 3min
  completed: 2026-03-18
  tasks: 1
  files: 1
---

# Quick Task 22: Fix Roster Slots Sync Bug in approveBid — Summary

**One-liner:** approveBid now falls back to roster_slots check when draftPicks row is missing, preventing transaction abort on post-migration edge cases.

## What Was Done

Fixed two related issues in the `approveBid` function in `src/app/admin/transfers/actions.ts`:

**Step 3 — outgoing rider verification:**
Added a `currentSlot` fallback variable. When `currentPick` (draftPicks lookup) is null, the function now queries `rosterSlots` for the same `(leagueId, teamId, riderId)`. The guard only throws `"Outgoing rider is no longer on this team"` when the rider is found in **neither** table. This handles the post-v1.4-migration edge case where a rider may have a `roster_slots` row but no corresponding `draftPicks` row (e.g., due to a previous partial transaction failure).

**Step 5 — outgoing rider deletion:**
Changed the gate from `if (currentPick)` to `if (bid.outRiderId != null)`. The `draftPicks` delete remains conditional on `currentPick` existing, but the `rosterSlots` delete now runs unconditionally whenever `outRiderId` is set — covering both the normal case (draftPick exists) and the fallback case (only rosterSlots row exists).

## Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix approveBid — roster_slots fallback for outgoing rider verification | 72474ee | src/app/admin/transfers/actions.ts |

## Verification

1. TypeScript: `npx tsc --noEmit` — no errors in actions.ts
2. Logic: `currentSlot` fallback fires when `currentPick` is null but rider IS in roster_slots
3. Logic: throw only when rider found in neither table (both checks fail)
4. Logic: roster_slots delete is unconditional on outRiderId presence (covers both paths)
5. Logic: incoming rider upsert path unchanged (still unconditional) — not touched

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/app/admin/transfers/actions.ts` modified correctly
- [x] Commit 72474ee exists and contains the change
- [x] TypeScript compiles without errors in actions.ts

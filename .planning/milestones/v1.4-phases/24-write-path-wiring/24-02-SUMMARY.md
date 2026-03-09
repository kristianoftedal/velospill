---
plan: 24-02
phase: 24-write-path-wiring
status: complete
completed_at: 2026-03-08
---

# Plan 24-02: Drop and Transfer Mutations → roster_slots

## What Was Built

Wired rider-drop and transfer-approval mutations to write corresponding `roster_slots` changes inside the same transaction.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Wrap `dropRider` in transaction with `roster_slots` DELETE | ✓ Complete |
| 2 | Extend `approveBid` transaction with `roster_slots` writes | ✓ Complete |

## Key Changes

- `src/app/(main)/leagues/[leagueId]/roster/actions.ts`: Added `rosterSlots` import; wrapped the 3 previously un-transacted writes (steps 5-7) in a single `db.transaction()` and added `tx.delete(rosterSlots)` for the dropped rider inside. `revalidatePath` calls remain outside.
- `src/app/admin/transfers/actions.ts`: Added `rosterSlots` import; inside the existing `approveBid` transaction: added `tx.delete(rosterSlots)` for the outgoing rider (inside the `if (currentPick)` guard after the `draftPicks` delete), and added `tx.insert(rosterSlots).onConflictDoUpdate()` for the incoming rider (after the `draftPicks` insert).

## Self-Check: PASSED

- TypeScript: zero errors
- `dropRider` atomically deletes `roster_slots` row with `draftPicks` row
- `approveBid` atomically swaps `roster_slots` ownership (delete outgoing, upsert incoming)
- Upsert uses `onConflictDoUpdate` on `(leagueId, riderId)` to handle any stale rows gracefully
- `revalidatePath` calls remain outside transactions

## key-files

### key-files.modified
- src/app/(main)/leagues/[leagueId]/roster/actions.ts
- src/app/admin/transfers/actions.ts

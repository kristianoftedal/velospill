---
plan: 24-03
phase: 24-write-path-wiring
status: complete
completed_at: 2026-03-08
---

# Plan 24-03: IR State Transitions → roster_slots

## What Was Built

Wired all four IR state-transition actions to write the corresponding status change into `roster_slots`, wrapped in transactions for full atomicity.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Wire `approveIrRequest` and `markEligibleToReturn` in `admin/ir/actions.ts` | ✓ Complete |
| 2 | Wire `returnRider` and `dropAndReturnRider` in `ir/actions.ts` | ✓ Complete |

## Key Changes

- `src/app/admin/ir/actions.ts`: Added `rosterSlots` import; wrapped `approveIrRequest`'s write in `db.transaction()` adding `roster_slots` update to `on_ir`; wrapped `markEligibleToReturn`'s write in `db.transaction()` adding `roster_slots` update to `return_eligible`. `rejectIrRequest` left untouched.
- `src/app/(main)/leagues/[leagueId]/ir/actions.ts`: Added `rosterSlots` import; wrapped `returnRider`'s final write in `db.transaction()` with `roster_slots` update to `active`; replaced `dropAndReturnRider`'s two sequential un-transacted writes with a single `db.transaction()` containing all 4 writes: delete `draftPicks` for dropped rider, delete `roster_slots` for dropped rider, update `irRequests` to returned, update `roster_slots` to `active` for returning rider.

## Self-Check: PASSED

- TypeScript: zero errors
- All 4 IR mutations now write `roster_slots` atomically
- `dropAndReturnRider` combines all 4 writes in a single transaction (delete draftPick + delete slot + update irRequest + update slot)
- Guard queries and `revalidatePath` calls remain outside all transactions
- `rejectIrRequest` correctly left unchanged (rejected requests don't change roster state)

## key-files

### key-files.modified
- src/app/admin/ir/actions.ts
- src/app/(main)/leagues/[leagueId]/ir/actions.ts

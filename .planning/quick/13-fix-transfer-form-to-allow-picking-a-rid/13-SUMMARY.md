---
phase: quick-13
plan: 01
subsystem: transfers
tags: [ir, roster, transfer-form, drizzle]
key-files:
  modified:
    - src/lib/transfer-queries.ts
    - src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx
decisions:
  - getTeamRoster left-joins irRequests to annotate each roster entry with isOnIR boolean
  - TransferForm uses active (non-IR) counts for slot math, keeping total counts for display
  - IR'd rider cards rendered as non-interactive divs (not disabled buttons) for cleaner semantics
metrics:
  duration: ~3min
  completed: 2026-03-06
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 13: Fix Transfer Form to Allow Picking Up a Rider When Team Has IR'd Players

**One-liner:** Left-join irRequests into getTeamRoster to expose isOnIR, then exclude IR'd riders from active slot counts and mark them non-selectable in the transfer form.

## What Was Done

### Task 1: Add isOnIR to getTeamRoster

Modified `src/lib/transfer-queries.ts`:
- Added import for `irRequests` from `@/db/schema/ir` and `sql` from `drizzle-orm`
- Added `.leftJoin(irRequests, ...)` to `getTeamRoster` joining on riderId + teamId + leagueId + status='approved'
- Added `isOnIR: sql<boolean>\`${irRequests.id} IS NOT NULL\`.as("isOnIR")` to the select
- `TeamRosterEntry` type updated automatically via inferred return type — no manual changes needed

### Task 2: Update TransferForm

Modified `src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx`:
- Added `activeMenRoster` and `activeWomenRoster` arrays (filtered to `!r.isOnIR`)
- `hasMenSlot` / `hasWomenSlot` now computed from active-only counts
- Free-slot info banner updated to show active counts
- Roster step 1 cards: IR'd riders render as a non-interactive `div` with muted styling (`opacity-60 cursor-not-allowed border-gray-100 bg-gray-50`) and an "On IR" badge
- `handleSelectOutRider` has early return guard when `rider?.isOnIR` is true

## Commits

| Hash    | Message |
|---------|---------|
| 009ca95 | feat(quick-13): add isOnIR to getTeamRoster via left-join on approved irRequests |
| 38fe168 | feat(quick-13): update TransferForm to exclude IR'd riders from active slot counts |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/lib/transfer-queries.ts` — modified, committed at 009ca95
- `src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx` — modified, committed at 38fe168
- TypeScript: `npx tsc --noEmit` exits clean

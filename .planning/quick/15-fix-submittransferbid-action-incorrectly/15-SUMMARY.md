# Quick Task 15: Fix submitTransferBid roster-full false positive

## What was done

Fixed a server-side bug in `submitTransferBid` where teams with approved IR riders were being incorrectly blocked from free-slot pickups with "Your roster is full".

## Root cause

The pickup-without-drop guard counted ALL `draftPicks` for the given gender, including riders on approved IR. Since IR riders free up a roster slot (active count = draftPicks - approved IRs), the count was inflated and triggered the roster-full error even when a slot was genuinely available.

## Fix

`src/app/(main)/leagues/[leagueId]/transfers/actions.ts` — the gender count query now left-joins `ir_requests` (approved) and filters out IR'd riders via `isNull(irRequests.id)`, matching the same logic applied to the form in quick task 13.

Also removed a stale comment block that incorrectly stated this fix was not needed.

## Files changed

- `src/app/(main)/leagues/[leagueId]/transfers/actions.ts`

## Commit

- `c8b0e97`: fix(quick-15): exclude approved IR riders from roster slot count in submitTransferBid

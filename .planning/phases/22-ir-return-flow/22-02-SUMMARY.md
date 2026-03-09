---
phase: 22-ir-return-flow
plan: "02"
subsystem: api
tags: [drizzle, server-actions, ir, roster-management, transfers]

# Dependency graph
requires:
  - phase: 22-ir-return-flow-01
    provides: return_eligible status enum value added to irRequests schema
  - phase: 21-drop-rider
    provides: dropRider draftPicks delete pattern used in dropAndReturnRider
provides:
  - markEligibleToReturn server action (admin, approved → return_eligible)
  - getApprovedIrRequests query + getApprovedIrRequestsAction wrapper
  - returnRider server action (player, return_eligible → returned, roster space check)
  - dropAndReturnRider server action (player, atomic drop+return when roster full)
  - IR-09 transfer block guard in submitTransferBid
affects:
  - 22-ir-return-flow-03 (UI layer that calls these actions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic drop-and-return: delete draftPicks row then update irRequests.status in sequence"
    - "Gender-aware roster space check via LEFT JOIN irRequests to exclude IR riders from active count"
    - "Transfer block guard: early return before window check if return_eligible IR exists"

key-files:
  created: []
  modified:
    - src/lib/ir-queries.ts
    - src/app/admin/ir/actions.ts
    - src/app/(main)/leagues/[leagueId]/ir/actions.ts
    - src/app/(main)/leagues/[leagueId]/transfers/actions.ts

key-decisions:
  - "returnRider checks gender-specific active count via LEFT JOIN to properly exclude IR riders before allowing return"
  - "dropAndReturnRider performs two sequential DB ops (not a true transaction) — acceptable given single-server, low-concurrency nature of the app"
  - "IR-09 guard placed before transfer window check (step 7) so return_eligible block takes precedence over window errors"

patterns-established:
  - "returnRider/dropAndReturnRider: both validate IR request belongs to team via AND clause on teamId + leagueId + status"
  - "Cannot drop IR rider guard: check inArray(['approved','return_eligible']) before deleting draftPicks"

requirements-completed: [IR-07, IR-09, IR-10, IR-11]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 22 Plan 02: IR Return Flow Server Actions Summary

**Server-action layer for full IR return flow: admin marks eligible, player returns with or without drop, and transfers blocked until IR riders returned**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-07T09:48:20Z
- **Completed:** 2026-03-07T09:50:24Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Admin can call `markEligibleToReturn(requestId)` to transition approved IR → return_eligible
- Player can call `returnRider(requestId, leagueId)` when roster has space, transitioning return_eligible → returned
- Player can call `dropAndReturnRider({requestId, dropRiderId, leagueId})` when roster full — atomically drops one rider and marks IR as returned
- `submitTransferBid` now rejects with error if any return_eligible IR riders exist for the team

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin actions — getApprovedIrRequests query + markEligibleToReturn** - `6d12170` (feat)
2. **Task 2: Player return actions + transfer block guard** - `0a890f7` (feat)

## Files Created/Modified

- `src/lib/ir-queries.ts` - Added `ApprovedIrRequest` type and `getApprovedIrRequests` query
- `src/app/admin/ir/actions.ts` - Added `getApprovedIrRequestsAction` and `markEligibleToReturn`
- `src/app/(main)/leagues/[leagueId]/ir/actions.ts` - Added `returnRider` and `dropAndReturnRider` with full roster validation
- `src/app/(main)/leagues/[leagueId]/transfers/actions.ts` - Added IR-09 transfer block guard before window check

## Decisions Made

- `returnRider` checks gender-specific active count via LEFT JOIN to irRequests, excluding approved/return_eligible IR riders from the active slot count before allowing the return
- `dropAndReturnRider` uses two sequential DB operations rather than a transaction — acceptable for this low-concurrency app
- Transfer block guard (IR-09) placed before the transfer window check so that return_eligible state takes precedence over window availability errors

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All server actions ready for Plan 03 UI wiring
- `returnRider` and `dropAndReturnRider` callable from IR page components
- `markEligibleToReturn` callable from admin IR management panel
- Transfer form will automatically show block error via existing error display logic

---
*Phase: 22-ir-return-flow*
*Completed: 2026-03-07*

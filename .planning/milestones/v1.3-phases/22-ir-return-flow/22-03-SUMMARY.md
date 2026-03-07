---
phase: 22-ir-return-flow
plan: 03
subsystem: ui
tags: [next.js, react, tailwind, server-actions, drizzle]

# Dependency graph
requires:
  - phase: 22-ir-return-flow-01
    provides: IR schema with return_eligible/returned status, getTeamIrSlots, getEligibleToReturnCount
  - phase: 22-ir-return-flow-02
    provides: returnRider, dropAndReturnRider, markEligibleToReturn server actions
provides:
  - Admin IR page second section showing approved riders with Mark Eligible button
  - MarkEligibleActions client component for admin IR flow
  - IrReturnActions client component handling return + drop-dialog flow
  - League page red banner when player has return_eligible IR riders
  - IR page return buttons on return_eligible slots
  - Transfers page blocking card when eligible-to-return riders exist
affects: [transfers, roster, ir-admin, league-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Try-then-dialog: call server action optimistically, open drop dialog only on 'full' error response"
    - "Parallel server-side fetch pattern extended to IR banner check on league page"

key-files:
  created:
    - src/app/(main)/leagues/[leagueId]/ir/ir-return-actions.tsx
  modified:
    - src/app/admin/ir/page.tsx
    - src/app/admin/ir/ir-actions.tsx
    - src/app/(main)/leagues/[leagueId]/ir/page.tsx
    - src/app/(main)/leagues/[leagueId]/page.tsx
    - src/app/(main)/leagues/[leagueId]/transfers/page.tsx

key-decisions:
  - "IrReturnActions tries returnRider first; if error contains 'full', opens drop dialog — avoids needing gender on IrSlot"
  - "Transfer page blocking card is UI affordance only — server action already enforces the block"
  - "Banner is non-dismissible: re-fetched on every page load, disappears automatically after rider is returned"

patterns-established:
  - "Try-then-dialog: call server action first, open modal only if server returns specific error string"

requirements-completed: [IR-06, IR-07, IR-08, IR-09, IR-10, IR-11]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 22 Plan 03: IR Return Flow UI Summary

**Complete end-to-end IR return UI: admin 'Mark Eligible' section, league page red banner, IR page return buttons with roster-full drop dialog, and transfers page blocking card**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-07T09:52:39Z
- **Completed:** 2026-03-07T09:55:17Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Admin IR page now has two sections: Pending Requests + Approved Riders (on IR) with Mark Eligible button per row
- IrReturnActions component handles the complete return flow — tries direct return, opens drop-and-return dialog on roster-full error
- League page shows non-dismissible red banner with IR link when user has return_eligible riders
- Transfers page shows blocking card above TransferForm when eligible-to-return count > 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin IR page — second section + MarkEligibleActions client component** - `5af7de5` (feat)
2. **Task 2: League page banner + IR page return buttons + transfer page block** - `4cdf55a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/admin/ir/ir-actions.tsx` - Added MarkEligibleActions export below IrActions
- `src/app/admin/ir/page.tsx` - Fetches approvedRequests in parallel, renders second Card with Mark Eligible table
- `src/app/(main)/leagues/[leagueId]/ir/ir-return-actions.tsx` - New client component: Return button + drop-and-return dialog
- `src/app/(main)/leagues/[leagueId]/ir/page.tsx` - Added return_eligible/returned status colors, activeRosterRiders computation, IrReturnActions on eligible slots
- `src/app/(main)/leagues/[leagueId]/page.tsx` - Imports getEligibleToReturnCount, fetches count for active leagues, renders red banner
- `src/app/(main)/leagues/[leagueId]/transfers/page.tsx` - Fetches eligibleCount, renders blocking card above TransferForm

## Decisions Made
- IrReturnActions always calls `returnRider` first; if the error message includes "full", opens the drop dialog. This avoids needing rider gender on IrSlot — the server action enforces gender-specific limits anyway.
- Transfer page blocking card is UI affordance only (server action already blocks submission).
- Banner is non-dismissible — it disappears after the next page load once the rider is returned.

## Deviations from Plan

None - plan executed exactly as written. The "try-then-dialog" approach described in the plan's Option A was implemented directly.

## Issues Encountered

Minor: accidentally introduced duplicate `toast` import in `ir-actions.tsx` during initial edit — immediately caught and corrected before commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- IR return flow is complete end-to-end (Plans 01 + 02 + 03)
- Phase 22 is complete — all 3 plans executed
- v1.3 milestone (IR List & Roster Management) is now fully shipped

## Self-Check: PASSED

All created files exist on disk. All task commits verified in git log.

---
*Phase: 22-ir-return-flow*
*Completed: 2026-03-07*

---
phase: 20-ir-foundation-admin-approval
plan: "03"
subsystem: ui
tags: [nextjs, react, server-components, drizzle, ir, injured-reserve]

# Dependency graph
requires:
  - phase: 20-ir-foundation-admin-approval/20-02
    provides: ir-queries.ts (getTeamIrSlots, getActiveRosterCount, getPendingIrRequests), submitIrRequest, approveIrRequest, rejectIrRequest server actions

provides:
  - Player-facing IR page at /leagues/[id]/ir with 2-slot display and request form
  - Admin IR queue at /admin/ir with approve/reject actions
  - "Injured Reserve" button on league detail page actions bar
  - "Injured Reserve" nav link in admin layout
  - IR-05 slot accounting invariant documented and getActiveRosterCount ready for Phase 22

affects:
  - 21-ir-return-flow
  - 22-drop-rider

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useTransition + startTransition for client-side server action calls
    - Server component page with client sub-component for interactive forms (IrForm, IrActions)
    - Parallel data fetching with Promise.all in server components

key-files:
  created:
    - src/app/(main)/leagues/[leagueId]/ir/page.tsx
    - src/app/(main)/leagues/[leagueId]/ir/ir-form.tsx
    - src/app/admin/ir/page.tsx
    - src/app/admin/ir/ir-actions.tsx
  modified:
    - src/app/admin/layout.tsx
    - src/app/(main)/leagues/[leagueId]/page.tsx
    - src/app/(main)/leagues/[leagueId]/transfers/actions.ts

key-decisions:
  - "IR form disabled when slotsUsed >= 2 (pending + approved count toward cap)"
  - "IR-05 accounting: approved IR riders excluded from active roster count via getActiveRosterCount arithmetic — enforcement deferred to Phase 22 (IR return flow)"
  - "IrActions uses same useTransition pattern as BidActions from admin/transfers"

patterns-established:
  - "Player IR page: server component fetches slots + roster in parallel, passes slotsUsed to client IrForm"
  - "Admin IR page: server component renders table rows with IrActions client component per row"

requirements-completed: [IR-01, IR-02, IR-03, IR-04, IR-05]

# Metrics
duration: ~15min
completed: 2026-03-06
---

# Phase 20 Plan 03: IR Foundation UI Summary

**Player IR page, admin IR queue, and league page integration — full Phase 20 IR feature live end-to-end with 2-slot cap enforcement and approve/reject actions**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-06
- **Completed:** 2026-03-06
- **Tasks:** 2 auto + 1 human-verify checkpoint
- **Files modified:** 7

## Accomplishments

- Player can visit /leagues/[id]/ir, see 2 IR slot cards with status badges (pending/approved/rejected), and submit an IR request via rider dropdown + optional reason field
- Admin can visit /admin/ir, see all pending IR requests across all leagues in a table, and approve or reject each with an optional admin note
- "Injured Reserve" button added to league detail page actions bar; "Injured Reserve" nav link added to admin layout
- IR-05 invariant documented in transfer actions: getActiveRosterCount arithmetic is ready for Phase 22 enforcement

## Task Commits

1. **Task 1: Player IR page + IR request form** - `2d57da8` (feat)
2. **Task 2: Admin IR queue + nav link + transfer slot accounting** - `edcd666` (feat)
3. **Task 3: Human verification checkpoint** - approved by user

## Files Created/Modified

- `src/app/(main)/leagues/[leagueId]/ir/page.tsx` - Server component: IR slots display + IrForm, guards for inactive leagues and no team
- `src/app/(main)/leagues/[leagueId]/ir/ir-form.tsx` - Client component: rider dropdown, reason textarea, submit with useTransition, disabled when 2 slots used
- `src/app/admin/ir/page.tsx` - Server component: pending IR requests table with IrActions per row
- `src/app/admin/ir/ir-actions.tsx` - Client component: approve/reject buttons with inline note input, useTransition
- `src/app/admin/layout.tsx` - Added "Injured Reserve" nav link
- `src/app/(main)/leagues/[leagueId]/page.tsx` - Added "Injured Reserve" button in actions bar (active leagues only)
- `src/app/(main)/leagues/[leagueId]/transfers/actions.ts` - Added IR-05 invariant comment for Phase 22

## Decisions Made

- IR form shows "Both IR slots are in use" disabled card when slotsUsed >= 2 (counts pending + approved, not just approved)
- Admin reject action uses inline text input for adminNote before confirming — matches BidActions pattern
- IR-05 slot accounting implemented as documented invariant only for Phase 20; active enforcement (no outRider pickup path) deferred to Phase 22

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full Phase 20 IR feature is live: player submission, admin approval/rejection, slot cap enforcement
- getActiveRosterCount is implemented and exported, ready for Phase 21/22 to call when validating IR return eligibility
- Phase 21 (IR Return Flow) can proceed: admin "mark eligible" action, player return banner, and transfer block until rider returned

---
*Phase: 20-ir-foundation-admin-approval*
*Completed: 2026-03-06*

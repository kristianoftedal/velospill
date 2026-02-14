---
phase: 07-orders-polish-integration
plan: 02
subsystem: ui
tags: [nextjs, react, server-components, multi-step-form, drizzle, orders]

# Dependency graph
requires:
  - phase: 07-01
    provides: orders table schema, orderStatusEnum, ordersRelations
  - phase: 06-01
    provides: getLeagueDetails server action, league-auth.ts patterns
  - phase: 05-01
    provides: standings page pattern (server component with parallel fetch)
provides:
  - Orders page at /leagues/[leagueId]/orders with multi-step form
  - OrdersClient with 4-step form: race > order type > target > confirm
  - My Orders table with status badges and cancel for pending orders
  - league detail page Orders card (purple, active leagues only)
affects: [07-03, 07-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server component page with parallel data fetch feeding client component
    - Multi-step wizard form with useTransition and sonner toast feedback
    - Server action props pattern (pass submitOrder/cancelOrder to client)
    - effectTarget-driven dynamic target UI (7 target types)

key-files:
  created:
    - src/app/(main)/leagues/[leagueId]/orders/page.tsx
    - src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx
  modified:
    - src/app/(main)/leagues/[leagueId]/page.tsx
    - src/app/(main)/leagues/[leagueId]/orders/actions.ts

key-decisions:
  - "unowned_gc_top10 (Hammer) accepts rider name in targetProTeam when no riderId provided — admin resolves lookup"
  - "Orders card on league detail page uses purple to distinguish from yellow (draft), green (standings), blue (transfers)"
  - "effectiveRaceType for stages derives from parent race in upcomingRaces array via parentRaceId lookup"
  - "Step transitions are automatic on selection for race/orderType/target but manual via confirm for all_own_riders/text inputs"

patterns-established:
  - "Orders page: Leagues > {name} > Orders breadcrumb pattern"
  - "Multi-step order form: 4 steps with step indicator dots, purple accent color"
  - "My Orders table: raceName, orderTypeDisplayName, formatted target, status badge, Cancel button"

# Metrics
duration: ~2min
completed: 2026-02-14
---

# Phase 07 Plan 02: Orders Page UI Summary

**Multi-step order submission page at /leagues/[leagueId]/orders with race/order-type/target/confirm wizard, My Orders table with cancel, and league detail purple Orders card**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-14T21:59:44Z
- **Completed:** 2026-02-14T22:01:13Z
- **Tasks:** 1 (Task 2 only; Task 1 was committed as 188c888 in prior session)
- **Files modified:** 4

## Accomplishments

- Orders page server component (`page.tsx`) fetches all needed data in parallel and guards on active-only, userTeamId present
- `OrdersClient` implements 4-step wizard with step indicator, race selection, order type filtering by effectiveRaceType, dynamic target UI for all 7 effectTarget variants, and confirmation summary
- My Orders table shows submitted orders with color-coded status badges and Cancel button for pending orders
- League detail page updated with purple "Go to Orders" card visible only for active leagues
- Fixed `unowned_gc_top10` bug in server action: now accepts rider name via `targetProTeam` when no `targetRiderId` is provided

## Task Commits

1. **Task 1: Create order queries library and server actions** - `188c888` (feat) — prior session
2. **Task 2: Create order page UI and league detail integration** - `fcb3ead` (feat)

## Files Created/Modified

- `src/app/(main)/leagues/[leagueId]/orders/page.tsx` — Server component: auth guard, status guard, parallel fetch, renders OrdersClient
- `src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx` — Client component: 4-step multi-step form + My Orders table
- `src/app/(main)/leagues/[leagueId]/page.tsx` — Added Strategic Orders card (purple, active leagues only)
- `src/app/(main)/leagues/[leagueId]/orders/actions.ts` — Fixed unowned_gc_top10 validation to accept text rider name

## Decisions Made

- `unowned_gc_top10` (Hammer) accepts rider name in `targetProTeam` field when `targetRiderId` not provided — client uses text input since user doesn't know DB rider IDs for undrafted riders; admin resolves at settlement time
- Purple color scheme (`bg-purple-600`) used for Orders to distinguish from draft (yellow), standings (green), and transfers (blue)
- `effectiveRaceType` computed client-side in orders-client.tsx by looking up parent race in the `upcomingRaces` array rather than a separate API call

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unowned_gc_top10 validation mismatch between client UI and server action**
- **Found during:** Task 2 (reviewing orders-client.tsx)
- **Issue:** Client UI stored Hammer rider name in `targetProTeam` text state (since users type a name, not a DB ID), but server action validated `targetRiderId` (number) and returned an error if not provided — making Hammer orders impossible to submit
- **Fix:** Updated server action to accept either `targetRiderId` (DB lookup path with validation) or `targetProTeam` (rider name text for admin resolution). Both paths require at least one to be present.
- **Files modified:** `src/app/(main)/leagues/[leagueId]/orders/actions.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `fcb3ead` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Bug fix required for Hammer order functionality. No scope creep — the client UI was already designed correctly; only the server validation needed alignment.

## Issues Encountered

- `page.tsx` and `orders-client.tsx` existed on disk (untracked) from a prior execution session that did not commit. Files were reviewed, verified correct, then committed as part of this task.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Orders page fully functional at `/leagues/[leagueId]/orders` for active leagues
- League detail page navigates to orders via purple card
- Ready for Phase 07-03: Admin order management page (already partially exists at `/admin/orders`)
- Ready for Phase 07-04: Scoring integration to apply order effects to race results

## Self-Check: PASSED

- FOUND: src/app/(main)/leagues/[leagueId]/orders/page.tsx
- FOUND: src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx
- FOUND: src/app/(main)/leagues/[leagueId]/orders/actions.ts
- FOUND: src/app/(main)/leagues/[leagueId]/page.tsx
- FOUND: .planning/phases/07-orders-polish-integration/07-02-SUMMARY.md
- FOUND commit: fcb3ead (Task 2)
- FOUND commit: 188c888 (Task 1, prior session)

---
*Phase: 07-orders-polish-integration*
*Completed: 2026-02-14*

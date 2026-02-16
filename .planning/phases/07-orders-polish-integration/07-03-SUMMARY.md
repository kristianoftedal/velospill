---
phase: 07-orders-polish-integration
plan: 03
subsystem: ui
tags: [next.js, drizzle-orm, server-actions, shadcn-ui, react]

# Dependency graph
requires:
  - phase: 07-01
    provides: orders table schema with order_status enum, bonusPoints, adminNote, resolvedAt, resolvedBy
  - phase: 06-03
    provides: bid-actions.tsx pattern for client action buttons with useTransition + dialog

provides:
  - Admin order validation UI at /admin/orders replacing Phase 2 stub
  - approveOrder, rejectOrder, setBonusPoints server actions
  - OrderActions client component with approve/reject dialog and bonus points input

affects: [07-04, scoring-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "alias() from drizzle-orm/pg-core for LEFT JOIN aliased tables (targetRider, targetTeam)"
    - "Server actions passed as props to 'use client' components from server page"
    - "Complex order detection via orderTypeEffect.type field against known complex effect types"

key-files:
  created:
    - src/app/admin/orders/actions.ts
    - src/app/admin/orders/order-actions.tsx
  modified:
    - src/app/admin/orders/page.tsx

key-decisions:
  - "Complex order effect types detected client-side via COMPLEX_EFFECT_TYPES array (gc_position_loss, team_sprint_points, team_placement_points)"
  - "setBonusPoints requires status=active to prevent setting bonus points on unreviewed orders"
  - "approveOrder and rejectOrder do not use transactions - simple update sufficient (no multi-table atomicity needed)"

patterns-established:
  - "OrderActions receives server action functions as props from server page for clean server/client boundary"
  - "renderTarget() helper renders human-readable target based on which nullable field is set"
  - "StatusBadge component for order status with green/red/gray color coding"

# Metrics
duration: ~8min
completed: 2026-02-14
---

# Phase 7 Plan 03: Admin Order Validation UI Summary

**Admin order validation page with approve/reject actions, bonus points entry for complex orders (Hammer/Innlagt Spurt/Lagtempo), and full order history table replacing the Phase 2 "Coming in Phase 7" stub**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-14T16:43:18Z
- **Completed:** 2026-02-14T16:51:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created complete admin order server actions (getPendingOrders, getOrderHistory, approveOrder, rejectOrder, setBonusPoints) with full table joins using Drizzle alias()
- Built OrderActions client component with approve/reject buttons, reject dialog with required admin note, and bonus points input for complex order types
- Replaced the Phase 2 admin orders stub (with "Coming in Phase 7" alerts) with a fully functional three-card layout: pending orders table, order history table, order types reference

## Task Commits

Each task was committed atomically:

1. **Task 1: Create admin order server actions** - `0b92b9f` (feat)
2. **Task 2: Replace admin orders stub page and create action buttons component** - `7097f5a` (feat)

**Plan metadata:** (docs commit forthcoming)

## Files Created/Modified
- `src/app/admin/orders/actions.ts` - Server actions: checkAdminAuth, getPendingOrders, getOrderHistory, approveOrder, rejectOrder, setBonusPoints with full Drizzle joins
- `src/app/admin/orders/order-actions.tsx` - "use client" component with approve/reject buttons, reject dialog, and bonus points input for complex orders
- `src/app/admin/orders/page.tsx` - Full replacement of Phase 2 stub with three-card layout (pending, history, reference)

## Decisions Made
- Complex order types detected via `orderTypeEffect.type` field against a known list (`gc_position_loss`, `team_sprint_points`, `team_placement_points`) — this matches the effect types used in the Hammer, Innlagt Spurt, and Lagtempo order types seeded in config
- `setBonusPoints` validates `status === "active"` before allowing update — prevents setting bonus points on unreviewed orders, ensures admin reviews the order first
- Used simple `db.update()` (no transaction) for approveOrder/rejectOrder — no multi-table atomicity required (unlike approveBid which swaps draftPicks)
- `revalidatePath()` called for both `/admin/orders` and `/leagues/${leagueId}/orders` after all mutations — same pattern as transfers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin can now fully review, approve, reject, and set bonus points on strategic orders
- Order status lifecycle (pending -> active/rejected) is complete
- Ready for Phase 07-04: team-side order submission UI at /leagues/[leagueId]/orders

---
*Phase: 07-orders-polish-integration*
*Completed: 2026-02-14*

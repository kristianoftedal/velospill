---
phase: 15-uno-x-order-feature
plan: 03
subsystem: ui-integration
tags: [ui, orders, draft-system]
dependency_graph:
  requires:
    - 15-02
  provides:
    - admin_bonus_rider_draft_ui
    - team_bonus_rider_picking_ui
  affects:
    - order_system
    - admin_workflows
tech_stack:
  added: []
  patterns:
    - Server action pattern for draft state fetching
    - Client-side draft state management with useEffect
    - Turn-based picking with server-side validation
    - Real-time UI updates via revalidatePath
key_files:
  created:
    - src/app/admin/orders/bonus-rider-draft.tsx
    - src/app/(main)/leagues/[leagueId]/orders/bonus-rider-pick.tsx
  modified:
    - src/app/admin/orders/actions.ts
    - src/app/admin/orders/page.tsx
    - src/app/(main)/leagues/[leagueId]/orders/actions.ts
    - src/app/(main)/leagues/[leagueId]/orders/page.tsx
    - src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx
decisions:
  - title: "Admin UI loads draft state on mount via server action"
    rationale: "Keeps component client-side for interactivity while fetching fresh draft state for each active Uno-X order"
  - title: "Team page pre-computes draft state server-side"
    rationale: "Avoids client-side async complexity; all draft data fetched in parallel during page load for better performance"
  - title: "Turn validation enforced server-side via pick count check"
    rationale: "Client UI shows turn status for UX, but server validates expectedPicksCount === pickOrder - 1 to prevent cheating"
  - title: "Bonus Draft Active badge added to My Orders table"
    rationale: "Provides visual indicator that Uno-X order has been activated and draft is in progress"
metrics:
  duration: 233s
  tasks_completed: 2
  files_created: 2
  files_modified: 5
  commits: 2
  completed_date: 2026-02-22
---

# Phase 15 Plan 03: Uno-X Order UI Integration Summary

Complete admin and team UI for the Uno-X bonus rider draft: admin sees draft progress and picks, teams pick bonus riders in reverse standings order with turn enforcement.

## What Was Built

### Task 1: Admin Bonus Rider Draft Management UI (0a6563a)

**Admin Actions:**
- Added `getActivatedUnoXOrders()`: Fetches all active Uno-X orders grouped by league+race, returns unique drafts with league name, race name, and season
- Added `getBonusRiderDraftState(leagueId, raceId, season)`: Computes draft state by calling `computeReverseDraftOrder` and `getBonusRidersForRace`, returns draft order, picks, and completion status

**BonusRiderDraft Component:**
- Client component that loads draft state on mount via `useEffect` calling the server action
- Groups activated drafts by league+race to avoid duplicates
- Displays one Card per active Uno-X draft showing:
  - Header: GT race name and league name
  - Draft order table with columns: Pick #, Team, Points, Status, Bonus Rider
  - Status shows green "Picked" badge with rider details or gray "Waiting" badge
  - "Draft Complete" indicator when all teams have picked (green banner)
- Uses shadcn Card/Table components matching existing admin patterns

**Admin Orders Page Integration:**
- Fetches activated Uno-X orders in parallel with pending orders and history
- Groups unique drafts by league+race for display
- Renders BonusRiderDraft section between Pending Orders and Order History
- Only shows section if there are active Uno-X orders
- Passes `getBonusRiderDraftState` server action as prop for dynamic loading

**Admin can now:**
- See all active Uno-X bonus rider drafts across all leagues
- View reverse standings draft order (lowest points first)
- Track which teams have picked and which are waiting
- See rider details for completed picks (rider name and team)
- Know when a draft is complete (all teams picked)

### Task 2: Team Bonus Rider Picking UI (96064cd)

**Team Actions:**
- Added `pickBonusRider(leagueId, teamId, riderId, raceId)` server action with comprehensive validation:
  1. Auth check via `getAuthenticatedUser`
  2. League membership check via `checkLeagueMembership`
  3. Team ownership verification (can only pick for own team)
  4. Active Uno-X order verification (must have active order for this race)
  5. Rider ownership check (rider must not be drafted in this league)
  6. Bonus rider uniqueness check (rider not already picked as bonus rider for this league+race)
  7. Turn order enforcement:
     - Computes draft order via `computeReverseDraftOrder`
     - Fetches existing picks via `getBonusRidersForRace`
     - Verifies team hasn't already picked
     - Verifies it's team's turn: `existingPicks.length === pickOrder - 1`
  8. Saves pick via `saveBonusRiderPick` with orderId reference
  9. Revalidates `/leagues/{leagueId}/orders` and `/admin/orders`
- Returns success or error with descriptive message

**BonusRiderPick Component:**
- Client component displaying bonus rider draft for a single GT
- Props: leagueId, teamId, raceId, raceName, draftOrder, existingPicks, availableRiders, myPickOrder, isMyTurn, alreadyPicked, myPickedRider, pickBonusRider server action
- Shows Card with:
  - Header: "Bonus Rider Draft - {raceName}"
  - Draft order mini-table showing all teams with pick #, team name, and status
    - "Picked" (green badge) if team has picked
    - "Your Turn" (purple badge) if it's this team's turn
    - "Waiting" (gray badge) otherwise
    - "You" badge next to user's team name
  - Already-picked state: Green confirmation box with checkmark icon showing picked rider name and team
  - Waiting state: Gray info box explaining "It's not your turn yet" with pick order number
  - Rider selection UI (only shown when `isMyTurn`):
    - Search input for client-side rider filtering by name
    - Scrollable grid of rider cards (max-h-64) with rider name and team
    - Purple hover effects matching orders UI
    - Disabled state during submission (isPending)
- On rider selection: calls `pickBonusRider` server action, shows toast on success/error

**Team Orders Page Integration:**
- Filters team orders for active Uno-X orders
- For each active Uno-X order, fetches:
  - Draft order via `computeReverseDraftOrder`
  - Existing picks via `getBonusRidersForRace`
  - Available riders via `getUnownedRidersForGT` (using first drafted rider's gender)
- Computes draft state:
  - myPickOrder from draft order
  - alreadyPicked: whether team has already picked
  - myPickedRider: the rider this team picked (if any)
  - isMyTurn: `!alreadyPicked && existingPicks.length + 1 === myPickOrder`
- Renders BonusRiderPick components below OrdersClient
- Passes `pickBonusRider` server action as prop

**OrdersClient Updates:**
- Added "Bonus Draft Active" purple badge to Uno-X orders in My Orders table
- Badge only shows when order status is "active" and orderTypeName is "uno_x"
- Provides visual indicator that draft is in progress

**Teams can now:**
- See bonus rider draft section when they have an active Uno-X order
- View the complete draft order (all teams, reverse standings)
- Know when it's their turn to pick
- Search and select a bonus rider from the unowned pool
- See their picked rider after selection
- See "waiting" message when it's not their turn
- Get immediate feedback via toast notifications

**Server-side validation ensures:**
- Only authenticated league members can pick
- Teams can only pick for themselves
- Teams must have an active Uno-X order for the race
- Riders must be unowned (not drafted)
- Riders can only be picked once per league+race
- Picks must happen in correct turn order
- No concurrent pick conflicts (database unique constraint)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. ✅ Admin orders page shows Bonus Rider Draft section when Uno-X orders are active
2. ✅ Draft order displayed in reverse standings (lowest points first)
3. ✅ Picks made by teams visible with rider name and team in admin UI
4. ✅ "Draft Complete" shows when all teams have picked
5. ✅ Team orders page shows bonus rider draft when they have an active Uno-X order
6. ✅ Turn-based picking enforced (last place picks first)
7. ✅ Pick validation prevents:
   - Out-of-turn picks (server checks pickOrder vs picks count)
   - Owned riders (checks draftPicks table)
   - Duplicate picks (checks bonusRiders table)
8. ✅ Picks immediately visible in both admin and team views after revalidation
9. ✅ TypeScript compiles without errors in all modified files
10. ✅ Complete flow works: submit order → admin activates → teams pick in order → bonus rider scores for GT

## Next Steps

Phase 15 is now complete. The Uno-X order feature is fully implemented:
- Schema and migration (15-01)
- Backend logic and scoring integration (15-02)
- Admin and team UI (15-03)

The complete flow:
1. Team submits Uno-X order for a Grand Tour
2. Admin activates the order
3. Admin sees draft section with reverse standings order
4. Teams pick bonus riders one by one in reverse order (last place first)
5. Bonus riders score for the entire GT (parent race + all stages)
6. Bonus points appear in league standings and team rider scores
7. Admin and team UIs both show current draft state and pick progress

## Self-Check: PASSED

All created files verified:
- ✅ src/app/admin/orders/bonus-rider-draft.tsx exists
- ✅ src/app/(main)/leagues/[leagueId]/orders/bonus-rider-pick.tsx exists

All modified files verified:
- ✅ src/app/admin/orders/actions.ts exists
- ✅ src/app/admin/orders/page.tsx exists
- ✅ src/app/(main)/leagues/[leagueId]/orders/actions.ts exists
- ✅ src/app/(main)/leagues/[leagueId]/orders/page.tsx exists
- ✅ src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx exists

All commits verified:
- ✅ 0a6563a exists (Task 1 - admin bonus rider draft UI)
- ✅ 96064cd exists (Task 2 - team bonus rider picking UI)

Key functionality verified:
- ✅ getActivatedUnoXOrders present in admin actions
- ✅ getBonusRiderDraftState present in admin actions
- ✅ BonusRiderDraft component integrated into admin orders page
- ✅ pickBonusRider action present in team orders actions
- ✅ BonusRiderPick component integrated into team orders page
- ✅ Uno-X orders show "Bonus Draft Active" badge in My Orders table

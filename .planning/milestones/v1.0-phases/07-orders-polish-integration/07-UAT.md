---
status: complete
phase: 07-orders-polish-integration
source: 07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md
started: 2026-02-15T10:00:00Z
updated: 2026-02-15T10:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Orders Card on League Detail
expected: On an active league's detail page, a purple "Go to Strategic Orders" card is visible alongside the other action cards (draft, standings, transfers).
result: pass

### 2. Orders Page Loads
expected: Clicking the Orders card navigates to /leagues/[leagueId]/orders. Page shows the order submission form and a "My Orders" section below.
result: pass

### 3. Order Form Step 1 - Race Selection
expected: The order form shows upcoming races to select from. Only races without an existing order from your team appear. Selecting a race advances to step 2.
result: skipped
reason: No future races in calendar to test with

### 4. Order Form Step 2 - Order Type Selection
expected: After selecting a race, available order types are shown filtered by the race type (e.g. GT-specific orders only show for Grand Tour stages, WC-only orders only for World Championships). Selecting an order type advances to step 3.
result: pass

### 5. Order Form Step 3 - Target Selection
expected: The target UI adapts to the selected order type: single rider picker for Blodpose, opponent rider picker for Shimanobil, team picker for Bondestreik, country/text input for Kaptein, etc. Selecting a target advances to step 4.
result: pass

### 6. Order Form Step 4 - Confirm & Submit
expected: A confirmation summary shows the selected race, order type, and target. Submitting creates the order and shows a success toast. The order appears in the "My Orders" table below with status "pending".
result: pass

### 7. Cancel Pending Order
expected: In the My Orders table, pending orders show a Cancel button. Clicking Cancel removes the order and shows a success toast.
result: pass

### 8. Admin Orders Page
expected: Navigating to /admin/orders shows three sections: pending orders table, order history, and order types reference. Pending orders show team name, race, order type, and target.
result: pass

### 9. Admin Approve/Reject Order
expected: Admin can approve an order (sets status to "active") or reject with a required admin note (sets status to "rejected"). Status updates are reflected in both admin and user views.
result: pass

### 10. Admin Bonus Points for Complex Orders
expected: For complex orders (Hammer, Innlagt Spurt, Lagtempo), after approving, admin can enter bonus points. The bonus points input only appears for active complex orders.
result: pass

### 11. Standings Reflect Order Effects
expected: The league standings page shows team totals that include order-adjusted points (not just base scoring).
result: pass

### 12. Race Breakdown Shows Order Effects
expected: On a race breakdown page where orders are active: an "Adjusted Pts" column appears (green if up, red if down), an "Order Effect" badge shows the effect type, and countered rows are highlighted in yellow.
result: pass

### 13. Counter Results Display
expected: When a counter has occurred (e.g. Etappeseier countered Shimanobil), the race breakdown page shows a "Counter Results" card with a narrative description of the counter event.
result: pass

## Summary

total: 13
passed: 12
issues: 0
pending: 0
skipped: 1

## Gaps

[none]

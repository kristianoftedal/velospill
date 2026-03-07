---
phase: 20-ir-foundation-admin-approval
plan: "02"
subsystem: ir
tags: [ir, server-actions, queries, admin, drizzle]
dependency_graph:
  requires:
    - 20-01
  provides:
    - ir-queries.ts exports for Plan 03 UI consumption
    - submitIrRequest player action
    - approveIrRequest / rejectIrRequest admin actions
  affects:
    - src/app/(main)/leagues/[leagueId]/ir/
    - src/app/admin/ir/
tech_stack:
  added: []
  patterns:
    - Drizzle ORM join queries with innerJoin for name resolution
    - inArray filter for status IN ("pending", "approved")
    - count() aggregate for slot accounting
    - Admin auth pattern copied from admin/transfers/actions.ts
    - Return type { success: true } | { success: false; error: string }
key_files:
  created:
    - src/lib/ir-queries.ts
    - src/app/(main)/leagues/[leagueId]/ir/actions.ts
    - src/app/admin/ir/actions.ts
  modified: []
decisions:
  - "getActiveRosterCount uses arithmetic: COUNT(draftPicks) - COUNT(approved irRequests)"
  - "inArray used for status IN guard (pending|approved) — matches existing transfer pattern"
  - "Player actions file follows same try/catch auth pattern as transfers/actions.ts"
  - "Admin actions re-fetch request outside transaction — simple update, no race condition risk unlike transfers"
metrics:
  duration_seconds: 145
  completed_date: "2026-03-06"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 20 Plan 02: IR Query and Action Layer Summary

**One-liner:** Drizzle query helpers and server actions for IR — player submit with 2-slot cap, admin approve/reject, and roster count accounting via getActiveRosterCount.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/lib/ir-queries.ts | 93e15cb | src/lib/ir-queries.ts |
| 2 | Create player and admin IR server actions | 52f6ba4 | src/app/(main)/leagues/[leagueId]/ir/actions.ts, src/app/admin/ir/actions.ts |

## Artifacts Delivered

### src/lib/ir-queries.ts

Plain module (no "use server") exporting three query helpers and two types:

- `getTeamIrSlots(teamId, leagueId)` — all IR requests for a team+league, joined with rider name, ordered newest first
- `getActiveRosterCount(teamId, leagueId)` — total draft picks minus approved IR slots
- `getPendingIrRequests()` — admin queue of all pending requests across all leagues, joined with league/team/rider names
- `IrSlot` type — full IR slot shape including status, reason, adminNote, dates
- `PendingIrRequest` type — admin queue shape with league/team/rider context

### src/app/(main)/leagues/[leagueId]/ir/actions.ts

`submitIrRequest({ leagueId, riderId, reason? })`:
1. Auth check via getAuthenticatedUser()
2. League membership via checkLeagueMembership()
3. Rider-on-team guard via draftPicks query
4. Slot count guard: pending OR approved count >= 2 → error "IR slots full (max 2)"
5. Duplicate guard: rider already has pending/approved in this league → error
6. Insert ir_requests row with status "pending"
7. Revalidates /leagues/{leagueId}/ir and /admin/ir

### src/app/admin/ir/actions.ts

`getPendingIrRequestsAction()` — admin wrapper delegating to getPendingIrRequests()

`approveIrRequest(requestId)`:
- Admin-only auth
- Fetches request + verifies pending status
- Updates to approved + sets resolvedAt/resolvedBy
- Revalidates admin/ir and league IR page

`rejectIrRequest(requestId, adminNote)`:
- Admin-only auth
- Validates adminNote is non-empty
- Fetches request + verifies pending status
- Updates to rejected + sets resolvedAt/resolvedBy/adminNote
- Revalidates admin/ir and league IR page

## Verification

- `npx tsc --noEmit` — no errors in any IR file
- All required exports present in ir-queries.ts
- submitIrRequest enforces 2-slot cap via inArray(status, ["pending", "approved"])
- approveIrRequest and rejectIrRequest both call checkAdminAuth() with throw-on-fail pattern

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All created files verified on disk. Both task commits (93e15cb, 52f6ba4) confirmed in git log.

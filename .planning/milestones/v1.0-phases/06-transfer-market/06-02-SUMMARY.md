---
phase: 06-transfer-market
plan: 02
subsystem: transfers
tags: [transfers, waiver-wire, server-actions, queries, gender-constraint]
dependency_graph:
  requires: [06-01]
  provides: [transfer-queries-library, team-transfer-ui]
  affects: [standings-page, admin-transfers-plan-03]
tech_stack:
  added: []
  patterns:
    - alias() from drizzle-orm/pg-core for self-joins on riders table
    - useTransition + sonner for async server action UX
    - Two-step bid form with client-side gender filtering of free agents
key_files:
  created:
    - src/lib/transfer-queries.ts
    - src/app/(main)/leagues/[leagueId]/transfers/page.tsx
    - src/app/(main)/leagues/[leagueId]/transfers/actions.ts
    - src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx
  modified: []
decisions:
  - alias() imported from drizzle-orm/pg-core not drizzle-orm (not exported from main package in this version)
  - getTeamTransferCount queries the window record for opensAt/closesAt dates rather than accepting them as parameters, keeping the caller interface clean
  - TransferForm uses two-step UI (select rider to drop, then see same-gender free agents) to enforce gender constraint at the client level before server validation
metrics:
  duration: ~10min
  completed: 2026-02-14T12:06:44Z
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 6 Plan 02: Transfer Queries Library and Team Transfer UI Summary

Transfer queries library with 5 reusable query functions and team-facing waiver wire bid UI with full server-side validation chain including gender constraint and transfer window enforcement.

## What Was Built

### Task 1: Transfer Queries Library (`src/lib/transfer-queries.ts`)

Five exported query functions:

- **`getFreeAgents(leagueId, gender)`** — Returns all riders not in any `draftPicks` for the league (via `notInArray` subquery), filtered by gender. Ordered alphabetically.
- **`getTeamRoster(teamId, leagueId)`** — Returns current team riders via `draftPicks` joined with `riders`. Ordered by gender (M first), then name.
- **`getTeamBids(teamId, leagueId)`** — Returns bid history with outgoing and incoming rider names via double `alias()` self-join on the riders table. Ordered by `submittedAt` DESC.
- **`getActiveTransferWindow(leagueId)`** — Returns the window where `opensAt <= now < closesAt`. Returns null if none active.
- **`getTeamTransferCount(teamId, leagueId, windowId)`** — Counts approved transfers within the window's time range for limit checking.

Exported types: `FreeAgent`, `TeamRosterEntry`, `TeamBid`, `ActiveTransferWindow`.

### Task 2: Team Transfers Page

**`page.tsx` (Server Component):**
- Parses `leagueId` with `isNaN` guard
- Auth + membership via `getLeagueDetails`
- Status guard: only `active` leagues show the transfer UI
- Team membership guard: user must have a team to submit bids
- Parallel fetch of roster, bids, active window, free agents (M and F)
- Breadcrumb: Leagues > {leagueName} > Transfers

**`actions.ts` (Server Actions):**

`submitTransferBid` validation chain:
1. Auth via `getAuthenticatedUser()`
2. Zod validation (`leagueId`, `outRiderId`, `inRiderId`, optional `reason`)
3. League membership check
4. League status guard (must be `active`)
5. Rider ownership: outRider must be in team's `draftPicks`
6. Free agent check: inRider must not be in any `draftPicks` for this league
7. Gender constraint: `outRider.gender === inRider.gender` (error: "men for men, women for women")
8. Window validation: active window must exist; `maxTransfers` limit checked if set
9. Insert `transferBids` (status: `pending`)
10. Insert `transferAudit` (action: `SUBMITTED`)
11. Revalidate `/leagues/${leagueId}/transfers` and `/admin/transfers`

`cancelTransferBid`:
1. Auth + membership
2. Fetch bid, verify `teamId` ownership and `status === "pending"`
3. Update to `cancelled` with `resolvedAt`
4. Insert audit (action: `CANCELLED`)
5. Revalidate both paths

**`transfer-form.tsx` (Client Component):**
- Active window banner (green) or closed alert (gray)
- Pending bids list with status badges (yellow=pending, green=approved, red=rejected, gray=cancelled) and cancel button for pending bids
- Two-step bid form (only shown when window is active):
  - Step 1: Select rider to drop (grouped by gender M/W)
  - Step 2: Select same-gender free agent (client-side search by name/team)
  - Optional reason textarea
  - Submit button (disabled until both riders selected)
- `useTransition` for loading states on both submit and cancel
- `sonner` toasts for success/error feedback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `alias` is not exported from `drizzle-orm` in this version**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** `import { alias } from "drizzle-orm"` caused `TS2305: Module '"drizzle-orm"' has no exported member 'alias'`
- **Fix:** Changed import to `import { alias } from "drizzle-orm/pg-core"` which is the correct source in drizzle-orm 0.45.x
- **Files modified:** `src/lib/transfer-queries.ts`
- **Commit:** cc8c547

None other — plan executed as written.

## Self-Check: PASSED

| File | Status |
|------|--------|
| `src/lib/transfer-queries.ts` | FOUND |
| `src/app/(main)/leagues/[leagueId]/transfers/page.tsx` | FOUND |
| `src/app/(main)/leagues/[leagueId]/transfers/actions.ts` | FOUND |
| `src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx` | FOUND |

Commits:
- cc8c547: feat(06-02): create transfer queries library
- e237a39: feat(06-02): create team transfers page, actions, and form component

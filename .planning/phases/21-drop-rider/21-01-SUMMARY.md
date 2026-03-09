---
phase: 21-drop-rider
plan: 01
subsystem: ui
tags: [next.js, drizzle-orm, react, shadcn, server-actions]

# Dependency graph
requires:
  - phase: 20-ir-foundation-admin-approval
    provides: irRequests table and schema, draftPicks pattern, league-auth guards
provides:
  - dropRider server action with auth, membership, active-league, and ownership guards
  - Hard-delete of draftPicks row with IR cleanup and transfer bid cancellation
  - /leagues/[id]/roster RSC page with breadcrumb and guards
  - RosterClient component with drop buttons and shadcn Dialog confirmation
  - Manage Roster button on league page for active leagues
affects: [22-ir-return]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server action guard chain: auth → membership → active league → ownership → mutation → revalidate"
    - "RSC page mirrors ir/page.tsx: try/catch getLeagueDetails, status guard, team guard, fetch, render client"
    - "Client component with useTransition + sonner toast + Dialog confirmation for destructive actions"

key-files:
  created:
    - src/app/(main)/leagues/[leagueId]/roster/actions.ts
    - src/app/(main)/leagues/[leagueId]/roster/page.tsx
    - src/app/(main)/leagues/[leagueId]/roster/roster-client.tsx
  modified:
    - src/app/(main)/leagues/[leagueId]/page.tsx

key-decisions:
  - "dropRider hard-deletes draftPicks row; no soft-delete or waiver period — instant removal"
  - "IR cleanup on drop uses inArray(['pending','approved']) matching IR slot cap guard pattern"
  - "Transfer bid cleanup on drop: status update to 'cancelled' (bid has cancelled status; IR does not)"

patterns-established:
  - "Destructive action pattern: useTransition + Dialog confirmation + toast + setConfirmRiderId state"
  - "Roster guard chain matches IR page structure exactly for consistency"

requirements-completed: [ROST-01]

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 21 Plan 01: Drop Rider Summary

**Instant drop-rider flow: `dropRider` server action deletes draftPicks row with IR and transfer bid cleanup, RSC roster page with shadcn Dialog confirmation dialog, and Manage Roster button on the league page**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-06T17:43:00Z
- **Completed:** 2026-03-06T17:44:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `dropRider` server action: 4-layer guard (auth, membership, active league, ownership) before deleting draftPicks row and cleaning up IR requests and pending transfer bids
- RSC roster page at `/leagues/[id]/roster` with league active + team membership guards, mirrors ir/page.tsx structure
- `RosterClient` component: lists all roster riders, Drop button per rider, shadcn Dialog confirmation with destructive CTA, useTransition pending state and sonner toasts
- Manage Roster button added to league page actions row (active leagues only), after Injured Reserve

## Task Commits

Each task was committed atomically:

1. **Task 1: dropRider server action** - `26f9184` (feat)
2. **Task 2: Roster page, client component, and league page button** - `d1a89d5` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/app/(main)/leagues/[leagueId]/roster/actions.ts` - dropRider server action with full guard chain and cleanup
- `src/app/(main)/leagues/[leagueId]/roster/page.tsx` - RSC roster page: fetches roster, applies guards, renders RosterClient
- `src/app/(main)/leagues/[leagueId]/roster/roster-client.tsx` - Client component with drop buttons and Dialog confirmation
- `src/app/(main)/leagues/[leagueId]/page.tsx` - Added Manage Roster button in actions row

## Decisions Made
- Drop is hard-delete with no waiver or approval period — ROST-01 requires instant removal
- IR cleanup uses `inArray(['pending', 'approved'])` — matching the same guard used in submitIrRequest slot cap check; rejected IR rows are left as historical record since those slots were never active
- Transfer bids use `status = 'cancelled'` update (transferBids supports cancelled; irRequests does not)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `dropRider` action is available for Phase 22 (IR Return flow) to gate return on roster-full check — player must drop someone first
- ROST-01 complete: drop rider is instant, no approval, no waiver period
- Full `npx tsc --noEmit` passes with zero errors

---
*Phase: 21-drop-rider*
*Completed: 2026-03-06*

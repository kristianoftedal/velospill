---
phase: 06-transfer-market
plan: 04
subsystem: ui
tags: [waiver-wire, transfer-windows, admin, standings-priority, race-calendar]

# Dependency graph
requires:
  - phase: 06-01
    provides: transfer schema, scoring ownership-at-race-time filter, negative pickNumber sentinels
  - phase: 06-02
    provides: getFreeAgents, getTeamRoster, getTeamBids, getActiveTransferWindow, getTeamTransferCount, submitBid action
  - phase: 06-03
    provides: approveBid, rejectBid, getPendingBids, getBidHistory admin actions, admin transfers page
  - phase: 05-01
    provides: getLeagueStandings for standings-based priority

provides:
  - resolveConflictingBids: priority resolution by lowest points team first, submittedAt tiebreaker
  - generateTransferWindows: race-calendar-based window proposals with race-type-specific limits
  - resolveWaiverWire: batch-resolve all pending bids using standings priority
  - generateWindowsForLeague: auto-generate windows, delete old auto windows, insert new
  - createTransferWindow: manual window creation with Zod validation
  - closeTransferWindow: admin override to close window early
  - getActiveLeagues/getTransferWindows: helper queries for admin UI
  - WaiverWireResolution: admin client component for batch resolution with league selector
  - TransferWindowManagement: admin client component with auto-generate, create dialog, close-early
  - Transfers link on league detail page for active leagues

affects: [future-seasons, scoring, admin-tooling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Waiver wire priority by standings (lowest total points = highest priority, submittedAt tiebreaker)
    - Auto-window generation from race calendar with race-type-specific maxTransfers limits
    - Admin batch resolution: reject conflicting losers first, then approve winners in priority order
    - searchParams-driven league selection in server component for window view
    - window.location for page reload after client-triggered server mutations

key-files:
  created:
    - src/app/admin/transfers/window-management.tsx
  modified:
    - src/lib/transfer-queries.ts
    - src/app/admin/transfers/actions.ts
    - src/app/admin/transfers/page.tsx
    - src/app/(main)/leagues/[leagueId]/page.tsx

key-decisions:
  - "resolveConflictingBids groups bids by inRiderId, sorts by totalPoints ASC then submittedAt ASC — lower-standing teams win"
  - "generateTransferWindows maps race type to (maxTransfers, daysBeforeOpen): GT/WT=null/7, HP=4/5, LP/MT/WO=2/3, WC=4/7"
  - "resolveWaiverWire rejects conflicting losers before approving winners to prevent race conditions"
  - "TransferWindowManagement uses window.location.reload after server mutations (simpler than router.refresh in App Router)"
  - "Admin page uses searchParams leagueId to server-render windows for selected league"
  - "Transfers card on league detail page uses blue button to distinguish from green standings and yellow draft"

patterns-established:
  - "Batch waiver resolution: reject all non-winners first, then approve winners in priority order"
  - "Race-type-to-window mapping centralized in generateTransferWindows for single source of truth"

# Metrics
duration: ~8min
completed: 2026-02-14
---

# Phase 06 Plan 04: Waiver Wire Priority and Transfer Window Management Summary

**Standings-based waiver wire priority (lowest points wins), auto-generated transfer windows from race calendar, admin batch-resolve and window CRUD, and Transfers navigation link on league detail page**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-14T12:15:00Z
- **Completed:** 2026-02-14T12:23:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Waiver wire priority resolution: bids for same free agent resolved by standings position (lowest total points = highest priority, with submittedAt tiebreaker per user decision #2)
- Auto-window generation: `generateTransferWindows` maps each parent race to a window with race-type-specific limits (GT=unlimited, HP=4, LP/mini-tour/WO=2, WC=4)
- Admin actions: `resolveWaiverWire` (batch resolve all pending bids), `generateWindowsForLeague` (auto-generate), `createTransferWindow` (manual), `closeTransferWindow` (early close override)
- Admin transfers page: three sections — waiver wire resolution, pending bids, bid history, transfer windows — with interactive client components
- League detail page: Transfers link card (blue button) visible when league status is "active"

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement waiver wire priority resolution and auto-window generation** - `886180d` (feat)
2. **Task 2: Add admin window management UI and league page transfers link** - `dcccafe` (feat)

## Files Created/Modified
- `src/lib/transfer-queries.ts` - Added `resolveConflictingBids` (standings-based priority) and `generateTransferWindows` (race calendar windows)
- `src/app/admin/transfers/actions.ts` - Added `resolveWaiverWire`, `generateWindowsForLeague`, `createTransferWindow`, `closeTransferWindow`, `getActiveLeagues`, `getTransferWindows`
- `src/app/admin/transfers/window-management.tsx` - Created: `WaiverWireResolution` and `TransferWindowManagement` client components
- `src/app/admin/transfers/page.tsx` - Integrated waiver wire and window management sections, added searchParams for league selection
- `src/app/(main)/leagues/[leagueId]/page.tsx` - Added Transfers card visible for active leagues

## Decisions Made
- `resolveConflictingBids` groups bids by `inRiderId`, sorts by totalPoints ASC then submittedAt ASC — lower-standing teams win
- `generateTransferWindows` maps race type to `(maxTransfers, daysBeforeOpen)`: GT/WT=null/7, HP=4/5, LP/MT/WO=2/3, WC=4/7
- `resolveWaiverWire` rejects conflicting losers before approving winners to prevent race conditions
- `TransferWindowManagement` uses `window.location.reload` after server mutations (simpler than router.refresh in App Router)
- Admin page uses `searchParams.leagueId` to server-render windows for the selected league
- Transfers card on league detail page uses blue button to distinguish from green standings and yellow draft

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 06 (Transfer Market) is now complete. All five user decisions are implemented:
- #1: Waiver wire system with two-step UI (06-02)
- #2: Priority by standings - lowest points wins (06-04)
- #3: Admin approve/reject with adminNote (06-03)
- #4: Auto-generated transfer windows with admin override (06-04)
- #5: Ownership-at-race-time scoring via pickedAt filter (06-01)

Complete transfer lifecycle functional: submit bid -> admin resolves by priority -> roster updated via draftPick swap -> scoring reflects ownership-at-race-time.

## Self-Check: PASSED

All files confirmed present. All task commits confirmed in git log.

---
*Phase: 06-transfer-market*
*Completed: 2026-02-14*

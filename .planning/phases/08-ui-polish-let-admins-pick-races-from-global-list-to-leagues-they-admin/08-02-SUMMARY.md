---
phase: 08-ui-polish-let-admins-pick-races-from-global-list-to-leagues-they-admin
plan: 02
subsystem: ui
tags: [next.js, server-actions, react, shadcn, drizzle-orm, race-picker]

# Dependency graph
requires:
  - phase: 08-01
    provides: leagueRaces join table and schema exports
  - phase: 03-league-management
    provides: leagues table, LeagueConfig, checkLeagueOwnership
  - phase: 07-orders
    provides: orders table for hadOrders check
  - phase: 02-admin-backoffice-race-calendar
    provides: races table with parentRaceId, season, raceType fields
provides:
  - getSeasonRacesForPicker server action: fetches season parent races with assigned state
  - assignRaceToLeague server action: inserts leagueRaces row with conflict guard
  - removeRaceFromLeague server action: deletes leagueRaces row, returns hadOrders flag
  - RacePickerSection client component: checkbox table for race assignment
  - Race Calendar section on league detail page (owners only)
affects:
  - /leagues/[leagueId] page — adds Race Calendar card for owners
  - /leagues/[leagueId]/orders — revalidated on race toggle
  - /leagues/[leagueId]/transfers — revalidated on race toggle

# Tech tracking
tech-stack:
  added:
    - shadcn Checkbox component (via radix-ui Checkbox primitive)
  patterns:
    - Server actions passed as props to client components (established in 07-02)
    - toast.success/warning/error from sonner for user feedback
    - router.refresh() after server action to sync server data
    - togglingRaceId state to disable individual checkboxes during async calls

key-files:
  created:
    - src/components/ui/checkbox.tsx
  modified:
    - src/app/(main)/leagues/[leagueId]/actions.ts
    - src/app/(main)/leagues/[leagueId]/league-client.tsx
    - src/app/(main)/leagues/[leagueId]/page.tsx

key-decisions:
  - "removeRaceFromLeague allows removal even when orders exist — returns hadOrders flag for client warning (soft-block would be confusing UX)"
  - "seasonRaces fetch guarded by isOwner check in page.tsx to avoid unnecessary DB queries"
  - "RacePickerSection is a standalone Card (no wrapping Card in page.tsx) to avoid double padding"
  - "shadcn CLI used successfully — radix-ui monorepo package provides Checkbox primitive"

patterns-established:
  - "Race assignment pattern: insert with onConflictDoNothing, delete with composite WHERE, revalidate 3 paths"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 08 Plan 02: Race Picker UI Summary

**Race Calendar checkbox table on league detail page — owners can assign/unassign season parent races via shadcn Checkbox, with toast feedback and hadOrders warning**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-16T07:02:52Z
- **Completed:** 2026-02-16T07:04:10Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Added `getSeasonRacesForPicker` server action: fetches all parent races for the league's season with `assigned` boolean derived from `leagueRaces` join table
- Added `assignRaceToLeague` server action: idempotent insert with `onConflictDoNothing`, revalidates league/orders/transfers paths
- Added `removeRaceFromLeague` server action: deletes leagueRaces row, checks for existing orders and returns `hadOrders` flag, revalidates paths
- Installed shadcn Checkbox component via `npx shadcn@latest add checkbox` (uses `radix-ui` monorepo package)
- Added `RacePickerSection` client component with Card layout, checkbox table, formatRaceType/formatRaceDate helpers, toast feedback (success/warning/error), per-row loading state via `togglingRaceId`
- Integrated `RacePickerSection` into league detail page: owner-only, fetched server-side with `getSeasonRacesForPicker`, rendered before Invite Link card

## Task Commits

Each task was committed atomically:

1. **Task 1: Add server actions and Checkbox component** — `4226289` (feat)
2. **Task 2: RacePickerSection component and page integration** — `b2f04a0` (feat)

**Plan metadata:** (committed in final docs commit)

## Files Created/Modified

- `src/components/ui/checkbox.tsx` — shadcn Checkbox using radix-ui primitive, CheckIcon from lucide-react
- `src/app/(main)/leagues/[leagueId]/actions.ts` — Added imports (leagueRaces, races, orders, isNull), three new server actions
- `src/app/(main)/leagues/[leagueId]/league-client.tsx` — Added Checkbox, Card, Table imports, toast; added RacePickerSection component with formatRaceType/formatRaceDate helpers
- `src/app/(main)/leagues/[leagueId]/page.tsx` — Added imports for new actions + RacePickerSection, seasonRaces fetch, Race Calendar section render

## Decisions Made

- `removeRaceFromLeague` soft-removes (doesn't block) even when orders exist — returns `hadOrders: true` so client can show warning toast; hard-blocking is confusing UX when owner has already decided
- `seasonRaces` is only fetched when `isOwner === true` in page.tsx to skip DB query for regular members
- `RacePickerSection` is rendered directly as its own Card (standalone, not wrapped in another Card) to avoid double-padding
- `shadcn@latest add checkbox` CLI worked on first try; uses `radix-ui` (monolithic v1.4.3) already in project

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled cleanly after both tasks with `npx tsc --noEmit`.

## User Setup Required

None — feature is live for league owners who visit their league detail page.

## Next Phase Readiness

- Race Calendar section live on league detail page for owners
- Owners can toggle race assignment via checkboxes with immediate toast feedback
- Non-owners see no Race Calendar section
- Ready for 08-03 (if applicable): any further polish or additional features

---
*Phase: 08-ui-polish-let-admins-pick-races-from-global-list-to-leagues-they-admin*
*Completed: 2026-02-16*

## Self-Check: PASSED

- FOUND: src/components/ui/checkbox.tsx
- FOUND: src/app/(main)/leagues/[leagueId]/actions.ts (contains getSeasonRacesForPicker, assignRaceToLeague, removeRaceFromLeague)
- FOUND: src/app/(main)/leagues/[leagueId]/league-client.tsx (contains RacePickerSection)
- FOUND: src/app/(main)/leagues/[leagueId]/page.tsx (contains RacePickerSection render)
- FOUND: commit 4226289 (Task 1)
- FOUND: commit b2f04a0 (Task 2)

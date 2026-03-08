---
plan: 24-01
phase: 24-write-path-wiring
status: complete
completed_at: 2026-03-08
---

# Plan 24-01: Draft Pick Mutations → roster_slots

## What Was Built

Wired both manual and automatic draft pick mutations to insert an `active` row into `roster_slots` within the same transaction as the `draftPicks` insert.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Wire `makePick` to insert into `roster_slots` | ✓ Complete |
| 2 | Wire auto-pick route to insert into `roster_slots` | ✓ Complete |

## Key Changes

- `src/app/(main)/leagues/[leagueId]/draft/actions.ts`: Added `rosterSlots` import; inserted `tx.insert(rosterSlots).values({ leagueId, teamId: team.id, riderId, status: "active" })` inside existing `db.transaction()` block, after `draftPicks` insert and before `draftSessions` update.
- `src/app/api/draft/auto-pick/route.ts`: Added `rosterSlots` import; inserted `tx.insert(rosterSlots).values({ leagueId, teamId: currentTeamId, riderId: rider.id, status: "active" })` inside existing `db.transaction()` block, after `draftPicks` insert and before `draftSessions` update.

## Self-Check: PASSED

- TypeScript: zero errors
- Both pick paths insert into `roster_slots` with `status: "active"` inside existing transactions
- A failed `roster_slots` insert rolls back the entire draft pick (no orphaned `draftPicks` rows)
- No logic outside the transaction blocks changed

## key-files

### key-files.modified
- src/app/(main)/leagues/[leagueId]/draft/actions.ts
- src/app/api/draft/auto-pick/route.ts

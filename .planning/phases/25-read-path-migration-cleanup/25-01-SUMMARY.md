---
phase: 25-read-path-migration-cleanup
plan: "01"
subsystem: query-layer
tags: [roster_slots, read-path, ir-queries, transfer-queries, migration]
dependency_graph:
  requires: [Phase 23 roster_slots schema, Phase 24 write-path-wiring]
  provides: [getActiveRosterCount via roster_slots, getTeamRoster via roster_slots]
  affects: [transfers/page.tsx, ir/page.tsx, roster/page.tsx]
tech_stack:
  added: []
  patterns: [direct-table-read, innerJoin-from-roster_slots]
key_files:
  modified:
    - src/lib/ir-queries.ts
    - src/lib/transfer-queries.ts
decisions:
  - "getActiveRosterCount: single SELECT COUNT(*) from roster_slots WHERE status='active' replaces two-query draftPicks-minus-irRequests subtraction"
  - "getTeamRoster: sources from rosterSlots innerJoin riders innerJoin draftPicks — pickedAt kept from draftPicks for ownership-at-race-time invariant"
  - "isOnIR derived from rosterSlots.status IN ('on_ir', 'return_eligible') — no longer from irRequests.id IS NOT NULL"
metrics:
  duration_seconds: 75
  completed_date: "2026-03-08"
  tasks_completed: 2
  files_modified: 2
requirements_satisfied:
  - RSLOT-09
  - RSLOT-10
---

# Phase 25 Plan 01: Read Path Migration Cleanup Summary

**One-liner:** Migrated getActiveRosterCount and getTeamRoster from draftPicks+irRequests join patterns to direct reads from roster_slots, making the read side consistent with the write side established in phases 23-24.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite getActiveRosterCount to read from roster_slots | ababe07 | src/lib/ir-queries.ts |
| 2 | Rewrite getTeamRoster to join from roster_slots | 06cb7cb | src/lib/transfer-queries.ts |

## What Was Built

### Task 1 — getActiveRosterCount (ir-queries.ts)

Replaced the two-query subtraction pattern (COUNT(draftPicks) - COUNT(approved+return_eligible irRequests)) with a single `SELECT COUNT(*) FROM roster_slots WHERE status='active'`. roster_slots is now the authoritative source so a direct count is correct and simpler.

Removed dead imports: `draftPicks` (from draft schema), `inArray` (from drizzle-orm).
Added import: `rosterSlots` (from roster-slots schema).

### Task 2 — getTeamRoster (transfer-queries.ts)

Replaced the query sourcing from `draftPicks` with a leftJoin to `irRequests` with a new query sourcing from `rosterSlots` with innerJoins to `riders` and `draftPicks`. Key decisions:

- `pickedAt` and `pickNumber` still come from `draftPicks` — required for ownership-at-race-time scoring invariant
- `isOnIR` is now `rosterSlots.status IN ('on_ir', 'return_eligible')` instead of `irRequests.id IS NOT NULL` — captures both on_ir and return_eligible states correctly (the old query only checked `approved` status, missing `return_eligible`)
- Return shape is structurally identical: `{ riderId, riderName, riderTeam, gender, nationality, pickNumber, pickedAt, isOnIR }` — no consumer changes required

Removed dead import: `irRequests` (from ir schema).
Added import: `rosterSlots` (from roster-slots schema).

## Verification

- `npx tsc --noEmit` produces zero errors across both files and the full project
- No `leftJoin.*irRequests` or `inArray.*approved.*return_eligible` patterns remain in either file
- `rosterSlots` imported and used in both files
- `getActiveRosterCount` queries only from `rosterSlots` with single COUNT query
- `getTeamRoster` joins from `rosterSlots` with no leftJoin to irRequests

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/lib/ir-queries.ts: modified correctly
- src/lib/transfer-queries.ts: modified correctly
- Commit ababe07: confirmed (feat(25-01): rewrite getActiveRosterCount)
- Commit 06cb7cb: confirmed (feat(25-01): rewrite getTeamRoster)
- TypeScript: zero errors

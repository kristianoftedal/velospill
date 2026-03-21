---
phase: quick-260321-cj1
plan: 01
subsystem: scoring/draft
tags: [bug-fix, soft-delete, scoring-queries, data-recovery, draftPicks]
dependency_graph:
  requires: []
  provides: [droppedAt-soft-delete, scoring-droppedAt-guards]
  affects:
    - src/db/schema/draft.ts
    - src/app/(main)/leagues/[leagueId]/roster/actions.ts
    - src/lib/scoring-queries.ts
tech_stack:
  added: []
  patterns: [soft-delete with droppedAt timestamp, partial unique index, ownership-at-race-time extension]
key_files:
  created:
    - src/db/migrations/0007_soft_delete_draft_picks.sql
    - src/db/migrations/0008_reinsert_tejada_romeo.sql
  modified:
    - src/db/schema/draft.ts
    - src/app/(main)/leagues/[leagueId]/roster/actions.ts
    - src/lib/scoring-queries.ts
decisions:
  - "droppedAt IS NULL partial unique index replaces full unique index — allows re-adding same rider after drop"
  - "dropRider sets droppedAt = NOW() instead of DELETE — historical points preserved for pre-drop races"
  - "Historical scoring guard: or(isNull(droppedAt), gte(droppedAt, races.startDate)) — include if never dropped or dropped on/after race start"
  - "Active roster guard: isNull(droppedAt) in WHERE of getTeamRiderScores — dropped riders not shown"
  - "Tejada and Romeo re-inserted with negative pickNumbers (-99, -100) and exact timestamps from transfer_bids audit trail"
metrics:
  duration: 25min
  completed: 2026-03-21
  tasks: 3
  files: 5
---

# Quick Task 260321-cj1: Fix Points Lost When Tejada and Romeo Were Dropped — Summary

**One-liner:** Soft-delete draftPicks rows on dropRider (droppedAt timestamp) so dropped riders' pre-drop race results still score, with full DB migration and data recovery for Tejada and Romeo.

## What Was Done

Fixed a scoring data integrity bug where `dropRider()` hard-deleted the `draftPicks` row, causing all historical points for the dropped rider to disappear from the team's totals. All five scoring queries join through `draftPicks`, so a deleted row makes the rider invisible to scoring.

### Task 1: Schema + Migration

Added nullable `droppedAt: timestamp("droppedAt", { withTimezone: true })` column to `draftPicks`.

Migration `0007_soft_delete_draft_picks.sql` (applied to DB):
1. Drops the old full unique index `draft_picks_rider_league_unique`
2. Adds `droppedAt TIMESTAMPTZ` column (nullable, no default)
3. Creates partial unique index `WHERE "droppedAt" IS NULL` — enforces one-active-pick-per-rider-per-league while allowing re-adds after drops

Updated the schema comment for `riderLeagueUnique` to document the partial index behavior.

### Task 2: Soft-delete + Scoring Query Guards

**dropRider() changes (actions.ts):**
- Step 4 (ownership check): added `isNull(draftPicks.droppedAt)` — only finds active picks
- Step 5 (drop): changed from `tx.delete(draftPicks)` to `tx.update(draftPicks).set({ droppedAt: new Date() })` with `isNull(droppedAt)` guard
- Added `isNull` to drizzle-orm imports

**Five scoring queries updated (scoring-queries.ts):**

| Query | Guard added | Location |
|-------|-------------|----------|
| `getTeamRiderScores` | `isNull(draftPicks.droppedAt)` | WHERE clause — active roster only |
| `getLeagueStandings` | `or(isNull(droppedAt), gte(droppedAt, races.startDate))` | races leftJoin condition |
| `getRaceScoreBreakdown` | `or(isNull(droppedAt), gte(droppedAt, races.startDate))` | draftPicks innerJoin condition |
| `getLeagueRacesWithScores` (Query A + B) | `or(isNull(droppedAt), gte(droppedAt, races.startDate))` | draftPicks join conditions |
| `getStandingsHistory` (parentRaceRows + perRacePointsRows) | `or(isNull(droppedAt), gte(droppedAt, races.startDate))` | draftPicks join + races join |

The historical guard `or(isNull(droppedAt), gte(droppedAt, races.startDate))` means: include the pick if the rider was never dropped, OR if they were dropped on or after the race's start date (i.e. the race happened while they were still on the team).

### Task 3: Data Recovery

Queried the database to identify Tejada and Romeo:
- **Ivan ROMEO ABAD** (riderId=381): added via approved bid 19 (2026-03-08T11:21:49Z), dropped as outgoing in bid 50 (2026-03-20T19:07:54Z)
- **Harold Alfonso TEJADA CANACUE** (riderId=438): added via approved bid 35 (2026-03-08T12:01:19Z), dropped as outgoing in bid 56 (2026-03-20T19:07:53Z)

Both were on team 15 (Hjultaster) in league 7 (Velospill). Re-inserted via migration `0008_reinsert_tejada_romeo.sql` with:
- Correct `pickedAt` from transfer_bids.resolvedAt of the adding bid
- Correct `droppedAt` from transfer_bids.resolvedAt of the removing bid
- Negative pickNumbers (-99, -100) to bypass the partial unique index on `pickNumber >= 0`

**Restored points (confirmed by race_results within ownership window):**
- Romeo: Stage 5 Paris-Nice/Tirreno 2026-03-12 (1pt)
- Tejada: Paris-Nice 2026-03-08 (1pt) + Stage 5 (4pt) + Stage 6 (7pt) + Stage 8 2026-03-15 (4pt) = 16pts

## Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add droppedAt to schema + write SQL migration | 268b553 | src/db/schema/draft.ts, src/db/migrations/0007_soft_delete_draft_picks.sql |
| 2 | Soft-delete in dropRider + update all 5 scoring queries | a8fd3b8 | src/app/(main)/leagues/[leagueId]/roster/actions.ts, src/lib/scoring-queries.ts |
| 3 | Data recovery — re-insert Tejada and Romeo | 66453cd | src/db/migrations/0008_reinsert_tejada_romeo.sql |

## Verification

1. TypeScript: `npx tsc --noEmit` — clean compile after all changes
2. DB migration applied: `droppedAt` column exists, partial unique index active
3. Data recovery: Romeo (id=198) and Tejada (id=199) inserted with correct timestamps
4. Standings page for league 7 should show Hjultaster's points restored
5. Roster page for Hjultaster should NOT show Tejada or Romeo (droppedAt IS NOT NULL)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/db/schema/draft.ts` has `droppedAt` column
- [x] `src/db/migrations/0007_soft_delete_draft_picks.sql` created and applied to DB
- [x] `src/db/migrations/0008_reinsert_tejada_romeo.sql` created and applied to DB
- [x] `src/app/(main)/leagues/[leagueId]/roster/actions.ts` uses soft-delete with isNull guard
- [x] `src/lib/scoring-queries.ts` has droppedAt guards in all 5 queries
- [x] TypeScript compiles without errors
- [x] Commits 268b553, a8fd3b8, 66453cd all exist

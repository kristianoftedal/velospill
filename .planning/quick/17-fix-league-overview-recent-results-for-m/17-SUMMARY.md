---
phase: quick-17
plan: "01"
subsystem: league-overview
tags: [multi-stage, recent-results, accordion, league-page]
dependency_graph:
  requires: []
  provides: [recent-results-multi-stage-accordion]
  affects: [league-overview-page]
tech_stack:
  added: []
  patterns: [three-query-application-assembly, ownership-at-race-time, accordion-expand-collapse]
key_files:
  created: []
  modified:
    - src/lib/league-overview-queries.ts
    - src/app/(main)/leagues/[leagueId]/page.tsx
decisions:
  - "MULTI_STAGE_TYPES defined locally in league-overview-queries.ts — keeps file independent of scoring-queries"
  - "totalPoints moved to top-level field on RecentRaceResult — consistent for both isMultiStage and one-day shapes"
  - "stage hasResults drives Done/Pending badge and whether points column shows a value or '-'"
metrics:
  duration: "~2 minutes"
  completed: "2026-03-13"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 17: Fix League Overview Recent Results for Multi-Stage Races

One-liner: Added partial multi-stage race support (mini tours, grand tours) to the Recent Results section — parent race appears when any stage has results, with expandable per-stage breakdown showing accumulated points, Done/Pending badges, and links to stage standings.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Update getRecentRaceResults for partial multi-stage | fd526c7 | src/lib/league-overview-queries.ts |
| 2 | Render multi-stage accordion in page.tsx | 3fb7136 | src/app/(main)/leagues/[leagueId]/page.tsx |

## What Was Built

**league-overview-queries.ts:**
- Changed parent race filter from INNER JOIN (requiring direct results) to a WHERE with two OR EXISTS subqueries: one checking for direct league results, one checking for any child stage results
- Added Query 3: stage rows for multi-stage parent races, using LEFT JOIN + draftPicks ownership-at-race-time, with per-stage `totalLeaguePoints` and a `hasResults` EXISTS subquery
- Defined `MULTI_STAGE_TYPES = new Set(["grand_tour", "mini_tour", "womens_grand_tour"])` locally
- Added `StageScore` type
- Return shape now includes `isMultiStage`, `totalPoints` (pre-summed), `stages[]` for all races; one-day races get `results[]` as before

**page.tsx Recent Results section:**
- Multi-stage path: AccordionItem trigger shows race name, date, race type badge, accumulated pts, "X/Y stages" count
- AccordionContent renders per-stage rows: stage name (linked to standings page when done), Done/Pending badge (green vs. gray), points value or "-" for pending
- One-day path: unchanged except reads `race.totalPoints` instead of recalculating inline

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/lib/league-overview-queries.ts
- FOUND: src/app/(main)/leagues/[leagueId]/page.tsx
- FOUND: commit fd526c7 (Task 1)
- FOUND: commit 3fb7136 (Task 2)
- TypeScript: no errors

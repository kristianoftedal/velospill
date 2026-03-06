---
phase: 19-season-standings-history
plan: "02"
subsystem: frontend
tags: [standings, history, recharts, chart, season]
dependency_graph:
  requires: [19-01]
  provides: [standings-history-page, history-link]
  affects: [league-overview, standings]
tech_stack:
  added: [recharts, shadcn-chart]
  patterns: [recharts-LineChart, scrollable-table, sticky-column, chart-tooltip]
key_files:
  created:
    - src/app/(main)/leagues/[leagueId]/standings/history/page.tsx
    - src/app/(main)/leagues/[leagueId]/standings/history/history-client.tsx
    - src/components/ui/chart.tsx
  modified:
    - src/app/(main)/leagues/[leagueId]/page.tsx
    - package.json
    - package-lock.json
key_decisions:
  - shadcn chart component installed via CLI with --yes flag, existing card.tsx skipped to avoid overwrite
  - sticky left-0 column uses inline style for background color to handle both highlighted and normal rows
  - XAxis tickFormatter uses first word of race name for brevity; full name available on column header title attribute
  - ChartTooltipContent used for tooltip; lines get strokeOpacity 0.75 for non-user teams for visual differentiation
metrics:
  duration: 111s
  completed: "2026-03-06"
  tasks_completed: 4
  tasks_total: 4
  files_created: 3
  files_modified: 3
requirements_satisfied: [HISTORY-01, HISTORY-02]
---

# Phase 19 Plan 02: Season Standings History UI Summary

One-liner: Recharts cumulative line chart plus scrollable race-by-race table at /standings/history, with Season History link in the league Standings card.

## What Was Built

- **Server page** (`standings/history/page.tsx`): Parses leagueId, guards auth and league status, fetches `getStandingsHistory(leagueId, seasonYear)`, renders breadcrumb and `HistoryClient`.
- **Client component** (`standings/history/history-client.tsx`): Recharts `LineChart` with one `Line` per team (user's team at `strokeWidth=3`, others at `strokeWidth=1.5`). Race-by-race `Table` with teams as rows, races as columns, horizontally scrollable with sticky first column.
- **League overview** (`leagues/[leagueId]/page.tsx`): Standings `CardHeader` updated to flex row with "Season History →" link on the right side.
- **shadcn chart component** installed via CLI; recharts added to dependencies.

## Empty State

When `history.races.length === 0`, a centered card shows: "No races have been completed yet. Check back after the first results are posted."

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

### Files Exist
- src/app/(main)/leagues/[leagueId]/standings/history/page.tsx: FOUND
- src/app/(main)/leagues/[leagueId]/standings/history/history-client.tsx: FOUND
- src/components/ui/chart.tsx: FOUND
- src/app/(main)/leagues/[leagueId]/page.tsx modified: FOUND

### Commits Exist
- 85a7d86: chore(19-02): install shadcn chart component
- e62f0fd: feat(19-02): create Season History page and client component
- c0e064a: feat(19-02): add Season History link to league overview Standings card

## Self-Check: PASSED

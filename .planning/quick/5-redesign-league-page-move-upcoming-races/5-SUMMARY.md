---
phase: quick-5
plan: 01
subsystem: ui/league
tags: [league-overview, home-page, accordion, ui-redesign]
dependency_graph:
  requires: [src/db/schema/lineups.ts, src/db/schema/leagues.ts, src/db/schema/races.ts, src/db/schema/results.ts, src/db/schema/draft.ts]
  provides: [src/lib/league-overview-queries.ts]
  affects: [src/app/(main)/home/page.tsx, src/app/(main)/leagues/[leagueId]/page.tsx]
tech_stack:
  added: []
  patterns: [ownership-at-race-time, accordion-disclosure, consolidated-actions-card]
key_files:
  created:
    - src/lib/league-overview-queries.ts
  modified:
    - src/app/(main)/home/page.tsx
    - src/app/(main)/leagues/[leagueId]/page.tsx
decisions:
  - Map type annotation required explicit generic params to avoid TypeScript implicit any propagation in nested riders arrays
  - Split Promise.all call into two separate calls (standings/riders/races vs upcoming/recent) to preserve strict typing
  - Used const intermediate variables instead of destructuring assignment to avoid union type inference loss
metrics:
  duration: ~420s
  completed: 2026-03-06
  tasks_completed: 2
  files_modified: 3
---

# Phase quick-5 Plan 01: League Page Redesign + Home Page Simplification Summary

**One-liner:** Simplified home page to leagues-only view + redesigned league overview with consolidated Actions card, upcoming race lineup accordions (per-team), and recent result accordions with fantasy team badges.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Strip home page race sections + create league-overview-queries.ts | e3190dc | src/app/(main)/home/page.tsx, src/lib/league-overview-queries.ts |
| 2 | Redesign league overview with Actions card + accordions | 44de3e6 | src/app/(main)/leagues/[leagueId]/page.tsx, src/lib/league-overview-queries.ts |

## What Was Built

### Home Page (simplified)
- Removed: "Upcoming Races" section (parent race cards)
- Removed: "Latest Results" section (rider result cards)
- Removed: "Completed Races" section (race summary cards)
- Removed all related imports: `raceResults`, `riders`, `races`, `gte`, `isNotNull`, `asc`, `isSameDay`, `format`, `lt`, `desc` (from date queries)
- Kept: "Your Leagues" cards section with status badges and "Go to Draft" quick action

### league-overview-queries.ts (new file)
Two query functions:
1. `getUpcomingRacesWithLineups(leagueId)` — upcoming parent races assigned to league (startDate > now, limit 5) with all teams and their submitted lineups
2. `getRecentRaceResults(leagueId)` — 3 most recent completed parent races with rider results tagged by fantasy team (ownership-at-race-time via draftPicks.pickedAt <= races.startDate inner join)

### League Overview Page (redesigned)
- **Standings card**: unchanged
- **Actions card**: NEW — single card with all navigation rows (Draft, Transfers, Set Lineup, Orders, League Settings for owners). Replaces 4-5 separate cards.
- **Upcoming Races section**: NEW — shadcn Accordion (type="multiple") showing per-race per-team lineup pills. Shows "(no lineup set)" for teams with empty lineups.
- **Recent Results section**: NEW — shadcn Accordion showing riders with position, points, and fantasy team Badge per row.
- **Team Roster card**: unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript implicit any from untyped Map default**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** `raceTeamMap.get(race.raceId) ?? new Map()` created an untyped `Map<unknown, unknown>`, causing `riders` array elements to be `any` in JSX
- **Fix:** Added explicit generic type annotation `new Map<number, { riderId: number; riderName: string; riderTeam: string }[]>()` as the default variable, and typed the fallback `[]` with `as { riderId: number; riderName: string; riderTeam: string }[]`
- **Files modified:** src/lib/league-overview-queries.ts
- **Commit:** 44de3e6

**2. [Rule 1 - Bug] Promise.all destructuring lost type specificity**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** Destructuring assignment `[standings, myTeamRiders, races, upcomingRaces, recentResults] = await Promise.all([...])` with mixed return types caused TypeScript to widen `upcomingRaces` to `any`
- **Fix:** Split into two separate `Promise.all` calls and used const intermediate variables for the typed results
- **Files modified:** src/app/(main)/leagues/[leagueId]/page.tsx
- **Commit:** 44de3e6

## Self-Check: PASSED

All files confirmed present:
- FOUND: src/lib/league-overview-queries.ts
- FOUND: src/app/(main)/home/page.tsx
- FOUND: src/app/(main)/leagues/[leagueId]/page.tsx

All commits confirmed:
- FOUND: e3190dc (Task 1 — strip home page + create league-overview-queries)
- FOUND: 44de3e6 (Task 2 — redesign league overview page)

TypeScript: `npx tsc --noEmit` passes with zero errors.

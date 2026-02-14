---
phase: 05-scoring-points-system
plan: 02
subsystem: ui
tags: [drizzle-orm, postgres, next.js, shadcn, tabs, standings, race-breakdown, navigation]

# Dependency graph
requires:
  - phase: 05-01
    provides: scoring-queries.ts with getLeagueStandings/getTeamRiderScores, standings page with two tabs
  - phase: 04-live-draft-system
    provides: draftPicks table for multi-tenant rider-to-team mapping
  - phase: 02-admin-backoffice-race-calendar
    provides: races/raceResults schema used in new queries

provides:
  - getRaceScoreBreakdown and getLeagueRacesWithScores query functions
  - RaceScoreEntry and LeagueRaceScore types
  - /leagues/[leagueId]/standings/[raceId] per-race breakdown route
  - Race Results tab on standings page with links to per-race breakdown
  - League Standings card on league detail page for active/complete leagues

affects:
  - any future phase adding race breakdown features (route already established)
  - league detail page now shows standings entry point for active/complete leagues

# Tech tracking
tech-stack:
  added: []
  patterns:
    - INNER JOIN from raceResults outward for breakdown (only show drafted riders who raced)
    - INNER JOIN draftPicks with AND(riderId, leagueId) for multi-tenant isolation
    - GROUP BY races columns for per-race aggregate in getLeagueRacesWithScores
    - Per-team subtotals derived in JS Map (reduce over breakdown array)
    - formatRaceType helper splits snake_case enum to Title Case for display

key-files:
  created:
    - src/app/(main)/leagues/[leagueId]/standings/[raceId]/page.tsx
  modified:
    - src/lib/scoring-queries.ts
    - src/app/(main)/leagues/[leagueId]/standings/page.tsx
    - src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx
    - src/app/(main)/leagues/[leagueId]/page.tsx

key-decisions:
  - "INNER JOIN from raceResults (not teams) for breakdown — only drafted riders who actually raced appear"
  - "Per-team subtotals computed in JS Map over breakdown rows rather than a second SQL query"
  - "formatRaceType helper converts snake_case enum values to human-readable Title Case in client"
  - "Standings card uses green background button to distinguish from yellow draft button"

patterns-established:
  - "Parallel DB fetch + JS-side aggregation for summary cards (getRaceScoreBreakdown + Map reduce)"
  - "Route param parsing with isNaN guard before DB access"

# Metrics
duration: ~6min
completed: 2026-02-14
---

# Phase 5 Plan 2: Per-Race Breakdown, Race Results Tab, and Standings Navigation Summary

**Per-race breakdown page with INNER JOIN queries, Race Results tab linked to breakdowns, and a Standings card on the league detail page completing the scoring navigation flow**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-14T07:00:04Z
- **Completed:** 2026-02-14T07:06:21Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `getRaceScoreBreakdown(raceId, leagueId)` — INNER JOIN query returning drafted riders who scored in a specific race with position, points, rider/team names
- `getLeagueRacesWithScores(leagueId, season)` — INNER JOIN + GROUP BY query returning races with at least one drafted rider result, aggregating total league points per race
- Per-race breakdown page at `/leagues/[leagueId]/standings/[raceId]` with auth guard, status guard, scored-rider table, and per-team subtotals card
- Race Results tab on standings page with race name links, type badge, formatted date, league points columns
- "League Standings" card on league detail page visible for active/complete leagues only

## Task Commits

1. **Task 1: Add race score queries and per-race breakdown page** - `9128ef3` (feat)
2. **Task 2: Add Race Results tab and wire standings into league page** - `3d935c5` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/lib/scoring-queries.ts` — Added getRaceScoreBreakdown, getLeagueRacesWithScores, RaceScoreEntry, LeagueRaceScore exports
- `src/app/(main)/leagues/[leagueId]/standings/[raceId]/page.tsx` — New per-race breakdown page
- `src/app/(main)/leagues/[leagueId]/standings/page.tsx` — Fetch races via getLeagueRacesWithScores, pass to client
- `src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx` — Third tab (Race Results) with formatted table and links
- `src/app/(main)/leagues/[leagueId]/page.tsx` — Standings card for active/complete leagues

## Decisions Made
- INNER JOIN from `raceResults` outward for breakdown query — only drafted riders who actually finished the race appear (not all drafted riders like in the standings query which uses LEFT JOIN from teams)
- Per-team subtotals computed in JS with a `Map` reduce over the breakdown array rather than a second SQL GROUP BY query — keeps it simple and avoids an extra round-trip
- `formatRaceType` helper in the client converts snake_case enum values (e.g. `grand_tour`) to human-readable Title Case — avoids storing display strings in the DB
- Standings card uses a green (`bg-green-600`) button to visually distinguish it from the yellow draft button already on the page

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Complete scoring navigation flow is live: league detail -> standings -> per-race breakdown
- scoring-queries.ts now exports 4 functions (getLeagueStandings, getTeamRiderScores, getRaceScoreBreakdown, getLeagueRacesWithScores)
- Phase 5 complete — scoring system is fully navigable for active/complete leagues

## Self-Check: PASSED

- FOUND: src/lib/scoring-queries.ts
- FOUND: src/app/(main)/leagues/[leagueId]/standings/[raceId]/page.tsx
- FOUND: src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx
- FOUND: src/app/(main)/leagues/[leagueId]/standings/page.tsx
- FOUND: src/app/(main)/leagues/[leagueId]/page.tsx
- FOUND commit: 9128ef3 (Task 1)
- FOUND commit: 3d935c5 (Task 2)

---
*Phase: 05-scoring-points-system*
*Completed: 2026-02-14*

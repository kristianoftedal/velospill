---
phase: 05-scoring-points-system
plan: 01
subsystem: ui
tags: [drizzle-orm, postgres, next.js, shadcn, tabs, standings, aggregation]

# Dependency graph
requires:
  - phase: 04-live-draft-system
    provides: draftPicks table with teamId/leagueId/riderId — the foundation for scoring
  - phase: 03-league-schema
    provides: teams/leagues schema and getLeagueDetails auth guard
  - phase: 02-admin-backoffice-race-calendar
    provides: races/raceResults schema with points column

provides:
  - scoring-queries.ts library: getLeagueStandings and getTeamRiderScores functions
  - LeagueStanding and TeamRiderScore types
  - /leagues/[leagueId]/standings route with Leaderboard and My Team tabs

affects:
  - future phases adding order multipliers (TODO comment left in scoring-queries.ts)
  - any UI linking to standings from the league detail page

# Tech tracking
tech-stack:
  added: []
  patterns:
    - LEFT JOIN from teams outward so zero-point teams always appear in standings
    - Season scoping via JOIN condition on races.season (not WHERE) to preserve LEFT JOIN semantics
    - leagueId on draftPicks JOIN condition for multi-tenant isolation (not just teamId)
    - Rank derived in JS with tie-handling logic (not SQL RANK() to avoid dialect complexity)
    - COALESCE(SUM(...), 0) pattern for null-safe aggregation

key-files:
  created:
    - src/lib/scoring-queries.ts
    - src/app/(main)/leagues/[leagueId]/standings/page.tsx
    - src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx
  modified: []

key-decisions:
  - "Season scoping applied in JOIN condition (not WHERE) to preserve LEFT JOIN zero-point team semantics"
  - "Rank derived in JS array map with tie-handling rather than SQL RANK() window function"
  - "leagueId included in draftPicks JOIN condition (not just teamId) for explicit multi-tenant isolation"
  - "Status guard blocks standings for setup/drafting leagues with informative message and back link"
  - "StandingsClient receives userTeamId (not just userTeamName) to highlight current user's row"

patterns-established:
  - "Aggregation queries: LEFT JOIN from the anchor table outward, COALESCE SUM, season via JOIN"
  - "Server page pattern: auth guard via getLeagueDetails, status guard, parallel data fetch"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 5 Plan 1: Scoring Aggregation and Standings Page Summary

**Drizzle LEFT JOIN aggregation query library with tabbed standings page showing ranked leaderboard and per-rider team scores, season-scoped via races.season JOIN condition**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-14T06:31:25Z
- **Completed:** 2026-02-14T06:34:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `scoring-queries.ts` library with `getLeagueStandings` and `getTeamRiderScores` aggregation functions using Drizzle ORM LEFT JOINs
- Season scoping via `races.season` in JOIN condition (preserves LEFT JOIN semantics so zero-point teams appear)
- Standings page at `/leagues/[leagueId]/standings` with auth guard and status guard for non-active leagues
- Tabbed client UI: Leaderboard (rank 1/2/3 gold/silver/bronze accents, user row blue-highlighted) and My Team (rider name, pro team, gender badge, points)

## Task Commits

1. **Task 1: Create scoring-queries.ts with aggregation functions** - `501f94e` (feat)
2. **Task 2: Create standings page with Leaderboard and My Team tabs** - `2668531` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/lib/scoring-queries.ts` - Scoring aggregation query library; exports getLeagueStandings, getTeamRiderScores, LeagueStanding, TeamRiderScore
- `src/app/(main)/leagues/[leagueId]/standings/page.tsx` - Server component with auth guard, status guard, parallel data fetch
- `src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx` - Client component with shadcn Tabs, Table, Badge

## Decisions Made
- Season scoping via JOIN condition `eq(races.season, season)` rather than WHERE clause to preserve LEFT JOIN semantics (zero-point teams would disappear if put in WHERE)
- Rank derived in JS with tie-handling (if points equal previous row, inherit previous row's rank) rather than SQL RANK() window function
- `leagueId` included in the `draftPicks` JOIN condition explicitly for multi-tenant correctness — ensures picks from other leagues can't bleed in even if the teamId happened to match
- `StandingsClient` receives `userTeamId: number | null` (not just name) so the leaderboard row can highlight the current user's team with `bg-blue-50`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Standings route is live and accessible for active/complete leagues
- Phase 5 Plan 2 can add navigation links from the league detail page to `/standings`
- `// TODO: apply order multipliers when orders/bids system is built` comment is in scoring-queries.ts for future reference

## Self-Check: PASSED

- FOUND: src/lib/scoring-queries.ts
- FOUND: src/app/(main)/leagues/[leagueId]/standings/page.tsx
- FOUND: src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx
- FOUND: .planning/phases/05-scoring-points-system/05-01-SUMMARY.md
- FOUND commit: 501f94e (Task 1)
- FOUND commit: 2668531 (Task 2)

---
*Phase: 05-scoring-points-system*
*Completed: 2026-02-14*

---
phase: 08-ui-polish-let-admins-pick-races-from-global-list-to-leagues-they-admin
plan: 01
subsystem: database
tags: [postgres, drizzle-orm, schema, migration, neon]

# Dependency graph
requires:
  - phase: 03-league-management
    provides: leagues table and leaguesRelations
  - phase: 02-admin-backoffice-race-calendar
    provides: races table and raceTypeEnum
provides:
  - leagueRaces join table in Neon with leagueId + raceId columns and unique constraint
  - leagueRaces and leagueRacesRelations exported from schema barrel
  - All existing leagues pre-populated with their season parent races
affects:
  - 08-02 (race picker UI queries league_races)
  - any query scoping races per-league

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pool.connect() for DDL migrations to Neon (established in 06-01)
    - pgTable with uniqueIndex for join tables
    - ON CONFLICT DO NOTHING for idempotent pre-population

key-files:
  created: []
  modified:
    - src/db/schema/leagues.ts

key-decisions:
  - "leagueRaces uses serial PK + unique index on (leagueId, raceId) matching teams table pattern"
  - "addedAt timestamp captures when admin added race to league (future audit)"
  - "ON CASCADE DELETE on both FKs: deleting league or race cleans up join rows"
  - "Pre-population uses config->>'seasonYear' JSONB extraction to match race.season for each league"

patterns-established:
  - "Join table pattern: serial PK + uniqueIndex on composite + individual column indexes + addedAt"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 08 Plan 01: League Races Join Table Summary

**`league_races` join table added to Drizzle schema and Neon DB, pre-populated with 8 rows across 4 leagues (2 parent races per league for their 2025 season)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-16T06:57:50Z
- **Completed:** 2026-02-16T06:59:08Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `leagueRaces` pgTable with `leagueId` FK, `raceId` FK, `addedAt` timestamp, unique index, and two per-column indexes
- Added `leagueRacesRelations` linking to `leagues` and `races` tables via Drizzle relations
- Updated `leaguesRelations` to include `many(leagueRaces)` for bidirectional query support
- Applied DDL to Neon via Pool.connect() migration script — `league_races` table live with all 3 indexes
- Pre-populated 8 league_races rows: 4 leagues x 2 parent races each (2025 season)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add leagueRaces table and relations to schema** - `be09af5` (feat)
2. **Task 2: Apply DDL migration and pre-populate existing leagues** - `98f0233` (chore)

**Plan metadata:** (committed in final docs commit)

## Files Created/Modified
- `src/db/schema/leagues.ts` - Added `import { races }`, `leagueRaces` table, `leagueRacesRelations`, and updated `leaguesRelations` to include `many(leagueRaces)`

## Decisions Made
- Used `serial("id").primaryKey()` matching existing tables (teams, leagues) rather than any identity pattern
- `addedAt` timestamp included for future admin audit of when races were assigned
- `ON DELETE CASCADE` on both FKs: if a league is deleted, its race assignments go with it; if a race is removed, its league assignments clean up
- Pre-population uses `(l.config->>'seasonYear')::integer` JSONB extraction matching race.season — works because all existing leagues have `seasonYear: 2025` in their JSONB config

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Table is live in Neon.

## Next Phase Readiness
- `league_races` table is live in Neon with correct schema and indexes
- `leagueRaces` and `leagueRacesRelations` are exported from schema barrel via `export * from "./leagues"`
- All 4 existing leagues pre-populated with their season's parent races
- Ready for 08-02: race picker UI — admin can add/remove races from a league's list

---
*Phase: 08-ui-polish-let-admins-pick-races-from-global-list-to-leagues-they-admin*
*Completed: 2026-02-16*

## Self-Check: PASSED

- FOUND: src/db/schema/leagues.ts
- FOUND: .planning/phases/08-ui-polish-.../08-01-SUMMARY.md
- FOUND: commit be09af5 (Task 1)
- FOUND: commit 98f0233 (Task 2)
- FOUND: leagueRaces exported from leagues.ts
- FOUND: leagueRacesRelations exported from leagues.ts

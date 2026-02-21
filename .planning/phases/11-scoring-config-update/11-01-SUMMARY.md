---
phase: 11-scoring-config-update
plan: 01
subsystem: database
tags: [scoring, configuration, data-migration, drizzle-orm, 2026-season]

# Dependency graph
requires:
  - phase: 05-scoring-points
    provides: scoringConfig table schema with JSONB rules field
provides:
  - Complete 2026 scoring configuration seed data with TdF-specific entries
  - Migration script for updating existing production data
  - grand_tour_tdf raceType for Tour de France distinct scoring
affects: [12-result-entry-expansion, scoring-calculation, race-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSONB scoring rules with flexible raceType text field (no schema changes needed)
    - Data-only updates via seed and migration scripts
    - Transaction-wrapped migrations with dry-run support

key-files:
  created:
    - src/db/migrate-scoring-2026.ts
  modified:
    - src/db/seed-scoring.ts

key-decisions:
  - "Use grand_tour_tdf as new raceType value for TdF-specific scoring (no schema change needed since raceType is text, not enum)"
  - "Remove tdf_stage_bonus and sprint_double categories, replace with dedicated TdF entries and sprint_giro"
  - "Extend mini tour end_gc to 8 positions to match 2026 ruleset"

patterns-established:
  - "Migration scripts use dry-run flag for safe preview before production execution"
  - "All migration operations wrapped in transactions for atomicity"
  - "Console logging for each migration operation for audit trail"

requirements-completed:
  - SCORE-01
  - SCORE-02
  - SCORE-03
  - SCORE-04
  - SCORE-05
  - SCORE-06
  - SCORE-07
  - SCORE-08
  - SCORE-09
  - SCORE-10

# Metrics
duration: 212s
completed: 2026-02-21
---

# Phase 11 Plan 01: Scoring Config 2026 Update Summary

**2026 scoring ruleset with TdF-specific entries using grand_tour_tdf raceType, updated one-day race point tables (50 for 1st in high-priority), and mini tour extensions**

## Performance

- **Duration:** 3m 32s
- **Started:** 2026-02-21T09:18:01Z
- **Completed:** 2026-02-21T09:21:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Updated all scoring configuration seed data to 2026 ruleset values
- Created 19 TdF-specific scoring entries with grand_tour_tdf raceType
- Built comprehensive migration script with 10 updates, 3 deletes, 20 inserts
- No schema changes required (scoringConfig.raceType is text field)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update seed-scoring.ts with 2026 scoring config values** - `3eccff2` (feat)
2. **Task 2: Create migration script for existing DB scoring data** - `b4c4c85` (feat)

## Files Created/Modified
- `src/db/seed-scoring.ts` - Updated all scoring entries to 2026 values, added grand_tour_tdf entries for TdF
- `src/db/migrate-scoring-2026.ts` - Migration script to update existing DB data with dry-run support

## Decisions Made

**1. Use grand_tour_tdf as new raceType for Tour de France**
- Rationale: scoringConfig.raceType is a text field (not enum), so we can add new values without schema migration
- Impact: Plan 02 will map race names to appropriate raceType (e.g., "Tour de France" → grand_tour_tdf)
- Alternative considered: Using flags/metadata in existing grand_tour entries (rejected - less clean separation)

**2. Remove tdf_stage_bonus and sprint_double categories**
- Rationale: 2026 rules replace these with dedicated TdF entries and Giro-specific sprint handling
- Impact: Cleaner data model with explicit per-race-type entries
- Migration: DELETE operations in migration script remove obsolete entries

**3. Extend mini tour end_gc to 8 positions**
- Rationale: 2026 ruleset specifies 8 positions for mini tour GC final classification
- Impact: More riders score end-of-tour points in mini tours
- Values: 8/6/4/3/2/2/1/1 (positions 6 and 8 both award multiple points)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all scoring updates were straightforward data changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 11 Plan 02:** Scoring lookup code update
- All 2026 scoring values are in seed data
- Migration script ready for production DB update
- grand_tour_tdf entries created for all TdF categories (stage finish, sprint, KOM, jerseys, end-of-tour)

**Blockers:** None

**Testing note:** Migration script includes dry-run mode for safe testing before production execution. Database connection required to test (expects DATABASE_URL env var).

---
*Phase: 11-scoring-config-update*
*Completed: 2026-02-21*

## Self-Check: PASSED

All claimed files and commits verified:
- src/db/seed-scoring.ts: FOUND
- src/db/migrate-scoring-2026.ts: FOUND
- Commit 3eccff2: FOUND
- Commit b4c4c85: FOUND

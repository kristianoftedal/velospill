# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.

**Current focus:** Phase 12 - Result Entry Expansion

## Current Position

Phase: 12 of 15 (Result Entry Expansion)
Plan: 1 of 2
Status: In Progress
Last activity: 2026-02-21 — Completed plan 12-01 (category support backend)

Progress: [████████████████░░░░] 73% (11 of 15 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 30 (26 v1.0 + 4 v1.1)
- Average duration: 152s (v1.1 tracked)
- Total execution time: 11 days (v1.0 milestone) + 606s (v1.1)

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 2. Admin Backoffice | 4 | Complete |
| 3. League Management | 3 | Complete |
| 4. Live Draft System | 4 | Complete |
| 5. Scoring & Points | 2 | Complete |
| 6. Transfer Market | 4 | Complete |
| 7. Strategic Orders | 5 | Complete |
| 8. UI Polish & Races | 3 | Complete |
| 9. Scoping & UX Fixes | 1 | Complete |

**By Phase (v1.1):**

| Phase | Plan | Duration | Files | Commits | Completed |
|-------|------|----------|-------|---------|-----------|
| 10. Bug Fixes | 10-01 | 114s | 3 | 2 | 2026-02-20 |
| 11. Scoring Config Update | 11-01 | 212s | 2 | 2 | 2026-02-21 |
| 11. Scoring Config Update | 11-02 | 110s | 2 | 2 | 2026-02-21 |
| 12. Result Entry Expansion | 12-01 | 170s | 3 | 2 | 2026-02-21 |

**Recent Trend:**
- v1.0 milestone: Shipped successfully
- v1.1 milestone: In progress (4 plans completed)

## Accumulated Context

### Decisions

Recent decisions from PROJECT.md:

- Phase 1: Better Auth over NextAuth (simpler Drizzle integration)
- Phase 1: JSONB scoring config in DB (flexibility for rule changes)
- Phase 4: Pusher for real-time draft (presence channels, serverless-compatible)
- Phase 4: QStash for auto-pick timer (serverless-friendly delayed execution)
- Phase 5: On-demand SQL aggregation for scoring (no materialized views)
- Phase 6: Waiver wire transfers with ownership-at-race-time scoring
- Phase 7: 12 strategic order types with counter mechanics
- Phase 8: league_races join table for per-league race scoping

**v1.1 decisions:**

- Phase 10 (10-01): Use literal SQL table names instead of Drizzle interpolation for EXISTS subqueries to avoid resolution failures
- Phase 10 (10-01): Use Set for O(1) drafted rider lookup instead of array includes for performance
- Phase 10 (10-01): Query all leagues' draft picks globally (not per-league) for unassigned filter simplicity
- Phase 11 (11-01): Use grand_tour_tdf as new raceType for TdF-specific scoring (no schema change needed since raceType is text field)
- Phase 11 (11-01): Remove tdf_stage_bonus and sprint_double categories, replace with dedicated TdF entries and sprint_giro
- Phase 11 (11-01): Extend mini tour end_gc to 8 positions to match 2026 ruleset
- Phase 11 (11-02): Use race name pattern matching (includes 'tour de france' or 'tdf') to detect TdF races for scoring config routing
- Phase 11 (11-02): Explicitly type raceTypeForScoring as string to allow grand_tour_tdf value beyond races enum
- Phase 11 (11-02): Add fallback to grand_tour config if TdF-specific config is missing for backward compatibility
- Phase 12 (12-01): Use category column with default 'finish' for backward compatibility
- Phase 12 (12-01): Unique constraints scoped by category (raceId, riderId, category) and (raceId, position, category)
- Phase 12 (12-01): Optional category parameter in previewScoringImpact preserves auto-detection when not provided
- Phase 12 (12-01): Stage results without explicit category default to 'stage_finish' as before

### Pending Todos

None yet.

### Blockers/Concerns

**Known from v1.0 limitations:**
- Hammer/Innlagt Spurt/Lagtempo orders use admin-entered bonus points (deferred to future)
- Shimanobil counter uses simplified team matching (deferred to future)
- npm run build fails due to drizzle-kit 0.18.x type error (out of v1.1 scope)

**v1.1 scope:**
- Phase 10: Fix rider filtering bugs before admin workflows can proceed (DONE)
- Phase 11: Scoring config changes are seed data only (no schema changes expected) (DONE)
- Phase 12: Result entry expansion requires schema changes for new categories (IN PROGRESS - backend done, UI pending)
- Phase 15: Uno-X order requires reverse standings draft UI (similar to phase 4 draft)

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed plan 12-01 (category support backend)
Resume file: None

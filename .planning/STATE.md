# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.

**Current focus:** Phase 10 - Bug Fixes

## Current Position

Phase: 10 of 15 (Bug Fixes)
Plan: 1 of TBD
Status: In progress
Last activity: 2026-02-20 — Completed plan 10-01 (rider workflow bug fixes)

Progress: [████████████████░░░░] 60% (9 of 15 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 27 (26 v1.0 + 1 v1.1)
- Average duration: Not tracked (v1.0 pre-metrics)
- Total execution time: 11 days (v1.0 milestone)

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

**Recent Trend:**
- v1.0 milestone: Shipped successfully
- v1.1 milestone: In progress (1 plan completed)

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

### Pending Todos

None yet.

### Blockers/Concerns

**Known from v1.0 limitations:**
- Result entry only supports finish/stage_finish categories (Phase 12 will address)
- Hammer/Innlagt Spurt/Lagtempo orders use admin-entered bonus points (deferred to future)
- Shimanobil counter uses simplified team matching (deferred to future)
- npm run build fails due to drizzle-kit 0.18.x type error (out of v1.1 scope)

**v1.1 scope:**
- Phase 10: Fix rider filtering bugs before admin workflows can proceed
- Phase 11: Scoring config changes are seed data only (no schema changes expected)
- Phase 12: Result entry expansion requires schema changes for new categories
- Phase 15: Uno-X order requires reverse standings draft UI (similar to phase 4 draft)

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed plan 10-01 (rider workflow bug fixes)
Resume file: None

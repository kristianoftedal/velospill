# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.

**Current focus:** v1.2 Player Visibility — Phase 17: Team Profile Page

## Current Position

Phase: 17 — Team Profile Page
Plan: 02 (complete) — Phase 17 complete, ready for Phase 18
Status: Complete (2 of 2 plans complete)
Last activity: 2026-03-03 — 17-02 complete: team profile page UI with accordion roster + standings links

Progress: [████████████████████] 100.0% (15 of 15 v1.0+v1.1 phases complete) | v1.2: 1 of 4 phases complete (Phase 17)

## Performance Metrics

**Velocity:**
- Total plans completed: 38 (26 v1.0 + 12 v1.1)
- Average duration: 165s (v1.1 tracked)
- Total execution time: 11 days (v1.0 milestone) + 2029s (v1.1)

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
| 12. Result Entry Expansion | 12-02 | 223s | 3 | 2 | 2026-02-21 |
| 12. Result Entry Expansion | 12-03 | 198s | 3 | 2 | 2026-02-21 |
| 13. Order Config Updates | 13-01 | 156s | 2 | 2 | 2026-02-22 |
| 13. Order Config Updates | 13-02 | 169s | 2 | 2 | 2026-02-22 |
| 14. Counter Mechanic Return Logic | 14-01 | 154s | 3 | 3 | 2026-02-22 |
| 15. Uno-X Order Feature | 15-01 | 122s | 5 | 2 | 2026-02-22 |
| 15. Uno-X Order Feature | 15-02 | 168s | 2 | 2 | 2026-02-22 |
| 15. Uno-X Order Feature | 15-03 | 233s | 7 | 2 | 2026-02-22 |

**Recent Trend:**
- v1.0 milestone: Shipped successfully (2026-02-20)
- v1.1 milestone: Shipped successfully (2026-02-26) — 6 phases, 12 plans, 2029s total execution
- v1.2 milestone: Roadmap created (2026-02-26) — 4 phases, ready for planning
- v1.2 Phase 16-01: Complete (2026-02-27) — 58s, 1 task, 1 file
- v1.2 Phase 17-01: Complete (2026-03-02) — 83s, 1 task, 1 file
- v1.2 Phase 17-02: Complete (2026-03-03) — 3 tasks, 3 files — TEAM-01 + TEAM-02 delivered

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
- Phase 12 (12-02): Category picker shows available categories based on race type and stage status
- Phase 12 (12-02): Grand Tour stages show sprint, mountain (GT-specific), jersey, and TTT categories
- Phase 12 (12-02): TdF detection uses race name pattern matching for category filtering
- Phase 12 (12-02): Results grouped by category with human-readable labels from categoryDisplayNames map
- Phase 12 (12-02): After submitting results, admin returns to category picker to enter more categories
- Phase 12 (12-03): TTT results entered by team placement, expanded to individual rider results
- Phase 12 (12-03): TTT entry uses team name selectors instead of rider selectors
- Phase 12 (12-03): End-of-tour categories validated to only work on parent races (not stages)
- Phase 12 (12-03): Team names loaded per-race based on gender for TTT entry
- Phase 12 (12-03): All scoring categories now enterable via admin UI with full preview support
- Phase 13 (13-01): Migration script uses @neondatabase/serverless Pool for consistency with project DB setup
- Phase 13 (13-01): Order type updates wrapped in single transaction for atomicity
- Phase 13 (13-01): Migration supports dry-run mode for safe testing before production execution
- Phase 13 (13-02): Etappeseier now multiplies ALL own riders' finish points (not limited to top-10 positions)
- Phase 13 (13-02): Sponsorens ritt uses configurable multiplier (3x) instead of hardcoded 2x
- Phase 13 (13-02): Kaptein works for both World Championship and women's one-day races
- Phase 13 (13-02): Blodpose GT multiplier resolution already handles per-GT values via existing effectValues code path
- Phase 14 (14-01): Remove blowback fields from CounterResult type (down to 3 fields)
- Phase 14 (14-01): Counter descriptions now say "order returned to attacker for reuse"
- Phase 14 (14-01): No penalty applied to attacking team when countered (2026 rules)
- Phase 14 (14-01): Counter results displayed with blue neutral styling instead of yellow warning
- Phase 15 (15-01): Bonus rider picks stored in dedicated bonus_riders table (not in orders or draft_picks)
- Phase 15 (15-01): Unique constraint on (leagueId, raceId, teamId) enforces one bonus rider per team per GT
- Phase 15 (15-01): Optional orderId reference links bonus rider back to Uno-X order that triggered draft
- Phase 15 (15-01): Migration script combines DDL + seed data in single atomic transaction
- Phase 15 (15-02): Bonus rider points queried separately and merged into standings (not via LEFT JOIN on main query)
- Phase 15 (15-02): Race matching uses OR(eq(races.id, bonusRiders.raceId), eq(races.parentRaceId, bonusRiders.raceId)) for GT stages
- Phase 15 (15-02): Standings re-ranked after adding bonus points to account for point changes
- Phase 15 (15-02): TeamRiderScore type extended with optional isBonus field for UI distinction
- Phase 15 (15-03): Admin UI loads draft state on mount via server action for fresh data per request
- Phase 15 (15-03): Team page pre-computes draft state server-side to avoid client async complexity
- Phase 15 (15-03): Turn validation enforced server-side via pick count check (expectedPicksCount === pickOrder - 1)
- Phase 15 (15-03): Bonus Draft Active badge added to My Orders table for visual feedback
- [Phase 16-01]: Three separate queries instead of one massive join for getRiderSeasonProfile — improves readability and maintainability
- [Phase 16-01]: Application-side grouping of race results by raceId instead of SQL JSON_AGG — simpler, portable, and debuggable
- [Phase 16-01]: Ownership resolution iterates pickedAt <= startDate per league in memory, keeping latest pick — matches ownership-at-race-time pattern from Phase 6
- [Phase 17-01]: Three-query pattern for getTeamSeasonProfile: team metadata, per-rider per-race results with lineupFilter, bonus riders — same as getRiderSeasonProfile for consistency
- [Phase 17-01]: lineupFilter copied verbatim from scoring-queries.ts to ensure lineup-aware scoring matches standings calculation exactly
- [Phase 17-01]: Application-side grouping via nested Map (riderId → raceMap → categories) instead of SQL JSON_AGG — simpler and consistent with Phase 16 pattern
- [Phase 17-02]: Server page parses leagueId and teamId from params, calls notFound() on NaN or missing profile — same guard pattern as rider profile page
- [Phase 17-02]: TeamProfileClient uses shadcn Accordion (type=single collapsible) for per-rider race breakdown — consistent with Phase 16 UI style
- [Phase 17-02]: Rider names in accordion trigger are Links to /riders/[riderId] with stopPropagation to prevent accordion toggle on link click
- [Phase 17-02]: Standings team name column wraps existing text in a Link to /leagues/[leagueId]/teams/[teamId] with minimal styling change only

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | admin add results improvements: sort races by date ascending, prefill results by category, searchable rider dropdown showing name | 2026-03-03 | 19461d9 | [1-admin-add-results-improvements-sort-race](./quick/1-admin-add-results-improvements-sort-race/) |
| 2 | PCS import: scrape procyclingstats results page, fuzzy match riders, populate form | 2026-03-04 | 4f3d9e2 | [2-pcs-import-scrape-procyclingstats-result](./quick/2-pcs-import-scrape-procyclingstats-result/) |
| 3 | Admin results: open form in dialog modal, fix stage dedup, switch to firstcycling.com import, fix rider/team search filtering | 2026-03-04 | b6d919f | [3-admin-results-open-form-in-modal-fix-sta](./quick/3-admin-results-open-form-in-modal-fix-sta/) |
| 4 | Fix SQL error when submitting TTT race results: move SELECT outside transaction + add replace logic | 2026-03-05 | d83e1ad | [4-fix-sql-error-when-submitting-race-resul](./quick/4-fix-sql-error-when-submitting-race-resul/) |
| 5 | Redesign league page: consolidated Actions card, upcoming races with per-team lineup accordions, recent results with fantasy team badges; remove race sections from home page | 2026-03-06 | 44de3e6 | [5-redesign-league-page-move-upcoming-races](./quick/5-redesign-league-page-move-upcoming-races/) |
| 6 | Fix admin results: Add More Results button broken due to ternary priority over existingResults | 2026-03-06 | a6b688c | [6-fix-admin-results-add-more-results-butto](./quick/6-fix-admin-results-add-more-results-butto/) |
| 7 | Improve league page Actions: replace card-with-rows with inline button row, move before Standings, hide View Draft after 5 days | 2026-03-06 | 32f1b08 | [7-improve-league-page-actions-card-row-of-](./quick/7-improve-league-page-actions-card-row-of-/) |

### Blockers/Concerns

**Known from v1.0 limitations:**
- Hammer/Innlagt Spurt/Lagtempo orders use admin-entered bonus points (deferred to future)
- Shimanobil counter uses simplified team matching (deferred to future)
- npm run build fails due to drizzle-kit 0.18.x type error (out of v1.1 scope)

**v1.2 scope:**
- Phase 16: Build rider profile page — requires querying race results + scoring data across all races for a single rider
- Phase 17: Build team profile page — requires per-rider, per-race scoring breakdown for all riders on a team
- Phase 18: Add lineup accordion to league race list — requires querying submitted lineups per race
- Phase 19: Add standings history to league page — requires cumulative points aggregation across all races

## Session Continuity

Last session: 2026-03-03
Last activity: 2026-03-06 - Completed quick task 7: improve league page actions — compact button row, first position, View Draft hidden after 5 days
Resume file: None

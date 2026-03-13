---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Multi-Stage Race Improvements
status: completed
stopped_at: Completed 27-02-PLAN.md — human verification approved
last_updated: "2026-03-13T10:19:41.739Z"
last_activity: 2026-03-13 - Completed quick task 17: Fix league overview recent results for mini tours
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.
**Current focus:** v1.5 Multi-Stage Race Improvements — Phase 26 ready to plan

## Current Position

Phase: 27 (League Stage Visibility) — Complete
Plan: 02 (final)
Status: All 4 plans complete — v1.5 milestone delivered
Last activity: 2026-03-13 — Phase 27 Plan 02 complete (human verification approved)

Progress: [██████████] 100% (v1.5) | v1.0-v1.4: 25/25 phases complete

## Performance Metrics

**Velocity:**
- Total plans completed: 51+ (v1.0–v1.3)
- Average duration: ~165s (v1.1 baseline)
- Total execution time: 11 days (v1.0) + 2029s (v1.1) + multiple sessions (v1.2) + multiple sessions (v1.3)

**v1.4 Summary:**

| Phase | Plans | Status |
|-------|-------|--------|
| 23. roster_slots Schema & Migration | 2/2 | Complete — 2026-03-07 |
| 24. Write Path Wiring | 3/3 | Complete — 2026-03-08 |
| 25. Read Path Migration & Cleanup | 2/2 | Complete — 2026-03-09 |

**v1.5 Summary:**

| Phase | Plans | Status |
|-------|-------|--------|
| 26. Admin Stage Result Scoping | 1/1 | Complete — 2026-03-13 |
| 27. League Stage Visibility | 2/2 | Complete — 2026-03-13 |
| Phase 26-admin-stage-result-scoping P01 | 1 | 1 tasks | 1 files |
| Phase 27-league-stage-visibility P01 | 7min | 1 tasks | 2 files |
| Phase 27 P02 | 5min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Recent decisions relevant to v1.5:

- Phase 6: Waiver wire transfers — priority by standings, admin approval, transfer windows
- Phase 6: Ownership-at-race-time — points stay with original team after transfer
- Phase 15: bonus_riders separate table — distinct lifecycle from main roster
- Phase 16-17: Three-query application-side assembly pattern — avoid SQL JSON_AGG complexity
- Phase 20: IR max 2 slots per team; approved riders freed from active roster limit
- Phase 20: IR status enum has 3 values (pending/approved/rejected) — no cancelled unlike transfer bids
- Phase 21: dropRider hard-deletes draftPicks row instantly — no waiver or approval period (ROST-01)
- Phase 22: return_eligible riders still free a roster slot — slot only closes again when status becomes returned
- Phase 22: IR-09 transfer block guard placed before window check so return_eligible state takes precedence
- [Phase 23]: roster_slot_status enum has 3 values: active/on_ir/return_eligible — no dropped/returned states (rows deleted)
- [Phase 23]: unique index on (leagueId, riderId) enforces single-slot-per-rider-per-league invariant at DB level
- [Phase 23]: addedAt column for audit trail only — scoring continues to use draftPicks.pickedAt for ownership-at-race-time
- [Phase 25]: getActiveRosterCount: single SELECT COUNT(*) from roster_slots WHERE status='active' replaces two-query draftPicks-minus-irRequests subtraction
- [Phase 25]: getTeamRoster: sources from rosterSlots innerJoin riders+draftPicks; isOnIR from status IN (on_ir, return_eligible); pickedAt still from draftPicks for ownership-at-race-time
- [Phase 25]: Slot-check guards in submitTransferBid and returnRider now count from roster_slots WHERE status='active' joined to riders for gender
- Key decision from Phase 11/19: COALESCE(parentRaceId, id) for stage roll-up — groups stage results to parent race without schema changes
- Key decision from Phase 12: Category column on raceResults — minimal schema change, reuses existing result entry patterns
- [Phase 26-admin-stage-result-scoping]: stagesTotal/stagesWithResults computed as correlated subqueries inline — consistent with hasResults pattern, no extra query needed
- [Phase 26-admin-stage-result-scoping]: Number() cast in .map() handles Neon returning COUNT(*) as strings from correlated subqueries
- [Phase 27-01]: MULTI_STAGE_TYPES = Set(['grand_tour','mini_tour','womens_grand_tour']) — determines isMultiStage flag; parent race's own results represent end-of-tour points; StandingsClient prop type updated to LeagueRaceScoreGrouped[] to keep TypeScript valid
- [Phase 27]: Expand state uses Set<number> of raceIds — independent expand/collapse per grand tour
- [Phase 27]: Expanded content uses colSpan=4 TableRow with div grid in TableCell — avoids invalid nested table HTML
- [Phase 27]: page.tsx required zero changes — TypeScript infers LeagueRaceScoreGrouped[] from getLeagueRacesWithScores return type

### Pending Todos

None.

### Quick Tasks Completed (v1.3)

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 1 | admin add results improvements | 2026-03-03 | 19461d9 |
| 2 | PCS import: scrape procyclingstats | 2026-03-04 | 4f3d9e2 |
| 3 | Admin results: modal form, firstcycling import | 2026-03-04 | b6d919f |
| 4 | Fix TTT SQL error | 2026-03-05 | d83e1ad |
| 5 | League page redesign + lineup accordions | 2026-03-06 | 44de3e6 |
| 6 | Fix Add More Results button | 2026-03-06 | a6b688c |
| 7 | Improve league page Actions | 2026-03-06 | 32f1b08 |
| 8 | Fix scoring display bug — rider 268 | 2026-03-06 | 58a2933 |
| 9 | Fix race startDate times to 12:00 UTC | 2026-03-06 | 6e39c54 |
| 10 | Add riders to roster if space available without dropping a rider | 2026-03-06 | 59aed39 |
| 11 | Reseed scoring DB with correct 2026 values | 2026-03-06 | f0875a6 |
| 12 | Add Michael Matthews and Neilson Powless to IR for team 11 | 2026-03-06 | 4d0077b |
| 13 | Fix transfer form — IR'd riders free active slots, show On IR badge, non-selectable | 2026-03-06 | 38fe168 |
| 14 | Retroactively recalculate all awarded points using updated 2026 scoring config | 2026-03-06 | 6d7408f |
| 15 | Fix submitTransferBid action incorrectly rejecting free-slot pickups with roster-full error | 2026-03-07 | c8b0e97 |
| 16 | Fix dropRider and submitTransferBid to handle return_eligible IR status | 2026-03-07 | f4d7c10 |
| 17 | Fix league overview Recent Results for multi-stage races | 2026-03-13 | 3fb7136 |
| 18 | Fix league overview Recent Results mini tour stages (inArray → SQL subquery) | 2026-03-13 | 0f79820 |
| 19 | Fix TTT scoring: admin selects which riders score via per-team checkboxes | 2026-03-13 | d5cdff0 |

### Blockers/Concerns

- DEBT-01: npm run build fails (drizzle-kit 0.18.x type error) — non-blocking, project source compiles
- DEBT-02-04: Hammer/Innlagt Spurt/Lagtempo order auto-calc deferred
- DEBT-05: Shimanobil counter simplified team matching deferred

## Session Continuity

Last session: 2026-03-13T08:02:17.885Z
Stopped at: Completed 27-02-PLAN.md — human verification approved
Resume file: None
Next action: /gsd:plan-phase 26

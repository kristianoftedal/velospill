---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: IR List & Roster Management
status: Ready to plan
last_updated: "2026-03-06"
last_activity: 2026-03-06 — v1.3 roadmap created (3 phases: 20-22)
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.
**Current focus:** v1.3 IR List & Roster Management — Phase 20: IR Foundation & Admin Approval

## Current Position

Phase: 20 of 22 (IR Foundation & Admin Approval)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-06 — v1.3 roadmap created, phases 20-22 defined

Progress: [░░░░░░░░░░] 0% (v1.3) | v1.0-v1.2: 19/19 phases complete

## Performance Metrics

**Velocity:**
- Total plans completed: 44+ (v1.0–v1.2)
- Average duration: ~165s (v1.1 baseline)
- Total execution time: 11 days (v1.0) + 2029s (v1.1) + multiple sessions (v1.2)

**v1.2 Summary:**

| Phase | Plans | Status |
|-------|-------|--------|
| 16. Rider Profile Page | 2/2 | Complete — 2026-03-02 |
| 17. Team Profile Page | 2/2 | Complete — 2026-03-03 |
| 18. Race Lineup Accordion | — | Complete (quick-5) — 2026-03-06 |
| 19. Season Standings History | 2/2 | Complete — 2026-03-06 |

**Recent Trend:** Stable. v1.2 shipped same day as v1.1 — 4 phases, 6 plans, plus 9 quick tasks.

## Accumulated Context

### Decisions

Recent decisions relevant to v1.3:

- Phase 6: Waiver wire transfers — priority by standings, admin approval, transfer windows
- Phase 6: Ownership-at-race-time — points stay with original team after transfer
- Phase 15: bonus_riders separate table — distinct lifecycle from main roster
- Phase 16-17: Three-query application-side assembly pattern — avoid SQL JSON_AGG complexity

**v1.3 design decisions (from instructions):**
- IR max 2 slots per team; approved riders freed from active roster limit
- Return flow: admin marks eligible → player banner → transfer-blocked until rider returned
- If roster full on return: player must drop someone first (ROST-01 is a prerequisite for IR-11)
- Drop rider: instant, no approval, no waiver period

### Pending Todos

None.

### Quick Tasks Completed

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

### Blockers/Concerns

- DEBT-01: npm run build fails (drizzle-kit 0.18.x type error) — non-blocking, project source compiles
- DEBT-02-04: Hammer/Innlagt Spurt/Lagtempo order auto-calc deferred
- DEBT-05: Shimanobil counter simplified team matching deferred

## Session Continuity

Last session: 2026-03-06
Stopped at: v1.3 roadmap created — ready to plan Phase 20
Resume file: None

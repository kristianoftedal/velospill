# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.4 — Roster Consolidation

**Shipped:** 2026-03-09
**Phases:** 3 | **Plans:** 7 | **Timeline:** 2 days (2026-03-07 → 2026-03-09)

### What Was Built
- `roster_slots` table as the single source of truth for current team composition — schema, enum, indexes, and DB migration
- Backfill script populating `roster_slots` from live `draftPicks` and `irRequests` records
- Full write-path wiring: all 6 roster mutations (draft, drop, transfer, IR approve, mark eligible, return) now write to `roster_slots` atomically in the same transaction as the primary mutation
- Full read-path migration: `getActiveRosterCount`, `getTeamRoster`, and 2 slot-check guards now read directly from `roster_slots`
- Incidental correctness fix: `isOnIR` now correctly includes `return_eligible` riders (previously only checked `approved`)

### What Worked
- Wave-based parallel execution — all 3 plans in phase 24 ran in parallel and completed without conflicts (they touch disjoint files)
- Plan interfaces block in PLANs: providing exact schema shapes, current function bodies, and precise insert locations meant executors made zero exploration calls
- Verification scores: 9/9 (phase 24) and 7/7 (phase 25) — zero gaps in both phases
- Pure backend refactor scope kept execution clean — no UI changes meant no design decisions during execution

### What Was Inefficient
- REQUIREMENTS.md traceability not auto-updated after phase 24 execution — RSLOT-03 through RSLOT-08 showed as "Pending" even after phase was verified complete; required manual fix at milestone completion
- Executor agents lacked Bash access, requiring orchestrator to handle TypeScript verification and commits — adds a round-trip after each wave

### Patterns Established
- Provide full current function bodies in PLAN `<interfaces>` block — executors should never need to explore to find the insertion point
- Transaction wrapping pattern: all write-path mutations that touch multiple tables should be wrapped in `db.transaction()` with all related writes inside
- `onConflictDoUpdate` for upsert on unique-constraint tables (e.g., `roster_slots` (leagueId, riderId)) is the safe default for incoming rider inserts

### Key Lessons
1. Traceability table in REQUIREMENTS.md should be updated automatically when phase completes — currently relies on executor agent which may not have correct state
2. For pure refactor milestones (no UI changes, no schema additions), 3-phase structure (schema, write, read) maps cleanly and executes fast
3. Verification must-haves derived directly from phase goal language produce high pass rates — keep them behavioral ("X does Y") not structural ("file contains Z")

### Cost Observations
- Model: sonnet throughout (executor + verifier)
- Sessions: 1 continuous session for phases 23-25 + milestone completion
- Notable: Both verifications passed on first attempt (no gap closure cycles needed)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 9 | ~26 | Initial GSD adoption — greenfield |
| v1.1 | 6 | 12 | Scoring config, rule updates |
| v1.2 | 4 | 6 | Three-query pattern established for profile pages |
| v1.3 | 3 | 7 | IR system — complex state machine, 16 quick tasks |
| v1.4 | 3 | 7 | Pure refactor — roster_slots as single source of truth |

### Top Lessons (Verified Across Milestones)

1. Providing exact code context in PLAN files (current function bodies, schema shapes, insertion points) dramatically reduces executor exploration and errors
2. Pure backend refactors with clear scope (no UI) execute faster and verify cleaner than feature milestones
3. Requirements traceability needs automation — manual checkbox updates are consistently missed

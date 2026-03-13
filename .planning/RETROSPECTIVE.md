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

## Milestone: v1.5 — Multi-Stage Race Improvements

**Shipped:** 2026-03-13
**Phases:** 2 | **Plans:** 4 | **Timeline:** 2 days (2026-03-12 → 2026-03-13)

### What Was Built
- `getRacesForResults` extended with correlated subqueries for `stagesTotal` / `stagesWithResults` — admin "X/Y done" sidebar counts
- Admin stage overview modal on parent race click with Done/Pending badges per stage and prev/next stage navigation in modal header
- `getLeagueRacesWithScores` refactored to three-query assembly (`LeagueRaceScoreGrouped[]`) with nested `stages[]`, `hasResults`, and `endOfTourPoints`
- Accordion-style expandable grand tour rows in league standings Race Results tab — chevron toggle, Done/Pending badges, breakdown links, "Final Classifications" end-of-tour section

### What Worked
- CONTEXT.md gathered via `/gsd:discuss-phase` before planning — all 11 locked decisions in Phase 27 had implementing tasks in the plans; zero scope drift
- Planner correctly identified that three-query application-side assembly (established in v1.2) was the right pattern for the standings grouping
- Wave sequencing clean: data layer in Wave 1, UI in Wave 2 — no dependency issues, executor for Wave 2 had exactly the type contract it needed
- Plan checker's non-blocking warning about Query A / COALESCE double-counting risk was accurate and the executor resolved it correctly by inspecting the existing query

### What Was Inefficient
- Research disabled by config — planner had to infer all patterns from CONTEXT.md and codebase knowledge; VALIDATION.md was never created (Nyquist skipped by user choice)
- Minor React `key` prop warning left in `standings-client.tsx:180` (fragment inside `.map()`) — not caught by `tsc --noEmit`, surfaced only in verifier

### Patterns Established
- Correlated subquery pattern: `sql<number>\`(SELECT COUNT(*) FROM races AS s WHERE s."parentRaceId" = ${races.id})::int\`` + `Number()` cast for Neon string coercion
- Accordion table rows: parent `<TableRow>` onClick toggle → child `<TableRow colSpan={N}>` with `<div>` grid inside `<TableCell>` — valid HTML, no nested `<table>` element
- `useState<Set<number>>` for independent multi-row expand/collapse state

### Key Lessons
1. Even with research disabled, providing full code context in CONTEXT.md (`<code_context>` section with reusable assets and integration points) gives the planner enough to produce correct plans
2. Checker flagging potential logic issues (double-counting risk) as `info` rather than blocking is the right call — executor resolved it without disruption
3. For UI milestone phases that follow a backend phase in the same session, Wave 1 data layer changes should update all downstream prop types immediately (as done in 27-01) to keep TypeScript valid throughout

### Cost Observations
- Model: sonnet throughout (planner, checker, executor, verifier)
- Sessions: 1 session for phases 26-27 + milestone completion
- Notable: Verifier returned `human_needed` (not `passed`) because checkpoint already covered the browser tests — approval was instant

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
| v1.5 | 2 | 4 | Full-stack feature — admin UX fix + player visibility |

### Top Lessons (Verified Across Milestones)

1. Providing exact code context in PLAN files (current function bodies, schema shapes, insertion points) dramatically reduces executor exploration and errors
2. Pure backend refactors with clear scope (no UI) execute faster and verify cleaner than feature milestones
3. Requirements traceability needs automation — manual checkbox updates are consistently missed
4. CONTEXT.md `<code_context>` section with reusable assets and integration points can substitute for research when patterns are well-established

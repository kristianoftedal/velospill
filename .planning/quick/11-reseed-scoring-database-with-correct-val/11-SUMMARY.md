---
phase: quick-11-reseed-scoring
plan: "01"
subsystem: scoring
tags: [database, migration, scoring-config, grand-tour-tdf]
dependency_graph:
  requires: []
  provides: [correct-2026-scoring-config]
  affects: [scoring-calculation, results-display]
tech_stack:
  added: []
  patterns: [idempotent-migration, onConflictDoNothing]
key_files:
  created: []
  modified: []
decisions:
  - "grand_tour_tdf is a separate raceType from grand_tour — TdF has its own scoring rows distinct from Giro/Vuelta"
  - "sprint_giro inserted under grand_tour raceType (not grand_tour_tdf) — replaces sprint_double for Giro"
  - "jersey_combative is TdF-only (grand_tour_tdf) at 2 points per stage"
metrics:
  duration: "~2 minutes"
  completed: "2026-03-06"
  tasks_completed: 2
  files_changed: 0
---

# Quick Task 11: Reseed Scoring Database with Correct 2026 Values

Ran the idempotent `migrate-scoring-2026.ts` script against the live DB — 10 updates, 3 deletes, 20 inserts — bringing all scoringConfig rows in line with the 2026 ruleset including TdF-specific `grand_tour_tdf` entries.

## What Was Done

### Task 1: Dry-run migration

Ran `migrate-scoring-2026.ts --dry-run` to confirm the script parses correctly and connects to the DB.

Output confirmed:
- 10 UPDATE lines (one-day tables, GT end results, mini tour values)
- 3 DELETE lines (tdf_stage_bonus, sprint_double x2)
- 20 INSERT lines (all grand_tour_tdf entries + sprint_giro)
- "Dry run completed - no changes committed" at the end

### Task 2: Live migration + verification

Ran the migration without `--dry-run`. Output ended with "Migration completed successfully!".

Spot-check queries confirmed final DB state:

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| grand_tour_tdf / stage_finish | {1:15, 2:12, ..., 12:1} | {1:15, 2:12, ..., 12:1} | PASS |
| high_priority_one_day / finish 1st | 50 | 50 | PASS |
| high_priority_one_day / finish 20th | 1 | 1 | PASS |
| mini_tour / stage_finish 2nd | 5 | 5 | PASS |
| grand_tour_tdf / jersey_combative 1st | 2 | 2 | PASS |
| mini_tour / end_gc positions | 8 | 8 | PASS |
| grand_tour / tdf_stage_bonus rows | 0 | 0 | PASS |
| grand_tour / sprint_double rows | 0 | 0 | PASS |
| grand_tour_tdf total rows | 19 | 19 | PASS |

All 19 grand_tour_tdf categories present: stage_finish, sprint, mountain_cc_hcx2_af, mountain_hc, mountain_1cat, mountain_2cat, mountain_3_4cat, jersey_gc, jersey_points, jersey_kom, jersey_combative, ttt, end_gc, end_points, end_kom, end_youth, end_combative, end_team, end_other.

## Deviations from Plan

None — plan executed exactly as written.

Note: The `dotenv` CLI tool is not directly available; `npx dotenv-cli` was used instead (Rule 3 infrastructure fix, no code changes required).

## Self-Check: PASSED

- Migration script: `src/db/migrate-scoring-2026.ts` — unchanged, existed before task
- No source files created or modified
- DB state verified via spot-check queries — all values match 2026 ruleset

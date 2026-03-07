---
phase: quick-14
plan: "01"
subsystem: database / scoring
tags: [scoring, recalculation, race-results, data-fix]
dependency_graph:
  requires: [quick-11]
  provides: [correct-race-result-points]
  affects: [league-team-totals, scoring-display]
tech_stack:
  added: []
  patterns: [drizzle-orm transaction, dry-run sentinel rollback]
key_files:
  created:
    - src/db/recalc-points-2026.ts
  modified: []
decisions:
  - "Inline resolveScoringRaceType and calculatePoints rather than importing from scoring-preview.ts to avoid import chain issues in a script context"
  - "Fetch all scoringConfig rows and filter in-memory for active ones — simpler than composing the lte/or/isNull/gt where clause with db.select()"
  - "Use empty git commit for Task 2 since it only modifies database rows, not source files"
metrics:
  duration: ~3min
  completed: "2026-03-07"
  tasks_completed: 2
  files_changed: 1
---

# Quick Task 14: Retroactively Recalculate All Awarded Points — Summary

**One-liner:** One-shot recalc script applying 2026 scoringConfig rules to all existing race_results, fixing 14 rows across 2 races (position 1: 25 pts → 30 pts).

## What Was Built

`src/db/recalc-points-2026.ts` — a one-shot recalculation script that:

1. Fetches all `race_results` rows with their race + parentRace via drizzle relations
2. Builds an active scoringConfig lookup map keyed by `"raceType:category"`
3. For each result, resolves the correct `raceTypeForScoring` (handles stage → parentRace, grand_tour_tdf TdF detection)
4. Calculates `newPoints` using the current rules; records rows where value differs
5. Logs a before/after table of all changes
6. Applies all updates in a single transaction (or rolls back on `--dry-run`)

The script was then executed to apply the 14 outstanding corrections.

## Results

| Metric | Value |
|--------|-------|
| Total race_results rows | 20 |
| Changed | 14 |
| Unchanged | 6 |
| Skipped (no config) | 0 |

Races corrected:
- Omloop Het Nieuwsblad (positions 1–7)
- Kuurne-Brussel-Kuurne (positions 1–7)

Spot-check confirmed: position=1 in both races now shows **30 points** (was 25, matches `low_priority_one_day` 2026 rules).

## Deviations from Plan

None — plan executed exactly as written.

The plan estimated "at least 20 changed rows (2 races x 10 positions each)" but only 14 rows changed because positions 8–10 in both races happened to have correct point values already (old rules and new rules agreed for those positions).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c05372f | feat(quick-14): add recalc-points-2026.ts script with --dry-run support |
| 2 | 6d7408f | chore(quick-14): run recalc-points-2026.ts — 14 rows updated |

## Self-Check: PASSED

- [x] `src/db/recalc-points-2026.ts` exists
- [x] Dry run completed without errors, showed 14 changes
- [x] Live run applied 14 updates in transaction, exited 0
- [x] Spot-check: position=1 rows show points=30

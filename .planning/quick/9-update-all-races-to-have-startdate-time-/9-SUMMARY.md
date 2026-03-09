---
phase: quick-9
plan: "01"
subsystem: database
tags: [migration, races, startDate, timezone]
dependency_graph:
  requires: []
  provides: [correct-race-start-times]
  affects: [race-display, timezone-rendering]
tech_stack:
  added: []
  patterns: [neon-serverless-pool, dry-run-migration]
key_files:
  created:
    - scripts/fix-race-start-times.ts
  modified: []
decisions:
  - Strip surrounding quotes from .env.local DATABASE_URL when passing via shell command substitution
  - Use EXTRACT(HOUR/MINUTE/SECOND FROM "startDate" AT TIME ZONE 'UTC') for precise midnight-UTC detection
  - Wrap UPDATE in transaction with ROLLBACK on error, matching Phase 13 migration pattern
metrics:
  duration: 120s
  completed: "2026-03-06"
  tasks: 2
  files: 1
---

# Quick Task 9: Fix Race startDate Times Summary

**One-liner:** DB migration shifting 332 midnight-UTC race startDates to 12:00 UTC using @neondatabase/serverless Pool with dry-run preview and transactional UPDATE.

## What Was Done

Wrote and executed `scripts/fix-race-start-times.ts` — a migration script that:

1. Connects via `new Pool({ connectionString: process.env.DATABASE_URL })`
2. Supports `--dry-run` flag for safe preview
3. In dry-run: SELECTs and prints all affected race IDs + names + dates
4. In live mode: runs a single transactional UPDATE adding `INTERVAL '12 hours'` to all rows where `EXTRACT(HOUR/MINUTE/SECOND AT TIME ZONE 'UTC') = 0`

### Results

- **Dry-run:** 332 races identified with 00:00:00 UTC startDate
- **Live update:** 332 rows updated successfully
- **Verification:** 0 rows remaining with midnight UTC startDate
- **Spot check:** First 5 races show 13:00 CET (= 12:00 UTC) — correct

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write and run the migration script | 6e39c54 | scripts/fix-race-start-times.ts |
| 2 | Commit the migration script | 6e39c54 | (same commit) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DATABASE_URL surrounded by quotes in .env.local**
- **Found during:** Task 1 (dry-run execution)
- **Issue:** `cut -d= -f2-` extracts `"postgresql://..."` with surrounding double-quotes, causing `Invalid URL` error in @neondatabase/serverless
- **Fix:** Added `| tr -d '"'` to strip surrounding quotes from the shell extraction
- **Files modified:** None (command-line fix only)

**2. [Rule 3 - Blocking] Inline tsx -e snippet used top-level await which fails in CJS mode**
- **Found during:** Task 1 (verification step)
- **Issue:** `npx tsx -e` runs in CJS mode by default, which doesn't support top-level await
- **Fix:** Wrote a temporary `scripts/verify-race-start-times.ts` file (deleted after use) that wraps queries in an async function

## Self-Check

- [x] `scripts/fix-race-start-times.ts` exists and committed (6e39c54)
- [x] Verification confirms 0 races with midnight UTC startDate
- [x] Spot check shows 13:00 CET (12:00 UTC) for updated races

## Self-Check: PASSED

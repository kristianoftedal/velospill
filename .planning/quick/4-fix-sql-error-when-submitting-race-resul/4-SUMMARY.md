---
quick_task: 4
title: Fix SQL error when submitting TTT race results
one_liner: "Move rider SELECT outside db.transaction + add pre-delete replace logic in submitTttResults to mirror the pattern already applied to submitRaceResults"
tags: [bug-fix, neon-serverless, transactions, ttt-results]
key_files:
  modified:
    - src/app/admin/results/actions.ts
decisions:
  - Pre-fetch all team rosters outside the transaction into a teamName->riderId[] Map to avoid Neon interactive transaction SELECT limitation
  - Delete existing TTT results (and their audit refs) outside the transaction before inserting new ones — same replace pattern used in submitRaceResults (commits a8d8597–4a02bd6)
  - Transaction is now INSERT-only (raceResults rows + one resultAudit row) — no reads inside
  - Removed the 23505 unique-constraint catch branch since pre-delete makes that error impossible
metrics:
  duration: 120s
  tasks_completed: 1
  files_modified: 1
  commits: 1
  completed_date: "2026-03-05"
---

# Quick Task 4: Fix SQL Error When Submitting TTT Race Results Summary

Move rider SELECT outside db.transaction + add pre-delete replace logic in submitTttResults to mirror the pattern already applied to submitRaceResults.

## What Was Done

`submitTttResults` in `src/app/admin/results/actions.ts` was executing a `tx.select()` inside a `db.transaction()` — the exact interactive-transaction SELECT pattern that Neon serverless (Pool + drizzle-orm/neon-serverless) cannot handle. The same bug was fixed for `submitRaceResults` in commits `a8d8597` through `4a02bd6`.

Additionally, re-submitting TTT results would hit a `23505` unique constraint violation because no replace logic existed (unlike `submitRaceResults` which already had pre-delete cleanup).

### Changes made to `submitTttResults` (lines 649–708)

1. **Pre-fetch team rosters outside the transaction** — one `db.select()` with `inArray(riders.team, allTeamNames)` fetches all riders for all entered teams at once, then builds a `Map<string, number[]>` for O(1) per-team lookup.

2. **Add replace logic** — before the transaction, query existing TTT results for the race. If any exist, delete their `resultAudit` refs first (FK constraint), then delete the `raceResults` rows. Both deletes run outside the transaction (same as `submitRaceResults`).

3. **Simplify transaction to INSERT-only** — removed `const teamRiders = await tx.select(...)` from inside the loop; replaced with `teamRiderMap.get(teamName) ?? []`. Transaction now only does `tx.insert(raceResults)` per rider + one `tx.insert(resultAudit)`.

4. **Removed 23505 catch branch** — the pre-delete replace logic makes a unique constraint violation impossible, so the special-case error handler was removed.

## Commits

| Hash | Message |
|------|---------|
| d83e1ad | fix(quick-4): move SELECT outside transaction + add replace logic for submitTttResults |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- File modified: src/app/admin/results/actions.ts — confirmed
- Commit d83e1ad — confirmed
- TypeScript: no errors (tsc --noEmit --skipLibCheck clean)

---
phase: 13-order-config-updates
plan: 01
subsystem: scoring-config
tags: [config, migration, order-types, 2026-ruleset]
dependency_graph:
  requires: []
  provides: [ORDER-01, ORDER-02, ORDER-03, ORDER-04, ORDER-05, ORDER-08]
  affects: [scoring-engine, order-types-db]
tech_stack:
  added: []
  patterns: [database-migration, seed-data-sync]
key_files:
  created:
    - scripts/migrate-order-types-v1.1.ts
  modified:
    - src/db/seed-scoring.ts
decisions:
  - Used @neondatabase/serverless Pool instead of pg for migration script
  - Migration script supports dry-run mode for safe testing
  - All 6 order type updates wrapped in single transaction for atomicity
metrics:
  duration: 156s
  tasks_completed: 2
  files_modified: 2
  commits: 2
  completed: 2026-02-22
---

# Phase 13 Plan 01: Order Type Configuration Updates Summary

**One-liner:** Migration script and updated seed data for 2026 order type ruleset changes (split multipliers, new effect types, value bumps)

## What Was Built

Created migration script and updated seed data to implement 2026 season changes for 6 order types:

1. **ORDER-01 (Blodpose GT)**: Split multipliers - x3 for TdF, x3.5 for Giro/Vuelta
2. **ORDER-02 (Etappeseier)**: Restructured from double_top10_stage to multiply_finish_points with per-GT values (x2 TdF, x2.25 Giro/Vuelta)
3. **ORDER-03 (Hammer)**: Increased from 3 pts/position (max 30) to 5 pts/position (max 50)
4. **ORDER-04 (Lagtempo)**: Increased from 5 pts to 10 pts per top-20 placement
5. **ORDER-05 (Sponsorens ritt)**: Changed from double_end_tour to multiply_end_tour with value 3
6. **ORDER-08 (Kaptein)**: Added womens_one_day to applicable race types alongside world_championship

Both migration script (for production DB update) and seed data (for fresh installs) now contain matching configurations.

## Tasks Completed

| Task | Description | Commit | Duration |
|------|-------------|--------|----------|
| 1 | Create migration script for orderTypes updates | 3b51da8 | ~80s |
| 2 | Update seed-scoring.ts with new order type configurations | 748c18b | ~76s |

## Implementation Details

### Migration Script (scripts/migrate-order-types-v1.1.ts)

- Uses @neondatabase/serverless Pool for DB connection
- Supports --dry-run flag for safe testing
- Wraps all 6 updates in single transaction for atomicity
- Logs old/new values for each update for audit trail
- Updates both `effect` JSONB and `description` fields (or `applicableRaceTypes` for Kaptein)
- Run with: `npx dotenv-cli -e .env.local -- npx tsx scripts/migrate-order-types-v1.1.ts`

### Seed Data Updates (src/db/seed-scoring.ts)

Updated 6 entries in the orderEntries array:
- Blodpose GT: Changed from `value: 3` to `values: { grand_tour: 3.5, grand_tour_tdf: 3 }`
- Etappeseier: Changed type from `double_top10_stage` to `multiply_finish_points` with `values: { grand_tour: 2.25, grand_tour_tdf: 2 }`
- Hammer: Changed `points_per_position` from 3 to 5, `max_points` from 30 to 50
- Lagtempo: Changed `points_per_top20` from 5 to 10
- Sponsorens ritt: Changed type from `double_end_tour` to `multiply_end_tour`, added `value: 3`
- Kaptein: Added "womens_one_day" to `applicableRaceTypes` array

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- Migration script dry-run successful: All 6 UPDATE statements generated correctly
- Seed data syntax valid: TypeScript structure matches expected JSONB format
- All must_haves verified:
  - ✓ Blodpose GT uses x3 for TdF and x3.5 for Giro/Vuelta
  - ✓ Etappeseier uses multiply_finish_points effect type with per-GT multipliers
  - ✓ Hammer uses 5 points per position and max 50
  - ✓ Lagtempo uses 10 points per top-20 placement
  - ✓ Sponsorens ritt uses multiplier value 3
  - ✓ Kaptein applicableRaceTypes includes womens_one_day

## Next Steps

Before application logic can use these new configurations:
1. Run migration script in production: `npx dotenv-cli -e .env.local -- npx tsx scripts/migrate-order-types-v1.1.ts` (without --dry-run)
2. Test affected order types in admin interface
3. Verify scoring calculations use new multiplier values correctly

Phase 13 next: Implement race calendar improvements and admin workflows.

## Self-Check

Verifying all created files and commits exist...

```bash
# Check files exist
[ -f "scripts/migrate-order-types-v1.1.ts" ] && echo "FOUND: scripts/migrate-order-types-v1.1.ts" || echo "MISSING: scripts/migrate-order-types-v1.1.ts"
[ -f "src/db/seed-scoring.ts" ] && echo "FOUND: src/db/seed-scoring.ts" || echo "MISSING: src/db/seed-scoring.ts"

# Check commits exist
git log --oneline --all | grep -q "3b51da8" && echo "FOUND: 3b51da8" || echo "MISSING: 3b51da8"
git log --oneline --all | grep -q "748c18b" && echo "FOUND: 748c18b" || echo "MISSING: 748c18b"
```

**Results:**
- FOUND: scripts/migrate-order-types-v1.1.ts
- FOUND: src/db/seed-scoring.ts
- FOUND: 3b51da8
- FOUND: 748c18b

## Self-Check: PASSED

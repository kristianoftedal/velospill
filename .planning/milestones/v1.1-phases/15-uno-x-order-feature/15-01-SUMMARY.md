---
phase: 15-uno-x-order-feature
plan: 01
subsystem: data-foundation
tags: [schema, migration, order-types]
dependency_graph:
  requires: []
  provides:
    - bonus_riders_table
    - uno_x_order_type
  affects:
    - scoring_system
    - order_system
tech_stack:
  added:
    - bonus_riders schema
  patterns:
    - Drizzle ORM table definition
    - SQL migration with indexes and constraints
    - Idempotent migration script with dry-run mode
key_files:
  created:
    - src/db/schema/bonus-riders.ts
    - src/db/migrations/0002_add_bonus_riders.sql
    - scripts/migrate-uno-x-order.ts
  modified:
    - src/db/schema/index.ts
    - src/db/seed-scoring.ts
decisions:
  - title: "Bonus rider picks stored in dedicated table"
    rationale: "Separate bonus_riders table provides clean tracking of per-GT bonus rider picks without overloading the orders or draft_picks tables"
  - title: "Unique constraint on (leagueId, raceId, teamId)"
    rationale: "Enforces one bonus rider per team per Grand Tour at the database level"
  - title: "Optional orderId reference"
    rationale: "Links bonus rider pick back to the Uno-X order that triggered the draft, nullable for flexibility"
  - title: "Migration script includes DDL + seed data"
    rationale: "Single atomic migration creates table and inserts order type in one transaction for production databases"
metrics:
  duration: 122s
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  commits: 2
  completed_date: 2026-02-22
---

# Phase 15 Plan 01: Uno-X Order Data Foundation Summary

Drizzle schema for bonus_riders table, SQL migration, Uno-X order type seed data, and production migration script for the reverse-standings bonus rider draft feature.

## What Was Built

### Task 1: bonus_riders Schema and Migration (a41d16f)

Created the `bonusRiders` Drizzle schema with the following structure:

**Columns:**
- `id`: serial primary key
- `leagueId`: integer NOT NULL, references leagues.id with cascade delete
- `teamId`: integer NOT NULL, references teams.id
- `riderId`: integer NOT NULL, references riders.id
- `raceId`: integer NOT NULL, references races.id (parent GT race, not stage)
- `orderId`: integer nullable, references orders.id (links to Uno-X order)
- `pickOrder`: integer NOT NULL (1-based pick position in reverse standings draft)
- `pickedAt`: timestamp with timezone, default now()

**Indexes:**
- `bonus_riders_league_idx` on leagueId
- `bonus_riders_team_idx` on teamId
- `bonus_riders_race_idx` on raceId
- `bonus_riders_league_race_team_unique` unique index on (leagueId, raceId, teamId)

**Relations:** Defined Drizzle relations to leagues, teams, riders, races, and orders tables.

**Migration:** Created `0002_add_bonus_riders.sql` with IF NOT EXISTS DDL for idempotent execution.

**Export:** Added barrel export to `src/db/schema/index.ts`.

### Task 2: Uno-X Order Type Seed and Migration Script (cc10788)

**Seed Data:** Added `uno_x` order type to `orderEntries` array in `src/db/seed-scoring.ts`:
```typescript
{
  name: "uno_x",
  displayName: "Uno-X",
  applicableRaceTypes: ["grand_tour", "womens_grand_tour"],
  effect: {
    type: "bonus_rider_draft",
    target: "unowned_rider_pool",
    description: "Each team picks one bonus rider from the unowned pool in reverse standings order"
  },
  description: "Pick a bonus rider from the unowned pool for this GT (reverse standings draft order)",
}
```

**Migration Script:** Created `scripts/migrate-uno-x-order.ts` following the established pattern:
- Uses `@neondatabase/serverless` Pool for consistency with project DB setup
- Supports `--dry-run` flag for safe testing
- Executes two operations in a single transaction:
  1. Runs DDL from `0002_add_bonus_riders.sql` to create bonus_riders table
  2. Inserts Uno-X order type with `ON CONFLICT (name) DO NOTHING` for idempotency
- Console logs each operation for audit trail
- Runnable with: `npx tsx scripts/migrate-uno-x-order.ts [--dry-run]`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. ✅ Schema file compiles without TypeScript errors (drizzle-kit type errors are known and out of scope)
2. ✅ Schema barrel exports `bonus-riders` module
3. ✅ Seed file includes the `uno_x` order type entry
4. ✅ Migration script follows established patterns (Pool.connect, dry-run, transaction)
5. ✅ bonusRiders table schema defined with all columns, indexes, and unique constraint
6. ✅ Uno-X order type configured for grand_tour and womens_grand_tour race types
7. ✅ Migration script can create table and seed order type for existing databases

## Next Steps

Phase 15 Plan 02 will build the bonus rider draft UI, including:
- Reverse standings sort logic
- Draft session state management
- Real-time draft interface (similar to Phase 4 draft system)
- Integration with Uno-X order activation

## Self-Check: PASSED

All created files verified:
- ✅ src/db/schema/bonus-riders.ts exists
- ✅ src/db/migrations/0002_add_bonus_riders.sql exists
- ✅ scripts/migrate-uno-x-order.ts exists

All commits verified:
- ✅ a41d16f exists (Task 1 - schema and migration)
- ✅ cc10788 exists (Task 2 - seed and migration script)

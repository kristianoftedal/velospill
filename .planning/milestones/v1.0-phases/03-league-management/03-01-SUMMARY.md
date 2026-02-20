---
phase: 03-league-management
plan: 01
subsystem: database-schema
tags: [drizzle, postgresql, schema, auth-helpers, nanoid]
dependency_graph:
  requires: []
  provides:
    - leagues-table
    - teams-table
    - league-status-enum
    - invite-code-generator
    - league-membership-check
    - league-ownership-check
  affects:
    - src/db/schema/index.ts
tech_stack:
  added:
    - nanoid (already installed, no new dep needed)
  patterns:
    - pgEnum for status enforcement
    - jsonb with TypeScript type assertion via $type<>()
    - Drizzle relations for type-safe queries
    - uniqueIndex for composite unique constraints
key_files:
  created:
    - src/db/schema/leagues.ts
    - src/lib/invite-codes.ts
    - src/lib/league-auth.ts
  modified:
    - src/db/schema/index.ts
decisions:
  - Used serial("id").primaryKey() to match existing races.ts pattern instead of generatedAlwaysAsIdentity
  - Used uniqueIndex() for composite unique constraints on teams table (leagueId+userId, leagueId+name)
  - Typed JSONB config column with $type<LeagueConfig>() for compile-time safety
  - getAuthenticatedUser() added alongside membership/ownership helpers for completeness
metrics:
  duration: "111 seconds"
  completed: "2026-02-13T07:30:35Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 3 Plan 1: League Schema & Auth Helpers Summary

**One-liner:** PostgreSQL leagues/teams tables with leagueStatusEnum, JSONB config, composite unique constraints, nanoid invite codes, and drizzle membership/ownership auth helpers.

## What Was Built

Created the data foundation for Phase 3 league management: two new PostgreSQL tables (`leagues`, `teams`) with a custom enum, JSONB config column, unique indexes, and two utility modules for invite code generation and league authorization checks.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create leagues and teams database schemas and run migration | `9d4b223` | `src/db/schema/leagues.ts`, `src/db/schema/index.ts` |
| 2 | Create invite code generator and league authorization helpers | `375e44d` | `src/lib/invite-codes.ts`, `src/lib/league-auth.ts` |

## Key Artifacts

### `src/db/schema/leagues.ts`
- `leagueStatusEnum`: PostgreSQL enum enforcing "setup" | "drafting" | "active" | "complete"
- `leagues` table: id (serial PK), name, inviteCode (unique), inviteExpiresAt, status (enum), ownerId (FK user.id), config (JSONB typed as `LeagueConfig`), timestamps
- `teams` table: id (serial PK), leagueId (FK leagues.id CASCADE), userId (FK user.id), name, createdAt
  - `teams_league_user_unique`: uniqueIndex on (leagueId, userId)
  - `teams_league_name_unique`: uniqueIndex on (leagueId, name)
- Drizzle relations: leagues<->teams (one-to-many), leagues->user (many-to-one), teams->user (many-to-one)

### `src/lib/invite-codes.ts`
- `generateInviteCode()`: 12-character URL-safe nanoid string (~68 bits entropy)

### `src/lib/league-auth.ts`
- `getAuthenticatedUser()`: retrieves session via better-auth, throws "Unauthorized" if missing
- `checkLeagueMembership(userId, leagueId)`: returns `{ isMember, team }` from teams table
- `checkLeagueOwnership(userId, leagueId)`: returns boolean from leagues table owner check

## Decisions Made

1. **serial vs generatedAlwaysAsIdentity:** Used `serial("id").primaryKey()` to match the existing `races.ts` pattern rather than the research-suggested `generatedAlwaysAsIdentity`.

2. **uniqueIndex vs unique:** Used `uniqueIndex()` in table options for composite unique constraints since drizzle-orm doesn't support chained `.unique()` on multi-column constraints.

3. **JSONB typing:** Applied `.$type<LeagueConfig>()` to the config column for compile-time type safety without runtime overhead.

4. **Separate schema import:** `league-auth.ts` imports from `@/db/schema/leagues` (not `@/db/schema`) to avoid circular imports since `db.ts` already imports all of `@/db/schema`.

## Deviations from Plan

None - plan executed exactly as written. nanoid was already installed in node_modules (not listed in package.json dependencies, but available as a transitive dependency).

## Self-Check: PASSED

- FOUND: src/db/schema/leagues.ts
- FOUND: src/lib/invite-codes.ts
- FOUND: src/lib/league-auth.ts
- FOUND: leagues export in src/db/schema/index.ts
- FOUND: generateInviteCode export
- FOUND: checkLeagueMembership export
- FOUND: checkLeagueOwnership export
- TypeScript: PASS (npx tsc --noEmit)
- Migration: PASS (leagues and teams tables created in database)
- Commits: 9d4b223 (Task 1), 375e44d (Task 2)

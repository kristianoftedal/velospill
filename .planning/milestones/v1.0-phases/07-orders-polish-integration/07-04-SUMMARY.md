---
phase: 07-orders-polish-integration
plan: 04
subsystem: scoring
tags: [orders, scoring, counter-mechanic, standings, race-breakdown]
dependency_graph:
  requires: [07-02, 07-03]
  provides: [order-adjusted-standings, order-effect-annotations, counter-mechanic-resolution]
  affects: [standings-page, race-breakdown-page, scoring-pipeline]
tech_stack:
  added: []
  patterns: [query-time-order-effects, blowback-counter-mechanic, dynamic-import-circular-prevention]
key_files:
  created: []
  modified:
    - src/lib/order-queries.ts
    - src/lib/scoring-queries.ts
    - src/app/(main)/leagues/[leagueId]/standings/page.tsx
    - src/app/(main)/leagues/[leagueId]/standings/[raceId]/page.tsx
decisions:
  - "Dynamic import used in scoring-queries.ts to import from order-queries.ts (avoids circular dependency since order-queries.ts imports from scoring-queries.ts)"
  - "effectValue (singular) added to ActiveOrder type alongside effectValues (plural) to handle blodpose_gt's single-value multiplier vs blodpose_one_day's race-type-keyed values"
  - "Blowback raceId set to 0 temporarily in applyOrderEffects then corrected post-call in getOrderAdjustedStandings — blowback adjustments are keyed on teamId+riderId not raceId"
  - "World Championship guard in applyOrderEffects skips all orders except kaptein — enforces the game rule that only Kaptein applies in WC"
  - "RaceScoreEntryWithOrders uses riderId=-1 sentinel for bonus rows (Gammel Venn, admin bonus) — these have no real rider representation in draftPicks"
metrics:
  duration: ~8min
  completed: 2026-02-14
  tasks_completed: 2
  files_modified: 4
---

# Phase 07 Plan 04: Scoring Integration and Counter Mechanics Summary

Order effects are now integrated into the full scoring pipeline. Standings reflect order-adjusted totals and the race breakdown page annotates every affected score with order effect badges, counter results, and bonus rows.

## What Was Built

### Task 1: Order Effect Calculation and Counter Mechanic Resolution (`src/lib/order-queries.ts`)

New types added:
- `ActiveOrder` — parsed representation of an active order with typed effect fields
- `OrderAdjustment` — a single score adjustment with base/adjusted points and human-readable description
- `CounterResult` — records which attack was countered, by what, and the blowback effect
- `BaseScore` — input type for applyOrderEffects

New functions:

**`getActiveOrdersForRace(raceId, leagueId)`**
- Queries `orders` JOIN `orderTypes` WHERE status='active'
- Parses the JSONB `effect` field into typed fields: `effectType`, `effectTarget`, `effectValues`, `effectValue`, `restriction`

**`resolveCounters(activeOrders)`**
- Identifies attack orders: `shimanobil`, `covid`, `bondestreik`
- Identifies defense orders: `etappeseier`, `blodpose_gt`
- For each attack: checks if the targeted team (or any opponent team for rider-targeted attacks) has a defense order
- When countered: removes attack from effectiveOrders, creates blowback CounterResult redirecting the attack effect to the attacker's own team
- Defense orders remain in effectiveOrders (they still provide their own positive effect)

**`applyOrderEffects(baseScores, effectiveOrders, raceType, counterResults, gammelVennBonuses)`**
- All 12 order types handled:
  - `multiplier` (blodpose_one_day, blodpose_gt): picks correct multiplier from effectValues[raceType] or effectValue
  - `zero_points` (shimanobil): zeroes the targeted rider on the opponent team
  - `half_points` (covid): halves all riders on the targeted team
  - `double_top10_stage` (etappeseier): doubles own riders in positions 1-10
  - `gc_position_loss` / `team_sprint_points` / `team_placement_points` (Hammer, Innlagt Spurt, Lagtempo): uses admin-entered bonusPoints
  - `zero_finish_points` (bondestreik): zeroes all riders on the targeted team
  - `choice` (kaptein): x2 single rider or x1.5 all own riders matching targetCountry (WC only)
  - `double_end_tour` (sponsorens_ritt): doubles all own riders' points
- Blowback effects applied from counterResults
- Gammel Venn bonuses added as separate adjustments

**`getOrderAdjustedStandings(leagueId, season)`**
- Fetches all active orders for league/season joined with race types
- Groups by raceId, processes each race: resolves counters, fetches base breakdown, applies effects
- Aggregates delta per team, adds to base standings totals
- Re-sorts and re-ranks with tie handling

### Task 2: Scoring Queries and UI Updates

**`src/lib/scoring-queries.ts`** — two new exported functions:

**`getLeagueStandingsWithOrders(leagueId, season)`**
- Delegates to `getOrderAdjustedStandings` via dynamic import (avoids circular dependency)
- Returns same `LeagueStanding[]` shape with order-adjusted totalPoints
- Backward-compatible: original `getLeagueStandings` unchanged

**`getRaceScoreBreakdownWithOrders(raceId, leagueId)`**
- Returns `{ entries: RaceScoreEntryWithOrders[], counterResults, hasOrders }`
- `RaceScoreEntryWithOrders` extends `RaceScoreEntry` with: `adjustedPoints`, `orderEffect`, `isCountered`, `isBonus`
- When no active orders: `hasOrders=false`, entries have adjustedPoints=points, all effects null
- Bonus rows added for Gammel Venn and admin-entered bonus point orders

**`src/app/(main)/leagues/[leagueId]/standings/page.tsx`**
- Swapped `getLeagueStandings` → `getLeagueStandingsWithOrders` (one-line change)
- Standings now show order-adjusted team totals

**`src/app/(main)/leagues/[leagueId]/standings/[raceId]/page.tsx`**
- Uses `getRaceScoreBreakdownWithOrders` instead of `getRaceScoreBreakdown`
- When orders are active (`hasOrders=true`):
  - Table adds "Adjusted Pts" column (colored green if up, red if down)
  - Table adds "Order Effect" column with color-coded `OrderEffectBadge` component
  - Countered rows highlighted in yellow background
  - "Order Bonuses" card for Gammel Venn and admin bonus rows
  - "Counter Results" card with narrative descriptions of counter events
  - Team Points Summary shows both base and adjusted columns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Circular Import] Used dynamic import to break order-queries ↔ scoring-queries circular dependency**
- **Found during:** Task 2 implementation
- **Issue:** `scoring-queries.ts` needed to call `getOrderAdjustedStandings` from `order-queries.ts`, but `order-queries.ts` already imports `getLeagueStandings` and `getRaceScoreBreakdown` from `scoring-queries.ts`
- **Fix:** Used `await import("./order-queries")` in `getRaceScoreBreakdownWithOrders` and `getLeagueStandingsWithOrders` to defer the import and break the cycle
- **Files modified:** `src/lib/scoring-queries.ts`

**2. [Rule 1 - Bug] Added `effectValue` (singular) to ActiveOrder type**
- **Found during:** Task 1 — reviewing seed data
- **Issue:** `blodpose_gt` uses `effect.value: 3` (singular) while `blodpose_one_day` uses `effect.values: {...}` (plural). The plan spec only mentioned `effectValues`
- **Fix:** Added `effectValue?: number` field to `ActiveOrder` and parsed it in both `getActiveOrdersForRace` and the bulk-order loop in `getOrderAdjustedStandings`
- **Files modified:** `src/lib/order-queries.ts`

## Verification Results

1. `npx tsc --noEmit` passes cleanly after both tasks
2. All 4 new functions exported: `getActiveOrdersForRace`, `resolveCounters`, `applyOrderEffects`, `getOrderAdjustedStandings`
3. `scoring-queries.ts` exports `getLeagueStandingsWithOrders` and `getRaceScoreBreakdownWithOrders`
4. Standings page imports and calls `getLeagueStandingsWithOrders`
5. Race breakdown page uses `getRaceScoreBreakdownWithOrders` and shows `orderEffect`, `isCountered`, `isBonus` fields
6. Counter results narrative shown in dedicated card on race breakdown page

## Self-Check: PASSED

All created/modified files verified to exist on disk.
Both task commits verified in git log:
- `58c60b0` feat(07-04): implement order effect calculation and counter mechanic resolution
- `5f7d03a` feat(07-04): update scoring queries and race breakdown UI with order-adjusted points

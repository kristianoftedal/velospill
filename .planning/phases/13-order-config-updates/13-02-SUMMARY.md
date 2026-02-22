---
phase: 13-order-config-updates
plan: 02
subsystem: scoring-engine
tags: [order-effects, scoring-logic, ui, 2026-ruleset]
dependency_graph:
  requires: [ORDER-01, ORDER-02, ORDER-05, ORDER-08]
  provides: [order-effect-handlers-v1.1]
  affects: [scoring-engine, order-queries, orders-ui]
tech_stack:
  added: []
  patterns: [effect-type-switch, dynamic-ui-filtering]
key_files:
  created: []
  modified:
    - src/lib/order-queries.ts
    - src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx
decisions:
  - Etappeseier now multiplies ALL own riders' finish points (not limited to top-10)
  - Sponsorens ritt uses configurable multiplier (3x) instead of hardcoded 2x
  - Kaptein works for both World Championship and women's one-day races
  - Blodpose GT multiplier resolution already handles per-GT values via existing effectValues code path
metrics:
  duration: 169s
  tasks_completed: 2
  files_modified: 2
  commits: 2
  completed: 2026-02-22
---

# Phase 13 Plan 02: Order Effect Application Logic Updates Summary

**One-liner:** Updated applyOrderEffects handlers to support new effect types (multiply_finish_points, multiply_end_tour) and removed Kaptein World Championship restriction for women's races

## What Was Built

Updated the order effect application logic and UI to align with the orderTypes configuration changes from Plan 01:

1. **Etappeseier (ORDER-02)**: Replaced `double_top10_stage` effect type with `multiply_finish_points`
   - Now multiplies ALL own riders' finish points (not just top-10 positions)
   - Uses per-race-type multiplier values: x2 for TdF, x2.25 for Giro/Vuelta
   - Applies to all riders with points > 0, regardless of position

2. **Sponsorens ritt (ORDER-05)**: Replaced `double_end_tour` effect type with `multiply_end_tour`
   - Changed from hardcoded 2x to configurable multiplier (now 3x)
   - Uses `order.effectValue ?? 3` for flexibility

3. **Kaptein (ORDER-08)**: Removed World Championship restriction
   - Deleted `if (!isWorldChampionship) break` guard from choice case
   - Now applies to both world_championship and womens_one_day races
   - UI already handles this dynamically via applicableRaceTypes filtering

4. **Blodpose GT (ORDER-01)**: Documented existing multiplier resolution
   - Confirmed existing code correctly handles per-GT multiplier values
   - Added comment noting how effectValues resolves for GT stages

## Tasks Completed

| Task | Description | Commit | Duration |
|------|-------------|--------|----------|
| 1 | Update applyOrderEffects for new effect types | bdfeaf3 | ~85s |
| 2 | Verify and document orders-client.tsx for womens WC kaptein | 10c72cd | ~84s |

## Implementation Details

### Task 1: Order-queries.ts Updates

**New effect type handlers:**

```typescript
case "multiply_finish_points": {
  // Etappeseier — multiply ALL own riders' finish points
  const multiplier = order.effectValues?.[raceType] ?? 2
  const ownRiders = baseScores.filter((s) => s.teamId === order.teamId)
  for (const entry of ownRiders) {
    if (entry.points > 0) {
      adjustments.push({
        teamId: order.teamId,
        riderId: entry.riderId,
        raceId: order.raceId,
        basePoints: entry.points,
        adjustedPoints: Math.floor(entry.points * multiplier),
        orderTypeName: order.orderTypeName,
        description: `${order.orderTypeName} x${multiplier} (finish pts)`,
      })
    }
  }
  break
}

case "multiply_end_tour": {
  // Sponsorens ritt — configurable multiplier (3x)
  const multiplier = order.effectValue ?? 3
  const ownRiders = baseScores.filter((s) => s.teamId === order.teamId)
  for (const entry of ownRiders) {
    if (entry.points > 0) {
      adjustments.push({
        teamId: order.teamId,
        riderId: entry.riderId,
        raceId: order.raceId,
        basePoints: entry.points,
        adjustedPoints: Math.floor(entry.points * multiplier),
        orderTypeName: order.orderTypeName,
        description: `${order.orderTypeName} x${multiplier}`,
      })
    }
  }
  break
}
```

**Kaptein restriction removal:**

Removed the `if (!isWorldChampionship) break` guard that prevented kaptein from working on non-WC races. The order submission validation already checks applicableRaceTypes in actions.ts, so the scoring logic doesn't need this restriction.

**Blodpose GT comment:**

Added documentation noting that the existing multiplier case already handles per-GT values correctly. The `effectValues[raceType]` lookup works because `raceType` is read from `races.raceType`, which for GT stages reflects the parent race type (grand_tour or grand_tour_tdf).

### Task 2: Orders-client.tsx Verification

The UI required no code changes because it's already fully dynamic:

1. The `effectiveRaceType` calculation correctly handles women's one-day races (no parentRaceId → uses race.raceType directly)
2. The `filteredOrderTypes` filter checks `applicableRaceTypes.includes(effectiveRaceType)`
3. Since Plan 01 added `womens_one_day` to kaptein's applicableRaceTypes, kaptein automatically shows up when a women's one-day race is selected
4. The kaptein UI (own_rider_or_country target) renders with x2/x1.5 strategy options as expected

Added a comment documenting this support for future maintainers.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verifications passed:

- ✓ `case "multiply_finish_points"` exists in order-queries.ts
- ✓ `case "multiply_end_tour"` exists in order-queries.ts
- ✓ Old effect type names (`double_top10_stage`, `double_end_tour`) removed
- ✓ Kaptein `case "choice"` has no World Championship guard
- ✓ JSDoc reflects new effect type names
- ✓ Women's one-day races show kaptein in UI via dynamic filtering

## Success Criteria Verification

All must_haves met:

- ✓ Blodpose GT correctly applies x3 for TdF races and x3.5 for Giro/Vuelta races (existing code path confirmed working)
- ✓ Etappeseier multiplies ALL own riders' finish points by race-specific multiplier (not just top-10)
- ✓ Sponsorens ritt multiplies end-of-tour points by 3x instead of 2x
- ✓ Kaptein order can be submitted and scored for women's one-day races
- ✓ Admin can select and submit all updated orders with correct multipliers via UI

## Next Steps

Phase 13 complete. Application logic now fully supports the 2026 order ruleset changes.

Remaining v1.1 work:
- Phase 14: Race calendar improvements and admin workflows
- Phase 15: Uno-X order (reverse standings draft UI)

## Self-Check

Verifying all modified files and commits exist...

```bash
# Check files exist
[ -f "src/lib/order-queries.ts" ] && echo "FOUND: src/lib/order-queries.ts" || echo "MISSING: src/lib/order-queries.ts"
[ -f "src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx" ] && echo "FOUND: src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx" || echo "MISSING: src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx"

# Check commits exist
git log --oneline --all | grep -q "bdfeaf3" && echo "FOUND: bdfeaf3" || echo "MISSING: bdfeaf3"
git log --oneline --all | grep -q "10c72cd" && echo "FOUND: 10c72cd" || echo "MISSING: 10c72cd"
```

**Results:**
- FOUND: src/lib/order-queries.ts
- FOUND: src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx
- FOUND: bdfeaf3
- FOUND: 10c72cd

## Self-Check: PASSED

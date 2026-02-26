---
phase: 14-counter-mechanic-return-logic
plan: 01
subsystem: strategic-orders
tags: [counter-mechanic, order-effects, 2026-rules, scoring]
dependency_graph:
  requires: [ORDER-06]
  provides: [COUNTER-RETURN-LOGIC]
  affects: [order-queries, scoring-queries, standings-ui]
tech_stack:
  added: []
  patterns: [simplified-counter-resolution, neutral-counter-display]
key_files:
  created: []
  modified:
    - src/lib/order-queries.ts
    - src/lib/scoring-queries.ts
    - src/app/(main)/leagues/[leagueId]/standings/[raceId]/page.tsx
decisions:
  - "Remove blowback fields from CounterResult type (down to 3 fields)"
  - "Counter descriptions now say 'order returned to attacker for reuse'"
  - "No penalty applied to attacking team when countered (2026 rules)"
  - "Counter results displayed with blue neutral styling instead of yellow warning"
metrics:
  duration: 154s
  tasks_completed: 2
  commits: 3
  files_modified: 3
  completed_at: 2026-02-22T14:53:27Z
---

# Phase 14 Plan 01: Counter Mechanic Return Logic Summary

**One-liner:** Removed bounce-back (blowback) mechanic from counter system — countered attacks now simply return to attacker for reuse with no penalty applied.

## What Was Built

Simplified the counter resolution mechanic to align with 2026 rules. When an attack order (shimanobil, covid, bondestreik) is countered by a defense order (etappeseier, blodpose_gt), the attack now has no effect on anyone and is returned to the attacker for future reuse. Previously, the attack would "bounce back" and penalize the attacker's own team.

### Key Changes

1. **Simplified CounterResult type** — Removed blowback fields (blowbackTeamId, blowbackEffectType, blowbackTargetTeamId, blowbackTargetRiderId), keeping only attackOrderId, counterOrderId, and description.

2. **Updated counter resolution descriptions** — Changed from "effect returns to attacker" to "order returned to attacker for reuse" to clarify that the order type can be used again in future races.

3. **Removed blowback application** — Deleted the entire blowback effect loop from applyOrderEffects() that would apply zero_points, half_points, or zero_finish_points to the attacking team.

4. **Updated counter results display** — Changed from yellow warning colors (punitive) to blue neutral colors (informational). Updated label from "Counter:" to "Counter (returned):" to make the return mechanic explicit.

5. **Updated OrderEffectBadge component** — Changed countered order styling from yellow to blue, removed "blowback" from attack detection.

## Deviations from Plan

None — plan executed exactly as written.

## Key Decisions Made

**Counter mechanic simplification approach:** Kept the counterResults parameter in applyOrderEffects() for backward compatibility but removed the blowback application logic. This minimizes breaking changes while achieving the rule change goal.

**UI color scheme:** Used blue instead of yellow to visually communicate that counters are now neutral events (order returned) rather than punitive (bounce-back penalty).

**Description wording:** Emphasized "for reuse" in counter descriptions to clarify that the order type returns to the attacker's inventory for future races, not just "bounces back" with negative effects.

## Testing Notes

Verification performed:
- ✅ No "blowback" references remain in order-queries.ts, scoring-queries.ts, or standings page (except in comments explaining 2026 rules)
- ✅ CounterResult type has exactly 3 fields (attackOrderId, counterOrderId, description)
- ✅ Counter descriptions include "returned to attacker for reuse"
- ✅ No TypeScript compilation errors in modified files
- ✅ Counter results display uses blue styling with "Counter (returned):" label

## Next Steps

None — this completes the counter mechanic changes for 2026 rules.

## Implementation Log

### Task 1: Remove blowback from counter resolution and effect application
**Duration:** ~60s | **Commit:** 261f5cf

- Simplified CounterResult type to 3 fields
- Updated resolveCounters() JSDoc and description strings
- Removed blowback application loop from applyOrderEffects()
- Updated JSDoc for applyOrderEffects() to remove blowback references
- Updated remaining comment that referenced "blowback adjustments"

**Files modified:**
- src/lib/order-queries.ts (81 lines removed, 9 lines added)

### Task 2: Update counter results display and scoring integration
**Duration:** ~50s | **Commit:** 75e5484

- Removed blowback field references from scoring-queries.ts
- Changed counter results card from yellow to blue styling
- Updated label from "Counter:" to "Counter (returned):"
- Updated OrderEffectBadge to use blue for countered orders
- Removed "blowback" from attack detection in badge component

**Files modified:**
- src/lib/scoring-queries.ts (6 lines changed)
- src/app/(main)/leagues/[leagueId]/standings/[raceId]/page.tsx (5 lines changed)

### Additional cleanup
**Duration:** ~10s | **Commit:** 378ade6

- Updated comment in scoring-queries.ts to remove outdated "counter + blowback" reference

**Files modified:**
- src/lib/scoring-queries.ts (1 line changed)

## Self-Check: PASSED

**Verified created files:** N/A (no new files created)

**Verified modified files:**
- ✅ FOUND: src/lib/order-queries.ts
- ✅ FOUND: src/lib/scoring-queries.ts
- ✅ FOUND: src/app/(main)/leagues/[leagueId]/standings/[raceId]/page.tsx

**Verified commits:**
- ✅ FOUND: 261f5cf (refactor: remove blowback from counter mechanic)
- ✅ FOUND: 75e5484 (feat: update counter results display to neutral styling)
- ✅ FOUND: 378ade6 (chore: update comment to remove blowback reference)

All files and commits verified successfully.

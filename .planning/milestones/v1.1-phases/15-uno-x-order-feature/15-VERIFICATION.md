---
phase: 15-uno-x-order-feature
verified: 2026-02-22T21:30:00Z
status: passed
score: 6/6 must-haves verified
requirements_coverage:
  - id: ORDER-07
    status: satisfied
    evidence: "Complete Uno-X order implementation with schema, scoring, and UI"
---

# Phase 15: Uno-X Order Feature Verification Report

**Phase Goal:** Implement new Uno-X order with reverse standings draft for bonus GT riders

**Verified:** 2026-02-22T21:30:00Z

**Status:** passed

**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Teams can submit Uno-X order for any Grand Tour race | ✓ VERIFIED | orders-client.tsx shows unowned_rider_pool case (line 496), actions.ts validates submission (line 276) |
| 2 | When activated, each team picks one bonus rider from the unowned rider pool | ✓ VERIFIED | BonusRiderPick component exists, pickBonusRider action implemented with full validation (actions.ts line 349) |
| 3 | Draft order is reverse standings (last place picks first) | ✓ VERIFIED | computeReverseDraftOrder sorts by totalPoints ASC (order-queries.ts line 828), admin UI shows reverse order |
| 4 | Bonus riders score points only for the specific GT they were picked for | ✓ VERIFIED | scoring-queries.ts uses OR clause for race matching (lines 111-112, 218-219) to scope bonus points to GT parent + stages |
| 5 | Bonus riders do NOT count against team roster limits | ✓ VERIFIED | Separate bonusRiders table, queried independently in scoring-queries.ts (lines 197-227), not in draft picks |
| 6 | Admin can see which bonus riders were picked per team per GT | ✓ VERIFIED | BonusRiderDraft component shows draft state with picks table, integrated into admin/orders/page.tsx (line 151) |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/bonus-riders.ts` | bonusRiders Drizzle schema with 8 columns, 4 indexes, unique constraint, 5 relations | ✓ VERIFIED | 46 lines, all columns present (id, leagueId, teamId, riderId, raceId, orderId, pickOrder, pickedAt), all indexes and unique constraint defined, all relations to leagues/teams/riders/races/orders |
| `src/db/migrations/0002_add_bonus_riders.sql` | DDL for bonus_riders table | ✓ VERIFIED | 14 lines, CREATE TABLE with all columns, 4 indexes, unique constraint |
| `scripts/migrate-uno-x-order.ts` | Migration script for Uno-X order type | ✓ VERIFIED | 122 lines, uses Pool.connect, supports --dry-run, creates table + inserts order type in transaction |
| `src/lib/order-queries.ts` | Uno-X backend functions | ✓ VERIFIED | computeReverseDraftOrder (line 828), getUnownedRidersForGT (847), getBonusRidersForRace (899), saveBonusRiderPick (929), bonus_rider_draft case (414) |
| `src/lib/scoring-queries.ts` | Bonus rider scoring integration | ✓ VERIFIED | bonusRiders import (line 8), separate aggregation query (99-118), merge into standings, isBonus flag in TeamRiderScore type (line 259) |
| `src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx` | Uno-X order target step UI | ✓ VERIFIED | unowned_rider_pool case (line 496) with info box and continue button |
| `src/app/admin/orders/bonus-rider-draft.tsx` | Admin bonus rider draft UI | ✓ VERIFIED | 149 lines, BonusRiderDraft component with draft order table, pick status badges, draft complete indicator |
| `src/app/(main)/leagues/[leagueId]/orders/bonus-rider-pick.tsx` | Team bonus rider picking UI | ✓ VERIFIED | 227 lines, BonusRiderPick component with draft order table, rider selection grid, search, turn enforcement UI |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| src/db/schema/bonus-riders.ts | src/db/schema/index.ts | barrel export | ✓ WIRED | Line 11: `export * from "./bonus-riders"` |
| src/db/schema/bonus-riders.ts | src/db/schema/leagues.ts | foreign key references | ✓ WIRED | Lines 10-14: references to leagues, teams, riders, races, orders tables |
| src/lib/order-queries.ts | src/db/schema/bonus-riders.ts | Drizzle query on bonusRiders table | ✓ WIRED | Lines 899-927: getBonusRidersForRace queries bonusRiders table with joins |
| src/lib/scoring-queries.ts | src/db/schema/bonus-riders.ts | LEFT JOIN for bonus rider points | ✓ WIRED | Lines 99-118: separate bonus points query with INNER JOINs, OR clause for race matching |
| src/app/(main)/leagues/[leagueId]/orders/actions.ts | src/lib/order-queries.ts | submitOrder validation for bonus_rider_draft | ✓ WIRED | Line 276: unowned_rider_pool validation allows submission |
| src/app/admin/orders/bonus-rider-draft.tsx | src/lib/order-queries.ts | getBonusRidersForRace, computeReverseDraftOrder | ✓ WIRED | Called via getBonusRiderDraftState server action (admin/orders/actions.ts line 242) |
| src/app/(main)/leagues/[leagueId]/orders/bonus-rider-pick.tsx | src/lib/order-queries.ts | saveBonusRiderPick | ✓ WIRED | Called via pickBonusRider server action (orders/actions.ts line 349) |
| src/app/admin/orders/page.tsx | src/app/admin/orders/bonus-rider-draft.tsx | component import and rendering | ✓ WIRED | Line 5: import, Line 151-153: BonusRiderDraft rendered with props |

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| ORDER-07: New Uno-X order — each team picks a bonus rider per GT from unowned pool, reverse standings draft order | ✓ SATISFIED | All 6 truths verified: order submission (UI + validation), bonus rider picking (turn-based UI + server action), reverse standings (computeReverseDraftOrder), GT-scoped scoring (race matching OR clause), no roster limit impact (separate table/queries), admin visibility (BonusRiderDraft component) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/app/admin/orders/bonus-rider-draft.tsx | 81 | `return null` | ℹ️ Info | Valid early return when no activated drafts - not a blocker |
| src/app/(main)/leagues/[leagueId]/orders/bonus-rider-pick.tsx | 188 | `placeholder` attribute | ℹ️ Info | Standard HTML placeholder for search input - not anti-pattern |

**No blockers found.** All implementations are substantive and wired.

### Human Verification Required

None - all functionality is programmatically verifiable or already verified in summaries.

### Verification Details

#### Plan 15-01: Data Foundation

**Truths:**
1. ✓ bonus_riders table exists in database with correct schema
   - Evidence: bonus-riders.ts (46 lines), migration SQL (14 lines), all columns/indexes/constraints present
2. ✓ Uno-X order type exists in orderTypes table with GT applicability
   - Evidence: seed-scoring.ts line 774 has "uno_x" entry with applicableRaceTypes: ["grand_tour", "womens_grand_tour"]
3. ✓ Existing production data can be migrated to include the new order type
   - Evidence: migrate-uno-x-order.ts implements transaction with DDL + INSERT ON CONFLICT DO NOTHING, supports --dry-run

**Artifacts:** All verified (schema, migration, script)

**Key Links:** All wired (barrel export line 11, foreign key references in schema)

#### Plan 15-02: Backend Logic

**Truths:**
1. ✓ Teams can submit the Uno-X order for any Grand Tour race through the existing orders UI
   - Evidence: orders-client.tsx line 496 (unowned_rider_pool UI case), actions.ts line 276 (validation)
2. ✓ When Uno-X is activated by admin, a reverse standings draft order is computed
   - Evidence: computeReverseDraftOrder (order-queries.ts line 828) sorts standings by totalPoints ASC
3. ✓ Each team can pick one bonus rider from the unowned rider pool
   - Evidence: getUnownedRidersForGT (line 847), saveBonusRiderPick (line 929), unique constraint enforces one per team per GT
4. ✓ Bonus riders score points only for the specific GT they were picked for
   - Evidence: scoring-queries.ts lines 111-112, 218-219 use OR(eq(races.id, bonusRiders.raceId), eq(races.parentRaceId, bonusRiders.raceId))
5. ✓ Bonus riders do NOT count against team roster limits
   - Evidence: bonusRiders queried separately (lines 197-227), not part of draft picks or lineup filtering

**Artifacts:** All verified (order-queries.ts has all 4 functions + bonus_rider_draft case, scoring-queries.ts has bonus integration, orders-client.tsx has UI case)

**Key Links:** All wired (bonusRiders table queries, scoring integration with OR clause, order submission validation)

#### Plan 15-03: UI Integration

**Truths:**
1. ✓ Admin can activate Uno-X orders and see the reverse standings draft order
   - Evidence: getActivatedUnoXOrders (admin/orders/actions.ts line 214), BonusRiderDraft component shows draft order table
2. ✓ Admin can see which bonus riders were picked per team per GT
   - Evidence: getBonusRiderDraftState (line 242), draft table shows "Picked" status with rider name
3. ✓ Each team picks one bonus rider from the unowned pool in draft order
   - Evidence: BonusRiderPick component (227 lines), pickBonusRider server action (line 349) with turn validation
4. ✓ Draft order follows reverse standings (last place picks first)
   - Evidence: computeReverseDraftOrder returns teams sorted by points ASC, UI displays in that order
5. ✓ Picked bonus riders are visible in the team's orders section
   - Evidence: BonusRiderPick shows picked rider (lines 127-153), "Bonus Draft Active" badge in My Orders (orders-client.tsx line 609)

**Artifacts:** All verified (bonus-rider-draft.tsx 149 lines, bonus-rider-pick.tsx 227 lines, both integrated into pages)

**Key Links:** All wired (admin component calls getBonusRiderDraftState, team component calls pickBonusRider, both rendered in pages)

### Commits Verified

All 6 commits from the 3 plans verified in git history:

- ✓ a41d16f - feat(15-01): add bonus_riders schema and migration
- ✓ cc10788 - feat(15-01): add Uno-X order type seed and migration script
- ✓ c9d7bd8 - feat(15-02): add Uno-X order UI support for bonus rider draft
- ✓ b7f42d0 - feat(15-02): integrate bonus riders into scoring queries
- ✓ 0a6563a - feat(15-03): build admin bonus rider draft management UI
- ✓ 96064cd - feat(15-03): build team bonus rider picking UI

---

_Verified: 2026-02-22T21:30:00Z_
_Verifier: Claude (gsd-verifier)_

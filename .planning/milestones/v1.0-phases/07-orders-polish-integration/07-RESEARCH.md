# Phase 7: Orders & Polish & Integration — Research

**Researched:** 2026-02-14
**Domain:** Strategic game mechanic (order system), scoring integration, fantasy sports
**Confidence:** HIGH (codebase), HIGH (architecture patterns), MEDIUM (order effect calculation complexity)

---

## Summary

Phase 7 implements the strategic orders system — the game's key differentiator — and ensures the scoring pipeline incorporates order effects. The `orderTypes` reference table already exists with 12 order types seeded in Phase 1. What is missing is: (1) an `orders` table to record submitted order instances, (2) an order submission UI for users, (3) the scoring integration to apply order multipliers/effects when calculating team standings, and (4) admin validation tooling to review and approve orders.

The fundamental architecture question is **when** order effects are applied: at result entry time (pre-calculation, stored in `raceResults.points`) or at query time (post-calculation, computed in standings queries). The existing codebase stores `raceResults.points` as pre-calculated finish-position points. Order effects — multipliers, zero-points, counter mechanics — are **per-team per-race** and vary by which team submitted which order. This makes pre-calculation at result entry time impractical (different teams see different effective points). The correct architecture is: store raw scoring points in `raceResults.points` (as now), store submitted orders in an `orders` table, and apply order effects in the scoring aggregation queries (or a separate order-adjusted-points view/function).

The counter mechanic (Shimanobil countered by Etappeseier/Blodpose returns the order to the attacker) is the most complex business logic. It requires comparing which orders were submitted across teams for the same race before computing final effective points.

The integration/polish work (Phase 8 merged in) is primarily ensuring standings reflect order effects and any residual UI polish — the standings, leaderboard, and race breakdown pages already exist and work correctly; they just need to incorporate order-adjusted points.

**Primary recommendation:** Add a new `orders` table to record submitted order instances. Implement order submission UI at `/leagues/[leagueId]/orders`. Apply order effects in a new `calculateOrderAdjustedPoints` function that wraps the existing scoring aggregation. Admin validation at `/admin/orders` (stub already exists). Use the Server Action + Zod + `revalidatePath` pattern consistent with transfers and results.

---

## Existing Codebase Findings

### What Already Exists

| Asset | Location | Status |
|-------|----------|--------|
| `orderTypes` table + schema | `src/db/schema/config.ts` | Exists — 12 order types seeded |
| `orderTypes` seed data | `src/db/seed-scoring.ts` lines 505–634 | All 12 orders seeded with JSONB effects |
| Admin orders page stub | `src/app/admin/orders/page.tsx` | "Coming in Phase 7" placeholder + order types reference list |
| Admin orders nav link | `src/app/admin/layout.tsx:62` | Live, navigates to stub |
| Scoring queries | `src/lib/scoring-queries.ts` | 4 functions — aggregate raw `raceResults.points`, no order effects |
| `raceResults.points` | `src/db/schema/results.ts` | Pre-calculated finish-position points stored on insert |
| `scoring-preview.ts` | `src/lib/scoring-preview.ts` | `previewScoringImpact` and `calculatePoints` — no order effect |
| Standings UI | `src/app/(main)/leagues/[leagueId]/standings/` | Working — 3 tabs: Leaderboard, My Team, Race Results |
| Race breakdown UI | `src/app/(main)/leagues/[leagueId]/standings/[raceId]/page.tsx` | Working — shows rider contributions per team |
| `league-auth.ts` | `src/lib/league-auth.ts` | `checkLeagueMembership`, `checkLeagueOwnership` — reuse for order submission auth |

### The `orderTypes` Table (Reference Data)

All 12 order types are seeded. Key structure:

```typescript
// src/db/schema/config.ts
export const orderTypes = pgTable("orderTypes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("displayName").notNull(),
  applicableRaceTypes: jsonb("applicableRaceTypes").notNull(),  // string[]
  effect: jsonb("effect").notNull(),  // typed effect descriptor
  description: text("description")
})
```

The 12 order types and their effects (from `seed-scoring.ts`):

| Name | Applicable Race Types | Effect |
|------|-----------------------|--------|
| `blodpose_one_day` | high/low_priority_one_day | Multiplier x2 (high) or x2.5 (low) on own rider |
| `shimanobil` | one-day, GT, mini_tour, womens_GT, womens_one_day | Zero points for opponent's rider |
| `gammel_venn` | high/low_priority_one_day | Multiplier x2 (high) or x3 (low) for unowned rider |
| `kaptein` | world_championship | Choice: x2 one rider OR x1.5 country/all riders |
| `blodpose_gt` | grand_tour, womens_grand_tour | Multiplier x3 for own rider |
| `etappeseier` | grand_tour, womens_grand_tour | Double top-10 stage finish points for all own riders |
| `hammer` | grand_tour | 3 pts per GC position lost by target rider (max 30, stage 11+) |
| `covid` | grand_tour, womens_grand_tour | All opponent's riders get half points |
| `innlagt_spurt` | grand_tour (Giro only) | Choose a real pro team, get their sprint points |
| `bondestreik` | grand_tour (TdF only) | One opponent's riders get 0 finish points |
| `lagtempo` | grand_tour (Vuelta only, no TTT) | Choose real team, 5 pts per top-20 placement |
| `sponsorens_ritt` | womens_grand_tour | Double end-of-tour points for all own riders |

### The Counter Mechanic (Requirements)

Per phase context:
- **Shimanobil** (zero points to opponent rider) can be countered by **Etappeseier** (attacker's order returns to them) or **Blodpose** (attacker's order returns to them)
- **COVID** (half points to all opponent riders) can be countered by **Etappeseier** or **Blodpose**
- When counter is active: the attacker's own order effect bounces back to the attacker's team

### What Does NOT Yet Exist

1. An `orders` table to store submitted order instances (teamId, raceId, orderTypeId, targetRiderId, etc.)
2. Order submission UI for users (planned: `/leagues/[leagueId]/orders`)
3. Order effect application in scoring queries
4. Admin order validation/approval workflow (stub exists but has no data layer)
5. Counter mechanic resolution logic

### How the Scoring Architecture Works

`raceResults.points` stores raw position-based points (calculated at result entry time in `src/app/admin/results/actions.ts:submitRaceResults`). The standings aggregation in `scoring-queries.ts` simply `SUM(raceResults.points)`.

Order effects change the *effective* points per team, not the *stored* base points. Therefore:

- **Option A (query-time):** Apply order multipliers in the standings query JOIN logic or in post-aggregation JS. The `orders` table is joined to `raceResults` + `draftPicks` to derive `effectivePoints = basePoints * multiplier`.
- **Option B (event-time):** When an order is applied (admin approves), write adjusted points into a separate `orderAdjustedPoints` table or update `raceResults.points` directly.

Option A (query-time) is preferred because:
- It is consistent with the existing data-driven JSONB pattern for scoring config
- Allows retroactive correction if order entries need to change
- Avoids mutation of `raceResults.points` which is already used correctly for base scoring
- Standings query is already doing complex joins — adding order effect joins is natural

**Note:** The most complex orders (Hammer, Innlagt Spurt, Lagtempo) compute points from external data not currently in the `raceResults` table. These require special handling:
- `hammer`: needs GC standings position data for a specific rider across stages
- `innlagt_spurt`: needs sprint classification results for a real pro team
- `lagtempo`: needs top-20 finishes per real team per stage

This suggests that some order effects generate "bonus points" rows rather than multiplying existing ones.

### Established Patterns to Follow

| Pattern | Where Established | Apply in Phase 7 |
|---------|------------------|-----------------|
| Server Action + Zod + `revalidatePath` | `admin/results/actions.ts`, `transfers/actions.ts` | Order submission, admin validation |
| `checkAdminAuth()` helper | `admin/results/actions.ts:17` | Admin order operations |
| `checkLeagueMembership` | `lib/league-auth.ts` | User order submission validation |
| `useTransition` + `toast` | `transfers/transfer-form.tsx` | Order form client feedback |
| Tabs UI pattern | `standings/standings-client.tsx` | Orders page tabbed layout |
| Card-based form | `transfers/transfer-form.tsx` | Order submission card |
| JSONB typed with `$type<T>()` | `leagues.ts:LeagueConfig` | Type the order `effect` JSONB |
| Two-step form (select then confirm) | `transfers/transfer-form.tsx` | Order form: select order type → configure target |
| Status enum | `transfers.ts:transferBidStatusEnum` | Order status (pending, active, rejected, countered) |
| Audit trail | `results.ts:resultAudit`, `transfers.ts:transferAudit` | Order audit log |
| Direct SQL for migrations | STATE.md decision #04-01 | All new tables via direct SQL |
| Pool.connect() for DDL | STATE.md note | DDL migrations to Neon |
| Negative pickNumbers as sentinel | STATE.md decision #06-01 | Not applicable here |

---

## Standard Stack

All tools from prior phases — no new dependencies needed for Phase 7.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | ^0.45.1 | DB schema, queries | Established in all prior phases |
| Next.js Server Actions | 16.1.6 | Form submissions, mutations | Used in all server-side mutations |
| Zod | ^4.3.6 | Input validation | Used in all action files |
| `drizzle-orm/pg-core` | same | `pgTable`, `serial`, `text`, `integer`, `jsonb`, `pgEnum`, `timestamp`, `index`, `uniqueIndex` | Established schema pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | ^2.0.7 | Toast notifications | All client-side feedback |
| `react-hook-form` | ^7.71.1 | Complex form state | Multi-step order form |
| `date-fns` | ^4.1.0 | Date formatting | Race/order deadline display |
| `lucide-react` | ^0.563.0 | Icons | Consistent admin UI |
| `shadcn/ui` | ^3.8.4 | UI components | All UI elements |

### shadcn/ui Components Available
All installed components (from `/src/components/ui/`):
`alert-dialog`, `alert`, `avatar`, `badge`, `button`, `card`, `combobox`, `dialog`, `dropdown-menu`, `form`, `input-group`, `input`, `label`, `select`, `sheet`, `sonner`, `table`, `tabs`, `textarea`

**No new npm packages needed for Phase 7.**

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── db/
│   └── schema/
│       └── orders.ts          # NEW: orders table (submitted instances)
│       └── config.ts          # EXISTS: orderTypes reference table (unchanged)
│       └── index.ts           # UPDATE: export orders
├── lib/
│   ├── order-queries.ts       # NEW: order submission, validation, effect queries
│   ├── scoring-queries.ts     # UPDATE: incorporate order-adjusted points in standings
│   └── scoring-preview.ts    # MAYBE UPDATE: preview with order effects
└── app/
    ├── (main)/leagues/[leagueId]/
    │   ├── orders/
    │   │   ├── page.tsx        # NEW: order submission page for users
    │   │   ├── orders-client.tsx # NEW: order form client component
    │   │   └── actions.ts      # NEW: submitOrder, cancelOrder server actions
    │   └── page.tsx            # UPDATE: add Orders button card
    └── admin/
        └── orders/
            └── page.tsx        # UPDATE: replace stub with real data + validation UI
            └── actions.ts      # NEW: admin order validation actions
```

### Pattern 1: Orders Table Schema

The `orders` table records submitted order instances (one per team per race, enforced by unique constraint):

```typescript
// src/db/schema/orders.ts
import { pgTable, serial, integer, text, timestamp, jsonb, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { leagues, teams } from "./leagues"
import { races } from "./races"
import { riders } from "./riders"
import { orderTypes } from "./config"
import { user } from "./users"

export const orderStatusEnum = pgEnum("order_status", [
  "pending",    // submitted, awaiting admin validation
  "active",     // admin has validated, will be applied to scoring
  "rejected",   // admin rejected (invalid order)
  "countered",  // another team's counter order neutralized it
])

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  raceId: integer("raceId").notNull().references(() => races.id),
  orderTypeId: integer("orderTypeId").notNull().references(() => orderTypes.id),
  status: orderStatusEnum("status").notNull().default("pending"),
  // The target specification (varies by order type):
  targetRiderId: integer("targetRiderId").references(() => riders.id), // for rider-targeted orders
  targetTeamId: integer("targetTeamId").references(() => teams.id),   // for team-targeted orders
  targetProTeam: text("targetProTeam"),  // for real-team orders (innlagt_spurt, lagtempo)
  targetCountry: text("targetCountry"),  // for kaptein country variant
  orderConfig: jsonb("orderConfig"),     // additional params (kaptein choice: single/country)
  adminNote: text("adminNote"),
  submittedAt: timestamp("submittedAt", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  resolvedBy: text("resolvedBy").references(() => user.id),
}, (table) => ({
  leagueIdx: index("orders_league_idx").on(table.leagueId),
  teamIdx: index("orders_team_idx").on(table.teamId),
  raceIdx: index("orders_race_idx").on(table.raceId),
  // One order per team per race (critical game rule)
  teamRaceUnique: uniqueIndex("orders_team_race_unique").on(table.teamId, table.raceId),
}))
```

**Key design decisions:**
- `teamRaceUnique`: enforces the "one order per stage/race" rule at DB level
- Multiple optional target columns (nullable) to handle the varied targeting of different order types
- `orderConfig` JSONB for additional runtime parameters (e.g., Kaptein's single-rider vs country choice)
- `status` enum mirrors the transfer bid pattern for consistency

### Pattern 2: Order Effect Application in Scoring

Order effects are applied in a post-aggregation step in the scoring queries, not by mutating `raceResults.points`.

The architecture:
1. Existing scoring queries aggregate base points from `raceResults.points` (unchanged)
2. A new `getOrderAdjustedStandings` function fetches active orders for a race and applies multipliers in JS after the base query

```typescript
// Conceptual pattern for order effect application
// src/lib/order-queries.ts

export type OrderEffect = {
  type: "multiplier" | "zero_points" | "half_points" | "double_top10_stage" | "double_end_tour" | ...
  targetTeamId?: number
  targetRiderId?: number
  multiplier?: number
}

export async function getActiveOrdersForRace(raceId: number, leagueId: number): Promise<ActiveOrder[]> {
  // Join orders + orderTypes to get effect JSONB + all targeting info
  // WHERE orders.raceId = raceId AND orders.leagueId = leagueId AND orders.status = 'active'
}

export function applyOrderEffects(
  baseScores: RiderScore[],
  activeOrders: ActiveOrder[],
  counterOrders: ActiveOrder[]
): RiderScore[] {
  // 1. Check counters first (Etappeseier/Blodpose counters Shimanobil/COVID)
  // 2. Apply remaining order multipliers to relevant rider scores
  // 3. Return adjusted scores
}
```

**Counter mechanic logic:**
```
For each "attack" order (shimanobil, covid, bondestreik):
  Check if the attacked team has a counter order (etappeseier, blodpose_gt) on the same race
  If yes:
    - The attack order is "countered" (its effect returns to attacker's team)
    - Example: Shimanobil targeting team B's rider, but team B played Etappeseier →
      team A's attacker's own rider gets 0 points (blowback)
  If no:
    - Attack order applies normally
```

### Pattern 3: Order Submission UI

Follow the two-step form pattern from `transfers/transfer-form.tsx`:

```
Step 1: Select order type (filtered by applicable race types for the current race)
Step 2: Configure target (rider picker, team picker, pro team input — varies by order type)
Step 3: Confirm submission
```

Key validation rules enforced in the server action:
- Race type must match `orderType.applicableRaceTypes`
- For GT-specific orders: check race restriction (Giro/TdF/Vuelta only)
- One order per team per race (DB unique constraint as backstop)
- Target rider must be owned by the team (for own-rider orders)
- Target rider must be owned by an opponent (for attack orders)
- Unowned rider validation for `gammel_venn`
- `hammer`: target must be in GC top-10 at stage 11+
- Cannot submit orders for World Championship except `kaptein`/`laginnsats`

### Anti-Patterns to Avoid

- **Mutating `raceResults.points` with order effects:** Order effects are per-team, base points are universal. Storing adjusted points in `raceResults` would contaminate the shared source of truth.
- **Applying order effects at order-submission time:** Counter mechanics require knowing both teams' orders simultaneously — you cannot resolve counters until admin validates both sides.
- **Modeling all order types identically:** The targeting model varies significantly. Use nullable target columns rather than forcing a single schema shape.
- **Skipping the DB unique constraint on (teamId, raceId):** Application-level checks are insufficient; the DB constraint is the safety net.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast | `sonner` (already installed) | Consistent with transfer form pattern |
| Form state management | Raw `useState` for multi-step form | `useTransition` + local state (as in transfer-form.tsx) | Matches established pattern |
| Optimistic updates | Custom cache invalidation | `revalidatePath` in server actions | Next.js App Router convention |
| Input validation | Custom validators | Zod schemas (as in all prior action files) | Type-safe, consistent error structure |
| Admin auth check | Inline session check | `checkAdminAuth()` (established in results/actions.ts) | Centralized admin check pattern |

---

## Common Pitfalls

### Pitfall 1: Order Effect Scope Confusion

**What goes wrong:** Applying order effects at the `raceResults` level (globally) when they should be at the `draftPicks + raceResults` (per-team) level.

**Why it happens:** `raceResults.points` is a flat table per rider per race — it has no team dimension. Team context only comes through `draftPicks` join.

**How to avoid:** Always apply order effects after joining through `draftPicks` to get the `teamId`. Order effects modify "points this team earns from this rider in this race," not "points stored for this rider in this race."

**Warning signs:** If you find yourself updating `raceResults.points` with multipliers, you've gone wrong.

### Pitfall 2: Counter Mechanic Ordering

**What goes wrong:** Resolving counter mechanics before all orders for a race are known, or applying them in the wrong order.

**Why it happens:** Counters require knowledge of both attack and defense orders simultaneously.

**How to avoid:** Counter resolution must happen at scoring calculation time (or admin validation time), using all active orders for the race in a single pass. Process attack orders, check for counters, then compute adjusted points.

### Pitfall 3: Stage vs Race Identity for Orders

**What goes wrong:** Confusion between submitting an order for a "stage" (child race with `parentRaceId`) vs the parent grand tour.

**Why it happens:** The `races` table has parent/child structure for GT stages. The `orderTypes.applicableRaceTypes` references `grand_tour` (the parent type), but an order is submitted for a specific stage.

**How to avoid:** The `orders.raceId` should reference the specific stage (child race). When validating the order type, check the parent race's `raceType` (via `races.parentRaceId → races.raceType`). Reuse the same parent-race lookup pattern from `scoring-preview.ts:previewScoringImpact`.

### Pitfall 4: One Order Per Stage vs Per Parent Race

**What goes wrong:** Allowing one order per parent race ("Tour de France") instead of one per stage.

**Why it happens:** The unique constraint on `(teamId, raceId)` needs careful scoping.

**How to avoid:** The unique constraint on `orders(teamId, raceId)` where `raceId` is the stage ID is correct. This allows one order per stage. World Championship and one-day races have only one race entry, so the constraint naturally applies.

### Pitfall 5: GT-Specific Race Restrictions

**What goes wrong:** `innlagt_spurt` (Giro only), `bondestreik` (TdF only), `lagtempo` (Vuelta only) must be validated against the specific race, not just the `grand_tour` type.

**Why it happens:** The `orderTypes.effect.restriction` JSONB field captures this (`"giro_only"`, `"tdf_only"`, `"vuelta_only_no_ttt"`), but enforcement must happen in application code.

**How to avoid:** Parse `orderTypes.effect.restriction` in the submission action. The race name (e.g., "Giro d'Italia") or a race-specific flag can be used. Add a `raceSeries` field to the `races` table or use name matching.

**Note:** This may require a small schema extension — consider adding a `series` column to `races` (e.g., "giro", "tdf", "vuelta") to support this cleanly.

### Pitfall 6: drizzle-kit Version Mismatch

**What goes wrong:** `npm run db:generate` or `npm run db:migrate` fails due to drizzle-kit 0.18.x incompatibility.

**Why it happens:** Established in STATE.md decision #04-01 — drizzle-kit 0.31.9 has a type error in `drizzle.config.ts`.

**How to avoid:** Apply all new migrations via direct SQL using `Pool.connect()` to the Neon database. Do NOT use `drizzle-kit generate/migrate` for new tables.

### Pitfall 7: Scoring Integration Scope

**What goes wrong:** Spending too much time on "complete" order effect calculation for complex orders (Hammer, Innlagt Spurt, Lagtempo) and blocking the simpler multiplier orders.

**Why it happens:** These three orders require data not currently tracked in the app (intermediate sprint results by team, GC position over time).

**How to avoid:** Implement the complex orders as "manually entered bonus points" in the admin interface rather than auto-calculated. The admin enters the bonus manually after computing it from external data. Simple multipliers (Blodpose, COVID, Shimanobil, Etappeseier, etc.) can be auto-calculated.

---

## Code Examples

### Existing: Scoring Query Pattern (to be extended)

```typescript
// Source: src/lib/scoring-queries.ts
export async function getLeagueStandings(leagueId: number, season: number) {
  const rows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      userId: teams.userId,
      totalPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
    })
    .from(teams)
    .leftJoin(draftPicks, and(
      eq(draftPicks.teamId, teams.id),
      eq(draftPicks.leagueId, leagueId)
    ))
    .leftJoin(raceResults, eq(raceResults.riderId, draftPicks.riderId))
    .leftJoin(races, and(
      eq(races.id, raceResults.raceId),
      eq(races.season, season),
      gte(races.startDate, draftPicks.pickedAt)  // ownership-at-race-time
    ))
    .where(eq(teams.leagueId, leagueId))
    .groupBy(teams.id, teams.name, teams.userId)
    .orderBy(desc(sql`COALESCE(SUM(${raceResults.points}), 0)`))
  // ...
}
```

Phase 7 adds order-adjusted points on top of this. The cleanest approach is:
1. Keep the existing query as base (returns raw points per team)
2. Add a separate query: `getActiveOrdersForLeagueSeason(leagueId, season)` returning all active orders
3. In JS, iterate raw points and apply order adjustments

### Existing: Server Action Pattern (to follow)

```typescript
// Source: src/app/(main)/leagues/[leagueId]/transfers/actions.ts
"use server"

export async function submitTransferBid(input: {
  leagueId: number
  outRiderId: number
  inRiderId: number
  reason?: string
}) {
  const session = await checkAuth()
  const { isMember } = await checkLeagueMembership(session.user.id, input.leagueId)
  if (!isMember) {
    return { success: false, error: "Not a member of this league" }
  }
  // Zod validation, DB insert, revalidatePath
}
```

### Existing: JSONB Effect Field Structure

```typescript
// Source: src/db/seed-scoring.ts — example effect shapes
{ type: "multiplier", values: { high_priority_one_day: 2, low_priority_one_day: 2.5 }, target: "own_rider" }
{ type: "zero_points", target: "opponent_rider" }
{ type: "choice", options: { single_rider: { multiplier: 2 }, country_all: { multiplier: 1.5 } }, target: "own_rider_or_country" }
{ type: "double_top10_stage", target: "all_own_riders" }
{ type: "gc_position_loss", points_per_position: 3, max_points: 30, restriction: "stage_11_plus", target: "unowned_gc_top10" }
{ type: "half_points", target: "opponent_all_riders" }
{ type: "team_sprint_points", restriction: "giro_only", target: "real_team" }
{ type: "zero_finish_points", restriction: "tdf_only", target: "opponent_all_riders" }
{ type: "team_placement_points", points_per_top20: 5, restriction: "vuelta_only_no_ttt", target: "real_team" }
{ type: "double_end_tour", target: "all_own_riders" }
```

---

## Phase Decomposition Recommendation

Based on the complexity analysis, Phase 7 should be broken into 3–4 plans:

### Plan 07-01: Orders Schema + Migration

**Goal:** Create `orders` table, schema file, barrel export, migration SQL, add to `schema/index.ts`

**Scope:**
- `src/db/schema/orders.ts` — `orderStatusEnum` + `orders` table with all fields and relations
- Update `src/db/schema/index.ts` to export orders
- Direct SQL migration (Pool.connect() pattern)
- **No UI, no scoring changes yet**

**Duration estimate:** ~3 min (follows exact transfer schema pattern)

### Plan 07-02: Order Submission UI (User-Facing)

**Goal:** Users can submit one order per race. Form validates eligibility, target, and race type.

**Scope:**
- `src/app/(main)/leagues/[leagueId]/orders/page.tsx` — server page fetching current races and user's orders
- `src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx` — client form with two-step UI
- `src/app/(main)/leagues/[leagueId]/orders/actions.ts` — `submitOrder`, `cancelOrder` server actions
- Update league detail page to add Orders navigation button
- Server action validates: race type compatibility, one-order-per-race, target validity

**Duration estimate:** ~10 min (transfer form is the direct analog)

### Plan 07-03: Admin Order Validation

**Goal:** Admin can review pending orders, approve/reject them, and see order history.

**Scope:**
- `src/app/admin/orders/page.tsx` — replace stub with real data table of pending/active orders
- `src/app/admin/orders/actions.ts` — `approveOrder`, `rejectOrder` server actions (NEW FILE)
- Admin sees: order type, submitting team, target, race, status
- Approve sets status → "active"; reject sets status → "rejected" with adminNote

**Duration estimate:** ~8 min (admin transfer approval is the analog)

### Plan 07-04: Scoring Integration + Counter Mechanics + Polish

**Goal:** Standings incorporate order effects; counter mechanic resolves correctly; final UI polish.

**Scope:**
- `src/lib/order-queries.ts` — NEW: `getActiveOrdersForRace`, `applyOrderEffects`, `resolveCounters`
- Update `src/lib/scoring-queries.ts` — incorporate order-adjusted points in `getLeagueStandings` and `getTeamRiderScores`
- Counter mechanic resolution: Shimanobil/COVID countered by Etappeseier/Blodpose
- Update standings page to show order effects in race breakdown
- Final polish: ensure all existing pages (standings, race breakdown, league detail) reflect order-adjusted scores

**Duration estimate:** ~15 min (most complex plan — scoring integration + counter logic)

---

## Open Questions

1. **Complex order implementation scope (Hammer, Innlagt Spurt, Lagtempo)**
   - What we know: These orders require data (GC standings per stage, sprint points by real team) not tracked in `raceResults`
   - What's unclear: Should Phase 7 implement full auto-calculation, or admin-entered bonus points?
   - Recommendation: Implement as admin-entered bonus points for Phase 7. Auto-calculation is a future enhancement. The `orders` table can store an `adminBonusPoints` field for this purpose.

2. **Race-series identification for GT-specific restrictions**
   - What we know: `innlagt_spurt` is Giro-only, `bondestreik` is TdF-only, `lagtempo` is Vuelta-only
   - What's unclear: How to distinguish Giro/TdF/Vuelta from the `races` table without a `series` column
   - Recommendation: Add a `series` text column to `races` table (nullable, e.g., "giro", "tdf", "vuelta") as part of Plan 07-01. Admin sets this when creating GT parent races. Alternatively, use name-matching as a simpler but fragile approach.

3. **Kaptein's "country" variant**
   - What we know: Kaptein allows x1.5 multiplier for "all riders from a chosen country" in World Championship
   - What's unclear: Does this apply to all drafted riders from that country, or all riders in the race from that country who are on the user's team?
   - Recommendation: Apply to all drafted riders on the team with `riders.nationality` matching the chosen country.

4. **Gammel Venn scoring flow**
   - What we know: Points from an unowned rider accrue to the team that played Gammel Venn
   - What's unclear: How this integrates with the scoring query — the rider is NOT in `draftPicks` for this team
   - Recommendation: When Gammel Venn is active, the scoring query or post-processing adds the targeted rider's `raceResults.points * multiplier` to the Gammel Venn submitter's score as a bonus addition (similar to admin-entered bonus points approach).

5. **Real-time order deadline visibility**
   - What we know: Orders must be submitted before the race starts
   - What's unclear: Should the UI show a deadline? Is there a cutoff time enforcement?
   - Recommendation: Use `races.startDate` as the implicit deadline. Server action validates that `races.startDate > now()` before accepting order submission.

---

## Sources

### Primary (HIGH confidence — direct code inspection)
- `src/db/schema/config.ts` — orderTypes table schema (verified existing)
- `src/db/seed-scoring.ts` — all 12 order type seeds with JSONB effect shapes (verified)
- `src/lib/scoring-queries.ts` — current scoring aggregation pattern (verified)
- `src/app/admin/orders/page.tsx` — existing stub confirming Phase 7 scope (verified)
- `src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx` — two-step form pattern (verified)
- `src/app/admin/results/actions.ts` — Server Action + Zod + checkAdminAuth pattern (verified)
- `/Users/kristianoftedal/dev/velospill/.planning/STATE.md` — all prior decisions and notes (verified)
- `src/db/schema/transfers.ts` — transfer schema as direct analog for orders schema (verified)

### Secondary (MEDIUM confidence)
- Phase context provided in research request — order requirements list (ORDER-01 through ORDER-18)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all tools established in prior phases
- Architecture (orders table design): HIGH — directly mirrors transfer schema pattern
- Architecture (scoring integration): MEDIUM — order effect application is conceptually clear but implementation complexity varies by order type
- Counter mechanic logic: MEDIUM — the game rule is clear, implementation details need validation
- Complex orders (Hammer, Innlagt Spurt, Lagtempo): LOW — requires external data not in current schema; recommend admin-manual-entry approach

**Research date:** 2026-02-14
**Valid until:** 2026-03-16 (30 days — stable codebase, no fast-moving dependencies)

---

## Critical Facts for Planner

1. **`orderTypes` table exists** with 12 order types seeded. Do NOT recreate it. Only create the `orders` (instances) table.
2. **No new npm packages required** — all tooling is already installed.
3. **Migrations via direct SQL only** — drizzle-kit version mismatch (STATE.md decision #04-01). Use `Pool.connect()`.
4. **`raceResults.points` stores raw base points** — never update these with order multipliers. Apply order effects at query/aggregation time.
5. **One order per team per race** — enforce with DB unique constraint on `(teamId, raceId)`.
6. **Counter mechanic requires both attack and defense orders to be known simultaneously** — resolve at admin validation time or scoring calculation time.
7. **Admin orders nav link already exists** in `src/app/admin/layout.tsx:62`.
8. **The league detail page already has** Draft, Standings, and Transfers buttons — add an Orders button.
9. **Standings and race breakdown pages already work** — Phase 7 integration is additive, not a rebuild.
10. **Three complex orders** (Hammer, Innlagt Spurt, Lagtempo) require external data — scope these as admin-manual-entry in Phase 7, not auto-calculated.

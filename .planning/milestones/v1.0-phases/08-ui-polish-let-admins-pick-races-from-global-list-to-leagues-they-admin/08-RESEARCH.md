# Phase 8: UI Polish — Let Admins Pick Races from Global List to Leagues They Admin - Research

**Researched:** 2026-02-15
**Domain:** Database schema extension, server actions, UI for league-race association
**Confidence:** HIGH — all findings verified directly from codebase inspection

---

## Summary

Phase 8 introduces a `league_races` join table that lets a league owner (the "league admin") assign specific races from the global `races` table to their league. Currently, every feature that needs "races for this league" queries the global `races` table filtered only by `season` year — resulting in all races in a season being visible to all leagues equally. Adding a league-specific race list makes scoring, orders, and transfers scoped to those races.

The schema change is small: one new join table (`league_races`) with `leagueId` + `raceId`, plus a UI on the league detail page (owner-only section) letting the owner toggle which races are included. Downstream, every query that currently does `eq(races.season, season)` will gain an additional `inArray(races.id, leagueRaceIds)` clause, or the queries will join through `league_races`.

The key planning decision is **how to handle existing leagues with no `league_races` rows** — a "fallback to all season races" behaviour would make the migration safe (zero data migration required), but it adds query complexity. Alternatively, on activation of this feature, a migration script pre-populates `league_races` for all active leagues using all their season's races.

**Primary recommendation:** Add a new `league_races` table (leagueId + raceId, unique constraint), expose a race picker UI in the league detail page under "League Management" (owner-only), and update all downstream queries to filter by league-assigned races rather than raw season.

---

## User Constraints

No CONTEXT.md exists — no prior user decisions locked. All design decisions are at Claude's discretion.

---

## Standard Stack

### Core (already in use — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | ORM + schema | Already used everywhere |
| @neondatabase/serverless | ^1.0.2 | DB connection (Pool) | Already in `lib/db.ts` |
| next | 16.1.6 | App framework | Project baseline |
| react-hook-form | ^7.71.1 | Form state | Used in transfer-form.tsx |
| zod | (via @hookform/resolvers) | Validation | Used in all server actions |
| shadcn/ui components | (radix-ui ^1.4.3) | UI primitives | Badge, Button, Card, Table, Checkbox, etc. |
| sonner | ^2.0.7 | Toast notifications | Used in existing client components |
| lucide-react | ^0.563.0 | Icons | Used throughout |

### No New Libraries Required

The entire phase is implementable with existing dependencies. The race picker UI needs a checkbox list or multi-select — both are achievable with shadcn/ui `Checkbox` or `Table` components that are already installed.

---

## Architecture Patterns

### Existing Pattern: Database Schema

```
src/db/schema/
  leagues.ts     — leagues + teams tables
  races.ts       — races table (global, no leagueId)
  transfers.ts   — transferWindows already has leagueId + raceId FK
  orders.ts      — orders has leagueId + raceId FK
```

The project uses Drizzle ORM schema-first: add table to a `.ts` schema file, run `npm run db:generate` then `npm run db:migrate`.

### New Table: league_races

```typescript
// Add to src/db/schema/leagues.ts (or a new leagueRaces.ts)

export const leagueRaces = pgTable("league_races", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  raceId: integer("raceId").notNull().references(() => races.id, { onDelete: "cascade" }),
  addedAt: timestamp("addedAt", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  leagueRaceUnique: uniqueIndex("league_races_league_race_unique").on(table.leagueId, table.raceId),
  leagueIdx: index("league_races_league_idx").on(table.leagueId),
}))
```

**Alternative:** Store race IDs in the `leagues.config` JSONB field. This avoids DDL but makes querying harder (no FK integrity, no JOIN). Reject this — a proper join table is the correct approach.

### Recommended Project Structure

```
src/
├── db/schema/
│   └── leagues.ts                     — add leagueRaces table here
├── app/(main)/leagues/[leagueId]/
│   ├── actions.ts                     — add assignRaceToLeague, removeRaceFromLeague server actions
│   ├── league-client.tsx              — add RacePickerSection client component
│   └── page.tsx                       — pass races data to RacePickerSection
└── lib/
    ├── order-queries.ts               — update getUpcomingRacesForLeague
    ├── transfer-queries.ts            — update generateTransferWindows
    └── scoring-queries.ts             — update getLeagueRacesWithScores
```

### Pattern 1: Server Action for Toggle Assignment

The project uses `"use server"` files with plain async functions passed as props to client components. The league `actions.ts` already has `checkLeagueOwnership` imported from `league-auth.ts`.

```typescript
// In src/app/(main)/leagues/[leagueId]/actions.ts

export async function assignRaceToLeague(leagueId: number, raceId: number) {
  const session = await checkAuth()
  const isOwner = await checkLeagueOwnership(session.user.id, leagueId)
  if (!isOwner) return { success: false, error: "Only the league owner can assign races" }

  await db.insert(leagueRaces).values({ leagueId, raceId }).onConflictDoNothing()
  revalidatePath(`/leagues/${leagueId}`)
  return { success: true }
}

export async function removeRaceFromLeague(leagueId: number, raceId: number) {
  const session = await checkAuth()
  const isOwner = await checkLeagueOwnership(session.user.id, leagueId)
  if (!isOwner) return { success: false, error: "Only the league owner can remove races" }

  await db.delete(leagueRaces)
    .where(and(eq(leagueRaces.leagueId, leagueId), eq(leagueRaces.raceId, raceId)))
  revalidatePath(`/leagues/${leagueId}`)
  return { success: true }
}

export async function getSeasonRacesForLeague(leagueId: number, season: number) {
  // Returns all season races with a flag indicating if they're assigned to this league
  const allRaces = await db.select().from(races)
    .where(and(eq(races.season, season), isNull(races.parentRaceId)))
    .orderBy(races.startDate)

  const assignedIds = await db
    .select({ raceId: leagueRaces.raceId })
    .from(leagueRaces)
    .where(eq(leagueRaces.leagueId, leagueId))

  const assignedSet = new Set(assignedIds.map(r => r.raceId))
  return allRaces.map(r => ({ ...r, assigned: assignedSet.has(r.id) }))
}
```

### Pattern 2: Client Component — Race Picker

The project pattern for owner-only client components is demonstrated in `league-client.tsx` (`InviteSection`, `LeagueStatusControl`). The race picker follows the same pattern: a `"use client"` component that receives server actions as props.

```typescript
// RacePickerSection — passed assignRace/removeRace as props (same as LeagueStatusControl pattern)
"use client"

interface RacePickerSectionProps {
  leagueId: number
  seasonRaces: Array<{ id: number; name: string; raceType: string; startDate: Date; assigned: boolean }>
  assignRace: (leagueId: number, raceId: number) => Promise<{ success: boolean; error?: string }>
  removeRace: (leagueId: number, raceId: number) => Promise<{ success: boolean; error?: string }>
}
```

Use shadcn/ui `Table` with `Checkbox` in each row. The Table pattern is already used in league detail page (Team Roster). Checkbox is available in shadcn/ui (radix-ui already installed).

### Pattern 3: Downstream Query Updates

Every query that currently uses `eq(races.season, season)` with no league scoping needs to also filter by `league_races`.

**Affected queries and their files:**

1. **`getUpcomingRacesForLeague`** (`src/lib/order-queries.ts`, lines 699-732)
   - Currently: `where(and(eq(races.season, season), gt(races.startDate, sql'now()')))`
   - Add: `innerJoin(leagueRaces, and(eq(leagueRaces.raceId, races.id), eq(leagueRaces.leagueId, leagueId)))`
   - Note: the function already takes `leagueId` as a param — just needs the join

2. **`generateTransferWindows`** (`src/lib/transfer-queries.ts`, lines 254-311)
   - Currently: `where(and(eq(races.season, season), isNull(races.parentRaceId)))`
   - Add join on `league_races` to filter to assigned parent races only
   - Takes `leagueId` as param — already available

3. **`getLeagueRacesWithScores`** (`src/lib/scoring-queries.ts`, lines 187-217)
   - Currently scores show for all races in season where any league rider has results
   - Ideally this also scopes to assigned races — but this is lower priority since it's the standings "Race Results" tab

4. **`getLeagueStandings` / `getTeamRiderScores`** (`src/lib/scoring-queries.ts`)
   - These aggregate points across all races in a season. Scoping scoring to league-assigned races is a deeper change.
   - Decision needed: should scoring ONLY count points from league-assigned races? If yes, this is a significant behavior change. If no, scoring stays global and only the Orders/Transfers UI is filtered.

### Anti-Patterns to Avoid

- **Don't store race IDs in `leagues.config` JSONB**: Makes queries harder, no FK integrity.
- **Don't filter by `leagueId` on the `races` table**: Races are global; the join table is the correct way to associate.
- **Don't silently break existing leagues**: Handle the "no league_races rows" case explicitly — either by pre-populating or by falling back.
- **Don't re-query `league_races` inside every function call**: Pass `leagueId` to the existing `order-queries` functions — they already take it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-select race picker | Custom dropdown/combobox | shadcn Table + Checkbox (already installed) | Simpler, matches existing roster table pattern |
| Conflict-safe insert | INSERT ... ON CONFLICT | Drizzle `.onConflictDoNothing()` | Built-in, prevents duplicate rows |
| Auth check | Custom role middleware | `checkLeagueOwnership()` from `lib/league-auth.ts` | Already exists and tested |
| Migration DDL | Raw SQL in actions | `npm run db:generate && db:migrate` | Standard project workflow |

---

## Common Pitfalls

### Pitfall 1: Breaking Existing Leagues on Migration

**What goes wrong:** After adding `league_races` table, all existing leagues have zero rows in it. Every downstream query that joins `league_races` returns empty — orders page shows no upcoming races, transfers show no windows.

**Why it happens:** New join table starts empty. Existing leagues haven't had races assigned yet.

**How to avoid:** Two strategies:
- **Option A (recommended):** Pre-populate `league_races` for all active leagues during migration. A seed/migration script queries `leagues` where `status IN ('setup','drafting','active')`, gets their `config.seasonYear`, then inserts all season parent races into `league_races`.
- **Option B:** Use LEFT JOIN instead of INNER JOIN in downstream queries and fall back to all season races when no `league_races` rows exist. More complex query logic.

**Warning signs:** Orders page renders "No upcoming races" immediately after deployment.

### Pitfall 2: Orders Table Unique Constraint

**What goes wrong:** The `orders` table has `uniqueIndex("orders_team_race_unique").on(table.teamId, table.raceId)`. If a race is removed from a league after orders are submitted, those orders still reference that race. No cascade delete exists on orders from league_races.

**Why it happens:** Orders point to `races.id` directly, not through `league_races`.

**How to avoid:** Removing a race from a league should soft-block: show a warning if orders exist for that race. Don't cascade-delete orders when unassigning a race.

### Pitfall 3: Drizzle `onConflictDoNothing` Requires Named Unique Index

**What goes wrong:** `.onConflictDoNothing()` in Drizzle requires a unique constraint to detect conflicts. Without the `uniqueIndex` on `(leagueId, raceId)`, duplicate rows can be inserted silently.

**Why it happens:** Table definition missing the unique index.

**How to avoid:** Define `uniqueIndex("league_races_league_race_unique").on(table.leagueId, table.raceId)` in the schema (shown above).

### Pitfall 4: `revalidatePath` Scope

**What goes wrong:** After toggling a race assignment, the league page updates but the orders/transfers pages don't reflect changes (stale cache).

**Why it happens:** `revalidatePath` only invalidates what's specified. Orders page and transfers page have separate cached paths.

**How to avoid:** Revalidate multiple paths in the server action:
```typescript
revalidatePath(`/leagues/${leagueId}`)
revalidatePath(`/leagues/${leagueId}/orders`)
revalidatePath(`/leagues/${leagueId}/transfers`)
```

### Pitfall 5: Stage Races vs Parent Races

**What goes wrong:** The race picker shows both parent races AND their stages (e.g., Tour de France and every individual stage). This makes the list unmanageable.

**Why it happens:** `getUpcomingRacesForLeague` queries all races including stages. `generateTransferWindows` already correctly filters `isNull(races.parentRaceId)`.

**How to avoid:** The race picker UI should only show parent races (`parentRaceId IS NULL`). Assigning a parent race implicitly includes its stages for query purposes. Downstream queries that need stages already join via `parentRaceId`.

**Specifically:** `getUpcomingRacesForLeague` already handles this — it does a LEFT JOIN on parent race and builds `displayName` from parent + stage number. When filtering by assigned league races, filter only by parent race IDs, then let stages flow through the existing parentRace join.

---

## Code Examples

### Adding leagueRaces to schema (src/db/schema/leagues.ts)

```typescript
// Verified pattern — follows exact same style as teams table in this file
export const leagueRaces = pgTable("league_races", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  raceId: integer("raceId").notNull().references(() => races.id, { onDelete: "cascade" }),
  addedAt: timestamp("addedAt", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  leagueRaceUnique: uniqueIndex("league_races_league_race_unique").on(table.leagueId, table.raceId),
  leagueIdx: index("league_races_league_idx").on(table.leagueId),
  raceIdx: index("league_races_race_idx").on(table.raceId),
}))

export const leagueRacesRelations = relations(leagueRaces, ({ one }) => ({
  league: one(leagues, { fields: [leagueRaces.leagueId], references: [leagues.id] }),
  race: one(races, { fields: [leagueRaces.raceId], references: [races.id] }),
}))
```

### Updated getUpcomingRacesForLeague (src/lib/order-queries.ts)

```typescript
// Current (lines 699-732) — add innerJoin on leagueRaces to scope by assignment
export async function getUpcomingRacesForLeague(leagueId: number, season: number) {
  const rows = await db
    .select({ ... })
    .from(races)
    .innerJoin(leagueRaces, and(
      eq(leagueRaces.raceId, races.id),
      eq(leagueRaces.leagueId, leagueId)
    ))
    .leftJoin(parentRaces, eq(parentRaces.id, races.parentRaceId))
    .where(
      and(
        eq(races.season, season),
        gt(races.startDate, sql`now()`)
        // leagueRaces join handles league filtering — no extra WHERE needed
      )
    )
    .orderBy(races.startDate)
  // ... rest unchanged
}
```

### Updated generateTransferWindows (src/lib/transfer-queries.ts)

```typescript
// Current (line 265) uses: where(and(eq(races.season, season), isNull(races.parentRaceId)))
// Update to add leagueRaces join:
const parentRaces = await db
  .select({ id: races.id, name: races.name, raceType: races.raceType, startDate: races.startDate })
  .from(races)
  .innerJoin(leagueRaces, and(
    eq(leagueRaces.raceId, races.id),
    eq(leagueRaces.leagueId, leagueId)
  ))
  .where(
    and(
      eq(races.season, season),
      isNull(races.parentRaceId)
    )
  )
  .orderBy(asc(races.startDate))
```

### Server action pattern (following existing league actions.ts pattern)

```typescript
"use server"
import { leagueRaces } from "@/db/schema/leagues"

export async function getSeasonRacesForPicker(leagueId: number) {
  const session = await checkAuth()
  const isOwner = await checkLeagueOwnership(session.user.id, leagueId)
  if (!isOwner) throw new Error("Unauthorized")

  const league = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1)
  if (!league[0]) return []

  const season = (league[0].config as LeagueConfig).seasonYear

  const [allRaces, assigned] = await Promise.all([
    db.select({ id: races.id, name: races.name, raceType: races.raceType, startDate: races.startDate })
      .from(races)
      .where(and(eq(races.season, season), isNull(races.parentRaceId)))
      .orderBy(races.startDate),
    db.select({ raceId: leagueRaces.raceId })
      .from(leagueRaces)
      .where(eq(leagueRaces.leagueId, leagueId))
  ])

  const assignedSet = new Set(assigned.map(r => r.raceId))
  return allRaces.map(r => ({ ...r, assigned: assignedSet.has(r.id) }))
}
```

---

## Key Design Decisions (Unresolved — for planning)

### Decision 1: Does scoring scope to league races?

**Current behavior:** `getLeagueStandings` and `getTeamRiderScores` aggregate points from ALL `raceResults` where `races.season = season`. There is no league scoping on which races contribute to scores.

**Option A:** Leave scoring global — only orders and transfers filter by league-assigned races. Simpler, no scoring query changes.

**Option B:** Add `league_races` join to scoring queries too — only races explicitly assigned to the league count toward standings. This is the "correct" behavior if leagues want to exclude certain races.

**Recommendation:** Option B is more correct for the stated goal ("scoring/orders/transfers only apply to those races"), but has more impact. The planner should decompose this as a separate task from the UI.

### Decision 2: Pre-populate existing league data?

A migration script should insert all season parent races into `league_races` for all active/drafting/setup leagues. This prevents breaking existing leagues.

**Approach:** Write a one-time migration script (similar to `src/db/seed.ts`) that:
1. Queries all leagues with their `config.seasonYear`
2. For each league, queries all parent races for that season
3. Inserts into `league_races` (with `ON CONFLICT DO NOTHING`)

### Decision 3: UI placement — where is the race picker?

The league detail page already has an owner-only "League Management" card. The race picker fits here naturally. A separate section "Race Calendar" card below "League Management" is cleaner since it's a distinct concern.

---

## Affected Files — Complete List

### Schema (DDL change)

- `/Users/kristianoftedal/dev/velospill/src/db/schema/leagues.ts` — add `leagueRaces` table + relations
- `/Users/kristianoftedal/dev/velospill/src/db/schema/index.ts` — already exports everything from leagues.ts (no change needed)

### Server actions (mutation + data fetch)

- `/Users/kristianoftedal/dev/velospill/src/app/(main)/leagues/[leagueId]/actions.ts` — add `assignRaceToLeague`, `removeRaceFromLeague`, `getSeasonRacesForPicker`

### UI (league detail page — owner section)

- `/Users/kristianoftedal/dev/velospill/src/app/(main)/leagues/[leagueId]/page.tsx` — fetch races for picker, pass to new RacePickerSection (owner-only)
- `/Users/kristianoftedal/dev/velospill/src/app/(main)/leagues/[leagueId]/league-client.tsx` — add `RacePickerSection` client component

### Query updates (filter by league races)

- `/Users/kristianoftedal/dev/velospill/src/lib/order-queries.ts` — `getUpcomingRacesForLeague`: add leagueRaces join
- `/Users/kristianoftedal/dev/velospill/src/lib/transfer-queries.ts` — `generateTransferWindows`: add leagueRaces join
- `/Users/kristianoftedal/dev/velospill/src/lib/scoring-queries.ts` — `getLeagueRacesWithScores` (and optionally `getLeagueStandings`, `getTeamRiderScores`): add leagueRaces join if scoring scoped

### Migration

- `/Users/kristianoftedal/dev/velospill/src/db/migrations/` — generated via `npm run db:generate`
- Optional: a one-time data migration script to pre-populate `league_races` for existing leagues

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Filter by season only | Filter by season + league_races join | Scoped race visibility per league |
| Global race calendar shown to all leagues | Per-league race assignment | Each league sees only its races |
| Transfer windows from full season calendar | Transfer windows from league-assigned races | Correct window generation |

---

## Open Questions

1. **Should scoring (standings) scope to league-assigned races?**
   - What we know: Currently all season races count toward points
   - What's unclear: Does the user want league scoring to only count points from assigned races, or is that too drastic?
   - Recommendation: Assume YES (the phase description says "scoring/orders/transfers only apply to those races") — but flag as high-impact decision for the planner

2. **What happens to existing orders if a race is unassigned from a league?**
   - What we know: Orders have a unique constraint on (teamId, raceId) and reference races.id directly
   - What's unclear: Should unassigning a race invalidate existing orders?
   - Recommendation: Warn the league owner if pending/active orders exist for that race; don't auto-delete

3. **Should the race picker also show stages, or only parent races?**
   - What we know: The orders page already shows stages (via parentRace join + displayName). Transfer windows only use parent races.
   - Recommendation: Assign parent races only in the picker. Stages automatically follow. The `leagueRaces` join in `getUpcomingRacesForLeague` would need to join through parent race ID for stages.

---

## Sources

### Primary (HIGH confidence — verified from codebase)

- `/Users/kristianoftedal/dev/velospill/src/db/schema/` — all schema files read directly
- `/Users/kristianoftedal/dev/velospill/src/lib/order-queries.ts` — full file read, confirmed `getUpcomingRacesForLeague` signature and WHERE clause
- `/Users/kristianoftedal/dev/velospill/src/lib/transfer-queries.ts` — full file read, confirmed `generateTransferWindows` pattern
- `/Users/kristianoftedal/dev/velospill/src/lib/scoring-queries.ts` — full file read, confirmed how `getLeagueStandings` works
- `/Users/kristianoftedal/dev/velospill/src/app/(main)/leagues/[leagueId]/page.tsx` — confirmed existing UI pattern and owner-only sections
- `/Users/kristianoftedal/dev/velospill/src/app/(main)/leagues/[leagueId]/league-client.tsx` — confirmed client component pattern
- `/Users/kristianoftedal/dev/velospill/src/app/(main)/leagues/[leagueId]/actions.ts` — confirmed `checkAuth`, `checkLeagueOwnership`, `revalidatePath` usage
- `/Users/kristianoftedal/dev/velospill/src/lib/league-auth.ts` — confirmed `checkLeagueOwnership` function exists

### Secondary (MEDIUM confidence)

- Drizzle ORM `onConflictDoNothing` pattern — verified present in codebase usage style, standard Drizzle API as of training knowledge (HIGH for this specific project's version ^0.45.1)

---

## Metadata

**Confidence breakdown:**
- Schema change (leagueRaces table): HIGH — clear pattern from existing tables
- Server actions pattern: HIGH — directly matches existing `actions.ts` patterns
- Downstream query updates: HIGH — queries read and understood, filter additions are straightforward
- Data migration strategy: MEDIUM — approach clear, exact script not written
- Scoring scope decision: MEDIUM — recommendation made but requires user confirmation
- UI component design: HIGH — matches existing `league-client.tsx` pattern exactly

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable codebase, no fast-moving dependencies)

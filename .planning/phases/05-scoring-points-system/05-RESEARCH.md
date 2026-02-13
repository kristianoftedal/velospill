# Phase 5: Scoring & Points System - Research

**Researched:** 2026-02-13
**Domain:** Fantasy sports scoring aggregation, leaderboard queries, Next.js Server Components with Drizzle ORM
**Confidence:** HIGH

## Summary

Phase 5 is a data-aggregation and UI-display problem, not a new technology problem. The hard parts of scoring are already built: `raceResults.points` is computed and stored at result-entry time via `previewScoringImpact` in `scoring-preview.ts`. The `scoringConfig` table drives all point values (JSONB rules per race type + category). The `orderTypes` table defines multipliers (blodpose, shimanobil, etc.) but orders/bidding are not yet implemented — Phase 5 scope should focus on standard scoring, not order effects.

The primary work is: (1) a scoring aggregation query that sums `raceResults.points` grouped by team (joining `draftPicks` → `riders` → `raceResults` scoped to a season/league), (2) new DB tables for caching team scores per race to enable efficient leaderboard queries and per-race breakdowns, and (3) UI routes — a leaderboard at `/leagues/[leagueId]/standings` and per-race score breakdowns.

The scoring query joins across: `draftPicks` (which riders belong to which team in which league) → `raceResults` (points per rider per race) → `races` (season scoping). No new library is needed — everything is Drizzle ORM `sql` template tag, `sum()`, `groupBy`, standard joins. The only strategic decision is whether to store computed scores in a `teamScores` table (materialized/cache) or compute them fresh on each request. Given Neon serverless and sub-second query times for small fantasy leagues (≤12 teams, ≤24 riders per team), **computed-on-demand** is the correct default. A `teamScores` cache table becomes necessary only if query becomes slow — defer.

**Primary recommendation:** Compute scores on-demand via Drizzle joins. Build a `scoring-queries.ts` lib file. Surface standings at `/leagues/[leagueId]/standings` and per-race breakdown at `/leagues/[leagueId]/standings/[raceId]`. The trigger point for automated score display is when `raceResults` exist for a race — no new background job needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Aggregation queries (sum, groupBy, joins) | Already installed, used throughout |
| @neondatabase/serverless | 1.0.2 | DB connection (Neon Pool) | Already wired in `lib/db.ts` |
| next | 16.1.6 | Server Components for leaderboard pages | Already installed; RSC pattern used in all league pages |
| @tanstack/react-table | 8.21.3 | Leaderboard table with sorting | Already installed (used in admin races/riders) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Format race dates in results breakdown | Already installed |
| sonner | 2.0.7 | Toast notifications (e.g. "Scores updated") | Already installed |
| shadcn/ui tabs | (shadcn) | Tab navigation: Standings / My Team / Race Results | Already installed (`tabs.tsx` exists) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| On-demand Drizzle joins | Materialized `teamScores` table | Cache adds complexity and invalidation logic; unnecessary for small leagues |
| On-demand Drizzle joins | PostgreSQL view | Views work well but Drizzle doesn't surface them in query builder; raw SQL view harder to maintain |
| On-demand Drizzle joins | Server Action with cache tags | `unstable_cache` with revalidate on result submission; valid but adds abstraction; not needed yet |

**Installation:**
```bash
# No new packages needed — all required libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── scoring-queries.ts        # All scoring aggregation queries (new)
├── app/(main)/leagues/[leagueId]/
│   ├── standings/
│   │   ├── page.tsx              # League leaderboard (RSC)
│   │   ├── standings-client.tsx  # Interactive table (use client)
│   │   └── [raceId]/
│   │       └── page.tsx          # Per-race score breakdown (RSC)
│   └── page.tsx                  # Already exists — add standings link when league is active
```

### Pattern 1: Scoring Aggregation Query
**What:** Join `draftPicks` → `raceResults` via `riderId`, group by `teamId`, sum points. Filter by `leagueId` (multi-tenant isolation) and `season` from `races`.
**When to use:** Leaderboard page, standings API, "my team" view.

```typescript
// Source: Drizzle ORM docs - aggregation with groupBy
import { db } from "@/lib/db"
import { draftPicks } from "@/db/schema/draft"
import { raceResults } from "@/db/schema/results"
import { races } from "@/db/schema/races"
import { teams } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { eq, and, sum, sql } from "drizzle-orm"

export async function getLeagueStandings(leagueId: number, season: number) {
  const rows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      totalPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`.as("totalPoints"),
    })
    .from(teams)
    .leftJoin(draftPicks, and(
      eq(draftPicks.teamId, teams.id),
      eq(draftPicks.leagueId, leagueId)
    ))
    .leftJoin(raceResults, eq(raceResults.riderId, draftPicks.riderId))
    .leftJoin(races, and(
      eq(races.id, raceResults.raceId),
      eq(races.season, season)
    ))
    .where(eq(teams.leagueId, leagueId))
    .groupBy(teams.id, teams.name)
    .orderBy(sql`totalPoints DESC`)

  return rows
}
```

**Key detail:** Use `LEFT JOIN` not `INNER JOIN` so teams with 0 points appear in standings. Use `COALESCE(SUM(...), 0)` for teams with no results yet.

### Pattern 2: Per-Race Score Breakdown
**What:** For a given race, show which drafted riders scored points and for which team.
**When to use:** Race detail page, "how did this race affect standings" view.

```typescript
// Source: existing codebase pattern (admin/results/actions.ts)
export async function getRaceScoreBreakdown(raceId: number, leagueId: number) {
  const rows = await db
    .select({
      teamId: draftPicks.teamId,
      teamName: teams.name,
      riderId: raceResults.riderId,
      riderName: riders.name,
      position: raceResults.position,
      points: raceResults.points,
    })
    .from(raceResults)
    .innerJoin(riders, eq(raceResults.riderId, riders.id))
    .innerJoin(draftPicks, and(
      eq(draftPicks.riderId, raceResults.riderId),
      eq(draftPicks.leagueId, leagueId)
    ))
    .innerJoin(teams, eq(teams.id, draftPicks.teamId))
    .where(eq(raceResults.raceId, raceId))
    .orderBy(raceResults.position)

  return rows
}
```

**Key detail:** Only drafted riders appear here (INNER JOIN on draftPicks). Undrafted riders' results don't appear in team breakdown.

### Pattern 3: "My Team" Rider Score List
**What:** For one team, show each drafted rider's total points across all races in the season.
**When to use:** "My Team" tab within league view.

```typescript
export async function getTeamRiderScores(teamId: number, leagueId: number, season: number) {
  const rows = await db
    .select({
      riderId: draftPicks.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      totalPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`.as("totalPoints"),
    })
    .from(draftPicks)
    .innerJoin(riders, eq(riders.id, draftPicks.riderId))
    .leftJoin(raceResults, eq(raceResults.riderId, draftPicks.riderId))
    .leftJoin(races, and(
      eq(races.id, raceResults.raceId),
      eq(races.season, season)
    ))
    .where(and(
      eq(draftPicks.teamId, teamId),
      eq(draftPicks.leagueId, leagueId)
    ))
    .groupBy(draftPicks.riderId, riders.name, riders.team, riders.gender)
    .orderBy(sql`totalPoints DESC`)

  return rows
}
```

### Pattern 4: Route Structure for Standings
**What:** Server Component page fetches data, passes to Client Component for interactivity.
**When to use:** All standings pages.

```typescript
// app/(main)/leagues/[leagueId]/standings/page.tsx (RSC)
export default async function StandingsPage({ params }) {
  const { leagueId } = await params
  const details = await getLeagueDetails(parseInt(leagueId))
  const season = (details.league.config as LeagueConfig).seasonYear
  const standings = await getLeagueStandings(parseInt(leagueId), season)
  return <StandingsClient standings={standings} leagueId={parseInt(leagueId)} />
}
```

### Pattern 5: Season Scoping via League Config
**What:** The `leagues.config` JSONB contains `seasonYear`. Use this to scope race queries.
**When to use:** All scoring aggregation queries must filter by season.

```typescript
// Get season from league config (already typed as LeagueConfig)
const season = (league.config as LeagueConfig).seasonYear
// Then pass season to scoring-queries.ts functions
```

### Anti-Patterns to Avoid
- **Hardcoding season year:** Never hardcode `2026`. Always read from `league.config.seasonYear`.
- **INNER JOIN on standings query:** Teams with 0 results would disappear from the leaderboard. Always LEFT JOIN from `teams` outward.
- **Fetching all results then aggregating in JS:** For even a 12-team league with 24 riders each × 50 races = 14,400 rows. Always aggregate in SQL, not application code.
- **Joining draftPicks without leagueId scope:** `draftPicks.riderId` is unique per league (enforced by `riderLeagueUnique` constraint), but always filter by `leagueId` to maintain multi-tenant isolation.
- **Showing standings in "setup" or "drafting" status:** Guard pages to only show when `league.status === "active" || "complete"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Points aggregation | Custom sum loop in JS | Drizzle `sql` + `SUM` + `groupBy` | DB aggregation handles NULL, is faster, scales |
| Leaderboard table | Custom table component | TanStack Table (already installed) | Sorting, filtering already handled |
| Season-scoped queries | Date range filters | `races.season` integer column | Season integer is already on every race; simpler than date ranges |
| Score caching | Redis/Upstash KV | Nothing (compute on demand) | Leagues are small; query is fast; no cache needed at this scale |
| Rank calculation | Window function or rank field | Derive rank from sorted array index in JS | Simpler than `ROW_NUMBER() OVER (ORDER BY ...)` for now |

**Key insight:** The entire scoring domain is a single well-crafted SQL query. The complexity is in the JOIN order and using LEFT JOIN correctly. Don't build infrastructure (cache, background jobs, materialized views) that isn't needed yet.

## Common Pitfalls

### Pitfall 1: Multi-tenant Leakage
**What goes wrong:** A standings query returns riders from other leagues because `draftPicks.riderId` is shared across leagues.
**Why it happens:** Rider IDs are global; a rider can be drafted in multiple leagues. Only `(leagueId, riderId)` is unique.
**How to avoid:** Every join involving `draftPicks` MUST include `eq(draftPicks.leagueId, leagueId)`.
**Warning signs:** Standings show inflated scores or riders not on the team.

### Pitfall 2: Season Drift
**What goes wrong:** A race from a previous season (2025) contributes to current season standings.
**Why it happens:** `raceResults` has no season column — season is on `races`.
**How to avoid:** Always join through `races` and filter `eq(races.season, season)` where season comes from `league.config.seasonYear`.
**Warning signs:** Standings show unexpected points from races the league wasn't part of.

### Pitfall 3: Teams with Zero Points Disappear
**What goes wrong:** A team that hasn't scored yet doesn't appear in standings.
**Why it happens:** INNER JOIN on `raceResults` excludes teams with no results.
**How to avoid:** Start the join from `teams` with `LEFT JOIN draftPicks` → `LEFT JOIN raceResults`.
**Warning signs:** Team count in standings is less than team count in league.

### Pitfall 4: Drizzle groupBy with Multiple Columns
**What goes wrong:** Drizzle `groupBy` requires all non-aggregate selected columns to be included.
**Why it happens:** PostgreSQL GROUP BY rules require all selected non-aggregate expressions to appear in GROUP BY.
**How to avoid:** List every non-aggregated column in `.groupBy(teams.id, teams.name)`. Drizzle will error at runtime (not compile time) if missing.
**Warning signs:** `ERROR: column must appear in GROUP BY clause`.

### Pitfall 5: Confusing raceResults.points vs Scoring Config
**What goes wrong:** Phase 5 tries to re-calculate points from `scoringConfig` on the fly instead of reading stored `raceResults.points`.
**Why it happens:** Misunderstanding the existing architecture. Points ARE already calculated and stored at result entry time.
**How to avoid:** Phase 5 only reads `raceResults.points` — it never re-reads `scoringConfig`. `scoringConfig` is only used at result entry time (Phase 2 responsibility).
**Warning signs:** Queries joining `scoringConfig` in leaderboard code.

### Pitfall 6: Orders/Multipliers Complexity
**What goes wrong:** Trying to apply `orderTypes` multipliers (blodpose, shimanobil) in Phase 5 scoring before the bid/orders system is built.
**Why it happens:** The `orderTypes` seed data suggests these should affect points. But no `orders` table or bid system exists yet.
**How to avoid:** Phase 5 scores from `raceResults.points` only (base points, no multipliers). Orders are a future phase. Document this explicitly.
**Warning signs:** Code that reads from `orderTypes` table in leaderboard queries.

### Pitfall 7: Drizzle sql Tag in orderBy
**What goes wrong:** `orderBy(sql\`totalPoints DESC\`)` doesn't work because `totalPoints` is an alias that PostgreSQL evaluates after ORDER BY.
**Why it happens:** SQL alias resolution order. The alias `totalPoints` from the SELECT is not available in ORDER BY in all DB contexts.
**How to avoid:** Use `orderBy(desc(sql\`COALESCE(SUM(${raceResults.points}), 0)\`))` or sort in application code after fetching. Alternative: use a subquery.
**Warning signs:** `column "totalPoints" does not exist` error.

## Code Examples

Verified patterns from existing codebase:

### Drizzle SQL Template Tag (from admin/results/actions.ts)
```typescript
// Source: src/app/admin/results/actions.ts line 73
import { sql } from "drizzle-orm"
hasResults: sql<boolean>`EXISTS(SELECT 1 FROM ${raceResults} WHERE ${raceResults.raceId} = ${races.id})`.as('hasResults'),
```

### Left Join Pattern (from draft-queries.ts)
```typescript
// Source: src/lib/draft-queries.ts line 148
.leftJoin(riders, eq(draftPicks.riderId, riders.id))
```

### Multi-condition And (from scoring-preview.ts)
```typescript
// Source: src/lib/scoring-preview.ts line 83-89
const scoringRule = await db.query.scoringConfig.findFirst({
  where: and(
    eq(scoringConfig.raceType, raceTypeForScoring),
    eq(scoringConfig.category, category),
    lte(scoringConfig.validFrom, now),
    or(isNull(scoringConfig.validUntil), gt(scoringConfig.validUntil, now))
  ),
})
```

### League Auth Guard Pattern (from league actions)
```typescript
// Source: src/app/(main)/leagues/[leagueId]/actions.ts
const { isMember } = await checkLeagueMembership(session.user.id, leagueId)
if (!isMember) throw new Error("Not a member of this league")
```

### RSC + Client Split Pattern (from league-client.tsx)
```typescript
// Server Component (page.tsx) fetches data, passes to Client Component
const data = await getLeagueDetails(leagueId)
return <SomeClient data={data} />
```

### Sum Aggregate with Drizzle (verified working pattern)
```typescript
// Source: src/app/(main)/leagues/[leagueId]/actions.ts line 42-44
const [{ teamCount }] = await db
  .select({ teamCount: count() })
  .from(teams)
  .where(eq(teams.leagueId, leagueId))
```

## Schema Inventory (What Phase 5 Reads)

**Tables that Phase 5 reads from (no schema changes required for basic scoring):**

| Table | Key Columns | Phase 5 Use |
|-------|-------------|-------------|
| `race_results` | `riderId`, `raceId`, `points`, `position` | Source of truth for all fantasy points |
| `draft_picks` | `teamId`, `riderId`, `leagueId`, `gender` | Maps riders to teams within a league |
| `teams` | `id`, `name`, `leagueId`, `userId` | Team identity for standings |
| `races` | `id`, `name`, `season`, `raceType`, `startDate` | Season scoping, race names for UI |
| `riders` | `id`, `name`, `team`, `gender` | Rider names for "My Team" view |
| `leagues` | `id`, `config` (seasonYear), `status` | Season year, gate standings by status |

**Potential new table (optional, only if needed for performance):**

A `teamScoreCache` table could store `(leagueId, teamId, raceId, pointsInRace, cumulativePoints)` to enable O(1) leaderboard reads. Do NOT build this in Phase 5 — compute on demand is correct at this scale. Add only if query profiling shows >500ms for a 10-team league.

## Navigation & UI Integration Points

**Existing pages that need updates:**
1. `/leagues/[leagueId]/page.tsx` — Add "Standings" link when `league.status === "active" || "complete"`
2. Navigation (if any global nav exists) — standings link per active league

**New pages to create:**
1. `/leagues/[leagueId]/standings/page.tsx` — League leaderboard (all teams ranked)
2. `/leagues/[leagueId]/standings/[raceId]/page.tsx` — Per-race score breakdown (optional, nice-to-have)

**UI components already available (no new installs):**
- `Card`, `Table`, `TableHead`, `TableBody` — from shadcn/ui (used in league pages)
- `Badge` — for position indicators or ranking badges
- `Tabs` — `tabs.tsx` exists; use for "Leaderboard / My Team / Race Results" tabs
- `TanStack Table` — already installed; use for sortable standings table

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Polling for score updates | Server Components with `revalidatePath` | RSC re-fetches on navigation; no polling needed |
| Separate scoring microservice | Drizzle queries in Server Actions | No microservice needed at this scale |
| WebSocket for score updates | Static RSC page with manual refresh | Acceptable for standings (not real-time like draft) |

**Note on real-time scores:** Unlike the draft (which needed Pusher for real-time), standings do NOT need real-time updates. Scores change only when an admin enters race results. A manual page refresh or a "Refresh Standings" button is sufficient. Do NOT add Pusher for standings — it's over-engineering at this scale.

## Open Questions

1. **Orders/Multipliers (blodpose, shimanobil, etc.)**
   - What we know: `orderTypes` table is seeded with 12 order types and their effects. No `orders` table exists. No bid system exists.
   - What's unclear: When is the orders/bids phase planned? Phase 6? Phase 7?
   - Recommendation: Phase 5 explicitly ignores orders. All scoring is base `raceResults.points` only. Add a code comment: `// TODO: apply order multipliers when orders system is built (Phase N)`.

2. **GC Jersey Scoring (per-stage jersey bonuses)**
   - What we know: `scoringConfig` has `jersey_gc`, `jersey_points`, `jersey_kom`, `jersey_combative` categories. These award points per stage to the jersey holder.
   - What's unclear: Is there a way to enter jersey holders when submitting race results? The current `raceResults` schema tracks finish position only, not jersey classification.
   - Recommendation: Phase 5 scores from existing `raceResults.points` only. Jersey scoring requires UI changes to result entry (a separate concern). Document as out of scope.

3. **Rank tie-breaking**
   - What we know: Two teams with identical total points would have the same rank.
   - What's unclear: What is the tiebreaker rule? (Most race wins? Earlier in draft?)
   - Recommendation: Sort by `totalPoints DESC` only; display tied rank visually (both show rank 2 if tied for 2nd). Don't implement tiebreaker logic until a user requests it.

4. **Historical season data**
   - What we know: `leagues.config.seasonYear` scopes everything. Phase 5 only shows active season.
   - What's unclear: Can a league span multiple seasons?
   - Recommendation: Treat each league as single-season. `seasonYear` from `league.config` is the only season in scope.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `/Users/kristianoftedal/dev/velospill/src/` — all schema, lib, and action files read directly
- Drizzle ORM 0.45.x installed behavior: verified from existing working queries in `draft-queries.ts`, `scoring-preview.ts`, `results/actions.ts`
- shadcn/ui components: verified present by listing `/Users/kristianoftedal/dev/velospill/src/components/ui/`

### Secondary (MEDIUM confidence)
- Drizzle aggregate query patterns: extrapolated from `count()` usage in `leagues/[leagueId]/actions.ts` — `sum()` follows identical pattern
- PostgreSQL GROUP BY rules: standard SQL behavior, verified consistent with Drizzle's query builder behavior

### Tertiary (LOW confidence)
- TanStack Table v8 sorting for standings: library is installed and used in admin pages; exact standings column config not verified against docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; verified from package.json and existing usage
- Architecture: HIGH — scoring query design derived directly from existing schema and query patterns in codebase
- Pitfalls: HIGH — multi-tenant pattern, JOIN order issues, and season scoping derived from existing code structure
- UI integration: HIGH — components verified present; page pattern matches existing league pages exactly

**Research date:** 2026-02-13
**Valid until:** 2026-04-13 (stable libraries, no fast-moving dependencies)

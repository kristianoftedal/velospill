# Phase 9: League Scoping & UX Fixes - Research

**Researched:** 2026-02-16
**Domain:** Drizzle ORM query modification, Next.js Server Actions, React client-side UX, package.json dependency management
**Confidence:** HIGH

## Summary

Phase 9 closes four discrete tech-debt items identified in the v1.0 milestone audit. Three are UX or
integration fixes with no schema changes; one is a trivial package.json addition. All four operate on
existing tables and existing code — no new tables, no new migrations, no new external services.

The integration gap is `getUpcomingRacesForLineup` in `src/lib/lineup-queries.ts`. It currently queries
all upcoming parent races globally (no league filter). The fix is a Drizzle INNER JOIN against
`leagueRaces` — following the exact pattern already used in `scoring-queries.ts` and the order form
query. The scoring queries in Phase 8 established the canonical pattern: an INNER JOIN on
`leagueRaces` for parent-only fetches, or an OR-subquery for parent+stage fetches. For the lineup
picker only parent races are needed (lineup is set at parent-race level), so a clean INNER JOIN
suffices — no subquery complexity needed.

The draft UX improvements are also well-contained. Auto-transitioning the league to "active" when
the draft session reaches `status = "complete"` requires adding a single `db.update(leagues)` inside
the existing transaction in `makePick` (draft/actions.ts) and the `handler` function in
`api/draft/auto-pick/route.ts`. `transitionLeagueStatus` in `leagues/[leagueId]/actions.ts` already
defines the valid `drafting -> active` transition; the auto-transition bypasses the ownership check
(it runs inside a privileged server action/API route) but applies the same update. The DraftRecap
component currently shows a plain "Back to League" text link; adding a prominent CTA button and,
for owners, a "Start Season" prompt is a pure client-side UI change with no server action needed
(league is auto-transitioned, so the owner just navigates to the league page). Finally, adding
`nanoid` as an explicit dependency is a one-line package.json change.

**Primary recommendation:** Execute all four items in a single plan (09-01). They share no inter-task
dependencies, are tiny in scope, and grouping them avoids plan-per-triviality overhead.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | ORM query builder | Already in use throughout codebase |
| next | 16.1.6 | Server Actions, React Server Components | Project framework |
| nanoid | 3.3.11 | URL-safe ID generation | Already a transitive dep via better-auth |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.563.0 | Icon components | Use for CTA buttons in DraftRecap (e.g., ArrowRight, Trophy) |

### New Dependency
| Library | Version | Purpose |
|---------|---------|---------|
| nanoid | ^3.3.11 | Move from transitive to direct dependency |

**Installation:**
```bash
npm install nanoid
```

This will promote nanoid from transitive (under better-auth's node_modules) to a direct entry
in package.json. The version already in the lockfile is 3.3.11 — `npm install nanoid` without
a version pin will install the latest 3.x which is backward-compatible (v3.x has been stable since 2020).

## Architecture Patterns

### Recommended Project Structure

No new files needed. All changes are in-place edits to existing files:

```
src/lib/
└── lineup-queries.ts          # Add INNER JOIN on leagueRaces (Task A)

src/app/(main)/leagues/[leagueId]/draft/
├── actions.ts                 # Add league active-transition to makePick + skipPick (Task B)
└── draft-recap.tsx            # Add CTA link and owner prompt (Task C)

src/app/api/draft/auto-pick/
└── route.ts                   # Add league active-transition when isComplete (Task B)

package.json                   # Add nanoid as direct dependency (Task D)
```

### Pattern 1: League-Scoped Race Query with INNER JOIN

**What:** Filter `getUpcomingRacesForLineup` to only show races assigned to the league via `leagueRaces`
join table.

**When to use:** When a query must restrict the races universe to only those an admin has assigned
to a specific league.

**Current code (gap):**
```typescript
// src/lib/lineup-queries.ts — current, no league scoping
return db
  .select({ ... })
  .from(races)
  .leftJoin(rosterLimits, eq(rosterLimits.raceType, races.raceType))
  .leftJoin(lineupCountSubquery, eq(lineupCountSubquery.raceId, races.id))
  .where(
    and(
      isNull(races.parentRaceId),   // parent races only
      gt(races.startDate, now)      // upcoming only
    )
  )
```

**Fixed pattern — INNER JOIN on leagueRaces:**
```typescript
// Source: scoring-queries.ts line 120 (established Phase 8 pattern)
// and generate-transfer-windows pattern (08-03)
import { leagueRaces } from "@/db/schema/leagues"
import { eq, and, gt, isNull, sql, count } from "drizzle-orm"

return db
  .select({ ... })
  .from(races)
  .innerJoin(leagueRaces, and(
    eq(leagueRaces.raceId, races.id),
    eq(leagueRaces.leagueId, leagueId)
  ))
  .leftJoin(rosterLimits, eq(rosterLimits.raceType, races.raceType))
  .leftJoin(lineupCountSubquery, eq(lineupCountSubquery.raceId, races.id))
  .where(
    and(
      isNull(races.parentRaceId),
      gt(races.startDate, now)
    )
  )
  .orderBy(races.startDate)
```

**Why INNER JOIN (not subquery):** The lineup picker only needs parent races, not stages. The subquery
OR pattern (`id IN (...) OR parentRaceId IN (...)`) is for scoring queries that must include stages.
For the lineup picker, INNER JOIN is simpler and semantically cleaner — it directly restricts the
races set without a subquery.

**Precedent in codebase:**
- `generateTransferWindows` uses `INNER JOIN on leagueRaces` (08-03 decision #58)
- `getLeagueStandings` uses subquery in LEFT JOIN condition (08-03 decision #59) — only needed
  because LEFT JOIN must preserve zero-point teams

### Pattern 2: Auto-Transition League Status Inside Draft Completion

**What:** When the draft reaches `isComplete = true`, add a `db.update(leagues).set({ status: "active" })`
inside the same transaction that marks the draft session as "complete".

**When to use:** At every code path where `isComplete` becomes true: `makePick`, `skipPick`, and
the auto-pick route handler.

**Pattern:**
```typescript
// Inside the existing db.transaction(async (tx) => { ... }) block
// where nextStatus === "complete":
if (isComplete) {
  await tx
    .update(leagues)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(
        eq(leagues.id, leagueId),
        eq(leagues.status, "drafting")  // guard: only transition if currently drafting
      )
    )
}
```

**Critical: The WHERE guard `eq(leagues.status, "drafting")` is essential.** Without it, if
`makePick` is called on an already-active league (edge case: stale client), the status would
incorrectly revert from "active" to "active" (benign) but could theoretically flip from "complete"
to "active" in a worst-case scenario. The guard makes the transition idempotent and safe.

**Three locations to update:**
1. `src/app/(main)/leagues/[leagueId]/draft/actions.ts` — `makePick` function (transaction block)
2. `src/app/(main)/leagues/[leagueId]/draft/actions.ts` — `skipPick` function (currently no transaction — add `db.transaction` wrapper or add the update directly since `skipPick` does a plain `db.update`)
3. `src/app/api/draft/auto-pick/route.ts` — `handler` function (transaction block)

**Note on skipPick:** The current `skipPick` does NOT use a transaction — it's a plain `db.update`.
If adding the league transition to `skipPick`, the options are: (a) wrap in `db.transaction()` to
make both updates atomic, or (b) do sequential `db.update` calls (acceptable risk — if the second
fails, the league remains in drafting, owner can manually transition). Option (a) is cleaner.

**Import addition needed:**
```typescript
import { leagues } from "@/db/schema/leagues"  // already imported in actions.ts
// and need `and` operator — already imported in most of these files
```

### Pattern 3: DraftRecap CTA Enhancement

**What:** Enhance the `DraftRecap` component footer to show a prominent link to the league page and,
for league owners, an additional prompt to start the season.

**When to use:** Whenever `draftStatus === "complete"` in the DraftRoom (the current condition that
renders DraftRecap).

**Current footer (gap):**
```tsx
{/* Footer */}
<div className="text-center">
  <Link
    href={`/leagues/${leagueId}`}
    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline font-medium"
  >
    Back to League
  </Link>
</div>
```

**Enhanced pattern:**
```tsx
{/* Footer — enhanced */}
<div className="text-center space-y-4">
  <Link
    href={`/leagues/${leagueId}`}
    className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
  >
    Go to League
    <ArrowRight className="h-4 w-4" />
  </Link>
  {isOwner && (
    <p className="text-sm text-gray-500">
      The season has started! Visit the league page to manage race lineups and standings.
    </p>
  )}
</div>
```

**DraftRecap receives `isOwner` prop.** The prop is available in the calling `DraftRoom` component
(`isOwner` is already passed to DraftRoom and stored, but not currently forwarded to DraftRecap).
Add `isOwner: boolean` to `DraftRecapProps` and pass it through:

```tsx
// In draft-room.tsx where DraftRecap is rendered (line ~436-453):
return <DraftRecap teams={recapTeams} picks={recapPicks} leagueId={leagueId} isOwner={isOwner} />
```

**Note:** Since Phase 9 adds auto-transition, by the time the user sees DraftRecap the league is
already "active". The owner prompt should NOT say "click to start season" (it's already started).
Instead, it should navigate the owner to the league page where they can see the active season state.
The prompt language should be: "The season is now active. Go to your league to set lineups and view standings."

### Anti-Patterns to Avoid

- **Subquery for lineup races:** Don't use the OR-subquery pattern (`id IN (...) OR parentRaceId IN (...)`)
  for `getUpcomingRacesForLineup`. The lineup is set at parent-race level; stages are not selectable
  for lineup. INNER JOIN is the right tool.
- **Calling `transitionLeagueStatus` from draft completion:** The existing `transitionLeagueStatus`
  server action requires auth + ownership check. Don't call it from the draft completion path. Use
  a direct `db.update(leagues)` inside the transaction instead.
- **Auto-transitioning outside a transaction:** The league status update MUST be in the same
  transaction as the draft session status update. If the transaction fails and rolls back, the league
  must also remain in "drafting", not "active".
- **Removing the `revalidatePath` call:** After auto-transition, `revalidatePath("/leagues")` and
  `revalidatePath(\`/leagues/${leagueId}\`)` are already called at the end of `makePick`. No additional
  revalidation is needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| League race filtering | Custom set intersection logic | Drizzle INNER JOIN on leagueRaces | Already a table in DB with correct indexes |
| Transaction atomicity | Manual rollback logic | `db.transaction(async (tx) => {...})` | Drizzle transactions handle rollback automatically |
| URL-safe IDs | Custom base64 encode | nanoid | Already installed, cryptographically secure |

**Key insight:** All the infrastructure for Phase 9 already exists. The work is connecting pieces that
are already built — not building new infrastructure.

## Common Pitfalls

### Pitfall 1: Forgetting `skipPick` When Adding Auto-Transition

**What goes wrong:** Auto-transition is added to `makePick` and the auto-pick route but not `skipPick`.
If a draft completes via timer expiry (all remaining picks are skipped), the league never transitions
to "active".

**Why it happens:** `skipPick` is easy to overlook because it's less commonly exercised — drafts
typically complete via picks, not skips.

**How to avoid:** Grep for `"complete"` in draft/actions.ts and handle every `isComplete` code path.
There are three locations: `makePick`, `skipPick`, `auto-pick/route.ts`.

**Warning signs:** League stays in "drafting" status after draft session shows "complete".

### Pitfall 2: Transaction Missing in `skipPick`

**What goes wrong:** `skipPick` currently does a plain `db.update(draftSessions)` — not a transaction.
Adding `db.update(leagues)` separately risks partial failure (draft session updated, league not updated,
or vice versa).

**Why it happens:** The original `skipPick` implementation had no atomic need (single update).
Adding a second update without wrapping in a transaction breaks atomicity.

**How to avoid:** Wrap both updates in `db.transaction()` when adding the league status update to
`skipPick`. Pattern matches `makePick`'s existing transaction structure.

**Warning signs:** TypeScript compiles, tests pass, but under high load or network flakiness one
update may succeed while the other fails.

### Pitfall 3: Lineup Page Showing "No upcoming races" After Scoping Fix

**What goes wrong:** After adding the INNER JOIN, leagues that have no races in `league_races` will
show an empty state in the lineup picker. This is correct behavior but could appear broken in test
if test leagues have no assigned races.

**Why it happens:** By design — the integration gap is now closed. If a league has no races assigned,
it correctly shows no lineup opportunities.

**How to avoid:** Verify at least one future-dated race is in `league_races` for the test league
before verifying the fix. The existing test data has races assigned per STATE.md ("All 4 existing
leagues pre-populated with 2 parent races each").

**Warning signs:** None — this is expected correct behavior after the fix.

### Pitfall 4: DraftRecap `isOwner` prop breaks TypeScript

**What goes wrong:** Adding `isOwner` to `DraftRecapProps` without adding it to the call site in
`draft-room.tsx` causes a TypeScript error.

**Why it happens:** The component interface change requires two edits: the interface definition AND
the call site. Easy to miss the call site.

**How to avoid:** Run `npx tsc --noEmit` after editing both files. Also check that `isOwner` is
available in scope at the DraftRecap call site in `draft-room.tsx` (it is — it's a top-level prop).

### Pitfall 5: nanoid install changes lockfile but not semantics

**What goes wrong:** Running `npm install nanoid` in a repo where nanoid is already in node_modules
(as a transitive dep) is a no-op for the package behavior but DOES update package.json and
package-lock.json. The risk is accidentally upgrading to nanoid v4+ (ESM-only, breaking if
the build assumes CJS).

**Why it happens:** nanoid v4+ is ESM-only. If `npm install nanoid` resolves to v4+, the existing
`import { nanoid } from "nanoid"` in `invite-codes.ts` will continue to work because Next.js
transpiles ESM correctly — but it could create subtle issues in edge cases.

**How to avoid:** The current lockfile has nanoid 3.3.11. Running `npm install nanoid` without a
version constraint will install the latest 3.x (3.3.x is the CJS-compatible branch). Confirm
`npm install nanoid@^3` to pin the major version explicitly. The current import style
`import { nanoid } from "nanoid"` is correct for v3.

## Code Examples

Verified patterns from official sources and existing codebase:

### Drizzle INNER JOIN (from scoring-queries.ts, established pattern)

```typescript
// Source: src/lib/scoring-queries.ts lines 63-70, Phase 8 established pattern
// Note: scoring uses subquery for parent+stage; lineup uses INNER JOIN for parent-only
import { leagueRaces } from "@/db/schema/leagues"
import { eq, and, gt, isNull } from "drizzle-orm"

// INNER JOIN pattern for parent-race-only league scoping:
.innerJoin(leagueRaces, and(
  eq(leagueRaces.raceId, races.id),
  eq(leagueRaces.leagueId, leagueId)
))
```

### Drizzle Transaction (from draft/actions.ts, existing pattern)

```typescript
// Source: src/app/(main)/leagues/[leagueId]/draft/actions.ts lines 225-251
// Existing makePick transaction — add league update inside:
await db.transaction(async (tx) => {
  const [p] = await tx.insert(draftPicks).values({ ... }).returning()
  insertedPick = p

  await tx.update(draftSessions).set({ ... }).where(eq(draftSessions.leagueId, leagueId))

  // NEW: auto-transition league to active when draft completes
  if (isComplete) {
    await tx
      .update(leagues)
      .set({ status: "active", updatedAt: new Date() })
      .where(and(eq(leagues.id, leagueId), eq(leagues.status, "drafting")))
  }
})
```

### League status update (from leagues/[leagueId]/actions.ts)

```typescript
// Source: src/app/(main)/leagues/[leagueId]/actions.ts lines 172-173
// Existing manual transition — same pattern used for auto-transition:
await db
  .update(leagues)
  .set({ status: newStatus, updatedAt: new Date() })
  .where(eq(leagues.id, leagueId))
```

### nanoid in package.json

```json
// Source: package.json (current state — nanoid is NOT listed as direct dep)
// Add to "dependencies":
"nanoid": "^3.3.11"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global race query for lineup | League-scoped via leagueRaces INNER JOIN | Phase 9 | Lineup page only shows races that admin assigned to the league |
| Manual owner clicks "Start Season" after draft | Auto-transition on draft completion | Phase 9 | Draft recap → league active → no manual step required |
| DraftRecap "Back to League" text link | Prominent CTA button + owner message | Phase 9 | Clear post-draft action path for owner and members |
| nanoid transitive dep (risk) | nanoid direct dep | Phase 9 | Build won't break if better-auth removes nanoid |

**Deprecated/outdated patterns after Phase 9:**
- `getUpcomingRacesForLineup` with global race scope: replaced by league-scoped version
- Manual `drafting -> active` transition by owner after draft completion: still available for
  edge cases but no longer the primary path

## Open Questions

1. **Should the owner prompt in DraftRecap say "season started" or still say "start season"?**
   - What we know: With auto-transition, the league is already "active" when DraftRecap is shown.
   - What's unclear: Whether the owner might still want a manual "Start Season" button (e.g., to
     delay the active season even after draft).
   - Recommendation: Since Phase 9 explicitly says "auto-transition league to active after both
     drafts complete", the prompt should confirm the season is active and link to the league page.
     No separate "Start Season" button needed in DraftRecap.

2. **Does `skipPick` need transaction wrapping, or is sequential plain updates acceptable?**
   - What we know: `makePick` and auto-pick use transactions. `skipPick` currently does not.
   - What's unclear: Risk tolerance for partial failure in the skip path.
   - Recommendation: Wrap `skipPick` in a transaction for consistency and atomicity. The pattern
     is identical to `makePick` — low implementation cost, high correctness gain.

3. **Are there leagues in production where the draft is already "complete" but the league is still "drafting"?**
   - What we know: From the v1.0 audit, no automated migration was run.
   - What's unclear: Whether any real league data has this mismatch.
   - Recommendation: The planner should include a one-time SQL statement to sync any leagues
     where the draft session is "complete" but the league is still "drafting":
     `UPDATE leagues SET status = 'active' WHERE id IN (SELECT "leagueId" FROM draft_sessions WHERE status = 'complete') AND status = 'drafting'`
     This is a data correction step, not a schema migration.

## Sources

### Primary (HIGH confidence)

- Codebase: `src/lib/lineup-queries.ts` — current getUpcomingRacesForLineup implementation, gap confirmed
- Codebase: `src/lib/scoring-queries.ts` — established INNER JOIN and subquery patterns for leagueRaces scoping
- Codebase: `src/app/(main)/leagues/[leagueId]/draft/actions.ts` — existing transaction structure for makePick and skipPick
- Codebase: `src/app/api/draft/auto-pick/route.ts` — existing transaction structure for auto-pick handler
- Codebase: `src/app/(main)/leagues/[leagueId]/draft/draft-recap.tsx` — current DraftRecap with text link, no isOwner prop
- Codebase: `src/app/(main)/leagues/[leagueId]/draft/draft-room.tsx` — isOwner prop available, DraftRecap call site
- Codebase: `package.json` — confirmed nanoid is NOT in direct dependencies
- Codebase: `package-lock.json` — confirmed nanoid 3.3.11 is in lockfile as transitive dep
- `.planning/STATE.md` — decision log entries 53-59 (Phase 8 leagueRaces patterns), decision 2 (nanoid transitive dep note)
- `.planning/v1.0-MILESTONE-AUDIT.md` — all four Phase 9 items explicitly documented as tech debt

### Secondary (MEDIUM confidence)

- `.planning/phases/03-league-management/03-VERIFICATION.md` — nanoid risk documented at Phase 3
- `.planning/phases/08-ui-polish-let-admins-pick-races-from-global-list-to-leagues-they-admin/` — Phase 8 decision to leave getUpcomingRacesForLineup unscoped intentionally

### Tertiary (LOW confidence)

- nanoid v3 vs v4 ESM-only concern: Based on known npm ecosystem behavior. No Context7 lookup performed.
  Confidence is MEDIUM-LOW. The lockfile shows 3.3.11 is already in use and working; `npm install nanoid@^3`
  is safe.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already in use, versions confirmed from package.json and lockfile
- Architecture: HIGH — All four changes follow existing patterns in the codebase, verified by reading source
- Pitfalls: HIGH — Identified from direct code inspection, not hypothetical
- Data correction query: MEDIUM — Based on logical inference; actual data state not verified

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days — stable ecosystem, all changes are internal to existing codebase)

---

## Task Summary for Planner

Four discrete items, no schema changes, no new libraries (except nanoid promotion):

| Task | File(s) | Change Type | Complexity |
|------|---------|-------------|------------|
| A. Scope lineup races to leagueRaces | `src/lib/lineup-queries.ts` | Add INNER JOIN | Trivial |
| B. Auto-transition league to active | `draft/actions.ts`, `auto-pick/route.ts` | Add `db.update` in transactions | Small |
| C. DraftRecap CTA + owner prompt | `draft-recap.tsx`, `draft-room.tsx` | UI + prop change | Small |
| D. Add nanoid as direct dep | `package.json` | Add one line + `npm install nanoid@^3` | Trivial |
| E. Data correction (optional) | N/A — SQL statement | One-time run | Trivial |

**Recommended plan structure:** Single plan 09-01 containing all four tasks. Estimated execution
time: ~5 minutes (matching Phase 8 plans in complexity).

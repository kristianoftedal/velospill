# Phase 6: Transfer Market - Research

**Researched:** 2026-02-14
**Domain:** Fantasy sports transfer/trade system, bid management, team roster mutation with audit trail
**Confidence:** HIGH (architecture), MEDIUM (transfer window mechanics — no locked user decisions yet)

## Summary

Phase 6 builds a transfer market on top of the existing draft and scoring infrastructure. The core model is simple: a team can submit a bid to drop a rider they own and pick up a rider currently on the "free agent" pool (i.e., not in any `draftPicks` for that league). The bid is recorded in a new `transferBids` table scoped by `leagueId`. On approval, the old `draftPick` row is deleted (or team-reassigned) and a new one is inserted for the incoming rider. Standings continue to aggregate from `raceResults.points` via `draftPicks` — no changes needed to `scoring-queries.ts` beyond the existing `// TODO: apply order multipliers` note.

The admin backoffice already has a placeholder at `/admin/transfers` (Phase 2) showing transfer window rules: Grand Tours = unlimited, High Priority = 4 transfers, Low Priority/Mini Tours = 2 transfers. This implies a **transfer window** concept tied to race calendar events. A `transferWindows` table or a JSONB field on `leagues.config` could represent windows; the simplest design is a standalone `transferWindows` table keyed by `leagueId` and `raceId` with open/close dates and a per-window transfer limit.

The bid flow has two participants: (1) a **team user** who submits a bid proposing drop+pickup, and (2) an **admin** who approves or rejects it. This matches the existing `resultAudit` pattern: admin-authoritative mutations with audit log. No real-time mechanism is needed (unlike Phase 4 draft). Server Actions + `revalidatePath` are sufficient. The existing `league-auth.ts` middleware, `checkAdminAuth` helper, and `draftPicks` schema are the primary integration points.

**Primary recommendation:** Add three new tables (`transferBids`, `transferWindows`, `transferAudit`) via direct SQL migration. Implement team-facing bid submission UI at `/leagues/[leagueId]/transfers` and admin approval UI at `/admin/transfers`. Use the established Server Action + Zod + `revalidatePath` pattern throughout. Keep standings query unchanged — transfers only mutate `draftPicks`, which standings already join.

---

## Existing Codebase Findings

### What Already Exists

| Asset | Location | Status |
|-------|----------|--------|
| Admin transfers placeholder | `src/app/admin/transfers/page.tsx` | Stub — info card only, says "Coming in Phase 5" |
| Admin transfers nav link | `src/app/admin/layout.tsx:58` | Live, navigates to stub |
| Transfer window rules (comments) | `src/app/admin/transfers/page.tsx:49` | Rules documented: GT=unlimited, HP=4, LP/MT=2 |
| `draftPicks` table | `src/db/schema/draft.ts` | The source of truth for team rosters |
| `orderTypes` table | `src/db/schema/config.ts` | 12 order types seeded — NOT the transfer system; these are "power-ups" for Phase 7 |
| `scoring-queries.ts` | `src/lib/scoring-queries.ts` | TODO comment: "apply order multipliers when orders/bids system is built" |
| `league-auth.ts` | `src/lib/league-auth.ts` | `checkLeagueMembership`, `checkLeagueOwnership` — reuse for transfer auth |
| `resultAudit` table | `src/db/schema/results.ts` | Pattern for audit trail in transfer system |

### Critical Clarification: Orders vs Transfers

The `orderTypes` table (blodpose, shimanobil, etc.) is **NOT** the transfer system. These are "strategic orders" / power-ups that modify scoring multipliers for a specific race — a separate feature planned for Phase 7 (per `src/app/admin/orders/page.tsx`: "Coming in Phase 7"). Phase 6 is **transfers only**: swapping riders between teams and the free agent pool.

### `draftPicks` Table (Roster Source of Truth)

```typescript
// src/db/schema/draft.ts
export const draftPicks = pgTable("draft_picks", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  riderId: integer("riderId").notNull().references(() => riders.id),
  pickNumber: integer("pickNumber").notNull(),
  round: integer("round").notNull(),
  gender: text("gender").notNull().$type<'M' | 'F'>(),
  wasAutomatic: boolean("wasAutomatic").notNull().default(false),
  pickedAt: timestamp("pickedAt", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  riderLeagueUnique: uniqueIndex("draft_picks_rider_league_unique").on(table.leagueId, table.riderId),
  // ...
}))
```

Key constraints:
- `riderLeagueUnique` — a rider can only be on ONE team per league. This enforces the "free agent" vs "owned" distinction.
- `pickNumber` and `round` are draft-specific metadata. Transfers don't have pick numbers in the draft sense — a transferred rider could use a sentinel value or new columns.
- `gender` is required. Must be propagated from `riders.gender` on transfer.

### How Transfers Affect Standings

`scoring-queries.ts` → `getLeagueStandings`:
- Joins `teams` → `draftPicks` (by `teamId` + `leagueId`) → `raceResults` (by `riderId`) → `races` (by `season`)
- Sums `raceResults.points` per team
- No points cache — computed on demand

When a transfer is approved:
1. Delete old `draftPick` row (dropped rider loses association to old team)
2. Insert new `draftPick` row (incoming rider gains association to new team)
3. All future `raceResults.points` for the incoming rider accrue to the new team
4. Historical `raceResults.points` for the dropped rider may or may not transfer — **this is a product decision** (see Open Questions)

### Established Patterns to Follow

| Pattern | Where Established | Reuse In Phase 6 |
|---------|------------------|------------------|
| Server Action + Zod + `revalidatePath` | `admin/results/actions.ts` | Transfer submission, approval, rejection |
| `checkAdminAuth()` helper | `admin/results/actions.ts:17` | Admin approval/rejection actions |
| `checkLeagueMembership` | `lib/league-auth.ts` | Team member transfer submission |
| Transaction + audit insert | `admin/results/actions.ts:206` | Transfer execution (delete + insert + audit) |
| JSONB audit with `oldData`/`newData` | `db/schema/results.ts` | Transfer audit log |
| `serial("id").primaryKey()` | All tables | New transfer tables |
| `leagueId` scoping on all tables | All tables | `transferBids` + `transferWindows` |
| Direct SQL for migrations | Decision #04-01 | New schema tables |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | Server Actions for mutations | Established pattern in all phases |
| Drizzle ORM | 0.45.1 | DB queries, transactions | Used throughout; transfers are insert/delete within transaction |
| Zod | 4.3.6 | Bid schema validation | Established pattern; validates riderId, leagueId, reason |
| React Hook Form | 7.71.1 | Transfer submission form | Consistent with Phase 2 pattern |
| shadcn/ui | Latest | UI components (Dialog, Table, Badge, Alert) | All already installed |
| Better Auth | 1.4.6 | Auth session in Server Actions | Used in all existing actions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Format transfer window dates | Already installed |
| sonner | 2.0.7 | Toast notifications on bid submission | Already installed |
| TanStack Table | 8.21.3 | Admin transfer management table | Already installed (used in admin races/riders) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Admin-approval workflow | Instant auto-approval | Auto-approval is simpler but loses admin oversight; game context requires review |
| Direct SQL for migration | drizzle-kit generate | drizzle-kit 0.31.9 + drizzle-orm 0.45.1 — check compatibility before using; prior phases used direct SQL |
| Separate `transferAudit` table | Reuse `resultAudit` | Separate table is cleaner; `resultAudit` is `raceId`-keyed, not appropriate for transfers |

**Installation:**
```bash
# No new packages needed — all required libraries already installed
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/
│   └── schema/
│       └── transfers.ts           # New: transferBids, transferWindows, transferAudit tables
├── app/
│   ├── admin/
│   │   └── transfers/
│   │       ├── page.tsx           # Replace stub: admin transfer management UI
│   │       └── actions.ts         # Admin: approve/reject bids
│   └── (main)/
│       └── leagues/
│           └── [leagueId]/
│               └── transfers/
│                   ├── page.tsx   # Team: view open bids, submit new bid
│                   ├── actions.ts # Team: submit bid, cancel bid
│                   └── transfer-form.tsx  # Client: bid form
└── lib/
    └── transfer-queries.ts        # Shared: get bids, get free agents, check windows
```

### Pattern 1: New Schema Tables (Direct SQL Migration)
**What:** Three new tables — `transferBids` (pending/approved/rejected bids), `transferWindows` (when transfers are open), `transferAudit` (immutable log).
**When to use:** On migration application via direct SQL (established workaround from decision #04-01).

```typescript
// src/db/schema/transfers.ts

import { pgTable, serial, integer, text, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core"
import { leagues, teams } from "./leagues"
import { riders } from "./riders"
import { races } from "./races"
import { user } from "./users"

export const transferBidStatusEnum = pgEnum("transfer_bid_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
])

export const transferBids = pgTable("transfer_bids", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  outRiderId: integer("outRiderId").notNull().references(() => riders.id),  // rider being dropped
  inRiderId: integer("inRiderId").notNull().references(() => riders.id),    // rider being picked up
  status: transferBidStatusEnum("status").notNull().default("pending"),
  reason: text("reason"),                 // optional team note
  adminNote: text("adminNote"),           // admin rejection reason
  submittedAt: timestamp("submittedAt", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  resolvedBy: text("resolvedBy").references(() => user.id),
}, (table) => ({
  leagueIdx: index("transfer_bids_league_idx").on(table.leagueId),
  teamIdx: index("transfer_bids_team_idx").on(table.teamId),
  statusIdx: index("transfer_bids_status_idx").on(table.status),
}))

export const transferWindows = pgTable("transfer_windows", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  raceId: integer("raceId").references(() => races.id),   // null = season-wide window
  maxTransfers: integer("maxTransfers"),                   // null = unlimited
  opensAt: timestamp("opensAt", { withTimezone: true }).notNull(),
  closesAt: timestamp("closesAt", { withTimezone: true }).notNull(),
  description: text("description"),
}, (table) => ({
  leagueIdx: index("transfer_windows_league_idx").on(table.leagueId),
}))

export const transferAudit = pgTable("transfer_audit", {
  id: serial("id").primaryKey(),
  transferBidId: integer("transferBidId").notNull().references(() => transferBids.id),
  leagueId: integer("leagueId").notNull().references(() => leagues.id),
  action: text("action").notNull(),  // "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXECUTED"
  performedBy: text("performedBy").notNull().references(() => user.id),
  performedAt: timestamp("performedAt", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
})
```

### Pattern 2: Transfer Execution via Transaction
**What:** On admin approval — atomically delete old `draftPick`, insert new `draftPick`, update bid status, insert audit record.
**When to use:** `approveBid` Server Action.

```typescript
// src/app/admin/transfers/actions.ts
"use server"

export async function approveBid(bidId: number) {
  const session = await checkAdminAuth()

  await db.transaction(async (tx) => {
    // 1. Fetch bid with validation
    const bid = await tx.query.transferBids.findFirst({
      where: and(eq(transferBids.id, bidId), eq(transferBids.status, "pending"))
    })
    if (!bid) throw new Error("Bid not found or not pending")

    // 2. Verify inRider is still a free agent (not picked up by someone else)
    const alreadyOwned = await tx.query.draftPicks.findFirst({
      where: and(
        eq(draftPicks.leagueId, bid.leagueId),
        eq(draftPicks.riderId, bid.inRiderId)
      )
    })
    if (alreadyOwned) throw new Error("Incoming rider is no longer a free agent")

    // 3. Verify outRider still belongs to this team
    const currentPick = await tx.query.draftPicks.findFirst({
      where: and(
        eq(draftPicks.leagueId, bid.leagueId),
        eq(draftPicks.riderId, bid.outRiderId),
        eq(draftPicks.teamId, bid.teamId)
      )
    })
    if (!currentPick) throw new Error("Outgoing rider is no longer on this team")

    // 4. Get inRider gender for draftPicks.gender
    const inRider = await tx.query.riders.findFirst({
      where: eq(riders.id, bid.inRiderId)
    })
    if (!inRider) throw new Error("Incoming rider not found")

    // 5. Execute roster mutation
    await tx.delete(draftPicks).where(eq(draftPicks.id, currentPick.id))
    await tx.insert(draftPicks).values({
      leagueId: bid.leagueId,
      teamId: bid.teamId,
      riderId: bid.inRiderId,
      pickNumber: -1,       // sentinel: -1 = transferred, not drafted
      round: -1,            // sentinel
      gender: inRider.gender,
      wasAutomatic: false,
      pickedAt: new Date(),
    })

    // 6. Update bid status
    await tx.update(transferBids)
      .set({ status: "approved", resolvedAt: new Date(), resolvedBy: session.user.id })
      .where(eq(transferBids.id, bidId))

    // 7. Audit
    await tx.insert(transferAudit).values({
      transferBidId: bidId,
      leagueId: bid.leagueId,
      action: "APPROVED",
      performedBy: session.user.id,
    })
  })

  revalidatePath("/admin/transfers")
  revalidatePath(`/leagues/${leagueId}/transfers`)
  return { success: true }
}
```

### Pattern 3: Free Agent Query (Available Riders)
**What:** All riders NOT in `draftPicks` for this league, with same gender filter.
**When to use:** Transfer form rider picker, showing available riders.

```typescript
// src/lib/transfer-queries.ts
export async function getFreeAgents(leagueId: number, gender?: "M" | "F") {
  // Subquery: all riderIds already drafted in this league
  const ownedRiderIds = db
    .select({ riderId: draftPicks.riderId })
    .from(draftPicks)
    .where(eq(draftPicks.leagueId, leagueId))

  const conditions = [notInArray(riders.id, ownedRiderIds)]
  if (gender) conditions.push(eq(riders.gender, gender))

  return db.select().from(riders).where(and(...conditions)).orderBy(riders.name)
}
```

### Pattern 4: Transfer Window Validation
**What:** Check whether a team has hit their transfer limit for the current window.
**When to use:** Server Action `submitBid` — reject if limit reached or window closed.

```typescript
// Inline in submitBid action
async function validateTransferWindow(leagueId: number, teamId: number): Promise<void> {
  const now = new Date()

  // Find active window
  const window = await db.query.transferWindows.findFirst({
    where: and(
      eq(transferWindows.leagueId, leagueId),
      lte(transferWindows.opensAt, now),
      gt(transferWindows.closesAt, now)
    )
  })

  if (!window) {
    throw new Error("No active transfer window — transfers are currently closed")
  }

  if (window.maxTransfers !== null) {
    // Count approved transfers this window for this team
    const usedCount = await db
      .select({ count: count() })
      .from(transferBids)
      .where(and(
        eq(transferBids.leagueId, leagueId),
        eq(transferBids.teamId, teamId),
        eq(transferBids.status, "approved"),
        gte(transferBids.submittedAt, window.opensAt),
        lte(transferBids.submittedAt, window.closesAt)
      ))
    const used = usedCount[0]?.count ?? 0
    if (used >= window.maxTransfers) {
      throw new Error(`Transfer limit reached (${window.maxTransfers}) for this window`)
    }
  }
}
```

### Pattern 5: Team Transfer UI Location
**What:** New route under league context at `/leagues/[leagueId]/transfers`.
**When to use:** Team members submit and track their own bids.

```typescript
// src/app/(main)/leagues/[leagueId]/transfers/page.tsx
// Server Component pattern following standings/page.tsx:
// 1. getLeagueDetails(leagueId) — auth + membership guard
// 2. Status guard: transfers only for "active" leagues
// 3. Parallel fetch: team's pending bids + active window + team's current roster
// 4. Pass to client component for display + submission form
```

### Anti-Patterns to Avoid

- **Mutating `draftPicks` without a transaction:** Drop + insert must be atomic. A crash between them leaves the league in inconsistent state.
- **Using `pickNumber` as roster identity:** `draftPicks.pickNumber` is a draft sequencing artifact. For transfers, use sentinel values (-1) or add a `sourceType: "draft" | "transfer"` column.
- **Allowing pending bid on already-pending rider:** If a team has a pending bid for rider X (incoming), a second team should not also bid on X. Validate at submission OR accept that approval is first-come-first-served (race condition exists without DB lock).
- **Not checking free agent status at approval time:** A rider might be bid on by two teams simultaneously. Always re-verify at approval time (inside transaction) that the rider is still unowned.
- **Forgetting `revalidatePath` on both admin and user paths:** Admin approves → both `/admin/transfers` AND `/leagues/[leagueId]/transfers` need revalidation.
- **Allowing transfer of rider to same team:** `outRiderId === inRiderId` or `inRiderId` already on `teamId` — validate before insert.
- **Using `draftPicks.round` for transfer history queries:** `round: -1` as sentinel is a smell. Consider adding `wasTransfer: boolean` column or querying `pickedAt > draftSession.completedAt` for transfer date filtering.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Free agent list | Custom "available riders" state | Drizzle `notInArray` subquery | Correct by construction from `draftPicks` constraint |
| Bid state machine | Custom status transitions | Enum + explicit update in action | PostgreSQL enforces allowed values via `transfer_bid_status` enum |
| Roster integrity | Application-level rider tracking | Drizzle transaction (delete + insert) | Atomic — no partial state possible |
| Transfer window config | Hardcoded race type rules | `transferWindows` table | Allows admin to configure per-league per-season without deploys |
| Historical points after transfer | Custom point attribution engine | Decision by design (see Open Questions) | Not a technical problem; choose one model and document |

**Key insight:** The transfer system is a state machine (pending → approved/rejected/cancelled) operating on `draftPicks`. All complexity is in the state transitions — use transactions for atomicity, not application-level locking.

---

## Common Pitfalls

### Pitfall 1: Race Condition on Free Agent Approval
**What goes wrong:** Two teams bid on the same free agent simultaneously. Both bids are pending. Admin approves bid A. Bid B still shows "pending" and can also be approved.
**Why it happens:** `getFreeAgents` check at submission time is a snapshot — the rider becomes owned only when bid A is approved.
**How to avoid:** At approval time, inside the transaction, re-check `draftPicks` for the `inRiderId`. If already owned, abort with error. The first approval wins; admin must reject the other bid.
**Warning signs:** League has duplicate `draftPick` rows for same `riderId` + `leagueId` — prevented by `riderLeagueUnique` index (will throw error).

### Pitfall 2: `draftPicks` Unique Index Violation on Transfer Insert
**What goes wrong:** Transfer approval inserts new `draftPick` for `inRider` but `riderLeagueUnique` index on `(leagueId, riderId)` blocks it if rider was already picked.
**Why it happens:** Race condition or logic error in validation step.
**How to avoid:** The `riderLeagueUnique` uniqueIndex is the safety net — catch error code `23505` and surface as "rider already on a team."
**Warning signs:** `error.code === "23505"` in catch block — same pattern as `submitRaceResults`.

### Pitfall 3: `pickNumber` Uniqueness Constraint for Transfer Inserts
**What goes wrong:** `draftPicks` has `pickNumberUnique` index on `(leagueId, pickNumber)`. If transfer uses `pickNumber: -1`, two transfers in the same league both use -1 → unique constraint violation.
**Why it happens:** `pickNumber` was designed for draft ordering, not post-draft operations.
**How to avoid:** Either (a) add a `sourceType: "draft" | "transfer"` column and make `pickNumberUnique` partial (only for drafts), or (b) use a sequence like `-(transferId)` to ensure uniqueness, or (c) remove the `pickNumberUnique` index constraint and add a new partial unique index only on draft picks.
**Warning signs:** Second transfer in same league fails with `23505` on `pick_number_unique`.

**CRITICAL DESIGN DECISION:** The `pickNumberUnique` uniqueIndex will block a naive transfer insert. The migration must address this. Options:
1. Drop `pickNumberUnique`, add partial unique index: `UNIQUE WHERE pickNumber >= 0`
2. Add `isTransfer: boolean` column, make pick number nullable for transfers
3. Use globally unique pick numbers across both draft and transfer (increment from max)

Recommended: Option 1 (drop the constraint on negative pickNumbers via partial index).

### Pitfall 4: Transfer During Active Race
**What goes wrong:** Admin approves a transfer while a grand tour is in progress. The dropped rider scored points in stage 3 for Team A. After transfer, those points historically belonged to Team A's pick. The new pick is for Team B.
**Why it happens:** `scoring-queries.ts` joins `draftPicks.teamId` to `raceResults.riderId` — it reflects current ownership, not historical ownership.
**How to avoid:** This is a product decision, not purely a technical bug. See Open Questions. Technically: add a `validFrom: timestamp` to `draftPick` rows and score only results where `race.startDate >= draftPick.validFrom`. But this adds significant query complexity.
**Warning signs:** Team A complains points disappeared after their rider was transferred away.

### Pitfall 5: Missing League Status Guard
**What goes wrong:** User can submit a transfer bid when league is in "setup" or "drafting" status.
**Why it happens:** Not checking `league.status === "active"` before allowing bid submission.
**How to avoid:** Status guard in the Server Action (same as standings page checks `league.status`). Return error if not active.
**Warning signs:** Transfer bids appear for leagues still in drafting phase.

### Pitfall 6: Admin Revalidation Not Covering User Path
**What goes wrong:** Admin approves bid. Admin's table refreshes. User's `/leagues/[leagueId]/transfers` page still shows bid as "pending."
**Why it happens:** `revalidatePath("/admin/transfers")` does not revalidate the user-facing path.
**How to avoid:** Revalidate both paths: `revalidatePath("/admin/transfers")` AND `revalidatePath(`/leagues/${leagueId}/transfers`)` after any bid status change.
**Warning signs:** User refreshes their transfer page and still sees "pending" after admin approved.

---

## Code Examples

### Submitting a Bid (Team Server Action)
```typescript
// src/app/(main)/leagues/[leagueId]/transfers/actions.ts
"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { transferBids } from "@/db/schema/transfers"
import { draftPicks } from "@/db/schema/draft"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { checkLeagueMembership } from "@/lib/league-auth"
import { eq, and } from "drizzle-orm"

const bidSchema = z.object({
  leagueId: z.number(),
  outRiderId: z.number(),
  inRiderId: z.number(),
  reason: z.string().optional(),
})

export async function submitTransferBid(formData: z.infer<typeof bidSchema>) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: "Unauthorized" }

  const parsed = bidSchema.safeParse(formData)
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors }

  const { leagueId, outRiderId, inRiderId, reason } = parsed.data

  // Auth: must be a league member
  const { isMember, team } = await checkLeagueMembership(session.user.id, leagueId)
  if (!isMember || !team) return { success: false, error: "Not a member of this league" }

  // Validate league is active (status guard)
  const league = await db.query.leagues.findFirst({ where: eq(leagues.id, leagueId) })
  if (!league || league.status !== "active") {
    return { success: false, error: "Transfers are only available during an active season" }
  }

  // Validate outRider belongs to this team
  const outPick = await db.query.draftPicks.findFirst({
    where: and(
      eq(draftPicks.leagueId, leagueId),
      eq(draftPicks.teamId, team.id),
      eq(draftPicks.riderId, outRiderId)
    )
  })
  if (!outPick) return { success: false, error: "Outgoing rider is not on your team" }

  // Validate inRider is a free agent (not in any draftPick for this league)
  const inPickExists = await db.query.draftPicks.findFirst({
    where: and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.riderId, inRiderId))
  })
  if (inPickExists) return { success: false, error: "Incoming rider is already on a team" }

  // Validate transfer window (if implemented)
  // await validateTransferWindow(leagueId, team.id)

  // Insert bid
  await db.insert(transferBids).values({
    leagueId,
    teamId: team.id,
    outRiderId,
    inRiderId,
    status: "pending",
    reason: reason ?? null,
  })

  revalidatePath(`/leagues/${leagueId}/transfers`)
  revalidatePath("/admin/transfers")
  return { success: true }
}
```

### Querying Pending Bids (Admin View)
```typescript
// Source: established pattern from scoring-queries.ts + results/actions.ts
export async function getPendingBids() {
  return db
    .select({
      bidId: transferBids.id,
      leagueId: transferBids.leagueId,
      leagueName: leagues.name,
      teamId: transferBids.teamId,
      teamName: teams.name,
      outRiderName: outRider.name,
      inRiderName: inRider.name,
      status: transferBids.status,
      submittedAt: transferBids.submittedAt,
    })
    .from(transferBids)
    .innerJoin(leagues, eq(leagues.id, transferBids.leagueId))
    .innerJoin(teams, eq(teams.id, transferBids.teamId))
    .innerJoin(outRider, eq(outRider.id, transferBids.outRiderId))
    .innerJoin(inRider, eq(inRider.id, transferBids.inRiderId))
    .where(eq(transferBids.status, "pending"))
    .orderBy(desc(transferBids.submittedAt))
}
// Note: `outRider` and `inRider` require table aliasing:
// const outRider = alias(riders, "outRider")
// const inRider = alias(riders, "inRider")
```

### Migration SQL (Direct SQL Pattern)
```sql
-- Apply via direct SQL (workaround: drizzle-kit incompatibility)
CREATE TYPE "transfer_bid_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE "transfer_bids" (
  "id" serial PRIMARY KEY NOT NULL,
  "leagueId" integer NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE,
  "teamId" integer NOT NULL REFERENCES "teams"("id"),
  "outRiderId" integer NOT NULL REFERENCES "riders"("id"),
  "inRiderId" integer NOT NULL REFERENCES "riders"("id"),
  "status" "transfer_bid_status" NOT NULL DEFAULT 'pending',
  "reason" text,
  "adminNote" text,
  "submittedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "resolvedAt" timestamp with time zone,
  "resolvedBy" text REFERENCES "user"("id")
);

CREATE TABLE "transfer_windows" (
  "id" serial PRIMARY KEY NOT NULL,
  "leagueId" integer NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE,
  "raceId" integer REFERENCES "races"("id"),
  "maxTransfers" integer,
  "opensAt" timestamp with time zone NOT NULL,
  "closesAt" timestamp with time zone NOT NULL,
  "description" text
);

CREATE TABLE "transfer_audit" (
  "id" serial PRIMARY KEY NOT NULL,
  "transferBidId" integer NOT NULL REFERENCES "transfer_bids"("id"),
  "leagueId" integer NOT NULL REFERENCES "leagues"("id"),
  "action" text NOT NULL,
  "performedBy" text NOT NULL REFERENCES "user"("id"),
  "performedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "note" text
);

-- Fix pickNumber uniqueness for transfers
-- Drop old constraint, add partial index covering only non-transfer picks
DROP INDEX IF EXISTS "draft_picks_pick_number_unique";
CREATE UNIQUE INDEX "draft_picks_pick_number_unique" ON "draft_picks"("leagueId", "pickNumber") WHERE "pickNumber" >= 0;

-- Indexes
CREATE INDEX "transfer_bids_league_idx" ON "transfer_bids"("leagueId");
CREATE INDEX "transfer_bids_team_idx" ON "transfer_bids"("teamId");
CREATE INDEX "transfer_bids_status_idx" ON "transfer_bids"("status");
CREATE INDEX "transfer_windows_league_idx" ON "transfer_windows"("leagueId");
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Roster as static array | `draftPicks` table as source of truth | Phase 4 | Transfers = mutations to this table, no separate roster concept needed |
| Separate "transfer" and "draft" pick tables | Single `draftPicks` table | Phase 4 design | Transfers reuse same table — sentinel `pickNumber: -1` needed OR partial index fix |
| Scoring joined to historical snapshot | Scoring joins current `draftPicks` | Phase 5 | Historical point attribution is a product decision, not technical requirement |

**Deprecated/outdated:**
- The admin transfers page stub says "Coming in Phase 5" — Phase 5 is done; Phase 6 fills this in.
- The `orderTypes` table is sometimes confused with "bids" — they are a separate feature (strategic power-ups) planned for Phase 7.

---

## Open Questions

1. **Historical Points After Transfer**
   - What we know: `scoring-queries.ts` joins current `draftPicks` — points reflect current roster ownership
   - What's unclear: Should Team A lose points their dropped rider scored before the transfer? Most fantasy sports attribute points to the team that owned the rider when the race happened, not the current owner
   - Recommendation: Add `pickedAt` to scoring query as a cutoff — only count `raceResults` where `race.startDate >= draftPick.pickedAt`. This requires a join change in `scoring-queries.ts`. Alternatively, attribute ALL historical points to current owner (simpler but may feel unfair). **User must decide.** Research suggests real fantasy platforms always use ownership-at-race-time.

2. **`draftPicks.pickNumber` Uniqueness for Transfers**
   - What we know: `pickNumberUnique` uniqueIndex on `(leagueId, pickNumber)` will block any two transfers using the same sentinel value
   - What's unclear: Best schema fix without breaking draft functionality
   - Recommendation: Drop the unique index, add partial unique index `WHERE pickNumber >= 0` — transfers use `pickNumber = -(transferBidId)` or any negative unique value

3. **Transfer Window Configuration**
   - What we know: Admin transfers placeholder documents rules (GT=unlimited, HP=4, LP/MT=2)
   - What's unclear: Should windows be auto-created from race calendar? Or manually created by admin? Are limits per-window or cumulative per-league?
   - Recommendation: Admin-created windows initially (simplest); auto-creation from race calendar is a future enhancement. Start with `transferWindows` table + admin CRUD. Limits are per-window.

4. **Can a Team Submit Multiple Pending Bids?**
   - What we know: No constraint prevents multiple pending bids from the same team
   - What's unclear: Should a team be limited to 1 pending bid at a time? Or can they queue multiple?
   - Recommendation: Limit to 1 pending bid per team (add check in `submitBid` action, optionally add unique index on `(leagueId, teamId, status) WHERE status = 'pending'`). Simpler admin workflow.

5. **Bid Expiry**
   - What we know: No expiry mechanism exists in schema
   - What's unclear: Should pending bids auto-expire when a transfer window closes?
   - Recommendation: Auto-expire via a background job (QStash, already installed) OR admin manually rejects. For Phase 6, admin rejects manually — background job is future work.

6. **Gender Constraint on Transfers**
   - What we know: Draft enforces gender (men's pool vs women's pool) — `draftPicks.gender` tracks this
   - What's unclear: Should transfers also be constrained by gender (only swap within same gender pool)?
   - Recommendation: Yes — validate that `outRider.gender === inRider.gender` in `submitBid` action. This preserves the men's/women's pool balance.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/db/schema/draft.ts` — `draftPicks` table schema, constraints, indexes (confirmed today)
- Codebase: `src/db/schema/config.ts` — `orderTypes` schema (confirmed it is NOT the transfer system)
- Codebase: `src/app/admin/transfers/page.tsx` — existing stub, documented transfer window rules
- Codebase: `src/app/admin/results/actions.ts` — transaction + audit pattern to reuse
- Codebase: `src/lib/scoring-queries.ts` — JOIN pattern, TODO comment on order multipliers
- Codebase: `src/lib/league-auth.ts` — auth helpers to reuse
- Codebase: `.planning/STATE.md` — decisions #04-01 (drizzle-kit workaround), #05-01 (multi-tenant isolation)
- Codebase: `src/db/migrations/0000_wonderful_songbird.sql` — confirmed `riderLeagueUnique` and `pickNumberUnique` constraints

### Secondary (MEDIUM confidence)
- `.planning/phases/02-admin-backoffice-race-calendar/02-RESEARCH.md` — Phase 2 research, architecture patterns for admin forms and audit trails
- `.planning/phases/05-scoring-points-system/05-RESEARCH.md` — Phase 5 research, scoring query patterns

### Tertiary (LOW confidence — validate during implementation)
- Fantasy sports convention: ownership-at-race-time for historical points (common practice, not verified against official docs)
- Partial unique index syntax on PostgreSQL: `CREATE UNIQUE INDEX ... WHERE pickNumber >= 0` — standard PostgreSQL partial index syntax (HIGH confidence from PostgreSQL docs knowledge, not re-verified today)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, confirmed in `package.json`
- Architecture: HIGH — patterns verified from existing codebase (results/actions.ts, draft.ts, scoring-queries.ts)
- Schema design: HIGH — `draftPicks` constraints fully understood; new tables are straightforward extensions
- Pitfalls: HIGH — `pickNumber` uniqueness issue is a concrete constraint found in the actual migration SQL; race condition on free agent approval is a known fantasy sports problem

**Research date:** 2026-02-14
**Valid until:** 2026-03-16 (30 days — stable ecosystem, no external APIs)

**Key pre-planning decisions needed from user before planning:**
1. Historical points attribution model: current-owner or owned-at-race-time?
2. Transfer window: admin-managed (simple) or auto-generated from race calendar?
3. Multiple pending bids per team: allow or restrict to 1?
4. Schema fix for `pickNumber`: partial index (recommended) or new `isTransfer` column?

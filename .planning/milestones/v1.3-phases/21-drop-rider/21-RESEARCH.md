# Phase 21: Drop Rider — Research

**Researched:** 2026-03-06
**Domain:** Next.js server actions, Drizzle ORM, roster mutation (draftPicks delete)
**Confidence:** HIGH

---

## Summary

Phase 21 is a deliberately narrow feature: players can instantly remove any rider from their active roster with no approval step and no waiver period. The mechanism is a hard delete of the `draftPicks` row for that rider+team+league combination. No new schema is required — `draftPicks` is the canonical "this rider is on this team" record and a delete is the correct, reversible-only-by-re-draft operation.

The Phase 20 work established `getActiveRosterCount` which subtracts approved IR riders from the total pick count. A drop reduces the total picks directly, so the freed slot is immediately reflected in that arithmetic: after a drop, `getActiveRosterCount` returns a lower value automatically, satisfying success criterion 3 without any additional logic.

The UX pattern to follow is the IR page: a server RSC page at `/leagues/[leagueId]/roster` (or co-located with an existing management page) renders the roster, a `"use client"` component handles button interaction and calls the server action via `useTransition`, and `revalidatePath` refreshes the relevant paths. A confirmation dialog (like the admin IR reject dialog pattern already in the codebase) prevents accidental drops.

**Primary recommendation:** One server action (`dropRider`) that hard-deletes the `draftPicks` row, guarded by auth + membership + ownership-of-rider checks, plus a client component with a confirmation step. Surface the drop UI on a new `/leagues/[leagueId]/roster` page linked from the league page actions row. No new schema. No new queries beyond what already exists (`getTeamRoster` from `transfer-queries.ts` is reusable as-is).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROST-01 | Player can drop any rider from their roster instantly (no admin approval, no waiver period) | Hard delete of `draftPicks` row in a server action with auth + membership + pick ownership guards. `revalidatePath` makes change immediate to the UI. `getActiveRosterCount` arithmetic automatically reflects the freed slot. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (App Router) | as installed | Server actions + RSC pages | Project-wide pattern |
| Drizzle ORM | as installed | DB delete via `db.delete(...).where(...)` | All data access in the project |
| `next/cache` `revalidatePath` | built-in | Invalidate RSC cache after mutation | Used on every action in the project |
| `sonner` | as installed | Toast feedback on success/error | IR form and transfer form both use it |
| shadcn/ui `Button`, `Card`, `Dialog` | as installed | UI components matching existing pages | Dialog for confirmation step; same pattern as admin IR reject |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useTransition` (React) | built-in | Pending state during server action call | Used in ir-form.tsx and transfer-form.tsx |
| `date-fns` `format` | as installed | Date formatting in roster display | IR page uses it for submittedAt |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hard delete of draftPicks | Soft-delete flag on draftPicks | Hard delete is correct — dropped riders become free agents; soft delete would require filtering everywhere |
| Separate `/roster` page | Inline drop buttons on IR page | Separate page is cleaner and follows the pattern established for IR, transfers, orders |
| Confirmation dialog | Single-click drop | Dialog prevents accidental drop of a high-value rider; low complexity cost using existing shadcn Dialog |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── (no new query file needed — getTeamRoster already in transfer-queries.ts)
├── app/(main)/leagues/[leagueId]/
│   └── roster/
│       ├── page.tsx          # RSC: fetches roster, renders RosterClient
│       └── roster-client.tsx # "use client": drop button + confirmation dialog
│   └── roster/
│       └── actions.ts        # "use server": dropRider server action
```

### Pattern 1: Server Action with Hard Delete
**What:** `dropRider({ leagueId, riderId })` deletes the draftPicks row for the authenticated user's team.
**When to use:** All roster mutations — drop is the simplest case.
**Example:**
```typescript
// Mirrors submitIrRequest pattern from src/app/(main)/leagues/[leagueId]/ir/actions.ts
"use server"

export async function dropRider(data: {
  leagueId: number
  riderId: number
}): Promise<{ success: true } | { success: false; error: string }> {
  // 1. Auth
  let session
  try { session = await getAuthenticatedUser() } catch { return { success: false, error: "Unauthorized" } }

  // 2. League membership + get team
  const { isMember, team } = await checkLeagueMembership(session.user.id, data.leagueId)
  if (!isMember || !team) return { success: false, error: "Not a member of this league" }

  // 3. Verify rider is on this team
  const [pick] = await db.select({ id: draftPicks.id })
    .from(draftPicks)
    .where(and(
      eq(draftPicks.teamId, team.id),
      eq(draftPicks.leagueId, data.leagueId),
      eq(draftPicks.riderId, data.riderId)
    ))
    .limit(1)

  if (!pick) return { success: false, error: "Rider is not on your team" }

  // 4. Delete the pick
  await db.delete(draftPicks)
    .where(and(
      eq(draftPicks.teamId, team.id),
      eq(draftPicks.leagueId, data.leagueId),
      eq(draftPicks.riderId, data.riderId)
    ))

  // 5. Revalidate
  revalidatePath(`/leagues/${data.leagueId}/roster`)
  revalidatePath(`/leagues/${data.leagueId}`)

  return { success: true }
}
```

### Pattern 2: RSC Page + Client Component Split
**What:** Page RSC fetches roster via `getTeamRoster`, passes to `RosterClient` which owns all interactivity.
**When to use:** Every player-facing action page (IR page, transfers page follow this).
**Example:**
```typescript
// page.tsx — mirrors ir/page.tsx
export default async function RosterPage({ params }) {
  const { leagueId } = await params
  const details = await getLeagueDetails(leagueId)
  // ... guards (league active, user has team)
  const roster = await getTeamRoster(userTeamId, leagueId)
  return <RosterClient roster={roster} leagueId={leagueId} />
}

// roster-client.tsx — mirrors ir-form.tsx
"use client"
export function RosterClient({ roster, leagueId }) {
  const [isPending, startTransition] = useTransition()
  const [confirmRiderId, setConfirmRiderId] = useState<number | null>(null)

  function handleDrop(riderId: number) {
    startTransition(async () => {
      const result = await dropRider({ leagueId, riderId })
      if (result.success) toast.success("Rider dropped")
      else toast.error(result.error)
      setConfirmRiderId(null)
    })
  }
  // Dialog for confirm step, rider list rendered as cards matching transfer-form.tsx style
}
```

### Anti-Patterns to Avoid
- **Deleting by riderId alone without teamId guard:** The `draftPicks` table has a `riderLeagueUnique` index on `(leagueId, riderId)`, but always scope deletes to `teamId` too — belt-and-suspenders against cross-team manipulation.
- **No confirmation step:** A drop is irreversible without an admin re-draft. Always show a confirm dialog.
- **Revalidating only the roster page:** The league page also shows team roster count context; revalidate both `/leagues/[leagueId]/roster` and `/leagues/[leagueId]`.
- **Missing league-active guard:** Drop should only be allowed when `league.status === "active"`. A rider should not be droppable in a setup/complete league.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth check | Custom session logic | `getAuthenticatedUser()` from `@/lib/league-auth` | Project standard, handles headers() |
| Membership check | Custom DB query | `checkLeagueMembership(userId, leagueId)` from `@/lib/league-auth` | Already returns the team record needed for teamId |
| Roster fetch | New query function | `getTeamRoster(teamId, leagueId)` from `@/lib/transfer-queries` | Returns `{ riderId, riderName, riderTeam, gender, ... }` — exactly what the UI needs |
| Toast feedback | Custom alert component | `sonner` `toast.success` / `toast.error` | IR form and transfer form both use this pattern |
| Confirmation UI | Alert or confirm() | shadcn `Dialog` | Used in admin IR reject flow; consistent with project UI kit |

**Key insight:** This phase requires zero new query helpers. `getTeamRoster` already returns the full roster with rider names. The only new code is the `dropRider` server action and the client UI.

---

## Common Pitfalls

### Pitfall 1: Dropped Rider Still Shows on IR
**What goes wrong:** If a rider on IR (approved) is dropped from the roster, the `ir_requests` row remains. The IR slot stays "occupied" but the rider is gone. `getActiveRosterCount` would return a negative correction (approved IR - 1 more than total picks).
**Why it happens:** Drop only deletes `draftPicks`; `ir_requests` is a separate table.
**How to avoid:** The server action must also clean up any active (`pending` or `approved`) `ir_requests` for that rider in that league+team when a drop occurs. Delete or update those IR rows in the same operation (within a transaction if possible, though the project uses no explicit transactions currently — two sequential deletes is acceptable given the simple flow).
**Warning signs:** If a team drops an IR'd rider and the IR slot doesn't free up, check for orphaned `ir_requests` rows.

### Pitfall 2: Dropping a Rider Who Has a Pending Transfer Bid
**What goes wrong:** A transfer bid references the outgoing rider via `outRiderId`. If the rider is dropped before the bid is processed, the bid references a rider no longer on the team.
**Why it happens:** Transfer bids are not cascade-deleted when a pick is removed.
**How to avoid:** When `dropRider` is called, also cancel any pending transfer bids (status = "pending") where `outRiderId = riderId AND teamId = team.id AND leagueId = leagueId`. Update their status to "cancelled". This matches the existing `cancelTransferBid` pattern in transfer actions.
**Warning signs:** Admin processes a transfer bid and the outgoing rider is no longer on the team — causes a confusing state.

### Pitfall 3: Double-Delete / Race Condition
**What goes wrong:** Player clicks drop twice rapidly; the second delete finds no row and silently succeeds (no error), but two "success" toasts appear.
**Why it happens:** `db.delete` with Drizzle does not error if zero rows are affected.
**How to avoid:** The ownership check (step 3 in the action — verify the pick exists) serves as the guard. If pick is not found, return `{ success: false, error: "Rider is not on your team" }`. The `useTransition` `isPending` state also disables the button during the first call. This is sufficient.

### Pitfall 4: IR Orphan after Drop (detailed mechanics)
**What goes wrong:** `getActiveRosterCount` = COUNT(draftPicks) - COUNT(approved irRequests). If a player has 10 picks, 1 approved IR, count = 9. After dropping the IR'd rider: picks = 9, approved IR = 1, count = 8. The arithmetic is correct BUT the IR slot still shows as "occupied" in the UI.
**How to avoid:** When dropping a rider, delete or cancel their `ir_requests` row so the IR page clears up. The `getTeamIrSlots` function (which drives the IR page display) will then show the slot as empty.

---

## Code Examples

### Drizzle Delete Pattern
```typescript
// Source: existing project pattern — db.delete used in transfers/actions.ts
await db.delete(draftPicks)
  .where(and(
    eq(draftPicks.teamId, team.id),
    eq(draftPicks.leagueId, data.leagueId),
    eq(draftPicks.riderId, data.riderId)
  ))
```

### IR Cleanup on Drop
```typescript
// Cancel pending/approved IR requests for the dropped rider
// Source: mirrors irRequests update pattern from admin/ir/actions.ts
import { inArray } from "drizzle-orm"

await db.delete(irRequests)
  .where(and(
    eq(irRequests.teamId, team.id),
    eq(irRequests.leagueId, data.leagueId),
    eq(irRequests.riderId, data.riderId),
    inArray(irRequests.status, ["pending", "approved"])
  ))
```

### Cancel Pending Transfer Bids for Dropped Rider
```typescript
// Source: mirrors cancelTransferBid pattern from transfers/actions.ts
import { transferBids } from "@/db/schema/transfers"

await db.update(transferBids)
  .set({ status: "cancelled" })
  .where(and(
    eq(transferBids.teamId, team.id),
    eq(transferBids.leagueId, data.leagueId),
    eq(transferBids.outRiderId, data.riderId),
    eq(transferBids.status, "pending")
  ))
```

### Client Confirmation Dialog Pattern
```typescript
// Source: mirrors ir-actions.tsx Dialog pattern from admin/ir/ir-actions.tsx
"use client"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

// Open dialog on first click, confirm on second click
const [confirmRiderId, setConfirmRiderId] = useState<number | null>(null)
const confirmRider = roster.find(r => r.riderId === confirmRiderId)

<Dialog open={confirmRiderId !== null} onOpenChange={() => setConfirmRiderId(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Drop {confirmRider?.riderName}?</DialogTitle>
      <DialogDescription>
        This is permanent. The rider will become a free agent immediately.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setConfirmRiderId(null)}>Cancel</Button>
      <Button variant="destructive" onClick={() => handleDrop(confirmRiderId!)} disabled={isPending}>
        {isPending ? "Dropping..." : "Drop Rider"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct form submit / page reload | Server action + `useTransition` + `revalidatePath` | Next.js App Router (project baseline) | Instant UI feedback, no full page reload |
| Separate API route | Co-located `actions.ts` with `"use server"` | Project v1.0 baseline | Simpler code organization, type-safe RPC |

**Deprecated/outdated:**
- `pages/api/` routes: project uses App Router server actions exclusively.

---

## Open Questions

1. **Where exactly should the drop UI live?**
   - What we know: IR page (`/leagues/[leagueId]/ir`) shows the roster as a dropdown for IR submissions. The league page (`/leagues/[leagueId]`) shows a team roster table but it is read-only. The transfers page has a roster display for picking the outgoing rider.
   - What's unclear: Should drop be a new `/leagues/[leagueId]/roster` page, or added to the existing IR page (since IR and drop are both "roster management" features), or inline on the league page?
   - Recommendation: A dedicated `/leagues/[leagueId]/roster` page is cleanest and avoids overloading the IR page. Add a "Manage Roster" button to the league page actions row (alongside "Injured Reserve"). The planner should make the final call.

2. **Should IR records be deleted or cancelled when a rider is dropped?**
   - What we know: The IR status enum only has `pending`, `approved`, `rejected` — there is no `cancelled` value (STATE.md confirms this was a deliberate decision in Phase 20).
   - What's unclear: Whether to hard-delete the IR row (cleanest) or update status to `rejected` with an auto-note.
   - Recommendation: Hard-delete the IR row when a rider is dropped. It avoids inventing a fourth status and keeps the IR table clean. The `ir_requests` row is only meaningful if the rider is still on the team.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`tsc --noEmit`) — the project uses type-checking as its primary automated verification; no Jest/Vitest test files present |
| Config file | `tsconfig.json` |
| Quick run command | `cd /Users/kristianoftedal/dev/velospill && npx tsc --noEmit 2>&1 \| grep -E "roster\|drop" \|\| echo "No TS errors in phase 21 files"` |
| Full suite command | `cd /Users/kristianoftedal/dev/velospill && npx tsc --noEmit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROST-01 | `dropRider` action deletes draftPicks row, rejects non-members and non-owners | manual-only (no test runner configured) | `npx tsc --noEmit 2>&1 \| grep "actions\|roster" \|\| echo "clean"` | ❌ Wave 0 |
| ROST-01 | IR rows cleaned up when rider is dropped | manual-only | n/a | ❌ Wave 0 |
| ROST-01 | Pending transfer bids cancelled when rider is dropped | manual-only | n/a | ❌ Wave 0 |

**Note:** The project has a single typecheck file in `src/lib/__tests__/` (`scoring-queries-history.typecheck.ts`). No runtime test suite is configured. Verification is by TypeScript compilation + manual smoke test in the running app.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit 2>&1 | grep -E "roster|drop|actions" || echo "No TS errors"`
- **Per wave merge:** `npx tsc --noEmit`
- **Phase gate:** Full `tsc --noEmit` clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No new test files needed — existing project convention is typecheck-only.
- [ ] Ensure `src/app/(main)/leagues/[leagueId]/roster/actions.ts` compiles clean after creation.

*(No additional test infrastructure required beyond what already exists.)*

---

## Sources

### Primary (HIGH confidence)
- Codebase read: `src/app/(main)/leagues/[leagueId]/ir/actions.ts` — server action pattern, auth guards
- Codebase read: `src/lib/ir-queries.ts` — query helper pattern, `getActiveRosterCount` arithmetic
- Codebase read: `src/lib/transfer-queries.ts` — `getTeamRoster` (reusable as-is), `cancelTransferBid` pattern
- Codebase read: `src/db/schema/draft.ts` — `draftPicks` table definition, `riderLeagueUnique` index
- Codebase read: `src/db/schema/ir.ts` — `irRequests` table, status enum values
- Codebase read: `src/app/admin/ir/ir-actions.tsx` — Dialog confirmation pattern
- Codebase read: `src/app/(main)/leagues/[leagueId]/page.tsx` — league page actions row (where "Manage Roster" button will be added)
- Codebase read: `.planning/STATE.md` — confirmed no `cancelled` IR status, drop is instant with no approval

### Secondary (MEDIUM confidence)
- Codebase read: `.planning/phases/20-ir-foundation-admin-approval/20-02-PLAN.md` — plan format and structure conventions for Phase 21 planner

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; confirmed by reading source files
- Architecture: HIGH — exact patterns for RSC page + client component + server action already established in Phase 20 IR work
- Pitfalls: HIGH — IR orphan and transfer bid cleanup identified by direct schema inspection; not speculative
- Open questions: MEDIUM — UI placement is a product decision, not a technical blocker

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable stack, no external dependencies)

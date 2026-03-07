# Phase 24: Write Path Wiring - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire all roster mutations to also write the corresponding change to `roster_slots`, keeping it in sync with `draftPicks` and `irRequests`. No UI changes. No read path changes. 6 requirements (RSLOT-03 through RSLOT-08) across 4 action files + 1 API route.

Scoring queries and `draftPicks.pickedAt` ownership-at-race-time remain completely untouched.

</domain>

<decisions>
## Implementation Decisions

### Sync failure policy
- **Full atomicity required** — wrap primary write + roster_slots write in a DB transaction everywhere
- If roster_slots write fails, roll back the entire action; user sees a generic error ("Failed to update roster" or equivalent)
- Do NOT surface roster_slots internals in error messages
- **All actions get transactions** — dropRider, approveIrRequest, markEligibleToReturn, returnRider, dropAndReturnRider, makePick, and auto-pick route all get wrapped in `db.transaction()`
- approveBid already uses a transaction — extend it, do not add a second one

### Auto-pick route scope
- **Include the QStash `/api/draft/auto-pick` route** — it inserts draftPicks rows just like makePick, so it must also insert into roster_slots
- Both makePick and auto-pick must be wired; omitting auto-pick would leave roster_slots incomplete after a timer fires

### dropAndReturnRider atomicity
- **One transaction for all 4 writes**: delete dropped rider's draftPicks + delete their roster_slots + update irRequests to `returned` + update returning rider's roster_slots to `active`
- All 4 must be atomic — if any step fails, none commit
- Plain returnRider (no drop) also gets a transaction: update irRequests to `returned` + update roster_slots to `active`

### Transfer approval roster_slots writes
- **Extend approveBid's existing transaction** — roster_slots writes go inside the existing `db.transaction()` block alongside the draftPicks changes
- For swaps (outgoing rider exists): DELETE outgoing rider's roster_slots row, INSERT incoming rider's roster_slots row with `active` and new teamId
- For free-slot pickups (no outgoing rider): INSERT incoming rider's roster_slots row
- Use **INSERT with ON CONFLICT DO UPDATE (upsert)** for the incoming rider insert — defensively handles any stale rows from inconsistency without crashing

### Claude's Discretion
- Shared helper vs. inline writes — either extract a `syncRosterSlot()` utility or write inline; planner decides
- Exact transaction wrapping style (whether to use existing `db.transaction()` pattern or introduce a helper)
- Where exactly in each action file the roster_slots import is added

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `rosterSlots` table: `src/db/schema/roster-slots.ts` — exported from `src/db/schema/index.ts`
- `rosterSlotStatusEnum`: available for type-safe status values
- `db.transaction()`: already used in `approveBid` — pattern established

### Established Patterns
- All action files import from `@/lib/db` and `@/db/schema/*` — follow same pattern
- Error returns use `{ success: false, error: string }` shape throughout
- `revalidatePath()` calls stay outside transactions (they're Next.js cache invalidation, not DB)

### Integration Points (write paths to wire)

| Requirement | Action | File | roster_slots change |
|-------------|--------|------|---------------------|
| RSLOT-03 | `makePick` | `draft/actions.ts` | INSERT `active` |
| RSLOT-03 | auto-pick route | `api/draft/auto-pick/route.ts` | INSERT `active` |
| RSLOT-04 | `dropRider` | `roster/actions.ts` | DELETE row |
| RSLOT-05 | `approveBid` | `admin/transfers/actions.ts` | DELETE out-row, INSERT in-row |
| RSLOT-06 | `approveIrRequest` | `admin/ir/actions.ts` | UPDATE status → `on_ir` |
| RSLOT-07 | `markEligibleToReturn` | `admin/ir/actions.ts` | UPDATE status → `return_eligible` |
| RSLOT-08 | `returnRider` | `ir/actions.ts` | UPDATE status → `active` |
| RSLOT-08 | `dropAndReturnRider` | `ir/actions.ts` | DELETE dropped row + UPDATE returned row → `active` |

### Key constraints
- `dropAndReturnRider` currently uses two sequential `await db.delete()` / `await db.update()` without a transaction — Phase 24 wraps all 4 operations (including the 2 new roster_slots writes) in a single `db.transaction()`
- `approveBid`'s transaction currently has 6 steps — roster_slots writes slot in after step 5 (delete old draftPick) and step 6 (insert new draftPick)
- The unique `(leagueId, riderId)` constraint on roster_slots is already enforced at DB level — approveBid already catches error code `23505`

</code_context>

<specifics>
## Specific Ideas

- Use `INSERT ... ON CONFLICT (leagueId, riderId) DO UPDATE SET teamId = EXCLUDED.teamId, status = EXCLUDED.status` for the incoming-rider insert in transfer approval (defensive upsert pattern matching the backfill script)
- The auto-pick route lives in `src/app/api/draft/auto-pick/route.ts` — it uses the same `db.insert(draftPicks)` pattern as makePick

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 24-write-path-wiring*
*Context gathered: 2026-03-07*

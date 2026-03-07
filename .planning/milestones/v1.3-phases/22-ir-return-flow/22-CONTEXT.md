# Phase 22: IR Return Flow - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

When an admin marks an approved IR rider as eligible to return, the player sees a warning banner on the league page, is blocked from submitting transfers until they act, and can return the rider to their active roster from the IR page. If the active roster is full, the player must drop a rider inline (same dialog, same action) before the return is accepted. Waiver pickup using the freed IR slot (IR-06) is already working via quick-task 15.

</domain>

<decisions>
## Implementation Decisions

### Banner placement
- Banner appears on the league page only (not injected into the layout for all sub-pages)
- Urgent/warning style — red or amber warning card, hard to miss
- Generic message: "You have riders eligible to return from IR. Transfers blocked until resolved." — covers 1 or 2 eligible riders without naming them
- Banner contains a button/link that navigates to /leagues/[leagueId]/ir where the return action lives

### Roster-full gate
- When active roster is full and player clicks "Return [Rider]", an inline dialog opens on the IR page
- Dialog shows a dropdown of current active roster riders to select who to drop
- Single combined confirmation button: "Drop & Return" — one action, both steps happen in the same server call
- Best-effort error handling: if the server action fails at any step, show a toast error and leave state unchanged (no partial state)
- No two-step confirmation — one dialog, one confirm

### Claude's Discretion
- Schema approach for "eligible to return" state: recommend adding `return_eligible` as a new value to the `irStatusEnum` (requires migration). Alternatively a separate boolean column — Claude chooses cleanest approach given existing schema
- Admin "mark eligible" UI: extend the existing admin IR page with a second section below the pending queue showing approved IR riders with a "Mark Eligible to Return" action per rider
- Transfer block implementation: disable the transfer form client-side with a clear message explaining why; server action also validates and returns an error if a bypass occurs
- Return action placement: inline on the IR page — each eligible-to-return rider gets a "Return" button in the IR slots list
- IR status after successful return: IR request record should be updated to a terminal state (e.g., `returned` — new enum value, or soft-delete the record) so the slot is freed

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `irStatusEnum` (`src/db/schema/ir.ts`): currently `pending | approved | rejected` — needs new value(s) for `return_eligible` and likely `returned`
- `getTeamIrSlots` (`src/lib/ir-queries.ts`): returns all IR requests for a team — already the right query shape for showing IR slots with return buttons
- `getActiveRosterCount` (`src/lib/ir-queries.ts`): already correct — subtracts approved IR riders from total picks; will need updating when `return_eligible` is introduced (eligible riders should still free the slot until returned)
- `RosterClient` drop confirmation pattern (`src/app/(main)/leagues/[leagueId]/roster/roster-client.tsx`): Dialog + confirm button pattern to reuse for inline drop-and-return
- `IrActions` component pattern (`src/app/admin/ir/ir-actions.tsx`): client component receiving server actions as props — same pattern for admin "mark eligible" action
- `approveIrRequest` / `rejectIrRequest` (`src/app/admin/ir/actions.ts`): server action pattern with `checkAdminAuth()` + update + `revalidatePath` — template for `markEligibleToReturn` action

### Established Patterns
- Server actions return `{ success: true } | { success: false; error: string }` — use the same shape for new actions
- `revalidatePath` after mutations — need to revalidate both `/admin/ir` and `/leagues/[leagueId]/ir` (and `/leagues/[leagueId]` for the banner)
- `useTransition` + `toast` (sonner) for async action feedback in client components
- Dialog from shadcn/ui for confirmation flows

### Integration Points
- League page (`/leagues/[leagueId]`): banner must be added here — query for eligible-to-return riders at page load
- Transfer form (`/leagues/[leagueId]/transfers`): must check for eligible-to-return riders and disable form with message
- Admin IR page (`/admin/ir`): extend with second section for approved riders and "Mark Eligible" action
- `submitTransferBid` server action: add guard that rejects if any IR rider on the team is `return_eligible`

</code_context>

<specifics>
## Specific Ideas

- Banner mockup decided: urgent warning card (red/amber) on league page with "You have riders eligible to return from IR. Transfers blocked until resolved." + link/button to IR page
- Roster-full dialog mockup: dropdown to select who to drop, single "Drop & Return" button — no separate confirmation steps

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-ir-return-flow*
*Context gathered: 2026-03-07*

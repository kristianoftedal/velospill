---
phase: quick-23
plan: 23
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/transfer-queries.ts
  - src/app/(main)/leagues/[leagueId]/transfers/actions.ts
  - src/app/admin/transfers/actions.ts
  - src/app/admin/transfers/window-management.tsx
autonomous: true
requirements: [QUICK-23]
must_haves:
  truths:
    - "Submitting a transfer bid never fails due to a per-window transfer limit"
    - "Auto-generated windows carry no maxTransfers value"
    - "Admin UI for managing windows has no Max Transfers column or form field"
    - "All existing windows in the DB have maxTransfers set to NULL"
  artifacts:
    - path: src/lib/transfer-queries.ts
      provides: generateTransferWindows without maxTransfers field
    - path: src/app/(main)/leagues/[leagueId]/transfers/actions.ts
      provides: submitTransferBid without limit check
    - path: src/app/admin/transfers/actions.ts
      provides: createTransferWindow without maxTransfers param
    - path: src/app/admin/transfers/window-management.tsx
      provides: window table and form without Max Transfers UI
  key_links:
    - from: src/app/(main)/leagues/[leagueId]/transfers/actions.ts
      to: src/lib/transfer-queries.ts
      via: getTeamTransferCount import removed
---

<objective>
Remove per-window transfer limits entirely. The `maxTransfers` column on `transfer_windows` remains in the DB schema (no migration needed) but is nulled out in existing rows and never populated or enforced going forward.

Purpose: Transfers should be unlimited per window — remove all validation, generation, and display of maxTransfers.
Output: Clean codebase with no transfer-limit logic; DB rows have NULL maxTransfers.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove limit logic from transfer-queries.ts and submitTransferBid action</name>
  <files>
    src/lib/transfer-queries.ts,
    src/app/(main)/leagues/[leagueId]/transfers/actions.ts
  </files>
  <action>
**In `src/lib/transfer-queries.ts`:**

1. Delete the `getTeamTransferCount` function entirely (lines 138-171).

2. In `generateTransferWindows`, change the `windowParams` map type from `Record<string, { maxTransfers: number | null; daysBeforeOpen: number }>` to `Record<string, { daysBeforeOpen: number }>`. Remove all `maxTransfers` values from every entry in the map. Remove the `maxTransfers: params.maxTransfers` line from the return object in `.map(...)`. Also remove the `maxTransfers: 2` from the fallback `?? { maxTransfers: 2, daysBeforeOpen: 3 }`.

3. Remove the `getTeamTransferCount` from the exported type aliases at the bottom (line 351 area — only if it was exported as a type, otherwise just deleting the function is enough).

**In `src/app/(main)/leagues/[leagueId]/transfers/actions.ts`:**

1. Remove `getTeamTransferCount` from the import of `@/lib/transfer-queries` (line 17).

2. Delete the entire limit-check block (currently after the `getActiveTransferWindow` call, before budget validation):
```ts
if (activeWindow.maxTransfers != null && outRiderId != null) {
  const usedTransfers = await getTeamTransferCount(team.id, leagueId, activeWindow.id)
  if (usedTransfers >= activeWindow.maxTransfers) {
    return {
      success: false,
      error: `Transfer limit reached (${activeWindow.maxTransfers} per window)`,
    }
  }
}
```
The `getActiveTransferWindow` call itself stays — it's still used to gate whether a window is open.
  </action>
  <verify>
    TypeScript: `npx tsc --noEmit 2>&1 | grep -E "transfer-queries|transfers/actions" | head -20`
    No references to `getTeamTransferCount` remain: `grep -r "getTeamTransferCount" src/`
  </verify>
  <done>No TypeScript errors in affected files; grep finds zero references to getTeamTransferCount.</done>
</task>

<task type="auto">
  <name>Task 2: Remove maxTransfers from admin actions, window management UI, and null out DB rows</name>
  <files>
    src/app/admin/transfers/actions.ts,
    src/app/admin/transfers/window-management.tsx
  </files>
  <action>
**In `src/app/admin/transfers/actions.ts`:**

1. In `createTransferWindowSchema`, remove the `maxTransfers: z.number().int().positive().optional()` field.

2. In the `createTransferWindow` function signature, remove `maxTransfers?: number` from the parameter type. Remove `maxTransfers` from the destructured `parsed.data`. Remove `maxTransfers: maxTransfers ?? null` from the `.values({...})` insert call.

3. In `getTransferWindows`, remove `maxTransfers: transferWindows.maxTransfers` from the `.select({...})` object. (The `TransferWindow` type exported at the bottom is inferred — it will update automatically.)

**In `src/app/admin/transfers/window-management.tsx`:**

1. In the `TransferWindowManagement` component, remove `maxTransfers: ""` from the initial `formData` state and from the `handleOpenDialog` reset.

2. Remove the `formData.maxTransfers` field from the `createTransferWindow` call in `handleSubmitWindow`.

3. In the windows table (`<Table>`), remove the `<TableHead>Max Transfers</TableHead>` header cell and the entire `<TableCell>` block that displays `w.maxTransfers` (the one with the "Unlimited" fallback span).

4. Remove the entire "Max Transfers" `<div className="space-y-1">` form group from the Create Manual Window Dialog (the Input with `id="max-transfers"`).

**Null out existing DB rows:**

Run this SQL against the Neon database via the project's DB connection. Use the `db` Drizzle client in a one-off script or run via `node -e`:

```ts
// Run as: npx tsx src/scripts/null-max-transfers.ts
import { db } from "@/lib/db"
import { transferWindows } from "@/db/schema/transfers"
import { isNotNull } from "drizzle-orm"

await db.update(transferWindows)
  .set({ maxTransfers: null })
  .where(isNotNull(transferWindows.maxTransfers))

console.log("Done — all maxTransfers nulled")
process.exit(0)
```

Create this file at `src/scripts/null-max-transfers.ts`, run it with `npx tsx src/scripts/null-max-transfers.ts`, then delete it.
  </action>
  <verify>
    TypeScript: `npx tsc --noEmit 2>&1 | grep -E "admin/transfers" | head -20`
    No maxTransfers in admin actions: `grep -n "maxTransfers" src/app/admin/transfers/actions.ts`
    No maxTransfers in window UI: `grep -n "maxTransfers" src/app/admin/transfers/window-management.tsx`
  </verify>
  <done>
    - Zero TypeScript errors in admin files
    - `grep maxTransfers src/app/admin/transfers/actions.ts` returns no results
    - `grep maxTransfers src/app/admin/transfers/window-management.tsx` returns no results
    - DB script ran successfully and was deleted
  </done>
</task>

</tasks>

<verification>
After both tasks:

1. No references to `maxTransfers` remain in any non-schema source file:
   `grep -r "maxTransfers" src/ --include="*.ts" --include="*.tsx" | grep -v "schema/transfers.ts"`

2. No references to `getTeamTransferCount` anywhere:
   `grep -r "getTeamTransferCount" src/`

3. TypeScript compiles cleanly for affected files:
   `npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30`
</verification>

<success_criteria>
- Transfer bid submission never returns "Transfer limit reached" error
- Auto-generated windows have no maxTransfers value in the returned proposals
- Admin window management UI has no Max Transfers column or form field
- All existing DB rows have maxTransfers = NULL
- No TypeScript errors introduced
</success_criteria>

<output>
After completion, create `.planning/quick/23-remove-transfer-limits-per-window-from-v/23-SUMMARY.md`
</output>

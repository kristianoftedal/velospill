---
phase: quick-13
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/transfer-queries.ts
  - src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Team with IR'd riders sees hasMenSlot/hasWomenSlot as true when active slots are below max"
    - "IR'd riders appear in the roster list marked 'On IR' and are not clickable as drop candidates"
    - "Free-slot pickup path shows Step 2 free agent picker when active count is below max even if total roster is full"
  artifacts:
    - path: "src/lib/transfer-queries.ts"
      provides: "getTeamRoster returns isOnIR: boolean for each entry"
      contains: "irRequests"
    - path: "src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx"
      provides: "hasMenSlot/hasWomenSlot computed from active (non-IR) riders only"
      contains: "isOnIR"
  key_links:
    - from: "src/lib/transfer-queries.ts"
      to: "src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx"
      via: "TeamRosterEntry type — isOnIR field consumed by form"
      pattern: "isOnIR"
---

<objective>
Fix the transfer form so teams with riders on IR can pick up a free agent without being forced to drop someone.

Purpose: IR'd riders occupy a draftPicks row but free up an active roster slot per the v1.3 design decision. Currently getTeamRoster counts them as active, making the roster appear full when it is not.
Output: getTeamRoster annotates each entry with isOnIR; the form excludes IR'd riders from active-slot counts and marks them as non-selectable drop targets.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@src/lib/transfer-queries.ts
@src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx
@src/db/schema/ir.ts

<interfaces>
<!-- irRequests table (src/db/schema/ir.ts) -->
irRequests columns: id, leagueId, teamId, riderId, status (pending/approved/rejected), reason, adminNote, submittedAt, resolvedAt, resolvedBy

<!-- Current getTeamRoster return shape (src/lib/transfer-queries.ts line 43-63) -->
{ riderId, riderName, riderTeam, gender, nationality, pickNumber, pickedAt }

<!-- TeamRosterEntry exported type (line 344) -->
export type TeamRosterEntry = Awaited<ReturnType<typeof getTeamRoster>>[number]

<!-- TransferForm props (transfer-form.tsx line 15-23) -->
interface TransferFormProps {
  roster: TeamRosterEntry[]   // <- isOnIR must be added here
  ...
}

<!-- Active slot logic in form (lines 71-77) -->
const menRoster = roster.filter((r) => r.gender === "M")    // currently ALL men
const womenRoster = roster.filter((r) => r.gender === "F")  // currently ALL women
const hasMenSlot = menRoster.length < MAX_MEN_RIDERS         // BUG: counts IR'd riders
const hasWomenSlot = womenRoster.length < MAX_WOMEN_RIDERS   // BUG: counts IR'd riders
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add isOnIR to getTeamRoster via left-join on approved irRequests</name>
  <files>src/lib/transfer-queries.ts</files>
  <action>
    1. Import irRequests from "@/db/schema/ir" at the top of the file (alongside existing imports).

    2. Modify getTeamRoster to left-join irRequests:
       - Join condition: irRequests.riderId = draftPicks.riderId AND irRequests.teamId = draftPicks.teamId AND irRequests.leagueId = draftPicks.leagueId AND irRequests.status = 'approved'
       - Add to select: isOnIR computed as a SQL boolean expression. Use Drizzle's `sql` helper: `sql<boolean>\`\${irRequests.id} IS NOT NULL\`.as("isOnIR")` (import sql from drizzle-orm).
       - Keep all existing select fields unchanged.

    3. The resulting query signature stays the same (teamId, leagueId). Only the return shape grows by one field: isOnIR: boolean.

    Example query structure:
    ```ts
    import { irRequests } from "@/db/schema/ir"
    import { sql } from "drizzle-orm"

    .from(draftPicks)
    .innerJoin(riders, eq(riders.id, draftPicks.riderId))
    .leftJoin(
      irRequests,
      and(
        eq(irRequests.riderId, draftPicks.riderId),
        eq(irRequests.teamId, draftPicks.teamId),
        eq(irRequests.leagueId, draftPicks.leagueId),
        eq(irRequests.status, "approved")
      )
    )
    .select({
      ...existingFields,
      isOnIR: sql<boolean>`${irRequests.id} IS NOT NULL`.as("isOnIR"),
    })
    ```

    4. The exported `TeamRosterEntry` type is inferred automatically — no manual type change needed.
  </action>
  <verify>npx tsc --noEmit --project tsconfig.json 2>&1 | grep -E "transfer-queries|ir\.ts" || echo "no type errors in these files"</verify>
  <done>getTeamRoster returns isOnIR: boolean on each entry; TypeScript compiles without errors in the modified files</done>
</task>

<task type="auto">
  <name>Task 2: Update TransferForm to exclude IR'd riders from active slot counts and mark them unselectable</name>
  <files>src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx</files>
  <action>
    The TeamRosterEntry type now includes isOnIR: boolean. Make the following changes:

    1. **Active-slot counts (lines 71-77):** Split roster into "all" (for display) and "active" (for slot math):
       ```ts
       const menRoster = roster.filter((r) => r.gender === "M")
       const womenRoster = roster.filter((r) => r.gender === "F")
       const activeMenRoster = menRoster.filter((r) => !r.isOnIR)
       const activeWomenRoster = womenRoster.filter((r) => !r.isOnIR)
       const hasMenSlot = activeMenRoster.length < MAX_MEN_RIDERS
       const hasWomenSlot = activeWomenRoster.length < MAX_WOMEN_RIDERS
       const hasAnyFreeSlot = hasMenSlot || hasWomenSlot
       const rosterIsFull = !hasAnyFreeSlot
       ```

    2. **Free-slot info banner (lines 264-274):** Replace menRoster.length / womenRoster.length references with activeMenRoster.length / activeWomenRoster.length so the counts are correct.

    3. **Roster buttons (lines 282-326):** For riders where r.isOnIR === true:
       - Render a non-interactive div instead of a button (or keep button but add `disabled` and `pointer-events-none`).
       - Show an "On IR" badge next to the rider name: `<span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 ml-1">On IR</span>`
       - Do not call handleSelectOutRider for IR'd riders.
       - Style: use `opacity-60 cursor-not-allowed border-gray-100 bg-gray-50` for IR'd rider cards.

    4. **handleSelectOutRider guard (line 101):** Add early return if the rider is on IR:
       ```ts
       function handleSelectOutRider(riderId: number) {
         const rider = roster.find((r) => r.riderId === riderId)
         if (rider?.isOnIR) return   // IR'd riders cannot be dropped via transfer
         ...rest unchanged...
       }
       ```

    Do NOT change any other form logic (bid submission, free agent picker, canSubmit, etc.).
  </action>
  <verify>npx tsc --noEmit --project tsconfig.json 2>&1 | grep "transfer-form" || echo "no type errors in transfer-form"</verify>
  <done>
    - hasMenSlot/hasWomenSlot correctly reflect active-only counts.
    - IR'd riders show "On IR" badge, are visually distinct (muted style), and cannot be selected as drop targets.
    - Teams with IR'd riders see Step 2 free agent picker without selecting a drop target when active slots are available.
  </done>
</task>

</tasks>

<verification>
Manual smoke test after both tasks:
1. Log in as a team that has at least one rider with an approved IR request.
2. Navigate to /leagues/{leagueId}/transfers.
3. Confirm the free-slot banner shows (reflecting IR'd rider freeing a slot).
4. Confirm IR'd rider card shows "On IR" badge and cannot be clicked.
5. Confirm Step 2 free agent picker appears without selecting a drop target.
6. Submit a no-drop pickup bid and verify it submits successfully.
</verification>

<success_criteria>
- TypeScript compiles without errors in the two modified files.
- Teams with IR'd riders can initiate a free-slot pickup in the transfer form.
- IR'd riders are visually marked and excluded from drop-target selection.
</success_criteria>

<output>
No SUMMARY file required for quick tasks.
</output>

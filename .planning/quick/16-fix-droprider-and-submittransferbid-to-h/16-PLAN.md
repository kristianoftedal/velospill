---
phase: quick-16
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(main)/leagues/[leagueId]/roster/actions.ts
  - src/app/(main)/leagues/[leagueId]/transfers/actions.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Dropping a return_eligible rider removes the stale IR row"
    - "Free-agent pickup slot check excludes both approved and return_eligible IR riders"
  artifacts:
    - path: "src/app/(main)/leagues/[leagueId]/roster/actions.ts"
      provides: "dropRider IR cleanup covers all non-terminal statuses"
      contains: "return_eligible"
    - path: "src/app/(main)/leagues/[leagueId]/transfers/actions.ts"
      provides: "submitTransferBid slot check consistent with getActiveRosterCount"
      contains: "return_eligible"
  key_links:
    - from: "dropRider IR cleanup"
      to: "irRequests"
      via: "inArray status check"
      pattern: "inArray.*return_eligible"
    - from: "submitTransferBid gender slot check"
      to: "irRequests"
      via: "LEFT JOIN isNull filter"
      pattern: "inArray.*return_eligible"
---

<objective>
Fix two status-enum gaps discovered during v1.3 audit: dropRider IR cleanup omits return_eligible, and submitTransferBid gender slot check omits return_eligible from its IR exclusion join.

Purpose: Both bugs can leave a team transfer-blocked after dropping a return_eligible rider, or overcounting active roster slots for a team with a return_eligible IR rider.
Output: Two one-line fixes, consistent use of ["approved", "return_eligible"] wherever IR riders must be excluded from active-slot counts or cleaned up on drop.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix dropRider IR cleanup to include return_eligible</name>
  <files>src/app/(main)/leagues/[leagueId]/roster/actions.ts</files>
  <action>
    At line ~91, change:
      inArray(irRequests.status, ["pending", "approved"])
    to:
      inArray(irRequests.status, ["pending", "approved", "return_eligible"])

    This ensures dropping a rider who is in return_eligible state removes the stale IR row and does not leave the team permanently transfer-blocked. The "rejected" and "returned" terminal statuses are correctly excluded — only non-terminal statuses should be cleaned up on drop.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "roster/actions" || echo "No type errors in roster/actions"</automated>
  </verify>
  <done>inArray at line ~91 contains "return_eligible"; no TypeScript errors in the file</done>
</task>

<task type="auto">
  <name>Task 2: Fix submitTransferBid gender slot check to include return_eligible</name>
  <files>src/app/(main)/leagues/[leagueId]/transfers/actions.ts</files>
  <action>
    At line ~150, change the LEFT JOIN condition on irRequests from:
      eq(irRequests.status, "approved")
    to:
      inArray(irRequests.status, ["approved", "return_eligible"])

    This makes the gender-specific slot count in submitTransferBid consistent with getActiveRosterCount, which already uses inArray(["approved", "return_eligible"]). Both approved and return_eligible riders free a roster slot (per v1.3 design decision: slot only closes again when status becomes "returned").

    Ensure the inArray import from drizzle-orm is already present at the top of the file — it should be since it is used elsewhere.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "transfers/actions" || echo "No type errors in transfers/actions"</automated>
  </verify>
  <done>eq(irRequests.status, "approved") replaced with inArray covering both statuses; no TypeScript errors in the file</done>
</task>

</tasks>

<verification>
After both fixes, confirm:
- grep return_eligible src/app/\(main\)/leagues/\[leagueId\]/roster/actions.ts returns the IR cleanup line
- grep return_eligible src/app/\(main\)/leagues/\[leagueId\]/transfers/actions.ts returns the slot-check JOIN line
- npx tsc --noEmit exits without errors in either file
</verification>

<success_criteria>
- dropRider deletes IR rows with status pending, approved, OR return_eligible
- submitTransferBid gender slot count excludes IR riders with status approved OR return_eligible (matching getActiveRosterCount)
- No new TypeScript errors introduced
</success_criteria>

<output>
After completion, create `.planning/quick/16-fix-droprider-and-submittransferbid-to-h/16-SUMMARY.md`
</output>

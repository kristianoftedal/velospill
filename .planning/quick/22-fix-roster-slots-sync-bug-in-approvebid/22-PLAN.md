---
phase: quick-22
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/admin/transfers/actions.ts
autonomous: true
requirements: [QUICK-22]

must_haves:
  truths:
    - "approveBid succeeds when outgoing rider exists in roster_slots but not in draftPicks"
    - "Outgoing rider's roster_slots row is deleted whether currentPick exists or not"
    - "Incoming rider's roster_slots row is always inserted/upserted on approval"
    - "approveBid still throws if outgoing rider is found in neither draftPicks nor roster_slots"
  artifacts:
    - path: "src/app/admin/transfers/actions.ts"
      provides: "Fixed approveBid with roster_slots fallback in Step 3 and Step 5"
  key_links:
    - from: "Step 3 guard"
      to: "roster_slots table"
      via: "tx.query.rosterSlots.findFirst fallback when currentPick is null"
      pattern: "rosterSlots.findFirst.*leagueId.*teamId.*riderId"
    - from: "Step 5 delete"
      to: "roster_slots"
      via: "delete by (leagueId, riderId) unconditionally when outRiderId is set"
---

<objective>
Fix the `approveBid` function so it handles the edge case where an outgoing rider exists in `roster_slots` but not in `draftPicks`. This prevents the transaction from aborting and leaving the system in a partially-applied state.

Purpose: After v1.4 roster_slots migration, some riders may have a roster_slots row without a corresponding draftPicks row. The current guard throws and aborts, which in past cases left draft_picks partially inserted with no roster_slots counterpart.

Output: Modified `approveBid` in `src/app/admin/transfers/actions.ts` with a roster_slots fallback check in Step 3 and a decoupled delete path in Step 5.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix approveBid — roster_slots fallback for outgoing rider verification</name>
  <files>src/app/admin/transfers/actions.ts</files>
  <action>
Modify the `approveBid` function in `src/app/admin/transfers/actions.ts` with these targeted changes:

**Step 3 — change the outgoing rider check to also consult roster_slots:**

Replace the current block (lines ~123–136):
```typescript
let currentPick = null
if (bid.outRiderId != null) {
  currentPick = await tx.query.draftPicks.findFirst({
    where: and(
      eq(draftPicks.leagueId, bid.leagueId),
      eq(draftPicks.teamId, bid.teamId),
      eq(draftPicks.riderId, bid.outRiderId)
    ),
  })
  if (!currentPick) {
    throw new Error("Outgoing rider is no longer on this team")
  }
}
```

With:
```typescript
let currentPick = null
let currentSlot = null
if (bid.outRiderId != null) {
  currentPick = await tx.query.draftPicks.findFirst({
    where: and(
      eq(draftPicks.leagueId, bid.leagueId),
      eq(draftPicks.teamId, bid.teamId),
      eq(draftPicks.riderId, bid.outRiderId)
    ),
  })
  // Fallback: check roster_slots in case the rider has a slot but no draft_pick
  // (can happen post-migration or if draft_pick was lost due to a previous partial failure)
  if (!currentPick) {
    currentSlot = await tx.query.rosterSlots.findFirst({
      where: and(
        eq(rosterSlots.leagueId, bid.leagueId),
        eq(rosterSlots.teamId, bid.teamId),
        eq(rosterSlots.riderId, bid.outRiderId!)
      ),
    })
    if (!currentSlot) {
      throw new Error("Outgoing rider is no longer on this team")
    }
  }
}
```

**Step 5 — decouple draftPick delete from roster_slots delete:**

Replace the current block (lines ~147–156):
```typescript
if (currentPick) {
  await tx.delete(draftPicks).where(eq(draftPicks.id, currentPick.id))
  // Delete outgoing rider's roster_slots row
  await tx.delete(rosterSlots).where(
    and(
      eq(rosterSlots.leagueId, bid.leagueId),
      eq(rosterSlots.riderId, bid.outRiderId!)
    )
  )
}
```

With:
```typescript
if (bid.outRiderId != null) {
  // Delete draft_pick if it exists
  if (currentPick) {
    await tx.delete(draftPicks).where(eq(draftPicks.id, currentPick.id))
  }
  // Always delete outgoing rider's roster_slots row (covers both currentPick and currentSlot cases)
  await tx.delete(rosterSlots).where(
    and(
      eq(rosterSlots.leagueId, bid.leagueId),
      eq(rosterSlots.riderId, bid.outRiderId)
    )
  )
}
```

No other changes. The incoming rider's roster_slots upsert after Step 6 is already unconditional and correct — do not touch it.

Also ensure `rosterSlots` is in scope for the query — it is already imported at line 6.
  </action>
  <verify>
    <automated>cd /Users/kristianoftedal/dev/velospill && npx tsc --noEmit 2>&1 | grep -E "actions\.ts" | head -20 || echo "No TS errors in actions.ts"</automated>
  </verify>
  <done>
    - `currentSlot` fallback variable declared and used in Step 3
    - Step 3 throws only when BOTH `currentPick` and `currentSlot` are null
    - Step 5 is gated on `bid.outRiderId != null`, not on `currentPick` presence
    - roster_slots delete runs whenever outRiderId is set (covers both the draftPick-exists and draftPick-missing paths)
    - TypeScript compiles without errors in actions.ts
  </done>
</task>

</tasks>

<verification>
After the fix:
1. TypeScript compiles: `npx tsc --noEmit` shows no errors in actions.ts
2. Logic review: `currentSlot` fallback kicks in when `currentPick` is null but rider IS in roster_slots
3. Logic review: throw only happens when rider found in neither table
4. Logic review: roster_slots delete for outgoing rider is unconditional on outRiderId presence
5. The incoming rider upsert path is unchanged (still unconditional)
</verification>

<success_criteria>
`approveBid` no longer aborts when the outgoing rider is in `roster_slots` but missing from `draftPicks`. The outgoing rider's roster slot is always cleaned up when outRiderId is set.
</success_criteria>

<output>
After completion, create `.planning/quick/22-fix-roster-slots-sync-bug-in-approvebid/22-SUMMARY.md`
</output>

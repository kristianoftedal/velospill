---
phase: quick-10
plan: 10
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/migrations/0004_nullable_out_rider.sql
  - src/db/schema/transfers.ts
  - src/app/(main)/leagues/[leagueId]/transfers/actions.ts
  - src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx
  - src/app/admin/transfers/actions.ts
  - src/app/admin/transfers/bid-actions.tsx
  - src/app/admin/transfers/page.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "A team with available roster slots can submit a pickup bid without selecting a rider to drop"
    - "A team with a full roster cannot submit a pickup-only bid"
    - "Admin can approve a free-slot pickup bid and the inRider is added to draftPicks"
    - "The admin transfers page renders correctly for bids with no outRider (shows 'free slot')"
  artifacts:
    - path: "src/db/migrations/0004_nullable_out_rider.sql"
      provides: "Migration making outRiderId nullable"
      contains: "DROP NOT NULL"
    - path: "src/db/schema/transfers.ts"
      provides: "Schema with nullable outRiderId"
  key_links:
    - from: "transfer-form.tsx (hasAnyFreeSlot)"
      to: "actions.ts (outRiderId: undefined)"
      via: "submitTransferBid call with no outRiderId"
    - from: "approveBid (admin/transfers/actions.ts)"
      to: "draftPicks insert"
      via: "skips delete step when outRiderId is null"
---

<objective>
Wire up and verify the free-slot rider pickup feature — allowing teams with available roster space to add a rider without dropping anyone.

Purpose: All code changes already exist in the working tree (schema, server action, form, admin UI). The migration has been written but not applied to the database. This plan applies the migration and verifies the feature end-to-end.

Output: Migration applied to production DB; pickup-without-drop fully operational.
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
  <name>Task 1: Apply the nullable outRiderId migration</name>
  <files>src/db/migrations/0004_nullable_out_rider.sql</files>
  <action>
    The migration file already exists at src/db/migrations/0004_nullable_out_rider.sql and contains:
    `ALTER TABLE "transfer_bids" ALTER COLUMN "outRiderId" DROP NOT NULL;`

    Apply it to the database using psql (matching the project's raw SQL migration style from STATE.md decisions):

    1. Find the DATABASE_URL from .env or .env.local
    2. Run: `psql $DATABASE_URL -f src/db/migrations/0004_nullable_out_rider.sql`

    If psql is not available, try: `DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-) && psql "$DATABASE_URL" -f src/db/migrations/0004_nullable_out_rider.sql`

    Do NOT use drizzle-kit push (it has a known type error per DEBT-01). Use raw psql only.

    After applying the migration, verify the schema column is nullable:
    `psql $DATABASE_URL -c "\d transfer_bids" | grep outRiderId`
    Expect: no `not null` constraint on the outRiderId column.
  </action>
  <verify>
    psql output confirms: `outRiderId | integer | | |` (no "not null")
  </verify>
  <done>Database column outRiderId is nullable; migration applied without error.</done>
</task>

<task type="auto">
  <name>Task 2: Commit all working-tree changes as one cohesive feature</name>
  <files>
    src/db/schema/transfers.ts
    src/app/(main)/leagues/[leagueId]/transfers/actions.ts
    src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx
    src/app/admin/transfers/actions.ts
    src/app/admin/transfers/bid-actions.tsx
    src/app/admin/transfers/page.tsx
    src/db/migrations/0004_nullable_out_rider.sql
  </files>
  <action>
    All code changes are already in the working tree. Stage and commit them as a single feature commit.

    Use the gsd-tools commit helper:
    ```
    node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "feat(quick-10): add rider pickup without drop when roster has space" --files \
      src/db/schema/transfers.ts \
      src/app/(main)/leagues/[leagueId]/transfers/actions.ts \
      src/app/(main)/leagues/[leagueId]/transfers/transfer-form.tsx \
      src/app/admin/transfers/actions.ts \
      src/app/admin/transfers/bid-actions.tsx \
      src/app/admin/transfers/page.tsx \
      src/db/migrations/0004_nullable_out_rider.sql
    ```

    What these changes collectively do:
    - schema: outRiderId is nullable (drop NOT NULL constraint)
    - transfer action: already validates free-slot pickups (checks gender-specific count vs MAX_MEN/MAX_WOMEN)
    - transfer form: shows free-slot banner, makes outRider selection optional, shows free-agent list even without selecting a drop
    - admin bid-actions: handles null outRiderName in approve toast and reject dialog
    - admin page: renders "free slot" italicised text when outRiderName is null
    - migration: the raw SQL file that was applied to the DB
  </action>
  <verify>
    `git log --oneline -1` shows the feat commit. `git status` is clean.
  </verify>
  <done>All 7 files committed. Git working tree clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Free-slot rider pickup: teams with available roster slots can now pick up a free agent without having to drop anyone first. The transfer form shows an info banner when slots are available, makes the "Step 1: drop a rider" section optional, and submits a bid with outRiderId = null. Admin approves it by inserting the new draftPick with no deletion step. Admin UI shows "free slot" where the out-rider column would be.
  </what-built>
  <how-to-verify>
    1. Navigate to a league's transfers page: /leagues/{leagueId}/transfers
    2. If your team has fewer than 18 men or fewer than 6 women, you should see a blue info banner: "You have available roster spots..."
    3. Without selecting any rider to drop, scroll to Step 2 and select a free agent of the appropriate gender
    4. Set bid amount (can be 0) and click "Submit Transfer Bid" — expect success toast
    5. As admin, go to /admin/transfers and find the pending bid
    6. The "Out Rider" column should show "free slot" in grey italics
    7. Approve the bid — expect toast: "{inRiderName} picked up (free slot)"
    8. Verify the rider now appears on the team's roster

    To test the guard: try submitting a bid without a drop when your men's roster is full (18 riders) — the submit button should remain disabled since no free slot exists for men.
  </how-to-verify>
  <resume-signal>Type "approved" if the pickup flow works, or describe any issues</resume-signal>
</task>

</tasks>

<verification>
- Migration applied: outRiderId is nullable in transfer_bids table
- Transfer form shows free-slot banner and allows submission without selecting a drop rider
- Server action validates gender-specific slot availability before accepting a pickup-only bid
- Admin UI renders null outRiderName gracefully
- approveBid skips the draftPicks delete step when outRiderId is null
- All 7 modified files committed
</verification>

<success_criteria>
Teams with available roster slots can submit transfer bids for free agents without dropping a rider. Admin can approve these "free slot" bids. The roster grows by one after approval. Teams at the roster cap (18M / 6W) cannot use this path.
</success_criteria>

<output>
After completion, create `.planning/quick/10-add-riders-to-roster-if-space-available-/10-SUMMARY.md` documenting what was done and any decisions made.
</output>

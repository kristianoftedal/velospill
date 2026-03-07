---
phase: 22-ir-return-flow
verified: 2026-03-07T12:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Navigate to a league page as a player whose team has a return_eligible IR rider — verify the red banner appears"
    expected: "Red card with 'Action required: IR return pending' text and 'Go to IR page' button visible, no dismiss option"
    why_human: "Banner is conditionally rendered server-side; cannot simulate session + DB state programmatically"
  - test: "On the IR page, click 'Return to Roster' for a return_eligible rider when roster has space"
    expected: "Rider is immediately returned, toast shows success, button disappears, slot updates to 'Returned' badge"
    why_human: "Requires active session, DB row in return_eligible state, and real network call"
  - test: "On the IR page, click 'Return to Roster' when the roster gender slot is full"
    expected: "Drop dialog opens with a dropdown listing active (non-IR) riders; selecting one and clicking 'Drop and Return' completes both operations"
    why_human: "Requires roster-full state and real server action response containing 'full'"
  - test: "On the transfers page, verify the blocking card appears when return_eligible riders exist and the form is still rendered below it"
    expected: "Red 'Transfers blocked' card above the TransferForm; submitting a bid is rejected with an error"
    why_human: "Requires IR return_eligible state active for the session user's team"
  - test: "Admin IR page — verify the 'Approved Riders (on IR)' section appears with a 'Mark Eligible to Return' button"
    expected: "Second Card visible below Pending Requests; clicking the button transitions the rider to return_eligible and toasts success"
    why_human: "Requires admin session and approved IR rows in the database"
---

# Phase 22: IR Return Flow Verification Report

**Phase Goal:** When an admin marks an IR rider as eligible to return, the player is notified via an in-app banner, blocked from any transfers until they act, and can return the rider to their active roster (dropping someone first if the roster is full).
**Verified:** 2026-03-07T12:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | irStatusEnum accepts 'return_eligible' and 'returned' as valid values in the database | VERIFIED | `src/db/schema/ir.ts` line 7: 5-value pgEnum; `0005_add_ir_return_statuses.sql` applies ALTER TYPE |
| 2 | getActiveRosterCount treats both 'approved' and 'return_eligible' riders as freeing a slot | VERIFIED | `src/lib/ir-queries.ts` lines 49: `inArray(irRequests.status, ["approved", "return_eligible"])` |
| 3 | getTeamIrSlots returns new status values without TypeScript errors | VERIFIED | `tsc --noEmit` produced zero errors; IrSlot type includes all 5 statuses |
| 4 | A query can retrieve all return_eligible IR requests for a team | VERIFIED | `getEligibleToReturnCount` exported from `ir-queries.ts` (lines 63–75) |
| 5 | Admin can call markEligibleToReturn(requestId) and transition approved → return_eligible | VERIFIED | `src/app/admin/ir/actions.ts` lines 136–170; validates status="approved", updates to "return_eligible" |
| 6 | Player can call returnRider(requestId, leagueId) to transition return_eligible → returned | VERIFIED | `src/app/(main)/leagues/[leagueId]/ir/actions.ts` lines 112–203; gender-specific active count check |
| 7 | Player can call dropAndReturnRider({requestId, dropRiderId, leagueId}) atomically | VERIFIED | Lines 210–301: deletes draftPicks row then sets status="returned"; guards against dropping IR riders |
| 8 | submitTransferBid rejects if any return_eligible IR riders exist for the team | VERIFIED | `transfers/actions.ts` lines 171–187: labelled IR-09 guard before window check |
| 9 | Admin IR page shows second 'Approved Riders (on IR)' section with Mark Eligible button | VERIFIED | `admin/ir/page.tsx` lines 95–150; fetches approvedRequests in parallel, renders MarkEligibleActions per row |
| 10 | League page shows red banner when eligibleToReturnCount > 0 (active league, user has team) | VERIFIED | `leagues/[leagueId]/page.tsx` lines 127–130 fetch; lines 219–235 render red Card with link to IR page |
| 11 | Banner links to /leagues/[leagueId]/ir and is non-dismissible | VERIFIED | `<Link href={\`/leagues/${leagueId}/ir\`}>` in banner; no dismiss/close mechanism present |
| 12 | IR page shows Return to Roster button on return_eligible slots; roster-full opens drop dialog | VERIFIED | `ir/page.tsx` lines 188–203; `IrReturnActions` tries returnRider first, opens dialog on 'full' error |
| 13 | Transfers page shows blocking card when eligible-to-return riders exist | VERIFIED | `transfers/page.tsx` lines 157–169: fetches eligibleCount in parallel, renders red Card above TransferForm |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/migrations/0005_add_ir_return_statuses.sql` | ALTER TYPE adding return_eligible and returned | VERIFIED | 3-line SQL, both ALTER TYPE statements present |
| `src/db/schema/ir.ts` | Updated irStatusEnum with 5 values | VERIFIED | `["pending", "approved", "rejected", "return_eligible", "returned"]` |
| `src/lib/ir-queries.ts` | getActiveRosterCount + getEligibleToReturnCount + getApprovedIrRequests | VERIFIED | All three exported; IrSlot type includes all 5 statuses; ApprovedIrRequest type exported |
| `src/app/admin/ir/actions.ts` | markEligibleToReturn + getApprovedIrRequestsAction | VERIFIED | Both exported; ApprovedIrRequest type re-exported |
| `src/app/(main)/leagues/[leagueId]/ir/actions.ts` | returnRider + dropAndReturnRider | VERIFIED | Both exported with full auth, membership, and roster validation |
| `src/app/(main)/leagues/[leagueId]/transfers/actions.ts` | IR-09 transfer block guard | VERIFIED | Guard inserted before transfer window check at lines 171–187 |
| `src/app/admin/ir/page.tsx` | Two-section admin page | VERIFIED | Fetches both pending and approved in parallel; two Cards rendered |
| `src/app/admin/ir/ir-actions.tsx` | MarkEligibleActions component | VERIFIED | Exported at lines 140–181; calls markEligibleToReturn with toast feedback |
| `src/app/(main)/leagues/[leagueId]/ir/ir-return-actions.tsx` | IrReturnActions client component | VERIFIED | Created; try-then-dialog pattern; calls returnRider and dropAndReturnRider |
| `src/app/(main)/leagues/[leagueId]/ir/page.tsx` | return_eligible status color + IrReturnActions wired | VERIFIED | statusColors includes return_eligible; IrReturnActions rendered per eligible slot |
| `src/app/(main)/leagues/[leagueId]/page.tsx` | IR return banner | VERIFIED | getEligibleToReturnCount called; banner Card with destructive link |
| `src/app/(main)/leagues/[leagueId]/transfers/page.tsx` | Blocking card above TransferForm | VERIFIED | eligibleCount fetched in parallel; red Card rendered conditionally at lines 157–169 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/schema/ir.ts` | `src/lib/ir-queries.ts` | IrSlot type includes return_eligible/returned | WIRED | Line 12: status union includes all 5 values |
| `src/lib/ir-queries.ts` | `getActiveRosterCount` | inArray(['approved', 'return_eligible']) | WIRED | Line 49 confirmed |
| `src/app/admin/ir/actions.ts` | `src/db/schema/ir.ts` | markEligibleToReturn sets status to 'return_eligible' | WIRED | Line 159: `status: "return_eligible"` |
| `src/app/(main)/leagues/[leagueId]/ir/actions.ts` | `src/db/schema/draft.ts` | dropAndReturnRider deletes draftPicks row | WIRED | Line 282: `db.delete(draftPicks)` with teamId/leagueId/riderId where clause |
| `src/app/(main)/leagues/[leagueId]/transfers/actions.ts` | `src/db/schema/ir.ts` | Transfer block guard checks return_eligible status | WIRED | Lines 171–187; queries irRequests with status="return_eligible" |
| `leagues/[leagueId]/page.tsx` | `src/lib/ir-queries.ts` | getEligibleToReturnCount called, drives banner render | WIRED | Import line 24; call at line 129; banner conditional at line 219 |
| `ir/ir-return-actions.tsx` | `leagues/[leagueId]/ir/actions.ts` | returnRider and dropAndReturnRider called on button click | WIRED | Import line 14: `import { returnRider, dropAndReturnRider } from "./actions"` |
| `admin/ir/page.tsx` | `admin/ir/actions.ts` | getApprovedIrRequestsAction and markEligibleToReturn passed to components | WIRED | Import line 12–17; markEligibleToReturn passed as prop to MarkEligibleActions at line 141 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IR-06 | 22-01, 22-03 | Player can use the freed slot to submit a waiver wire pickup request | SATISFIED | getActiveRosterCount now counts return_eligible as freeing a slot; slot is available for new IR or transfer pickup |
| IR-07 | 22-01, 22-02, 22-03 | Admin can mark an IR rider as eligible to return | SATISFIED | markEligibleToReturn server action + admin page second section with Mark Eligible button |
| IR-08 | 22-03 | Player sees an in-app banner when one of their IR riders is marked eligible to return | SATISFIED | League page fetches getEligibleToReturnCount and renders non-dismissible red banner |
| IR-09 | 22-02, 22-03 | Player is blocked from making transfers while they have a rider eligible to return | SATISFIED | Transfer block guard in submitTransferBid server action; transfers page UI blocking card |
| IR-10 | 22-02, 22-03 | Player can return an eligible rider from IR to their active roster | SATISFIED | returnRider server action + IrReturnActions component with Return to Roster button |
| IR-11 | 22-02, 22-03 | If the active roster is full when returning, player must drop a rider to make room first | SATISFIED | dropAndReturnRider server action; IrReturnActions opens drop dialog when returnRider returns 'full' error |

All 6 requirement IDs from plans are covered. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ir/ir-form.tsx` | 85 | `placeholder="Brief description..."` | Info | HTML input placeholder — correct usage, not a stub |
| `admin/ir/ir-actions.tsx` | 111 | `placeholder="e.g. Rider is still..."` | Info | Textarea placeholder — correct usage, not a stub |

No blockers or warnings. The two placeholder strings are legitimate HTML attribute values in form inputs.

---

### Commit Verification

All 6 commits claimed in SUMMARY files verified to exist in git log:

| Commit | Plan | Description |
|--------|------|-------------|
| `71d7d07` | 22-01 Task 1 | feat: add return_eligible and returned to ir_status enum |
| `fd62a38` | 22-01 Task 2 | feat: update schema and query layer for IR return statuses |
| `6d12170` | 22-02 Task 1 | feat: admin actions — getApprovedIrRequests + markEligibleToReturn |
| `0a890f7` | 22-02 Task 2 | feat: player return actions + transfer block guard |
| `5af7de5` | 22-03 Task 1 | feat: admin IR page second section + MarkEligibleActions |
| `4cdf55a` | 22-03 Task 2 | feat: league banner, IR return buttons, drop-dialog, transfer block |

---

### Human Verification Required

The following items require a live browser session to verify:

#### 1. IR Return Banner on League Page

**Test:** As a player whose team has a rider in `return_eligible` status, navigate to the league overview page.
**Expected:** Red card appears after the Actions button row with title "Action required: IR return pending", explanatory text, and a "Go to IR page" button. No dismiss button present.
**Why human:** Conditional on session identity, team membership, and a live DB row with status=return_eligible.

#### 2. Direct Return (Roster Has Space)

**Test:** On the IR page with a return_eligible slot showing, click "Return to Roster".
**Expected:** Spinner shows briefly, then success toast fires: "[Rider name] returned to active roster". The slot card updates to show "Returned" badge.
**Why human:** Requires auth session + DB state + real Next.js server action round-trip.

#### 3. Drop and Return Dialog (Roster Full)

**Test:** On the IR page when the gender slot is at its limit (18 men or 6 women active), click "Return to Roster".
**Expected:** The dialog "Roster Full — Drop a Rider First" opens automatically. A native `<select>` dropdown lists active (non-IR) riders. Selecting one and clicking "Drop & Return" completes both operations atomically.
**Why human:** Requires a full roster state and the server action returning an error containing "full" to trigger the dialog.

#### 4. Transfer Blocking Card

**Test:** Navigate to /leagues/[id]/transfers as a player with a return_eligible IR rider.
**Expected:** Red "Transfers blocked" card appears above the TransferForm with a link to the IR page. Attempting to submit a bid via the form is rejected server-side with the IR return error.
**Why human:** Requires active return_eligible IR state for the session user.

#### 5. Admin Mark Eligible Flow

**Test:** Log in as an admin, navigate to /admin/ir, confirm the "Approved Riders (on IR)" section is visible with a "Mark Eligible to Return" button. Click the button.
**Expected:** Success toast "Rider marked eligible to return — player will see banner". Row disappears from the approved section. The player's league page now shows the banner.
**Why human:** Requires admin role, approved IR rows, and cross-session verification (admin action → player sees banner).

---

### Summary

Phase 22 goal is fully achieved. All three plans executed correctly:

- **Plan 01:** Database migration applied cleanly (5-value ir_status enum), Drizzle schema synced, IrSlot type updated, getActiveRosterCount corrected, getEligibleToReturnCount added.
- **Plan 02:** Server action layer complete — admin can mark eligible, player can return directly or with drop, transfer block guard inserted before window check.
- **Plan 03:** UI layer complete — admin second section, non-dismissible league banner, IR page return buttons with try-then-dialog pattern, transfers page blocking card.

All 13 observable truths verified, all 12 artifacts confirmed substantive and wired, all 8 key links traced through the codebase. TypeScript compilation produces zero errors across all modified files. No stub anti-patterns detected. All 6 requirement IDs (IR-06 through IR-11) satisfied.

Five items flagged for human verification — these are live-session behaviors that cannot be asserted from grep/file inspection alone.

---

_Verified: 2026-03-07T12:00:00Z_
_Verifier: Claude (gsd-verifier)_

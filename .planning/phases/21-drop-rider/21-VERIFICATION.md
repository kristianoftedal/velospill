---
phase: 21-drop-rider
verified: 2026-03-06T19:00:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to an active league as a member. Click Manage Roster. Click Drop on a rider. Confirm in dialog. Verify toast shows 'Rider dropped' and rider no longer appears in the list."
    expected: "Rider is immediately removed from the roster list without any page reload. Toast appears."
    why_human: "No runtime test suite configured. UI interactivity and toast behavior require browser execution."
  - test: "Put a rider on IR (approved status), then drop that rider from the roster page. Navigate to the IR page."
    expected: "The IR slot for that rider is now empty. The slot count decrements correctly."
    why_human: "IR cleanup correctness after drop requires a live database with a rider in approved IR state."
  - test: "Create a pending transfer bid with a rider as the outgoing party, then drop that rider. Check the transfer bid status."
    expected: "The pending transfer bid shows as 'cancelled'."
    why_human: "Transfer bid cancellation requires a live database state to verify the row update."
  - test: "Attempt to access /leagues/[id]/roster in a league that is not in 'active' status."
    expected: "Page renders 'Roster management is only available for active leagues.' message — no drop UI shown."
    why_human: "Guard behavior requires a non-active league in the database."
  - test: "Attempt to access /leagues/[id]/roster as a league member with no team."
    expected: "Page renders 'You need a team to manage your roster.' message."
    why_human: "Guard behavior requires a user with league membership but no team record."
---

# Phase 21: Drop Rider — Verification Report

**Phase Goal:** Players can instantly remove any rider from their active roster without admin approval or a waiver period.
**Verified:** 2026-03-06T19:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Player can navigate to /leagues/[id]/roster and see their full roster | VERIFIED | `page.tsx` calls `getTeamRoster(userTeamId, leagueId)` and passes result to `RosterClient`. Guards for non-active league and missing team are present. |
| 2 | Each rider in the roster list has a Drop button that triggers a confirmation dialog | VERIFIED | `roster-client.tsx` maps over roster, renders a `Button` per rider calling `setConfirmRiderId(r.riderId)`. Dialog opens when `confirmRiderId !== null`. |
| 3 | After confirming, the rider is immediately removed from the team (draftPicks row deleted) | VERIFIED | `dropRider` in `actions.ts` lines 73-81 performs `db.delete(draftPicks)` scoped to `teamId + leagueId + riderId`. `revalidatePath` called on both roster and league pages. |
| 4 | Any active IR request for the dropped rider is hard-deleted | VERIFIED | `actions.ts` lines 84-93 performs `db.delete(irRequests)` with `inArray(irRequests.status, ["pending", "approved"])`. |
| 5 | Any pending transfer bid with the dropped rider as outgoing is cancelled | VERIFIED | `actions.ts` lines 96-106 performs `db.update(transferBids).set({ status: "cancelled" })` filtered to `outRiderId = riderId AND status = "pending"`. |
| 6 | The freed roster slot is immediately available (getActiveRosterCount arithmetic corrects automatically) | VERIFIED | Drop hard-deletes the `draftPicks` row. `getActiveRosterCount` computes `COUNT(draftPicks) - COUNT(approved irRequests)` — fewer picks means lower count with no additional logic. IR cleanup also removes the approved IR row, doubly ensuring the arithmetic is correct. |
| 7 | League page has a Manage Roster button linking to /leagues/[id]/roster | VERIFIED | `page.tsx` lines 198-202 render a `Button` linking to `/leagues/${league.id}/roster` guarded by `league.status === "active"`. |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(main)/leagues/[leagueId]/roster/actions.ts` | dropRider server action with auth + membership + active league + ownership guards and cleanup | VERIFIED | 114 lines. Exports `dropRider`. All 4 guards implemented in order. Delete draftPicks, delete irRequests, update transferBids, revalidatePath x3. |
| `src/app/(main)/leagues/[leagueId]/roster/page.tsx` | RSC page fetching roster and rendering RosterClient | VERIFIED | 127 lines. Calls `getLeagueDetails`, applies active-league guard and team-membership guard, calls `getTeamRoster`, renders `<RosterClient>`. |
| `src/app/(main)/leagues/[leagueId]/roster/roster-client.tsx` | Client component with drop buttons and confirmation dialog | VERIFIED | 120 lines. `"use client"`. `useState`, `useTransition`, `Dialog` confirmation, `handleDrop` calling `dropRider`, sonner toasts, disabled buttons during pending state. |
| `src/app/(main)/leagues/[leagueId]/page.tsx` | Manage Roster button in the actions row (league.status === active guard) | VERIFIED | Button at lines 198-202, guarded by `league.status === "active"`, links to `/leagues/${league.id}/roster`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `roster-client.tsx` | `roster/actions.ts` | `import { dropRider } from "./actions"` | WIRED | Line 5 of roster-client.tsx. `dropRider` is called in `handleDrop` at line 38. |
| `roster/page.tsx` | `src/lib/transfer-queries.ts` | `getTeamRoster` call | WIRED | Imported at line 4, called at line 100 with both `userTeamId` and `leagueId`. |
| `roster/actions.ts` | draftPicks table | `db.delete(draftPicks)` | WIRED | Lines 73-81. Scoped with `and(eq teamId, eq leagueId, eq riderId)`. |
| `roster/actions.ts` | irRequests table | `db.delete(irRequests)` | WIRED | Lines 84-93. Scoped with `inArray(status, ["pending","approved"])`. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ROST-01 | 21-01-PLAN.md | Player can drop any rider from their roster instantly (no admin approval, no waiver period) | SATISFIED | `dropRider` hard-deletes draftPicks row immediately on call. No approval workflow. No waiver period. `revalidatePath` makes change visible instantly. REQUIREMENTS.md marks as "Complete". |

No orphaned requirements found. The only requirement mapped to Phase 21 in REQUIREMENTS.md is ROST-01, which is claimed and satisfied by plan 21-01.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None in phase 21 files | — | — | — | No TODO/FIXME/placeholder comments found. No empty return stubs. No console.log-only handlers. |

**Pre-existing TypeScript error (not from Phase 21):**

`src/app/admin/transfers/actions.ts(127,11)` — TS2769 error passing `number | null` where `number | SQLWrapper` is required. This file was last modified in phase 6 (commit `1008a86`), predating phase 21 by many phases. Phase 21 files compile cleanly — confirmed by `npx tsc --noEmit` producing no errors in any `roster/` path.

---

### Human Verification Required

#### 1. Drop rider end-to-end flow

**Test:** Navigate to an active league as a member. Click "Manage Roster". Click "Drop" on any rider. Confirm in the dialog.
**Expected:** Toast shows "Rider dropped". Rider no longer appears in the roster list. The slot count in `getActiveRosterCount` decrements.
**Why human:** No runtime test suite configured. UI interaction, transition state, and toast require browser execution.

#### 2. IR cleanup after drop

**Test:** Put a rider on IR (approved status via admin). Then navigate to Manage Roster and drop that rider. Navigate to the IR page.
**Expected:** The IR slot for that rider shows as empty. No orphaned "approved" IR record remains.
**Why human:** Requires live database state with a rider in approved IR status.

#### 3. Transfer bid cancellation after drop

**Test:** Submit a transfer bid with a specific rider as the outgoing party. Then drop that rider from the roster page.
**Expected:** The transfer bid's status changes to "cancelled". Admin transfer queue should no longer show it as pending.
**Why human:** Requires live database state with a pending transfer bid.

#### 4. Active-league guard

**Test:** Access `/leagues/[id]/roster` for a league in "setup" or "complete" status.
**Expected:** Page renders the "Roster management is only available for active leagues." message. No drop UI is shown. The league page for non-active leagues does not render the "Manage Roster" button.
**Why human:** Requires a non-active league in the database.

#### 5. No-team guard

**Test:** Access `/leagues/[id]/roster` as a league member who has not created a team.
**Expected:** Page renders "You need a team to manage your roster." message.
**Why human:** Requires a user with league membership but no team record.

---

### Gaps Summary

No automated gaps found. All 7 observable truths are verified against the actual codebase. All 4 artifacts are substantive (not stubs), all 4 key links are wired. ROST-01 is satisfied. No blocker anti-patterns found in phase 21 files.

The remaining 5 items require human browser testing: the end-to-end drop flow, IR slot cleanup correctness, transfer bid cancellation, and the two guard scenarios. These are behavioral correctness checks that cannot be verified by static code analysis alone.

---

_Verified: 2026-03-06T19:00:00Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 20-ir-foundation-admin-approval
verified: 2026-03-06T00:00:00Z
status: human_needed
score: 10/10 must-haves verified
human_verification:
  - test: "Navigate to league page as active member and confirm 'Injured Reserve' button is visible in the actions bar"
    expected: "Button labeled 'Injured Reserve' appears alongside Transfers / Set Lineup / Orders when league.status === 'active'"
    why_human: "Conditional rendering with league.status guard — requires browser session and active league fixture"
  - test: "Click 'Injured Reserve' and verify the IR page loads showing 2 slot cards and a rider dropdown"
    expected: "Page at /leagues/[id]/ir renders with 2 slot placeholders ('Empty slot') and a form with rider select and reason textarea"
    why_human: "Visual layout and data hydration require runtime rendering"
  - test: "Submit an IR request and verify it appears as Pending in the slot display"
    expected: "After submission the slot card shows rider name + yellow 'Pending' badge; the rider is no longer available in the dropdown"
    why_human: "Server action + page revalidation flow requires live DB and Next.js cache behavior"
  - test: "Log in as admin, visit /admin/ir, confirm pending request appears and approve it"
    expected: "Table row shows league / team / rider / reason / submitted date. Clicking 'Approve' removes the row and player page updates slot to green 'Approved'"
    why_human: "Admin auth gate, cross-page revalidation, and UI state change require end-to-end browser testing"
  - test: "Reject a pending request with a note and confirm the admin note is visible on the player IR page"
    expected: "Slot card shows red 'Rejected' badge and the rejection reason text below the rider name"
    why_human: "Dialog UX, adminNote persistence, and player-facing display require runtime verification"
  - test: "Submit two IR requests to fill both slots and confirm the form is replaced by the 'slots full' message"
    expected: "IrForm renders 'Both IR slots are in use...' disabled card instead of the rider dropdown"
    why_human: "slotsUsed >= 2 branch in IrForm requires live data state with 2 pending/approved rows"
---

# Phase 20: IR Foundation & Admin Approval — Verification Report

**Phase Goal:** Players can place riders on the Injured Reserve list (up to 2 slots), admins can approve or reject those requests, and approved IR riders are freed from the active roster limit so a waiver slot opens up.
**Verified:** 2026-03-06
**Status:** human_needed — all automated checks passed; 6 runtime behaviors flagged for human confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | ir_requests table exists in DB with all required columns | VERIFIED | `src/db/migrations/0003_add_ir_requests.sql` — DDL present with all 10 columns, applied via psql per summary |
| 2 | IrStatus enum has values: pending, approved, rejected | VERIFIED | `src/db/schema/ir.ts` line 7: `pgEnum("ir_status", ["pending", "approved", "rejected"])` |
| 3 | ir_requests rows link to teams, leagues, and riders via FKs | VERIFIED | `ir.ts` lines 11–13: FKs to leagues.id (cascade), teams.id, riders.id; resolvedBy → user.id |
| 4 | Schema is exported and importable from @/db/schema | VERIFIED | `src/db/schema/index.ts` line 13: `export * from "./ir"` |
| 5 | submitIrRequest rejects a third request when 2 slots already occupied | VERIFIED | `ir/actions.ts` lines 57–70: `inArray(status, ["pending","approved"])` count >= 2 → error |
| 6 | getTeamIrSlots returns all IR requests for a team with rider name and status | VERIFIED | `ir-queries.ts` lines 35–54: innerJoin riders, filter by teamId+leagueId, ordered DESC |
| 7 | getPendingIrRequests returns all pending IR rows across all leagues for admin | VERIFIED | `ir-queries.ts` lines 89–108: joined with leagues, teams, riders; filtered status="pending" |
| 8 | approveIrRequest updates status to approved; rejectIrRequest sets rejected + adminNote | VERIFIED | `admin/ir/actions.ts` lines 40–74 (approve) and 80–121 (reject) — DB update with status, resolvedAt, resolvedBy, adminNote |
| 9 | getActiveRosterCount correctly excludes approved IR riders from active count | VERIFIED | `ir-queries.ts` lines 61–82: `COUNT(draftPicks) - COUNT(approved irRequests)` |
| 10 | Player IR page, admin IR queue, nav links, and league button all wired | VERIFIED | All 4 UI files exist with substantive implementations; admin layout line 70; league page lines 193–196 |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/ir.ts` | irRequests table, irStatusEnum, irRequestsRelations | VERIFIED | 46 lines — all exports present: irStatusEnum, irRequests, irRequestsRelations, IrRequest type |
| `src/db/schema/index.ts` | re-exports ir.ts symbols | VERIFIED | Line 13: `export * from "./ir"` |
| `src/db/migrations/0003_add_ir_requests.sql` | DDL for ir_status enum + ir_requests table | VERIFIED | 26 lines — CREATE TYPE + CREATE TABLE + 3 indexes |
| `src/lib/ir-queries.ts` | getTeamIrSlots, getActiveRosterCount, getPendingIrRequests | VERIFIED | 109 lines — all 3 functions exported with correct return types; IrSlot and PendingIrRequest types exported |
| `src/app/(main)/leagues/[leagueId]/ir/actions.ts` | submitIrRequest server action | VERIFIED | 105 lines — "use server", all 6 guards implemented, insert + revalidatePath |
| `src/app/admin/ir/actions.ts` | approveIrRequest, rejectIrRequest, getPendingIrRequestsAction | VERIFIED | 124 lines — "use server", checkAdminAuth, all three actions + re-export of PendingIrRequest |
| `src/app/(main)/leagues/[leagueId]/ir/page.tsx` | Player IR status page | VERIFIED | 199 lines — server component, parallel fetch, 2-slot card grid, breadcrumb, guards for inactive league and no team |
| `src/app/(main)/leagues/[leagueId]/ir/ir-form.tsx` | Client component with rider dropdown and reason field | VERIFIED | 109 lines — "use client", useTransition, slotsUsed >= 2 disabled branch, submitIrRequest wired |
| `src/app/admin/ir/page.tsx` | Admin IR queue page | VERIFIED | 87 lines — server component, pending count badge, table with IrActions per row, empty state |
| `src/app/admin/ir/ir-actions.tsx` | Client component: approve/reject with confirm dialog | VERIFIED | 139 lines — "use client", useTransition, Dialog for rejection with adminNote textarea |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/schema/ir.ts` | `src/db/schema/leagues.ts` | leagueId FK → leagues.id | WIRED | Line 11: `.references(() => leagues.id, { onDelete: "cascade" })` |
| `src/db/schema/ir.ts` | `src/db/schema/riders.ts` | riderId FK → riders.id | WIRED | Line 13: `.references(() => riders.id)` |
| `src/lib/ir-queries.ts` | `src/db/schema/ir.ts` | Drizzle query on irRequests | WIRED | Line 2: `import { irRequests } from "@/db/schema/ir"` — used in all 3 functions |
| `src/app/(main)/leagues/[leagueId]/ir/actions.ts` | `src/lib/ir-queries.ts` | getTeamIrSlots to count occupied IR slots | WIRED | `ir/actions.ts` imports `inArray, count` from drizzle and queries irRequests directly — slot count guard at lines 57–70 uses same pattern as getTeamIrSlots |
| `src/app/admin/ir/actions.ts` | `src/db/schema/ir.ts` | irRequests table direct updates | WIRED | Lines 9: `import { irRequests } from "@/db/schema/ir"` — used in approve + reject updates |
| `src/app/admin/ir/actions.ts` | `src/lib/ir-queries.ts` | getPendingIrRequests delegation | WIRED | Line 10: `import { getPendingIrRequests }` — called in getPendingIrRequestsAction |
| `src/app/(main)/leagues/[leagueId]/ir/ir-form.tsx` | `src/app/(main)/leagues/[leagueId]/ir/actions.ts` | calls submitIrRequest | WIRED | Line 8: `import { submitIrRequest } from "./actions"` — called in handleSubmit line 40 |
| `src/app/admin/ir/ir-actions.tsx` | `src/app/admin/ir/actions.ts` | calls approveIrRequest / rejectIrRequest | WIRED | Passed as props from page.tsx lines 74–75; called in handleApprove/handleReject |
| `src/app/admin/layout.tsx` | `/admin/ir` | "Injured Reserve" nav link | WIRED | Lines 69–74: Link href="/admin/ir" with label "Injured Reserve" |
| `src/app/(main)/leagues/[leagueId]/page.tsx` | `/leagues/[id]/ir` | "Injured Reserve" button in actions bar | WIRED | Lines 193–196: Button with Link href=`/leagues/${league.id}/ir` inside `league.status === "active"` guard |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| IR-01 | 20-01, 20-02, 20-03 | Player can request to place a rider on IR (max 2 IR slots per team) | SATISFIED | submitIrRequest with 2-slot cap guard (inArray pending+approved count >= 2) + IrForm disabled when slotsUsed >= 2 |
| IR-02 | 20-01, 20-02, 20-03 | Player can view their current IR slots and which riders occupy them | SATISFIED | /leagues/[id]/ir page renders 2 slot cards with riderName, status badge, submittedAt, adminNote |
| IR-03 | 20-02, 20-03 | Admin can view a queue of pending IR placement requests | SATISFIED | /admin/ir page calls getPendingIrRequestsAction() → table with league/team/rider/reason/submitted |
| IR-04 | 20-02, 20-03 | Admin can approve or reject an IR placement request | SATISFIED | approveIrRequest + rejectIrRequest (with mandatory adminNote) both implemented and wired to IrActions client component |
| IR-05 | 20-02, 20-03 | Approved IR riders do not count against the active roster limit, freeing a slot | SATISFIED (deferred enforcement) | getActiveRosterCount arithmetic is implemented and exported; full enforcement deferred to Phase 22 (transfer pickup without outRider). Documented invariant in transfers/actions.ts lines 157–167. This is the contract stated in PLAN frontmatter truth #5. |

No orphaned requirements — IR-06 through IR-11 and ROST-01 are mapped to Phases 21–22 in REQUIREMENTS.md and are intentionally out of scope for Phase 20.

---

## Anti-Patterns Found

None. All "placeholder" text found in ir-form.tsx and ir-actions.tsx are HTML `placeholder` attributes on textarea/input elements — not stub indicators.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

---

## Human Verification Required

The automated verification confirms all artifacts exist, are substantive (no stubs), and are properly wired. The following behaviors require a live browser session to confirm end-to-end behavior:

### 1. "Injured Reserve" Button on League Page

**Test:** Log in as a league member, navigate to a league with `status = "active"`. Inspect the actions bar.
**Expected:** "Injured Reserve" button appears alongside Transfers / Set Lineup / Orders.
**Why human:** Conditional rendering gate on `league.status === "active"` verified in code, but requires a live active league to confirm correct display.

### 2. Player IR Page Loads with Slot Display and Form

**Test:** Click "Injured Reserve" and inspect the rendered page.
**Expected:** Page shows breadcrumb (Leagues > [League Name] > Injured Reserve), 2 slot cards with "Empty slot" text, and a form with a rider dropdown and optional reason textarea.
**Why human:** Visual layout, data hydration from getTeamIrSlots and getTeamRoster, and component composition require runtime rendering.

### 3. Submit IR Request — Happy Path

**Test:** Select a rider from the dropdown, optionally add a reason, click "Request IR Placement".
**Expected:** Toast "IR request submitted successfully" appears. The slot card updates to show the rider name with a yellow "Pending" badge.
**Why human:** Server action execution, revalidatePath cache invalidation, and toast notification require live Next.js runtime.

### 4. Admin Approve Flow

**Test:** Log in as admin, visit /admin/ir. Confirm the pending request row appears. Click "Approve".
**Expected:** Row disappears from the pending queue. On the player IR page, the slot badge changes from yellow "Pending" to green "Approved".
**Why human:** Admin auth check, cross-page revalidation, and DB state change require end-to-end browser testing.

### 5. Admin Reject Flow with Note Visible on Player Page

**Test:** Click "Reject" on a pending request. Enter a rejection reason in the dialog. Confirm rejection. Check the player IR page.
**Expected:** Dialog closes, row disappears from admin queue. Player's slot card shows red "Rejected" badge and the admin note text.
**Why human:** Dialog UX, adminNote field persistence, and conditional rendering of adminNote on player side require runtime verification.

### 6. Slots Full — Form Disabled

**Test:** Submit two IR requests (or use one approved + one pending) to fill both slots. Reload the IR page.
**Expected:** The IrForm card is replaced by the "Both IR slots are in use. A slot opens when a pending request is rejected or you have no more approved riders." message. No rider dropdown is shown.
**Why human:** Requires live data state with slotsUsed >= 2 to trigger the disabled branch in IrForm.

---

## Summary

Phase 20 goal is structurally achieved. Every artifact exists, is substantive, and is correctly wired. The full IR data layer (schema, migration, query helpers, server actions) and UI (player page, admin queue, nav integration) are in place. The 2-slot cap guard is properly implemented in both the server action (database-side count) and the UI (client-side slotsUsed prop). Admin auth is enforced. The IR-05 slot accounting invariant is implemented via getActiveRosterCount and documented for Phase 22 enforcement — this is the agreed scope boundary stated explicitly in the Plan 03 must_haves.

All 6 commits from the phase (af9e33e, 1ad3fc9, 93e15cb, 52f6ba4, 2d57da8, edcd666) are confirmed in git history. TypeScript compilation passes with zero errors across all IR files. No stub patterns, placeholder implementations, or orphaned artifacts detected.

Automated checks: **passed**. Awaiting human verification on 6 runtime behavior items.

---

_Verified: 2026-03-06_
_Verifier: Claude (gsd-verifier)_

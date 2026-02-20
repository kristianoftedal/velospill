---
phase: 03-league-management
plan: 02
subsystem: ui
tags: [next.js, react-hook-form, zod, server-actions, shadcn, date-fns, drizzle]

dependency_graph:
  requires:
    - phase: 03-01
      provides: leagues-table, teams-table, invite-code-generator, league-membership-check
  provides:
    - league-creation-form
    - join-via-invite-flow
    - createLeague-server-action
    - validateInvite-server-action
    - joinLeague-server-action
  affects:
    - 03-03-league-detail-page

tech_stack:
  added: []
  patterns:
    - Server components validate invite before rendering client form
    - Client components use react-hook-form + zodResolver for form management
    - Server actions return typed discriminated union (success/failure) for client handling
    - Re-validation of invite on joinLeague (never trust client state)
    - DB-level unique constraints as safety net for race conditions

key_files:
  created:
    - src/app/(main)/leagues/new/actions.ts
    - src/app/(main)/leagues/new/page.tsx
    - src/app/(main)/leagues/join/[inviteCode]/actions.ts
    - src/app/(main)/leagues/join/[inviteCode]/page.tsx
    - src/app/(main)/leagues/join/[inviteCode]/join-form.tsx
  modified: []

key-decisions:
  - "JoinForm extracted to join-form.tsx for clean 'use client' separation from server page component"
  - "joinLeague re-validates invite server-side to prevent stale client state attacks"
  - "validateInvite joins user table for owner name in a single query rather than separate lookup"
  - "Zod v4 does not support invalid_type_error option on z.number() - removed it"

patterns-established:
  - "Server page validates preconditions, passes data to client form component as props"
  - "Server actions return { success: true, ... } | { success: false, error: {...} } discriminated union"

metrics:
  duration: "3min"
  completed: "2026-02-13T07:35:35Z"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 3 Plan 2: League Creation & Join Flow Summary

**React-hook-form league creation page at /leagues/new with invite link display, and server-validated join page at /leagues/join/[inviteCode] with team name entry, covering LEAGUE-01 through LEAGUE-05.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-13T07:33:25Z
- **Completed:** 2026-02-13T07:35:35Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments

- createLeague server action generates nanoid invite codes, inserts league with JSONB config (seasonYear, draftDate, teamMin, teamMax), returns invite code for immediate sharing
- validateInvite server action checks expiration, status, team capacity in a single joined query with owner name
- joinLeague server action re-validates invite, checks membership and name uniqueness, relies on DB-level unique indexes as race condition safety net
- /leagues/new: client form (react-hook-form + Zod) with league name, season year, draft date; success state shows invite link with Copy button
- /leagues/join/[inviteCode]: server component validates invite, shows league stats (teams joined / max / spots left), renders JoinForm client component; invalid invites show clear error reasons

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server actions for league creation and joining** - `786b8f3` (feat)
2. **Task 2: Build league creation form and join-via-invite pages** - `80476c5` (feat)

**Plan metadata:** (final docs commit)

## Files Created/Modified

- `src/app/(main)/leagues/new/actions.ts` - createLeague server action with Zod validation, nanoid invite code, JSONB config insert
- `src/app/(main)/leagues/new/page.tsx` - Client form with react-hook-form, success state showing invite link + copy button
- `src/app/(main)/leagues/join/[inviteCode]/actions.ts` - validateInvite (expiry/status/capacity checks) and joinLeague (membership + name uniqueness + DB safety net)
- `src/app/(main)/leagues/join/[inviteCode]/page.tsx` - Server component: validates invite, renders league stats + JoinForm
- `src/app/(main)/leagues/join/[inviteCode]/join-form.tsx` - Client form component: team name input, loading state, error display, redirect on success

## Decisions Made

1. **JoinForm in separate file:** Needed `"use client"` isolation from the server page component - created `join-form.tsx` as a deviation from the original plan file list.

2. **Re-validation on joinLeague:** The action re-calls invite validation logic server-side rather than trusting client-passed state, preventing stale invite codes from being used.

3. **Single query for validateInvite:** Used a LEFT JOIN to the user table to fetch owner name in one query instead of a separate lookup.

4. **Zod v4 API fix:** Removed `invalid_type_error` from `z.number()` call - this option doesn't exist in Zod v4 (auto-fixed during Task 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unsupported Zod v4 option `invalid_type_error` from z.number()**
- **Found during:** Task 2 (TypeScript check after writing pages)
- **Issue:** `z.number({ invalid_type_error: "..." })` fails in Zod v4 - option doesn't exist in the type signature
- **Fix:** Removed the options object from `z.number()`
- **Files modified:** `src/app/(main)/leagues/new/page.tsx`
- **Verification:** `npx tsc --noEmit` passed, `npm run build` succeeded
- **Committed in:** `80476c5` (Task 2 commit)

**2. [Rule 3 - Blocking] Added join-form.tsx (extra file not in original plan list)**
- **Found during:** Task 2 (page implementation)
- **Issue:** `"use client"` and `async` server component cannot coexist in one file - the plan anticipated this and explicitly noted adding the file
- **Fix:** Created `join-form.tsx` as a client component, imported into the server page
- **Files modified:** Added `src/app/(main)/leagues/join/[inviteCode]/join-form.tsx`
- **Verification:** Build passes, clean separation of client/server boundaries
- **Committed in:** `80476c5` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes essential for correctness. Plan itself anticipated the join-form.tsx addition. No scope creep.

## Issues Encountered

None beyond the Zod v4 API difference noted above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- League creation and join flows are complete (LEAGUE-01 through LEAGUE-05)
- /leagues/[leagueId] detail page route exists but shows placeholder - ready for Plan 03 to build the league detail view
- Teams table has data after a user joins, ready for draft/scoring features in future phases

## Self-Check: PASSED

- FOUND: src/app/(main)/leagues/new/actions.ts
- FOUND: src/app/(main)/leagues/new/page.tsx
- FOUND: src/app/(main)/leagues/join/[inviteCode]/actions.ts
- FOUND: src/app/(main)/leagues/join/[inviteCode]/page.tsx
- FOUND: src/app/(main)/leagues/join/[inviteCode]/join-form.tsx
- TypeScript: PASS (npx tsc --noEmit)
- Build: PASS (npm run build - all routes rendered)
- Commits: 786b8f3 (Task 1), 80476c5 (Task 2)

---
*Phase: 03-league-management*
*Completed: 2026-02-13*

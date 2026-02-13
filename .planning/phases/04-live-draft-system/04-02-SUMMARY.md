---
phase: 04-live-draft-system
plan: 02
subsystem: server-actions, api-routes
tags: [drizzle, postgresql, pusher, qstash, snake-draft, server-actions]

# Dependency graph
requires:
  - phase: 04-01
    provides: draft schema (draftSessions, draftPicks), Pusher server singleton, snake order utility

provides:
  - startDraft and makePick server actions for complete draft lifecycle management
  - Auto-pick QStash callback route with signature verification and idempotency
  - Shared draft query helpers (getAvailableRiders, getDraftState, getBestAvailableRider, computeNextDraftState)

affects:
  - 04-03 (draft lobby UI — consumes startDraft/makePick actions and Pusher events)
  - 04-04 (live pick UI — consumes same events and actions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server actions return { success, error } pattern consistent with existing league actions
    - Pusher triggers always OUTSIDE db.transaction to avoid partial-state broadcasts
    - QStash auto-pick with 65s delay, idempotency via expectedPickIndex guard
    - computeNextDraftState shared between makePick and auto-pick route to eliminate duplication
    - Women's draft snake order resets independently (pickIndex relative to start of women's draft)

key-files:
  created:
    - src/lib/draft-queries.ts
    - src/app/(main)/leagues/[leagueId]/draft/actions.ts
    - src/app/api/draft/auto-pick/route.ts

key-decisions:
  - "computeNextDraftState extracted to draft-queries.ts to share pick-advancing logic between makePick and auto-pick"
  - "QStash dynamic import inside scheduleAutoPick in route.ts to avoid top-level client instantiation at module load"
  - "npm run build fails due to pre-existing drizzle-kit 0.18.x incompatibility in drizzle.config.ts — same issue as phase 04-01, not introduced by this plan"

# Metrics
duration: ~2min
completed: 2026-02-13
---

# Phase 4 Plan 02: Draft Server Logic Summary

**Complete server-side draft engine: startDraft/makePick server actions, QStash auto-pick callback, and shared draft query helpers implementing the full 18-round men + 6-round women snake draft lifecycle**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-13T09:25:20Z
- **Completed:** 2026-02-13T09:27:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `src/lib/draft-queries.ts`: Four exported helpers — `getAvailableRiders` (available riders with optional search/team/nationality filters), `getDraftState` (session + picks + teams), `getBestAvailableRider` (first alphabetically for auto-pick), `computeNextDraftState` (shared pick-advance logic handling men/women snake order transitions)
- `startDraft` server action: validates owner, league status ('drafting'), and team count (≥2); inserts draft session; schedules QStash auto-pick at pick index 0; triggers Pusher 'draft-started' event with full draft order
- `makePick` server action: validates turn order (currentTeamId match), rider gender, rider availability; inserts pick + advances session in transaction; schedules next QStash auto-pick; triggers 'pick-made' and optionally 'draft-complete' events
- Auto-pick route (`/api/draft/auto-pick`): verifies QStash signature via `verifySignatureAppRouter`; dual idempotency guards (no active draft + pick already made); 5s timing grace period; finds best available rider; advances state same as makePick; triggers Pusher events after transaction

## Task Commits

1. **Task 1: Create draft query helpers and startDraft/makePick server actions** - `987c9ab` (feat)
2. **Task 2: Create auto-pick API route with QStash signature verification** - `34ae2ff` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created

- `src/lib/draft-queries.ts` — Shared draft query helpers: getAvailableRiders, getDraftState, getBestAvailableRider, computeNextDraftState
- `src/app/(main)/leagues/[leagueId]/draft/actions.ts` — startDraft and makePick server actions with full validation chain
- `src/app/api/draft/auto-pick/route.ts` — QStash auto-pick callback with signature verification and idempotency

## Decisions Made

- `computeNextDraftState` extracted to `draft-queries.ts` as a shared pure function so both `makePick` and the auto-pick route use identical state-advance logic — eliminates duplicated transition code
- Dynamic import of `@upstash/qstash` Client inside the route's `scheduleAutoPick` helper to avoid instantiating the client at module load time in the API route
- `npm run build` continues to fail due to the pre-existing `drizzle-kit 0.18.x` incompatibility in `drizzle.config.ts` — this is a known project-wide issue, not introduced by this plan (identical behavior confirmed before and after our changes via `git stash` check)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

The plan's `npm run build` verification criterion has a known pre-existing failure (drizzle-kit type error in drizzle.config.ts, confirmed present on the base commit before this plan). All project-specific files compile cleanly via `npx tsc --noEmit`. This matches the workaround pattern established in 04-01.

## Draft State Machine

```
pending -> [startDraft] -> men (18 rounds per team)
men -> [all men picks done] -> women (6 rounds per team)
women -> [all women picks done] -> complete
```

Each pick: validate -> insert -> advance session -> schedule QStash (65s) -> trigger Pusher

## Next Phase Readiness

- All server-side draft logic complete: start, pick, auto-pick, state transitions
- Pusher events ready for UI consumption: 'draft-started', 'pick-made', 'draft-complete'
- Plan 03 (draft lobby UI) can proceed immediately — consumes startDraft action and Pusher channel

---
*Phase: 04-live-draft-system*
*Completed: 2026-02-13*

## Self-Check: PASSED

- src/lib/draft-queries.ts: FOUND
- src/app/(main)/leagues/[leagueId]/draft/actions.ts: FOUND
- src/app/api/draft/auto-pick/route.ts: FOUND
- Commit 987c9ab: FOUND (feat(04-02): create draft query helpers and startDraft/makePick server actions)
- Commit 34ae2ff: FOUND (feat(04-02): create auto-pick API route with QStash signature verification)

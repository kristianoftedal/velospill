---
phase: 04-live-draft-system
plan: 03
subsystem: ui, real-time
tags: [pusher, react, next.js, shadcn, use-sound, draft, websocket]

# Dependency graph
requires:
  - phase: 04-01
    provides: Pusher client singleton, snake order utility, draft DB schema
  - phase: 04-02
    provides: startDraft/makePick server actions, getDraftState/getAvailableRiders helpers, Pusher events

provides:
  - Complete draft room UI at /leagues/[leagueId]/draft
  - Server-rendered waiting room with Start Draft button for league owner
  - Real-time DraftRoom with Pusher presence channel subscription
  - DraftBoard pick grid (rounds x teams) with snake order highlight
  - RiderPicker with search, team/nationality filters, and pick button
  - DraftTimer counting down from server timerExpiresAt

affects:
  - 04-04 (live pick UI - same page but further features if needed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server component loads initial state, passes to "use client" DraftRoom
    - Pusher presence channel bound in useEffect, unsubscribed on unmount
    - React.memo on DraftCell to avoid re-rendering all 240 cells per pick
    - useSound hook for audio notification on your-turn event
    - Client-side filtering in RiderPicker via useMemo for instant response
    - DraftTimer polls setInterval(500ms) against server timerExpiresAt (not local countdown)
    - draftStatus typed as union excluding "paused" in client state

key-files:
  created:
    - src/app/(main)/leagues/[leagueId]/draft/page.tsx
    - src/app/(main)/leagues/[leagueId]/draft/draft-room.tsx
    - src/app/(main)/leagues/[leagueId]/draft/draft-board.tsx
    - src/app/(main)/leagues/[leagueId]/draft/rider-picker.tsx
    - src/app/(main)/leagues/[leagueId]/draft/timer.tsx
  modified: []

key-decisions:
  - "DraftRoom maps 'paused' status -> 'pending' on load since client UI does not support pause state"
  - "RiderPicker does client-side filtering from passed-in availableRiders array (not server refetch on each keystroke)"
  - "DraftBoard uses buildDraftOrder to derive slot->team mapping, then looks up picks by pickNumber"
  - "Pusher pick-made event carries rider gender so client can remove from correct (men/women) available list"
  - "public/sounds/README.md added as placeholder — user must place MP3 file for audio to work"

# Metrics
duration: ~8min
completed: 2026-02-13
---

# Phase 4 Plan 03: Draft Room UI Summary

**Complete draft room interface with real-time Pusher subscription, snake-order pick grid, rider search/filter, server-authoritative countdown timer, and "your turn" audio+visual notifications**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-13T09:30:06Z
- **Completed:** 2026-02-13T09:38:00Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments

- `page.tsx`: Server component authenticating user, checking league membership, loading draft state and available riders, rendering waiting room (with owner's Start Draft button) or full DraftRoom
- `draft-room.tsx`: Client component subscribing to `presence-draft-{leagueId}` Pusher channel; handles `draft-started`, `pick-made`, `draft-complete` events; manages picks/status/timer/available-riders state; fires `your-turn` visual banner + sound when turn arrives; calls `makePick` server action via `onPick` handler; responsive lg:flex-row layout
- `draft-board.tsx`: Round-by-team grid using `buildDraftOrder` to derive slot positions; current pick highlighted with blue ring; past picks show rider name + team (auto-picks in italics); men/women section divider; horizontal scroll on mobile; `React.memo` on DraftCell for perf
- `rider-picker.tsx`: Search by name (case-insensitive), filter by team and nationality (unique dropdowns); rider list with name, team, nationality, specialty badge, and Pick button; disabled unless `isMyTurn && !isPickPending`; "Waiting for X..." message when not user's turn
- `timer.tsx`: Polls `Math.max(0, (expiresAt - now) / 1000)` every 500ms; urgency modes at ≤10s (red animate-pulse) and ≤5s (red background + larger); shows "Your time" vs "Time remaining" label

## Task Commits

1. **Task 1: Draft page, DraftRoom container, DraftBoard grid** - `4f91bfc` (feat)
2. **Task 2: RiderPicker and DraftTimer components** - `cdae7e2` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created

- `src/app/(main)/leagues/[leagueId]/draft/page.tsx` — Server component: auth, membership check, initial state load, waiting room vs DraftRoom
- `src/app/(main)/leagues/[leagueId]/draft/draft-room.tsx` — Client component: Pusher subscription, real-time state, layout, your-turn notifications
- `src/app/(main)/leagues/[leagueId]/draft/draft-board.tsx` — Round x team pick grid with snake order, highlights, and scrolling
- `src/app/(main)/leagues/[leagueId]/draft/rider-picker.tsx` — Search/filter/pick UI for active drafter
- `src/app/(main)/leagues/[leagueId]/draft/timer.tsx` — Server-authoritative countdown with urgency cues

## Decisions Made

- Mapped `"paused"` draft status to `"pending"` in client state — the draft room UI has no pause state, treating it as pre-start avoids a TS union error and maintains correctness
- RiderPicker filters client-side from the `availableRiders` prop — instant response without server round-trips; available riders are updated on each Pusher `pick-made` event
- DraftBoard derived slot positions from `buildDraftOrder` rather than re-implementing snake logic — consistent with server-side order
- `Pusher pick-made` payload already carries the pick's `gender` field, so client removes the rider from the correct available list without additional lookups
- `public/sounds/README.md` added as placeholder — `use-sound` is wired up but audio requires the user to place `/public/sounds/your-turn.mp3` manually (Claude cannot create binary audio files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DraftRoom draftStatus type excluded "paused"**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `initialSession.status` includes `"paused"` from DB enum, but client state only supports `"pending" | "men" | "women" | "complete"` since there's no UI for the paused state
- **Fix:** Mapped `"paused"` -> `"pending"` when initialising `draftStatus` state with explicit union type annotation
- **Files modified:** `draft-room.tsx`
- **Commit:** 4f91bfc (included in Task 1 commit)

---

The plan's `npm run build` verification criterion has the same pre-existing failure (drizzle-kit 0.18.x type error in drizzle.config.ts). All project-specific files compile cleanly via `npx tsc --noEmit`. Consistent with 04-01 and 04-02 workaround.

## Draft Room Feature Summary

```
/leagues/[leagueId]/draft
  ├── Waiting room (no session or pending)
  │   ├── Teams joined list
  │   └── Start Draft button (owner only)
  └── DraftRoom (session active)
      ├── Header: status label + current drafter + timer
      ├── DraftBoard: scrollable round x team grid
      │   ├── Men's rounds (1-18) with blue row labels
      │   ├── Women's section divider
      │   └── Women's rounds (1-6) with purple row labels
      └── RiderPicker: search + filter + pick
          ├── Search input (name)
          ├── Team filter dropdown
          ├── Nationality filter dropdown
          └── Rider list with specialty badges + Pick buttons
```

Pusher events: `draft-started` → set state; `pick-made` → append pick, remove rider, update turn; `draft-complete` → clear timer.

---
*Phase: 04-live-draft-system*
*Completed: 2026-02-13*

## Self-Check: PASSED

- src/app/(main)/leagues/[leagueId]/draft/page.tsx: FOUND
- src/app/(main)/leagues/[leagueId]/draft/draft-room.tsx: FOUND
- src/app/(main)/leagues/[leagueId]/draft/draft-board.tsx: FOUND
- src/app/(main)/leagues/[leagueId]/draft/rider-picker.tsx: FOUND
- src/app/(main)/leagues/[leagueId]/draft/timer.tsx: FOUND
- Commit 4f91bfc: FOUND (feat(04-03): create draft page, DraftRoom container, and DraftBoard grid)
- Commit cdae7e2: FOUND (feat(04-03): create RiderPicker with search/filter and DraftTimer component)

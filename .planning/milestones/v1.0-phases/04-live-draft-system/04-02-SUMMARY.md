---
status: complete
started: 2026-02-13
completed: 2026-02-13
---

# Plan 04-02 Summary

## What Was Built
Implemented the server-side draft engine with complete pick validation, state transitions, and real-time broadcasting. Created `startDraft` and `makePick` server actions with transaction-safe database updates, QStash auto-pick timer scheduling, and Pusher event broadcasting. Added shared query helpers for retrieving available riders and computing next draft states, plus a QStash-signed auto-pick API route that fires on timer expiry.

## Key Files
### Created
- `src/lib/draft-queries.ts` - Query helpers: `getAvailableRiders`, `getDraftState`, `getBestAvailableRider`, `getEnrichedPicks`, `getEnrichedTeams`, `getDraftStateEnriched`, and re-export of `computeNextDraftState`
- `src/app/(main)/leagues/[leagueId]/draft/actions.ts` - Server actions: `startDraft`, `makePick`, `refreshDraftState`
- `src/app/api/draft/auto-pick/route.ts` - QStash-verified auto-pick endpoint with idempotency checks and best-available-rider selection

### Modified
- None

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Trigger Pusher events AFTER db.transaction() completes | Ensures database updates committed before real-time broadcasts, preventing race conditions |
| Idempotency checks in auto-pick (expectedPickIndex guard) | Prevents duplicate picks if user manually picks just before timer fires |
| Best available rider = alphabetically first | Simple, deterministic MVP auto-pick strategy (can be enhanced later with more sophisticated logic) |
| Shared computeNextDraftState helper | Eliminates code duplication between makePick and auto-pick route, maintains consistency |
| 65s QStash delay vs 60s timer | 5s grace period for network latency; auto-pick fires after UI timer shows 0 |
| Gender-specific round tracking for women's draft | Women's rounds start fresh from round 0 for snake calculation, distinct from men's round numbers |

## Self-Check: PASSED
All verification criteria met:
- startDraft creates draft session, schedules first auto-pick, triggers Pusher broadcast
- makePick validates turn order, rider availability, and gender matching
- Auto-pick respects idempotency and timing guards
- Draft correctly transitions: pending → men (18 rounds) → women (6 rounds) → complete
- Picks appear instantly via Pusher events in all connected clients
- TypeScript compilation successful

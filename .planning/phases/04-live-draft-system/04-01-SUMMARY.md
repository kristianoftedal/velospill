---
phase: 04-live-draft-system
plan: 01
subsystem: database, infra
tags: [drizzle, postgresql, pusher, websocket, qstash, snake-draft]

# Dependency graph
requires:
  - phase: 03-league-management
    provides: leagues and teams tables referenced as foreign keys in draft schema
  - phase: 01-foundation
    provides: riders table referenced as foreign key in draft_picks

provides:
  - draft_sessions and draft_picks PostgreSQL tables with all constraints and indexes
  - Pusher server singleton for triggering real-time events
  - Pusher client singleton for subscribing to presence channels
  - /api/pusher-auth route with session + league membership validation
  - Snake draft order utility (getTeamIndexForPick, buildDraftOrder, getTotalPicks)

affects:
  - 04-02 (draft lobby and start flow)
  - 04-03 (pick submission and real-time updates)
  - 04-04 (auto-pick timer)

# Tech tracking
tech-stack:
  added: [pusher, pusher-js, @upstash/qstash, use-sound, @types/howler]
  patterns:
    - Pusher presence channels with session-validated auth endpoint
    - Snake draft order: even rounds L-R, odd rounds R-L, men first then women

key-files:
  created:
    - src/db/schema/draft.ts
    - src/lib/pusher-server.ts
    - src/lib/pusher-client.ts
    - src/lib/draft-snake-order.ts
    - src/app/api/pusher-auth/route.ts
  modified:
    - src/db/schema/index.ts
    - package.json

key-decisions:
  - "drizzle-kit 0.18.x incompatible with drizzle-orm 0.45.x — applied migration via direct SQL (same pattern as phase 03)"
  - "Women's snake order restarts independently from round 0 (not continuing men's absolute round count)"
  - "Pusher auth validates both session AND league membership before authorizing presence channel"
  - "draftSessions.leagueId is UNIQUE — one draft session per league enforced at DB level"

patterns-established:
  - "Pusher presence channel naming: presence-draft-{leagueId}"
  - "pusher-client.ts is for 'use client' components only — never import in server code"

# Metrics
duration: 3min
completed: 2026-02-13
---

# Phase 4 Plan 01: Draft Infrastructure Summary

**PostgreSQL draft tables, Pusher real-time infrastructure, and snake draft order utility installed and ready for live draft feature development**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T09:20:02Z
- **Completed:** 2026-02-13T09:23:04Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Draft database schema created: `draft_sessions` (one per league, tracks status/current pick/timer) and `draft_picks` (all picks with unique constraints on rider-per-league and pick-slot-per-league)
- Pusher server and client singletons configured; `/api/pusher-auth` presence channel endpoint validates user session and league membership before authorizing subscription
- Snake draft order utility implemented and verified: `getTeamIndexForPick`, `buildDraftOrder`, `getTotalPicks` — correct snake pattern confirmed for 10-team scenario
- Five new npm packages installed: pusher, pusher-js, @upstash/qstash, use-sound, @types/howler

## Task Commits

1. **Task 1: Install packages and create draft DB schema** - `ea15552` (feat)
2. **Task 2: Pusher singletons, snake order utility, and auth endpoint** - `95ad857` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src/db/schema/draft.ts` - Draft schema: draftStatusEnum, draftSessions table, draftPicks table with relations
- `src/db/schema/index.ts` - Added re-export of draft schema
- `src/lib/pusher-server.ts` - Server-side Pusher singleton (server use only)
- `src/lib/pusher-client.ts` - Client-side Pusher singleton with presence channel auth config
- `src/lib/draft-snake-order.ts` - Snake order utility: getTeamIndexForPick, buildDraftOrder, getTotalPicks, DraftSlot type
- `src/app/api/pusher-auth/route.ts` - POST handler for Pusher presence channel authorization
- `package.json` - Added pusher, pusher-js, @upstash/qstash, use-sound

## Decisions Made

- Applied migration via direct SQL execution since drizzle-kit 0.18.x is incompatible with the newer drizzle-orm 0.45.x installed (same workaround used in phase 03)
- Women's draft snake order resets to round 0 independently rather than continuing the absolute round count from men's draft — makes each gender's snake order self-contained
- Pusher presence channel auth checks both authentication (valid session) AND authorization (league membership) before allowing subscription
- `draftSessions.leagueId` has a UNIQUE constraint at the DB level, enforcing exactly one draft session per league

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Direct SQL migration instead of drizzle-kit commands**
- **Found during:** Task 1 (run migration step)
- **Issue:** `npm run db:generate` and `npm run db:migrate` fail because drizzle-kit 0.18.x doesn't support these command names (only `generate:pg` exists) and the version mismatch with drizzle-orm 0.45.x causes generation to abort
- **Fix:** Applied migration directly using `@neondatabase/serverless` Pool with CREATE TABLE IF NOT EXISTS SQL — same approach used in phase 03
- **Files modified:** None (applied to database, not files)
- **Verification:** Queried `information_schema.tables` to confirm `draft_sessions` and `draft_picks` exist with correct columns
- **Committed in:** ea15552 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary to proceed — tables are correctly created in the database. No scope creep.

## Issues Encountered

- drizzle-kit 0.18.1 is too old for the drizzle-orm 0.45.x API — the `generate` and `migrate` commands don't exist in this version. Direct SQL migration was used as the workaround. This is a known project-wide pattern (see STATE.md notes).

## User Setup Required

**External services require manual configuration before draft features can be tested:**

Pusher (presence channels for real-time draft events):
- `PUSHER_APP_ID` — Pusher Dashboard -> App Keys
- `NEXT_PUBLIC_PUSHER_KEY` — Pusher Dashboard -> App Keys
- `PUSHER_SECRET` — Pusher Dashboard -> App Keys
- `NEXT_PUBLIC_PUSHER_CLUSTER` — Pusher Dashboard -> App Keys (e.g., eu, mt1)
- Create a Channels app in the Pusher Dashboard

QStash (delayed auto-pick timer for serverless):
- `QSTASH_TOKEN` — Upstash Console -> QStash -> Settings
- `QSTASH_CURRENT_SIGNING_KEY` — Upstash Console -> QStash -> Settings -> Signing Keys
- `QSTASH_NEXT_SIGNING_KEY` — Upstash Console -> QStash -> Settings -> Signing Keys
- Create a QStash instance in the Upstash Console

App URL (needed for QStash callbacks):
- `NEXT_PUBLIC_APP_URL` — Your deployed app URL (e.g., https://yourapp.vercel.app)

## Next Phase Readiness

- Draft data layer complete: schema, relations, indexes, and unique constraints in place
- Real-time infrastructure configured: Pusher server and client ready, auth endpoint live
- Snake order utility verified correct for 10-team 24-round scenario
- Plan 02 (draft lobby and start flow) can proceed immediately
- Pusher and QStash env vars must be configured before end-to-end draft testing

---
*Phase: 04-live-draft-system*
*Completed: 2026-02-13*

## Self-Check: PASSED

- All 7 files verified present on disk
- Commits ea15552 and 95ad857 confirmed in git log

# Phase 4: Live Draft System - Research

**Researched:** 2026-02-13
**Domain:** Real-Time WebSocket Systems, Snake Draft Algorithms, Serverless Timer Architecture, Fantasy Draft UX
**Confidence:** HIGH

## Summary

Phase 4 implements a real-time snake draft for a cycling fantasy league. The two technically risky areas are: (1) real-time communication in a serverless Next.js environment, and (2) server-authoritative countdown timer with auto-pick on expiry.

The core constraint is that **Next.js deployed on Vercel Hobby cannot use native WebSocket servers** — serverless functions are stateless and cannot hold connections. The answer is a managed real-time service: **Pusher Channels** is the recommended choice. Pusher's free tier (200k messages/day, 100 concurrent connections) comfortably covers draft activity (a 24-round draft for 10 teams = 240 picks maximum, with each pick generating ~10 broadcast events = ~2,400 Pusher messages per full draft). Server Actions trigger Pusher events server-side; clients subscribe via pusher-js.

The second hard problem is timer auto-pick. Vercel Hobby cron jobs run **at most once per day** — completely infeasible for 60-second pick timers. The solution is **Upstash QStash**: when a pick turn begins, the server publishes a delayed QStash message (e.g., 65 seconds delay) pointing to an `/api/draft/auto-pick` endpoint. If the drafter picks before timeout, the pick action marks that timer as canceled in the database; the QStash callback checks `timerExpiresAt` and no-ops if the slot is already filled. QStash free tier (1,000 messages/day) is adequate.

Draft state must live entirely in PostgreSQL (Drizzle). The `draftPicks` table stores every pick; `draftSessions` tracks the current session state (current round, current pick index, status). All state is authoritative from the DB, so reconnecting clients can hydrate via a single fetch, then subscribe to Pusher for deltas.

**Primary recommendation:** Use Pusher Channels (managed WebSocket), QStash (delayed auto-pick timer), Drizzle for draft state persistence, and store the timer `timerExpiresAt` timestamp server-side for drift-free countdown display on all clients.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pusher | 5.3.2 | Server-side event trigger | Official Pusher server SDK, `trigger()` from Server Actions |
| pusher-js | 8.4.0 | Client WebSocket connection | Official Pusher client SDK, TypeScript types since v5.1.0 |
| @upstash/qstash | 2.9.0 | Delayed auto-pick job | Serverless message queue, 1,000 msg/day free, delays up to 90 days |
| next | 16.1.6 | Framework (already installed) | Route handlers for Pusher auth endpoint + QStash callback |
| drizzle-orm | 0.45.1 | Draft state persistence (already installed) | Existing ORM, transactional picks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| use-sound | 5.0.0 | "Your turn" audio notification | Client-side sound using Howler.js. Place audio in /public. Only import in "use client" components. |
| date-fns | 4.1.0 | Timer display calculations (already installed) | `differenceInSeconds` for countdown display |
| Web Audio API | (browser built-in) | Alternative: generate beep sound without audio file | Use OscillatorNode if no audio file is available. Needs user-gesture unlock on iOS Safari. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pusher Channels | Ably Realtime | Ably has more features (message history, presence) but higher API surface. Pusher simpler DX for pub/sub; free tier sufficient for draft use case |
| Pusher Channels | PartyKit | Runs on Cloudflare Durable Objects, excellent for stateful rooms but requires separate deployment and more complex setup |
| Pusher Channels | native WebSocket server | Requires custom server (incompatible with Vercel serverless), can use with fly.io/Railway but adds infra |
| QStash | Vercel Cron | Vercel Hobby cron = once per day, completely unusable for 60s timers |
| QStash | Client-side timer only | Client timer unreliable: tab close, network drop, browser freeze all cause missed auto-picks. Cannot rely solely on client. |
| QStash | setInterval in route handler | Serverless functions are stateless, can't hold long-running timers across requests |
| DB-persisted state | In-memory draft state | In-memory state lost on any function cold start or redeploy; DB is the only reliable source of truth |

**Installation:**
```bash
npm install pusher pusher-js @upstash/qstash use-sound
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (main)/
│   │   └── leagues/
│   │       └── [leagueId]/
│   │           └── draft/
│   │               ├── page.tsx              # Draft room (server component, loads state)
│   │               ├── draft-room.tsx        # Client component (Pusher subscription, UI)
│   │               ├── draft-board.tsx       # Pick grid display
│   │               ├── rider-picker.tsx      # Search/filter available riders
│   │               ├── timer.tsx             # Countdown display (client)
│   │               └── actions.ts            # makePick, startDraft server actions
│   └── api/
│       ├── pusher-auth/
│       │   └── route.ts                      # Presence channel auth endpoint (REQUIRED)
│       └── draft/
│           └── auto-pick/
│               └── route.ts                  # QStash callback: auto-pick on timer expiry
├── db/
│   └── schema/
│       └── draft.ts                          # draftSessions, draftPicks tables
└── lib/
    ├── pusher-server.ts                       # PusherServer singleton
    ├── pusher-client.ts                       # PusherClient singleton (browser only)
    └── draft-snake-order.ts                  # Snake order calculation utilities
```

### Pattern 1: Pusher Server + Client Singletons
**What:** Create separate server/client Pusher instances to avoid API key exposure
**When to use:** Every file that needs to trigger (server) or subscribe (client) to events
**Example:**
```typescript
// Source: Pusher Channels Docs https://pusher.com/docs/channels/server_api/overview/
// src/lib/pusher-server.ts
import Pusher from 'pusher'

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

// src/lib/pusher-client.ts  (only imported in "use client" components)
// Source: https://github.com/pusher/pusher-js/blob/master/README.md
import PusherClient from 'pusher-js'

// Create ONCE outside React component tree — do not create inside useEffect or component render
export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    channelAuthorization: {
      endpoint: '/api/pusher-auth',
      transport: 'ajax',
    },
  }
)
```

### Pattern 2: Presence Channel Auth Endpoint
**What:** Route handler that validates user identity and authorizes channel subscription
**When to use:** Required for any `presence-` prefixed Pusher channel (tracks who is online)
**Example:**
```typescript
// Source: Pusher Channels Docs https://pusher.com/docs/channels/server_api/authorizing-users/
// src/app/api/pusher-auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { pusherServer } from '@/lib/pusher-server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { checkLeagueMembership } from '@/lib/league-auth'

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  // CRITICAL: Pusher sends body as application/x-www-form-urlencoded, not JSON
  // Use req.text() + URLSearchParams (or req.formData()) — NOT req.json()
  const data = await req.text()
  const params = new URLSearchParams(data)
  const socketId = params.get('socket_id')!
  const channelName = params.get('channel_name')!

  // Extract leagueId from channel name: "presence-draft-{leagueId}"
  const leagueId = parseInt(channelName.replace('presence-draft-', ''))
  const { isMember } = await checkLeagueMembership(session.user.id, leagueId)
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const presenceData = {
    user_id: session.user.id,
    user_info: { name: session.user.name }
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData)
  return NextResponse.json(authResponse)
}
```

### Pattern 3: Server Action Triggers Pusher Event
**What:** After mutating the database, broadcast the change to all connected clients
**When to use:** Every draft state change (pick made, timer started, draft started)
**Example:**
```typescript
// Source: Pattern derived from Pusher server SDK docs + existing actions.ts pattern
// src/app/(main)/leagues/[leagueId]/draft/actions.ts
'use server'

import { db } from '@/lib/db'
import { draftPicks, draftSessions } from '@/db/schema/draft'
import { pusherServer } from '@/lib/pusher-server'
import { Client as QStashClient } from '@upstash/qstash'

const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! })

export async function makePick(leagueId: number, riderId: number) {
  const session = await getAuthenticatedUser()

  // 1. Validate: it's this user's turn, rider is available, draft is active
  // ... validation queries ...

  // 2. Insert pick in transaction
  const pick = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(draftPicks).values({
      leagueId,
      teamId: currentTeamId,
      riderId,
      round: currentRound,
      pickNumber: currentPickNumber,
      gender: currentGender,
    }).returning()

    // 3. Advance draft state
    await tx.update(draftSessions)
      .set({
        currentPickIndex: nextPickIndex,
        currentTeamId: nextTeamId,
        pickedAt: new Date(),
        timerExpiresAt: new Date(Date.now() + 60_000), // 60 second timer
      })
      .where(eq(draftSessions.leagueId, leagueId))

    return inserted
  })

  // 4. Schedule auto-pick via QStash AFTER transaction commits (65s = 60s window + 5s buffer)
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/draft/auto-pick`,
    delay: 65,
    body: { leagueId, expectedPickIndex: nextPickIndex },
  })

  // 5. Broadcast to all clients via Pusher AFTER transaction commits
  await pusherServer.trigger(`presence-draft-${leagueId}`, 'pick-made', {
    pick,
    nextTeamId,
    nextPickIndex,
    timerExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  })

  return { success: true, pick }
}
```

### Pattern 4: QStash Auto-Pick Callback
**What:** Route handler called by QStash after timer delay; checks if pick was already made
**When to use:** Auto-pick fallback when drafter's timer expires
**Example:**
```typescript
// Source: Upstash QStash docs https://upstash.com/docs/qstash/quickstarts/vercel-nextjs
// src/app/api/draft/auto-pick/route.ts
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { draftSessions, draftPicks } from '@/db/schema/draft'
import { pusherServer } from '@/lib/pusher-server'
import { eq } from 'drizzle-orm'

async function handler(req: NextRequest) {
  const body = await req.json()
  const { leagueId, expectedPickIndex } = body

  // Check if the pick was already made (user picked before timer)
  const session = await db.query.draftSessions.findFirst({
    where: eq(draftSessions.leagueId, leagueId)
  })

  // If pick index has advanced, someone already picked — no-op
  if (!session || session.currentPickIndex !== expectedPickIndex) {
    return NextResponse.json({ skipped: true })
  }

  // Check timer actually expired (defense against early delivery)
  if (session.timerExpiresAt && new Date() < session.timerExpiresAt) {
    return NextResponse.json({ tooEarly: true })
  }

  // Auto-pick: select first available rider by name (alphabetical)
  const bestRider = await getBestAvailableRider(leagueId, session.currentGender)
  if (!bestRider) {
    // No riders left — this shouldn't happen; log and skip
    return NextResponse.json({ error: 'No available riders' }, { status: 500 })
  }

  // Insert pick and advance state (same transaction as makePick)
  await db.transaction(async (tx) => {
    await tx.insert(draftPicks).values({
      leagueId,
      teamId: session.currentTeamId,
      riderId: bestRider.id,
      round: session.currentRound,
      pickNumber: expectedPickIndex,
      gender: session.currentGender,
      wasAutomatic: true,
    })
    await tx.update(draftSessions).set({
      currentPickIndex: expectedPickIndex + 1,
      currentTeamId: nextTeamId,
      timerExpiresAt: new Date(Date.now() + 60_000),
    }).where(eq(draftSessions.leagueId, leagueId))
  })

  // Broadcast auto-pick event
  await pusherServer.trigger(`presence-draft-${leagueId}`, 'auto-pick', {
    riderId: bestRider.id,
    riderName: bestRider.name,
    teamId: session.currentTeamId,
    wasAutomatic: true,
  })

  return NextResponse.json({ success: true })
}

// verifySignatureAppRouter ensures only QStash can call this endpoint
export const POST = verifySignatureAppRouter(handler)
```

### Pattern 5: Client Subscription with Pick Event Handling
**What:** React client component that subscribes to Pusher and updates local state
**When to use:** The main draft room component
**Example:**
```typescript
// Source: Derived from Pusher client docs + React patterns
// src/app/(main)/leagues/[leagueId]/draft/draft-room.tsx
'use client'

import { useEffect, useState } from 'react'
import { pusherClient } from '@/lib/pusher-client'
import { useSound } from 'use-sound'

export function DraftRoom({ leagueId, initialState, currentUserId, currentTeamId }) {
  const [picks, setPicks] = useState(initialState.picks)
  const [currentTurn, setCurrentTurn] = useState(initialState.currentTeamId)
  const [timerExpiresAt, setTimerExpiresAt] = useState<Date | null>(
    initialState.timerExpiresAt ? new Date(initialState.timerExpiresAt) : null
  )
  // Audio file goes in /public/sounds/your-turn.mp3
  const [playYourTurn] = useSound('/sounds/your-turn.mp3', { volume: 0.5 })

  useEffect(() => {
    const channel = pusherClient.subscribe(`presence-draft-${leagueId}`)

    // On reconnect, fetch fresh state to avoid divergence
    channel.bind('pusher:subscription_succeeded', async () => {
      const freshState = await getDraftState(leagueId)
      setPicks(freshState.picks)
      setCurrentTurn(freshState.currentTeamId)
      setTimerExpiresAt(freshState.timerExpiresAt ? new Date(freshState.timerExpiresAt) : null)
    })

    channel.bind('pick-made', (data) => {
      setPicks(prev => [...prev, data.pick])
      setCurrentTurn(data.nextTeamId)
      setTimerExpiresAt(data.timerExpiresAt ? new Date(data.timerExpiresAt) : null)

      // Play sound if it's now the current user's turn
      if (data.nextTeamId === currentTeamId) {
        playYourTurn()
      }
    })

    channel.bind('auto-pick', (data) => {
      setPicks(prev => [...prev, { ...data, wasAutomatic: true }])
    })

    return () => {
      pusherClient.unsubscribe(`presence-draft-${leagueId}`)
    }
  }, [leagueId, currentTeamId, playYourTurn])

  // ...
}
```

### Pattern 6: Snake Draft Order Algorithm
**What:** Calculate which team picks at any given pick index
**When to use:** Determining next drafter, displaying draft order, pre-computing all picks
**Example:**
```typescript
// Source: Snake draft definition — pure arithmetic
// src/lib/draft-snake-order.ts

/**
 * Returns the team index (0-based) for a given pick number in a snake draft.
 * In a snake draft: even rounds go 0..N-1, odd rounds go N-1..0
 *
 * pick 0 = round 0, slot 0
 * pick 9 = round 0, slot 9 (last in round with 10 teams)
 * pick 10 = round 1, slot 9 (reversed: last team picks again)
 * pick 19 = round 1, slot 0
 */
export function getTeamIndexForPick(pickIndex: number, teamCount: number): number {
  const round = Math.floor(pickIndex / teamCount)
  const positionInRound = pickIndex % teamCount
  // Even rounds go left-to-right, odd rounds go right-to-left
  return round % 2 === 0 ? positionInRound : (teamCount - 1 - positionInRound)
}

/**
 * Returns all pick slots for a complete draft.
 * menRounds: 18 rounds for men's riders
 * womenRounds: 6 rounds for women's riders
 */
export function buildDraftOrder(
  teams: { id: number; name: string }[],
  menRounds: number,
  womenRounds: number
): DraftSlot[] {
  const slots: DraftSlot[] = []
  const n = teams.length

  // Men's draft first (18 rounds)
  for (let round = 0; round < menRounds; round++) {
    for (let slot = 0; slot < n; slot++) {
      const teamIndex = round % 2 === 0 ? slot : (n - 1 - slot)
      slots.push({
        pickNumber: slots.length,
        round,
        gender: 'M' as const,
        teamId: teams[teamIndex].id,
        teamIndex,
      })
    }
  }

  // Women's draft (6 rounds)
  for (let round = 0; round < womenRounds; round++) {
    for (let slot = 0; slot < n; slot++) {
      const teamIndex = round % 2 === 0 ? slot : (n - 1 - slot)
      slots.push({
        pickNumber: slots.length,
        round: menRounds + round,
        gender: 'F' as const,
        teamId: teams[teamIndex].id,
        teamIndex,
      })
    }
  }

  return slots
}

// Verification examples for 10 teams:
// getTeamIndexForPick(0, 10)  → 0  (round 0, first team)
// getTeamIndexForPick(9, 10)  → 9  (round 0, last team)
// getTeamIndexForPick(10, 10) → 9  (round 1, last team picks again)
// getTeamIndexForPick(19, 10) → 0  (round 1, first team)
// getTeamIndexForPick(20, 10) → 0  (round 2, first team)
```

### Pattern 7: Server-Authoritative Timer Display
**What:** Clients compute countdown from `timerExpiresAt` timestamp (never trust client timer)
**When to use:** Countdown display component
**Example:**
```typescript
// Source: Timer sync best practice — absolute timestamp diff
// src/app/(main)/leagues/[leagueId]/draft/timer.tsx
'use client'

import { useEffect, useState } from 'react'

export function DraftTimer({ expiresAt }: { expiresAt: Date | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0)

  useEffect(() => {
    if (!expiresAt) return

    const interval = setInterval(() => {
      // Compute from absolute timestamp — no drift accumulation
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }, 500) // 500ms polling gives smooth display without drift

    return () => clearInterval(interval)
  }, [expiresAt])

  if (!expiresAt) return null

  return (
    <div className={secondsLeft <= 10 ? 'text-red-500 animate-pulse font-bold' : 'font-mono'}>
      {secondsLeft}s
    </div>
  )
}
```

### Pattern 8: Draft State Database Schema
**What:** Minimal normalized schema for draft sessions and picks
**When to use:** Foundation for all draft operations
**Example:**
```typescript
// Source: Drizzle ORM docs + domain model requirements + existing codebase patterns (serial PK, pgEnum, JSONB)
// src/db/schema/draft.ts
import { pgTable, serial, integer, text, timestamp, pgEnum, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { leagues, teams } from './leagues'
import { riders } from './riders'

export const draftStatusEnum = pgEnum('draft_status', [
  'pending',    // Not yet started
  'men',        // Men's draft active
  'women',      // Women's draft active
  'complete',   // All picks done
  'paused',     // Admin paused (future use)
])

// One session per league (the active draft)
export const draftSessions = pgTable('draftSessions', {
  id: serial('id').primaryKey(),
  leagueId: integer('leagueId').notNull().unique().references(() => leagues.id, { onDelete: 'cascade' }),
  status: draftStatusEnum('status').notNull().default('pending'),
  currentPickIndex: integer('currentPickIndex').notNull().default(0),
  currentTeamId: integer('currentTeamId').references(() => teams.id),
  currentGender: text('currentGender').$type<'M' | 'F'>(),
  timerExpiresAt: timestamp('timerExpiresAt', { withTimezone: true }),
  startedAt: timestamp('startedAt', { withTimezone: true }),
  completedAt: timestamp('completedAt', { withTimezone: true }),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  leagueIdx: index('draftSessions_league_idx').on(table.leagueId),
}))

// One row per pick made
export const draftPicks = pgTable('draftPicks', {
  id: serial('id').primaryKey(),
  leagueId: integer('leagueId').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  teamId: integer('teamId').notNull().references(() => teams.id),
  riderId: integer('riderId').notNull().references(() => riders.id),
  pickNumber: integer('pickNumber').notNull(),
  round: integer('round').notNull(),
  gender: text('gender').$type<'M' | 'F'>().notNull(),
  wasAutomatic: boolean('wasAutomatic').notNull().default(false),
  pickedAt: timestamp('pickedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // A rider can only be picked once per league per gender
  riderLeagueGenderUnique: uniqueIndex('draftPicks_rider_league_gender_unique').on(table.leagueId, table.riderId, table.gender),
  // A pick number can only appear once per league
  pickNumberLeagueUnique: uniqueIndex('draftPicks_pickNumber_league_unique').on(table.leagueId, table.pickNumber),
  leagueIdx: index('draftPicks_league_idx').on(table.leagueId),
  teamIdx: index('draftPicks_team_idx').on(table.teamId),
}))
```

### Anti-Patterns to Avoid

- **Client-only timer for auto-pick:** Client tab can close or freeze; QStash provides the authoritative fallback; client countdown is display only
- **Triggering Pusher inside DB transaction:** Pusher failure would rollback the pick. Always call `pusherServer.trigger()` AFTER `await db.transaction(...)` resolves
- **Trusting pick order from client:** Always validate server-side: is it this user's turn? Is the rider available? Is the draft active?
- **Polling for draft state:** Use Pusher events as delta updates; initial state loaded server-side via page.tsx; only re-fetch on reconnect (`pusher:subscription_succeeded`)
- **Opening Pusher connection in Server Components:** Pusher subscriptions require `"use client"` — `pusherClient` is only imported in client components
- **Multiple QStash timers for same slot:** Each new pick schedules QStash with `expectedPickIndex`; callbacks check this before acting — older timers no-op automatically
- **Using LISTEN/NOTIFY with Neon:** Neon scales to zero after 5 minutes of inactivity, which ends PostgreSQL sessions and terminates any LISTEN subscriptions — not viable
- **Creating Pusher client inside React component:** Create singleton outside component tree; subscribe/unsubscribe inside useEffect only

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket server | Custom ws:// server in Next.js | Pusher Channels | Serverless-incompatible; connection management, reconnection, presence, scaling all solved by Pusher |
| Delayed auto-pick job | `setTimeout` in server code | QStash delayed message | Serverless functions are stateless; setInterval/setTimeout die when function returns |
| Timer sync across clients | Each client runs its own countdown | Server `timerExpiresAt` + `Date.now()` diff | Client timers drift, tab close loses state; server timestamp is the source of truth |
| Snake order computation | Manual round-by-round if/else | `getTeamIndexForPick()` utility | Easy to get wrong (off-by-one on odd rounds); centralize for pick validation and display |
| Real-time "who's online" | Manual presence table polling | Pusher presence channels | Pusher presence tracks connect/disconnect automatically |
| Audio notification | Web Audio API from scratch | use-sound + Howler.js | Browser autoplay policies, AudioContext lifecycle, cross-browser compatibility all handled |

**Key insight:** Pusher + QStash replaces what would otherwise require a persistent WebSocket server + background job worker — two pieces of infra that Vercel's serverless hosting cannot provide. Both services have generous free tiers that cover the draft use case many times over.

## Common Pitfalls

### Pitfall 1: Vercel Hobby Cron Cannot Drive Pick Timers
**What goes wrong:** Developer tries to use `vercel.json` cron for auto-pick timer
**Why it happens:** Cron jobs seem like the obvious solution for scheduled tasks
**How to avoid:** Vercel Hobby cron minimum interval is ONCE PER DAY. Use QStash delayed messages instead
**Warning signs:** Deployment fails with "Hobby accounts are limited to daily cron jobs"

### Pitfall 2: Race Condition on Simultaneous Picks
**What goes wrong:** Two requests to `makePick` arrive at the same millisecond (e.g., user clicks fast + auto-pick fires simultaneously)
**Why it happens:** No database-level lock on current pick slot
**How to avoid:** Use a `uniqueIndex` on `(leagueId, pickNumber)` in `draftPicks` so the second insert fails with a constraint violation. Catch the error and return "pick already taken"
**Warning signs:** Same pick slot filled twice, draft corrupted

### Pitfall 3: QStash Timer Fires After Pick Already Made
**What goes wrong:** QStash auto-pick fires, even though the user picked before timer
**Why it happens:** QStash delivers regardless; it doesn't know if the pick happened
**How to avoid:** At callback start, check `currentPickIndex === expectedPickIndex`. If they differ, the slot was filled — return `{ skipped: true }` immediately
**Warning signs:** Extra/duplicate picks appearing, pick slot filled by "auto" when user picked manually

### Pitfall 4: Neon Connection Exhaustion During Draft
**What goes wrong:** Concurrent connections to Neon exceed pool limits during active draft
**Why it happens:** Many users load the draft page simultaneously; Neon serverless driver Pool needs proper sizing
**How to avoid:** Neon serverless driver uses HTTP by default for single queries; Pool (WebSocket) for transactions. Draft page loads can use HTTP; keep Pool usage to transactional operations only
**Warning signs:** `NeonDbError: too many clients` errors in logs during draft

### Pitfall 5: Pusher Event Before DB Commit
**What goes wrong:** Pusher broadcasts pick, but DB transaction not yet committed; clients show pick that doesn't exist in DB
**Why it happens:** `pusherServer.trigger()` called inside the `db.transaction()` callback
**How to avoid:** Always trigger Pusher AFTER `await db.transaction(...)` resolves successfully
**Warning signs:** Clients see pick, then it disappears on reconnect; inconsistent state

### Pitfall 6: Missing Gender Filter in Available Riders Query
**What goes wrong:** A rider picked in the men's draft appears as "already picked" in the women's draft query
**Why it happens:** Available rider query doesn't filter by current draft gender
**How to avoid:** All "get available riders" queries must filter: `WHERE gender = :currentGender AND riderId NOT IN (SELECT riderId FROM draftPicks WHERE leagueId = :id AND gender = :currentGender)`
**Warning signs:** Women riders show as unavailable during men's draft or vice versa

### Pitfall 7: Pusher Auth Endpoint Expects Form Data, Not JSON
**What goes wrong:** Auth endpoint returns 400 or `socketId` is null
**Why it happens:** Pusher sends `POST /api/pusher-auth` as `application/x-www-form-urlencoded`. Using `req.json()` parses nothing
**How to avoid:** Use `req.text()` + `new URLSearchParams(data)` or `req.formData()` — NOT `req.json()`
**Warning signs:** Private/presence channel subscriptions silently fail; no events received; console shows auth endpoint error

### Pitfall 8: use-sound SSR Error in Next.js
**What goes wrong:** `ReferenceError: window is not defined` on server during SSR
**Why it happens:** use-sound uses Howler.js which accesses `window` during import
**How to avoid:** Only use `useSound` inside `"use client"` components; never in Server Components. Audio files go in `/public/sounds/`
**Warning signs:** Build errors or SSR errors mentioning `window`, `AudioContext`

### Pitfall 9: Draft State Diverges Between Clients After Reconnect
**What goes wrong:** One client misses a Pusher event (brief disconnect), sees stale board
**Why it happens:** Pusher does not replay missed events. Client reconnects but doesn't re-fetch from DB
**How to avoid:** Bind to `pusher:subscription_succeeded` event; when it fires, fetch current draft state from server and replace local state entirely
**Warning signs:** Board shows different picks for different users; reconnected user sees wrong current drafter

### Pitfall 10: Draft Board Render Performance with Many Cells
**What goes wrong:** Draft board (up to 10 teams × 24 rounds = 240 cells) re-renders on every pick event causing lag
**Why it happens:** React re-renders entire pick grid on state update
**How to avoid:** Use `React.memo` on pick cells; only update the changed cell. Consider TanStack Virtual if 10+ teams or mobile performance is critical
**Warning signs:** Browser janky/slow during draft, especially on mobile with large team counts

## Code Examples

Verified patterns from official sources:

### Environment Variables Required
```bash
# .env.local additions for Phase 4
PUSHER_APP_ID=your_app_id
NEXT_PUBLIC_PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
NEXT_PUBLIC_PUSHER_CLUSTER=eu  # or mt1/us2/ap1/ap2/etc.
QSTASH_TOKEN=your_qstash_token
QSTASH_CURRENT_SIGNING_KEY=...  # for QStash signature verification
QSTASH_NEXT_SIGNING_KEY=...     # for QStash signature verification
NEXT_PUBLIC_APP_URL=https://yourapp.vercel.app  # needed by QStash for callback URL
```

### Complete Draft Session Loading (Server Component)
```typescript
// Source: Drizzle ORM query patterns + existing codebase pattern
// src/app/(main)/leagues/[leagueId]/draft/page.tsx
import { db } from '@/lib/db'
import { draftSessions, draftPicks } from '@/db/schema/draft'
import { DraftRoom } from './draft-room'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'

export default async function DraftPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId: leagueIdStr } = await params
  const leagueId = parseInt(leagueIdStr)
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  // Load all draft state server-side for initial render
  const [draftSession, picks, leagueTeams] = await Promise.all([
    db.query.draftSessions.findFirst({
      where: eq(draftSessions.leagueId, leagueId)
    }),
    db.select().from(draftPicks).where(eq(draftPicks.leagueId, leagueId)),
    db.select().from(teams).where(eq(teams.leagueId, leagueId)).orderBy(teams.createdAt),
  ])

  return (
    <DraftRoom
      leagueId={leagueId}
      initialSession={draftSession}
      initialPicks={picks}
      teams={leagueTeams}
      currentUserId={session.user.id}
    />
  )
}
```

### Rider Search/Filter Query
```typescript
// Source: Drizzle ORM docs + existing riders schema
// Used by active drafter to browse available riders
import { riders } from '@/db/schema/riders'
import { draftPicks } from '@/db/schema/draft'
import { eq, and, notInArray, ilike } from 'drizzle-orm'

export async function getAvailableRiders(
  leagueId: number,
  gender: 'M' | 'F',
  search?: string,
  filterTeam?: string,
  filterNationality?: string
) {
  const pickedRiderIds = db
    .select({ riderId: draftPicks.riderId })
    .from(draftPicks)
    .where(and(
      eq(draftPicks.leagueId, leagueId),
      eq(draftPicks.gender, gender)
    ))

  return db.select()
    .from(riders)
    .where(and(
      eq(riders.gender, gender),
      notInArray(riders.id, pickedRiderIds),
      search ? ilike(riders.name, `%${search}%`) : undefined,
      filterTeam ? eq(riders.team, filterTeam) : undefined,
      filterNationality ? eq(riders.nationality, filterNationality) : undefined,
    ))
    .orderBy(riders.name) // Alphabetical = deterministic "best available" for auto-pick
}
```

### Snake Order Verification
```typescript
// Verify snake order for 10 teams:
// Round 0 (even): picks 0-9  → team indices [0,1,2,3,4,5,6,7,8,9]
// Round 1 (odd):  picks 10-19 → team indices [9,8,7,6,5,4,3,2,1,0]
// Round 2 (even): picks 20-29 → team indices [0,1,2,3,4,5,6,7,8,9]

getTeamIndexForPick(0, 10)  // → 0 (first team, round 0)
getTeamIndexForPick(9, 10)  // → 9 (last team, round 0)
getTeamIndexForPick(10, 10) // → 9 (last team picks again, round 1)
getTeamIndexForPick(19, 10) // → 0 (first team, round 1)
getTeamIndexForPick(20, 10) // → 0 (first team, round 2)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Socket.io custom server | Managed WebSocket service (Pusher/Ably) | 2020+ | No persistent server needed, works with Vercel serverless |
| Vercel cron for timers | QStash delayed messages | 2022 (QStash GA) | Sub-minute scheduling possible on serverless/Hobby plan |
| LISTEN/NOTIFY for real-time | Managed pub/sub | 2022+ (Neon scale-to-zero) | LISTEN/NOTIFY sessions killed on Neon inactivity |
| Client-side socket server | Pusher Channels REST API trigger | 2015+ | Server triggers over HTTPS; WebSocket for client-only |
| Long-polling for real-time | WebSockets via managed service | 2018+ | Sub-100ms latency, bidirectional, no request overhead |

**Deprecated/outdated:**
- `socket.io` with Next.js: Still works but requires custom server setup (fly.io/Railway), incompatible with Vercel serverless deployment
- LISTEN/NOTIFY with Neon: Broken by scale-to-zero — only viable with scale-to-zero disabled (adds cost)
- Vercel cron for fine-grained scheduling: Hard limit of once per day on Hobby plan

## Open Questions

1. **Draft sequence: men first or interleaved?**
   - What we know: Requirements say "separate drafts for men (18 rounds) and women (6 rounds)"
   - What's unclear: Does all men's drafting complete before women's draft starts, or is there an interleaved format?
   - Recommendation: Implement sequential (men → women) — requirements say "separate drafts"; transition to women's automatically on men's completion

2. **Best available rider for auto-pick**
   - What we know: DRAFT-08 says "auto-pick best available rider"
   - What's unclear: What defines "best"? There is no ranking column in `riders` table
   - Recommendation: Use alphabetical order as deterministic tie-breaker for MVP; auto-pick the first available rider sorted by `riders.name` ASC

3. **Draft board layout for variable team counts (2-10)**
   - What we know: Leagues can have 2-10 teams
   - What's unclear: How does the grid render when team count varies?
   - Recommendation: Horizontal scroll for >6 teams on mobile; each column = one team; each row = one round

4. **QStash delivery on local development**
   - What we know: QStash sends HTTP requests to `NEXT_PUBLIC_APP_URL`
   - What's unclear: How to test QStash callbacks locally without deploying?
   - Recommendation: Use Upstash's QStash development server or `ngrok` for local testing. Or skip QStash testing locally and test auto-pick via direct API call with `BYPASS_QSTASH_AUTH=true` guard

5. **Draft room accessibility before draft starts**
   - What we know: DRAFT-01 says admin starts the draft
   - What's unclear: Can all league members see the draft room in advance (lobby state)?
   - Recommendation: Show a "waiting room" view at `/leagues/[id]/draft` while status is `pending`; connect Pusher presence channel early so all members are visible before picks start

6. **Vercel tier for project**
   - What we know: No evidence of Pro plan in codebase
   - What's unclear: Is the project deployed on Hobby or Pro?
   - Recommendation: Assume Hobby tier; design auto-pick with QStash (works on both tiers, not cron-dependent)

## Sources

### Primary (HIGH confidence)
- [Pusher Channels Docs - Authorizing Users](https://pusher.com/docs/channels/server_api/authorizing-users/) - auth endpoint pattern, private/presence channel flow
- [Pusher Channels Docs - JavaScript Quick Start](https://pusher.com/docs/channels/getting_started/javascript/) - client setup, event binding
- [Pusher Channels Docs - Presence Channels](https://pusher.com/docs/channels/using_channels/presence-channels/) - presence member tracking
- [Vercel Cron Jobs - Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) - Hobby = once per day confirmed; minimum interval table
- [github.com/pusher/pusher-js README](https://github.com/pusher/pusher-js/blob/master/README.md) - channelAuthorization config, TypeScript types
- Existing codebase — `/src/db/schema/leagues.ts` — league/team schema, serial PK, pgEnum, JSONB patterns
- Existing codebase — `/src/db/schema/riders.ts` — gender enum, rider fields for draft pool
- Existing codebase — `/src/lib/league-auth.ts` — league membership/ownership auth helpers
- Existing codebase — `/src/lib/db.ts` — Neon serverless Pool setup
- npm: `pusher@5.3.2`, `pusher-js@8.4.0`, `@upstash/qstash@2.9.0`, `use-sound@5.0.0` — current versions confirmed via `npm show`

### Secondary (MEDIUM confidence)
- [Upstash QStash - Next.js Quickstart](https://upstash.com/docs/qstash/quickstarts/vercel-nextjs) - verifySignatureAppRouter, delayed message pattern
- [Upstash QStash Pricing](https://upstash.com/docs/qstash/overall/pricing) - Free tier: 1,000 messages/day confirmed
- [Pusher Channels Pricing](https://pusher.com/channels/pricing/) - Free tier: 200k msg/day, 100 concurrent connections confirmed
- [Vercel - Deploying Pusher Channels](https://vercel.com/kb/guide/deploying-pusher-channels-with-vercel) - Vercel + Pusher deployment pattern
- [MDN Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) - AudioContext autoplay policy, iOS Safari requirements

### Tertiary (LOW confidence - validate during implementation)
- [Neon Real-Time Guide](https://neon.com/guides/real-time-comments) - LISTEN/NOTIFY limitation with scale-to-zero
- Pusher presence channels blog — member_added/member_removed events pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Pusher, QStash, use-sound verified via official docs; versions confirmed via npm; Vercel Hobby cron limitation confirmed from official Vercel docs
- Architecture: HIGH — Pusher + QStash pattern is the established answer to "realtime + scheduled tasks on Vercel serverless"; patterns from official sources
- Pitfalls: HIGH — Vercel cron limit from docs; race conditions and DB constraints are standard concurrency issues; Neon LISTEN/NOTIFY limitation from Neon docs; Pusher form data pitfall from official auth docs

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days — Pusher/QStash APIs stable; Vercel plan limits unlikely to change)

**Key new dependencies to install (all others already in package.json):**
- `pusher@5.3.2` — Server-side Pusher SDK
- `pusher-js@8.4.0` — Client Pusher SDK
- `@upstash/qstash@2.9.0` — Delayed job queue
- `use-sound@5.0.0` — Audio notifications

**Critical constraint confirmed:**
Vercel Hobby tier: cron jobs run at most once per day. Auto-pick MUST use QStash delayed messages, not Vercel cron.

**Free tier capacity check:**
- Pusher Sandbox: 200,000 msgs/day, 100 concurrent connections. A 10-team full draft (240 picks × ~10 Pusher messages/pick) = ~2,400 messages per league draft. Capacity for ~80 concurrent league drafts per day.
- QStash Free: 1,000 msgs/day. Each pick = 1 QStash message. A 10-team full draft = 240 messages. Capacity for ~4 concurrent full drafts per day. Upgrade to pay-as-you-go if more concurrent drafts needed ($1 per 100k requests).

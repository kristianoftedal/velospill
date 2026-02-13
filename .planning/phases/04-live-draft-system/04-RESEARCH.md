# Phase 4: Live Draft System - Research

**Researched:** 2026-02-13
**Domain:** Real-Time WebSocket Systems, Snake Draft Algorithms, Serverless Timer Architecture, Fantasy Draft UX
**Confidence:** HIGH

## Summary

Phase 4 implements a real-time snake draft for a cycling fantasy league. The two technically risky areas are: (1) real-time communication in a serverless Next.js environment, and (2) server-authoritative countdown timer with auto-pick on expiry.

The core constraint is that **Next.js deployed on Vercel Hobby cannot use native WebSocket servers** — serverless functions are stateless and cannot hold connections. The answer is a managed real-time service: **Pusher Channels** is the recommended choice. Pusher's free tier (200k messages/day, 100 concurrent connections) comfortably covers draft activity (a 24-round draft for 10 teams = 240 picks maximum, with each pick generating ~10 broadcast events = ~2,400 Pusher messages per full draft). Server Actions trigger Pusher events server-side; clients subscribe via pusher-js.

The second hard problem is timer auto-pick. Vercel Hobby cron jobs run **at most once per day** — completely infeasible for 60-second pick timers. The solution is **Upstash QStash**: when a pick turn begins, the server publishes a delayed QStash message (e.g., 65 seconds delay) pointing to an `/api/draft/auto-pick` endpoint. If the drafter picks before timeout, the pick action marks that timer as canceled in the database; the QStash callback checks `pick_expires_at` and no-ops if the slot is already filled. QStash free tier (1,000 messages/day) is adequate.

Draft state must live entirely in PostgreSQL (Drizzle). The `draft_picks` table stores every pick; `draft_sessions` tracks the current session state (current round, current pick index, status). All state is authoritative from the DB, so reconnecting clients can hydrate via a single REST fetch, then subscribe to Pusher for deltas.

**Primary recommendation:** Use Pusher Channels (managed WebSocket), QStash (delayed auto-pick timer), Drizzle for draft state persistence, and store the timer `expires_at` timestamp server-side for drift-free countdown display on all clients.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pusher | ^5.2.0 | Server-side event trigger | Official Pusher server SDK, `trigger()` from Server Actions |
| pusher-js | ^8.4.0 | Client WebSocket connection | Official Pusher client SDK, works in browser |
| @upstash/qstash | ^2.7.0 | Delayed auto-pick job | Serverless message queue, 1000 msg/day free, delays up to 90 days |
| next | 16.1.6 | Framework (already installed) | Route handlers for Pusher auth endpoint + QStash callback |
| drizzle-orm | ^0.45.1 | Draft state persistence (already installed) | Existing ORM, transactional picks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| use-sound | ^4.0.1 | "Your turn" audio notification | Client-side sound using Howler.js, place audio in /public |
| @types/howler | ^2.2.11 | TypeScript types for Howler | Required when using use-sound with TypeScript |
| date-fns | ^4.1.0 | Timer display calculations (already installed) | `differenceInSeconds` for countdown display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pusher Channels | Ably Realtime | Ably has more features (message history, presence) but higher API surface. Pusher simpler DX for pub/sub; free tier sufficient for draft use case |
| Pusher Channels | PartyKit | PartyKit runs on Cloudflare Durable Objects, excellent for stateful rooms but requires separate deployment and more complex setup |
| Pusher Channels | native WebSocket server | Requires custom server (incompatible with Vercel serverless), can use with fly.io/Railway but adds infra |
| QStash | Vercel Cron | Vercel Hobby cron = once per day, completely unusable for 60s timers |
| QStash | Client-side timer only | Client timer is unreliable: tab close, network drop, browser freeze all cause missed auto-picks |
| QStash | setInterval in route handler | Serverless functions are stateless, can't hold long-running timers across requests |
| DB-persisted state | In-memory draft state | In-memory state lost on any function cold start or redeploy; DB is the only reliable source of truth |

**Installation:**
```bash
npm install pusher pusher-js @upstash/qstash use-sound
npm install --save-dev @types/howler
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
│       │   └── route.ts                      # Presence channel auth endpoint
│       └── draft/
│           └── auto-pick/
│               └── route.ts                  # QStash callback: auto-pick on timer expiry
├── db/
│   └── schema/
│       └── draft.ts                          # draft_sessions, draft_picks tables
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
// Source: Pusher Channels Docs + https://www.obytes.com/blog/pusher-nextjs
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
import PusherClient from 'pusher-js'

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

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const data = await req.text()
  const params = new URLSearchParams(data)
  const socketId = params.get('socket_id')!
  const channelName = params.get('channel_name')!

  const presenceData = {
    user_id: session.user.id,
    user_info: { name: session.user.name, teamId: '' } // populate from DB
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
import { Client } from '@upstash/qstash'

const qstash = new Client({ token: process.env.QSTASH_TOKEN! })

export async function makePick(leagueId: number, riderId: number) {
  const session = await checkAuth()

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

  // 4. Schedule auto-pick via QStash (65s delay = 60s pick window + 5s buffer)
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/draft/auto-pick`,
    delay: 65,
    body: { leagueId, expectedPickIndex: nextPickIndex },
  })

  // 5. Broadcast to all clients via Pusher
  await pusherServer.trigger(`presence-draft-${leagueId}`, 'pick-made', {
    pick,
    nextTeamId,
    nextPickIndex,
    timerExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  })

  revalidatePath(`/leagues/${leagueId}/draft`)
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

  // Auto-pick: select best available rider (highest ranking / first in list)
  const bestRider = await getBestAvailableRider(leagueId, session.currentGender)

  // Insert pick and advance state (same as makePick but automated)
  // ... identical transaction logic ...

  // Broadcast auto-pick event
  await pusherServer.trigger(`presence-draft-${leagueId}`, 'auto-pick', {
    riderId: bestRider.id,
    riderName: bestRider.name,
    teamId: session.currentTeamId,
    wasAutomatic: true,
  })

  return NextResponse.json({ success: true })
}

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
  const [timerExpiresAt, setTimerExpiresAt] = useState(initialState.timerExpiresAt)
  const [playYourTurn] = useSound('/sounds/your-turn.mp3')

  useEffect(() => {
    const channel = pusherClient.subscribe(`presence-draft-${leagueId}`)

    channel.bind('pick-made', (data) => {
      setPicks(prev => [...prev, data.pick])
      setCurrentTurn(data.nextTeamId)
      setTimerExpiresAt(new Date(data.timerExpiresAt))

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
// Source: Snake draft definition + algorithm derivation
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
  const totalRounds = menRounds + womenRounds
  const n = teams.length

  // Men's draft first (18 rounds)
  for (let round = 0; round < menRounds; round++) {
    for (let slot = 0; slot < n; slot++) {
      const teamIndex = round % 2 === 0 ? slot : (n - 1 - slot)
      slots.push({
        pickNumber: slots.length,
        round,
        gender: 'M',
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
        gender: 'F',
        teamId: teams[teamIndex].id,
        teamIndex,
      })
    }
  }

  return slots
}
```

### Pattern 7: Server-Authoritative Timer Display
**What:** Clients compute countdown from `timerExpiresAt` timestamp (never trust client timer)
**When to use:** Countdown display component
**Example:**
```typescript
// Source: Derived from timer sync best practices
// src/app/(main)/leagues/[leagueId]/draft/timer.tsx
'use client'

import { useEffect, useState } from 'react'

export function DraftTimer({ expiresAt }: { expiresAt: Date | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0)

  useEffect(() => {
    if (!expiresAt) return

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }, 500) // 500ms polling gives smooth updates without drift accumulation

    return () => clearInterval(interval)
  }, [expiresAt])

  if (!expiresAt) return null

  return (
    <div className={secondsLeft <= 10 ? 'text-red-500 animate-pulse' : ''}>
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
// Source: Drizzle ORM docs + domain model requirements
// src/db/schema/draft.ts
import { pgTable, serial, integer, text, timestamp, pgEnum, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { leagues } from './leagues'
import { teams } from './leagues'
import { riders } from './riders'

export const draftStatusEnum = pgEnum('draft_status', [
  'pending',    // Not yet started
  'men',        // Men's draft active
  'women',      // Women's draft active
  'complete',   // All picks done
  'paused',     // Optional: admin paused
])

// One session per league (the active draft)
export const draftSessions = pgTable('draft_sessions', {
  id: serial('id').primaryKey(),
  leagueId: integer('leagueId').notNull().unique().references(() => leagues.id, { onDelete: 'cascade' }),
  status: draftStatusEnum('status').notNull().default('pending'),
  currentPickIndex: integer('currentPickIndex').notNull().default(0),
  currentTeamId: integer('currentTeamId').references(() => teams.id),
  currentGender: text('currentGender').$type<'M' | 'F'>(),
  timerExpiresAt: timestamp('timerExpiresAt', { withTimezone: true }),
  startedAt: timestamp('startedAt', { withTimezone: true }),
  completedAt: timestamp('completedAt', { withTimezone: true }),
}, (table) => ({
  leagueIdx: index('draft_sessions_league_idx').on(table.leagueId),
}))

// One row per pick made
export const draftPicks = pgTable('draft_picks', {
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
  // A rider can only be picked once per league
  riderLeagueUnique: uniqueIndex('draft_picks_rider_league_unique').on(table.leagueId, table.riderId),
  // A team+round+gender combination can only appear once
  teamRoundUnique: uniqueIndex('draft_picks_team_round_gender_unique').on(table.teamId, table.round, table.gender),
  leagueIdx: index('draft_picks_league_idx').on(table.leagueId),
  teamIdx: index('draft_picks_team_idx').on(table.teamId),
}))
```

### Anti-Patterns to Avoid

- **Client-only timer:** Client tab can close or freeze; timer state MUST originate from server `timerExpiresAt` in DB
- **Blocking Server Action on Pusher:** Trigger Pusher after committing the DB transaction, not inside it (Pusher failure should not rollback the pick)
- **Trusting pick order from client:** Always validate server-side: is it this user's turn? Is the rider available?
- **Polling for draft state:** Use Pusher events as delta updates; initial state loaded server-side via page.tsx; only fallback-poll on reconnect
- **Opening Pusher connection in Server Components:** Pusher subscriptions require `"use client"` — only pusher-server.ts (trigger) is used in server context
- **Multiple QStash timers for same slot:** Each new pick should include the `expectedPickIndex` in the QStash payload; callbacks check this before acting, making older timers idempotent
- **Using LISTEN/NOTIFY with Neon:** Neon scales to zero after 5 minutes of inactivity, which ends PostgreSQL sessions and terminates any LISTEN subscriptions — not a viable real-time approach

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket server | Custom ws:// server in Next.js | Pusher Channels | Serverless-incompatible; connection management, reconnection, presence, scaling all solved by Pusher |
| Delayed auto-pick job | `setTimeout` in server code | QStash delayed message | Serverless functions are stateless; setInterval/setTimeout die when function returns |
| Timer sync across clients | Each client runs its own countdown | Server `timerExpiresAt` + `Date.now()` diff | Client timers drift, tab close loses state; server timestamp is truth |
| Snake order computation | Manual round-by-round if/else | `getTeamIndexForPick()` utility | Easy to get wrong (off-by-one on odd rounds); centralize for pick validation |
| Real-time "who's online" | Manual presence table polling | Pusher presence channels | Pusher presence tracks connect/disconnect automatically, no DB polling needed |
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
**Why it happens:** Many users load the draft page simultaneously; `@neondatabase/serverless` Pool needs proper sizing
**How to avoid:** Neon serverless driver uses HTTP by default for single queries; Pool (WebSocket) for transactions. Draft page loads can use HTTP; keep Pool usage to transactional operations only
**Warning signs:** `NeonDbError: too many clients` errors in logs during draft

### Pitfall 5: Pusher Event Before DB Commit
**What goes wrong:** Pusher broadcasts pick, but DB transaction not yet committed; clients show pick that doesn't exist
**Why it happens:** `pusherServer.trigger()` called inside the `db.transaction()` callback
**How to avoid:** Always trigger Pusher AFTER `await db.transaction(...)` resolves successfully
**Warning signs:** Clients see pick, then it disappears on reconnect; inconsistent state

### Pitfall 6: Missing Gender Draft Separation in DB Queries
**What goes wrong:** A rider picked in the men's draft appears as "already picked" in the women's draft query
**Why it happens:** Available rider query doesn't filter by current draft gender
**How to avoid:** All "get available riders" queries must filter: `AND gender = :currentGender AND riderId NOT IN (SELECT riderId FROM draftPicks WHERE leagueId = :leagueId AND gender = :currentGender)`
**Warning signs:** Women riders show as unavailable during men's draft or vice versa

### Pitfall 7: Pusher Presence Channel Name Conflict
**What goes wrong:** Multiple leagues can't use the same channel name
**Why it happens:** Channel name not scoped to leagueId
**How to avoid:** Always use `presence-draft-${leagueId}` as channel name pattern. Pusher channel names up to 164 characters
**Warning signs:** Draft events from one league appear in another league's UI

### Pitfall 8: use-sound SSR Error in Next.js
**What goes wrong:** `ReferenceError: window is not defined` on server during SSR
**Why it happens:** use-sound uses Howler.js which accesses `window` during import
**How to avoid:** Only use `useSound` inside `"use client"` components; never in Server Components. Audio files go in `/public/sounds/`
**Warning signs:** Build errors or SSR errors mentioning `window`, `AudioContext`

### Pitfall 9: Draft Board Render Performance with 240 Picks
**What goes wrong:** Draft board (10 teams × 24 rounds = 240 cells) re-renders on every pick event causing lag
**Why it happens:** React re-renders entire pick grid on state update
**How to avoid:** Use `React.memo` on pick cells; update only the changed cell. Consider virtualization (TanStack Virtual) if 10+ teams
**Warning signs:** Browser janky/slow during draft, especially on mobile

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
QSTASH_CURRENT_SIGNING_KEY=...  # for signature verification
QSTASH_NEXT_SIGNING_KEY=...     # for signature verification
NEXT_PUBLIC_APP_URL=https://yourapp.vercel.app  # needed by QStash callback
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

export default async function DraftPage({ params }: { params: { leagueId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const leagueId = parseInt(params.leagueId)

  // Load all draft state server-side for initial render
  const [draftSession, picks, teams, availableMen, availableWomen] = await Promise.all([
    db.query.draftSessions.findFirst({
      where: eq(draftSessions.leagueId, leagueId)
    }),
    db.select().from(draftPicks).where(eq(draftPicks.leagueId, leagueId)),
    db.query.teams.findMany({ where: eq(teams.leagueId, leagueId) }),
    getAvailableRiders(leagueId, 'M'),
    getAvailableRiders(leagueId, 'F'),
  ])

  return (
    <DraftRoom
      leagueId={leagueId}
      initialSession={draftSession}
      initialPicks={picks}
      teams={teams}
      availableMen={availableMen}
      availableWomen={availableWomen}
      currentUserId={session.user.id}
    />
  )
}
```

### Snake Order Calculation Verification
```typescript
// Verify snake order for 10 teams, round 0 and round 1:
// Round 0 (even): picks 0-9  → teams [0,1,2,3,4,5,6,7,8,9]
// Round 1 (odd):  picks 10-19 → teams [9,8,7,6,5,4,3,2,1,0]
// Round 2 (even): picks 20-29 → teams [0,1,2,3,4,5,6,7,8,9]

getTeamIndexForPick(0, 10)  // → 0 (first team, round 0)
getTeamIndexForPick(9, 10)  // → 9 (last team, round 0)
getTeamIndexForPick(10, 10) // → 9 (last team picks again, round 1)
getTeamIndexForPick(19, 10) // → 0 (first team, round 1)
getTeamIndexForPick(20, 10) // → 0 (first team, round 2)
```

### Rider Search/Filter Query
```typescript
// Source: Drizzle ORM docs + existing riders schema
// Used by active drafter to browse available riders
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
    .orderBy(riders.name)
}
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
   - What's unclear: Does all men's drafting complete before women's draft starts, or is there an interleaved format (e.g., pick a man, then a woman, alternating)?
   - Recommendation: Design DB schema to support both; implement sequential (men → women) as default since requirements say "separate drafts"

2. **Best available rider for auto-pick**
   - What we know: DRAFT-08 says "auto-pick best available rider"
   - What's unclear: What defines "best"? Alphabetical first? By specialty? By team ranking?
   - Recommendation: Use alphabetical order as tie-breaker for MVP; add a `draftRank` column to riders table in a future phase

3. **Draft board layout for different team counts (2-10)**
   - What we know: Leagues can have 2-10 teams (from Phase 3 config)
   - What's unclear: How does the grid render when team count varies? 2-team vs 10-team drafts look very different
   - Recommendation: Build grid as `team_count × (24 rows for men + 6 rows for women)`; responsive horizontal scroll for >6 teams on mobile

4. **What happens if admin disconnects during draft?**
   - What we know: Only admin can start the draft (DRAFT-01)
   - What's unclear: Is admin required to stay online? Can draft proceed if admin leaves?
   - Recommendation: Draft should proceed without admin presence once started; admin can rejoin and the state is fully persistent

5. **Pausing a draft**
   - What we know: Requirements don't mention a pause feature
   - What's unclear: What if a participant has a technical issue mid-draft?
   - Recommendation: Implement `paused` status in `draftStatusEnum` (already in schema above) but don't build the UI in Phase 4; add as future enhancement

6. **Draft room accessibility before draft starts**
   - What we know: DRAFT-01 says admin starts the draft
   - What's unclear: Can all league members see the draft room in advance (lobby state)? Or is the URL only surfaced when admin starts?
   - Recommendation: Show a "waiting room" page at `/leagues/[id]/draft` while status is `pending`; connect to Pusher presence channel early so all members are visible

## Sources

### Primary (HIGH confidence)
- [Pusher Channels Docs - Authorizing Users](https://pusher.com/docs/channels/server_api/authorizing-users/) - auth endpoint pattern, private/presence channel flow
- [Pusher Channels Docs - JavaScript Quick Start](https://pusher.com/docs/channels/getting_started/javascript/) - client setup, event binding
- [Upstash QStash Documentation](https://upstash.com/docs/qstash/quickstarts/vercel-nextjs) - Next.js integration, verifySignatureAppRouter
- [Vercel Cron Jobs - Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) - Hobby = once per day confirmed
- [Neon Docs - Real-Time Comments Guide](https://neon.com/guides/real-time-comments) - Neon LISTEN/NOTIFY limitation with scale-to-zero
- Existing codebase - `/src/db/schema/leagues.ts` - league/team schema for foreign key references
- Existing codebase - `/src/db/schema/riders.ts` - gender enum, rider fields for draft pool
- Existing codebase - `/src/lib/db.ts` - Neon serverless Pool setup
- Existing codebase - `/src/app/admin/riders/actions.ts` - established Server Action pattern

### Secondary (MEDIUM confidence)
- [Neon - Real-Time Comments with Ably LiveSync](https://neon.com/guides/real-time-comments) - outbox pattern, Ably integration architecture
- [Ably + Next.js Vercel link sharing](https://ably.com/blog/next-js-vercel-link-sharing-serverless-websockets) - server trigger pattern, token auth flow
- [obytes.com - Pusher with Next.js](https://www.obytes.com/blog/pusher-nextjs) - client subscription code pattern
- [Pusher Channels Pricing](https://pusher.com/channels/pricing/) - Free tier: 200k msg/day, 100 concurrent connections verified
- [QStash Pricing](https://upstash.com/pricing/qstash) - Free tier: 1,000 messages/day verified
- [Josh W. Comeau - use-sound hook](https://www.joshwcomeau.com/react/announcing-use-sound-react-hook/) - use-sound API, public folder for audio files

### Tertiary (LOW confidence - validate during implementation)
- [Syncing Countdown Timers Across Clients - Medium](https://medium.com/@flowersayo/syncing-countdown-timers-across-multiple-clients-a-subtle-but-critical-challenge-384ba5fbef9a) - 500ms interval + server timestamp diff pattern (403 on fetch, reconstructed from description)
- [Pusher Channels Presence Channels Blog](https://pusher.com/blog/what-are-presence-channels-pusher-presence-channels-when-and-how-to-use-them/) - presence channel patterns for "who's online"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Pusher, QStash, use-sound all verified via official docs/pricing pages; Vercel Hobby cron limitation confirmed from official Vercel docs
- Architecture: HIGH - Pusher + QStash pattern is the established answer to "realtime + scheduled tasks on Vercel serverless"; patterns derived from official sources
- Pitfalls: HIGH - Vercel cron limit verified from docs; race conditions and DB constraint pitfalls are standard concurrency issues; Neon LISTEN/NOTIFY limitation confirmed from Neon docs

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days — Pusher/QStash APIs stable; Vercel plan limits unlikely to change)

**Key dependencies to install:**
- `pusher` ^5.2.0 - Server-side Pusher SDK (NEW)
- `pusher-js` ^8.4.0 - Client Pusher SDK (NEW)
- `@upstash/qstash` ^2.7.0 - Delayed job queue (NEW)
- `use-sound` ^4.0.1 - Audio notifications (NEW)
- `@types/howler` ^2.2.11 - TypeScript types for Howler.js (NEW, devDependency)
- All other dependencies already installed

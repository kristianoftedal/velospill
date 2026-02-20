# Phase 3: League Management - Research

**Researched:** 2026-02-12
**Domain:** Multi-tenant League Systems, Invite Links, State Machines, Team Management
**Confidence:** HIGH

## Summary

Phase 3 implements private league creation with shareable invite links, team name registration, and lifecycle state management. The technical foundation builds on existing Next.js 16 Server Actions with Better Auth for user context, Drizzle ORM for multi-tenant data isolation, and Zod for validation.

The core pattern is multi-tenant with shared database using league_id scoping on all related tables (teams, drafts, transfers). Each league has a unique invite code generated with nanoid (cryptographically secure, URL-safe, shorter than UUID). Invite links include expiration and usage limits. League lifecycle follows explicit enum states: setup → drafting → active → complete, enforced at the database level with PostgreSQL enums.

Team names must be unique within a league but can duplicate across leagues. Use Zod superRefine for async database validation to check team name uniqueness before insert. Store league configuration (draft date, season year, team limits) as JSONB for flexibility without schema changes.

**Primary recommendation:** Use nanoid (12+ characters) for invite codes, PostgreSQL enum for league status with state validation in Server Actions, scope all queries by league_id using Drizzle where clauses, validate team name uniqueness with Zod superRefine + database query.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | Framework, Server Actions | Already in use, stable in 2026 |
| Better Auth | 1.4.18 | Authentication, user context | Already in use, provides session management |
| Drizzle ORM | 0.45.1 | Database queries, transactions | Already in use, excellent multi-tenant support with where scoping |
| Zod | 4.3.6 | Schema validation | Already in use, superRefine for async DB checks |
| nanoid | Latest (3.3.7+) | Secure ID generation | Industry standard for invite codes, better than UUID for user-facing tokens |
| PostgreSQL | Latest | Database, enums, JSONB | Already in use via Neon, native enum and JSONB support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Date manipulation | Already in use, for draft date validation and invite expiration |
| React Hook Form | 7.71.1 | Form state management | Already in use, for league creation and team join forms |
| shadcn/ui | Latest | UI components | Already in use, provides Form, Dialog, Input components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nanoid | UUID v4 | UUID is 36 chars vs nanoid 12-21, both secure but nanoid more user-friendly in URLs |
| PostgreSQL enum | text column with validation | Enums provide database-level constraint, better type safety, but harder to change values |
| JSONB config | Separate columns | JSONB allows flexible config without migrations, trade-off is less type safety at DB level |
| Shared DB + league_id | Separate schemas per league | Shared DB simpler to manage, schema-per-tenant adds complexity for 2-10 teams per league |
| Application-level scoping | Row-Level Security (RLS) | RLS stronger isolation but adds complexity; app-level sufficient for league scoping with explicit where clauses |

**Installation:**
```bash
npm install nanoid  # Add for invite code generation
# All other dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── (main)/
│       └── leagues/
│           ├── page.tsx              # List user's leagues
│           ├── new/
│           │   ├── page.tsx          # Create league form
│           │   └── actions.ts        # Server Actions
│           ├── [leagueId]/
│           │   ├── page.tsx          # League detail/dashboard
│           │   └── actions.ts        # League-scoped actions
│           └── join/
│               └── [inviteCode]/
│                   └── page.tsx      # Join via invite link
├── db/
│   └── schema/
│       ├── leagues.ts                # League, invite, team tables
│       └── index.ts                  # Export all schemas
└── lib/
    ├── invite-codes.ts               # nanoid wrapper for codes
    └── league-auth.ts                # Check league membership
```

### Pattern 1: Multi-Tenant League Scoping
**What:** All league-related queries filtered by league_id to ensure data isolation
**When to use:** Every database query for teams, drafts, transfers, results within a league
**Example:**
```typescript
// Source: Derived from Drizzle ORM docs + multi-tenant best practices
import { eq, and } from 'drizzle-orm'

// BAD: Missing league scope
const team = await db.select()
  .from(teams)
  .where(eq(teams.id, teamId))

// GOOD: Always scope by league
const team = await db.select()
  .from(teams)
  .where(and(
    eq(teams.id, teamId),
    eq(teams.leagueId, leagueId)
  ))
  .limit(1)
```

### Pattern 2: Secure Invite Code Generation
**What:** Generate URL-safe, collision-resistant invite codes with nanoid
**When to use:** League creation, invite link regeneration
**Example:**
```typescript
// Source: https://github.com/ai/nanoid
import { nanoid } from 'nanoid'

// Generate 12-character invite code (68 bits entropy)
// Collision probability: ~1% after 9 billion codes
export function generateInviteCode(): string {
  return nanoid(12) // e.g., "V1StGXR8_Z5j"
}

// Usage in league creation
const inviteCode = generateInviteCode()
const inviteExpiration = addDays(new Date(), 7) // 7 days validity

await db.insert(leagues).values({
  name: leagueName,
  inviteCode,
  inviteExpiresAt: inviteExpiration,
  status: 'setup'
})
```

### Pattern 3: League State Machine with PostgreSQL Enum
**What:** Explicit lifecycle states enforced at database level
**When to use:** League status transitions, state-dependent operations
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/column-types/pg
import { pgEnum, pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core'

export const leagueStatusEnum = pgEnum('league_status', [
  'setup',      // Initial state: accepting joins
  'drafting',   // Draft in progress
  'active',     // Season active
  'complete'    // Season ended
])

export const leagues = pgTable('leagues', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  inviteExpiresAt: timestamp('invite_expires_at'),
  status: leagueStatusEnum('status').notNull().default('setup'),
  ownerId: text('owner_id').notNull(), // references user.id
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// State transition validation
export async function transitionLeagueStatus(
  leagueId: number,
  newStatus: 'setup' | 'drafting' | 'active' | 'complete'
) {
  const [league] = await db.select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)

  // Validate state transitions
  const validTransitions = {
    setup: ['drafting'],
    drafting: ['active'],
    active: ['complete'],
    complete: [] // terminal state
  }

  if (!validTransitions[league.status].includes(newStatus)) {
    throw new Error(`Invalid transition: ${league.status} → ${newStatus}`)
  }

  await db.update(leagues)
    .set({ status: newStatus })
    .where(eq(leagues.id, leagueId))
}
```

### Pattern 4: Team Name Uniqueness Validation
**What:** Zod async validation to check team name uniqueness within league
**When to use:** Team join/creation form validation
**Example:**
```typescript
// Source: https://zod.dev/api (superRefine) + Zod async validation patterns
import { z } from 'zod'

export const joinLeagueSchema = z.object({
  leagueId: z.number(),
  teamName: z.string()
    .min(2, "Team name must be at least 2 characters")
    .max(50, "Team name must be at most 50 characters")
}).superRefine(async (data, ctx) => {
  // Check if team name already exists in this league
  const [existing] = await db.select()
    .from(teams)
    .where(and(
      eq(teams.leagueId, data.leagueId),
      eq(teams.name, data.teamName)
    ))
    .limit(1)

  if (existing) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Team name already taken in this league',
      path: ['teamName']
    })
  }
})
```

### Pattern 5: Invite Link Validation
**What:** Validate invite code exists, not expired, and league has room for more teams
**When to use:** Join page load, before allowing team creation
**Example:**
```typescript
// Source: Derived from Next.js Server Actions + date-fns
export async function validateInviteCode(inviteCode: string) {
  const [league] = await db.select()
    .from(leagues)
    .where(eq(leagues.inviteCode, inviteCode))
    .limit(1)

  if (!league) {
    return { valid: false, reason: 'Invalid invite code' }
  }

  // Check expiration
  if (league.inviteExpiresAt && isPast(league.inviteExpiresAt)) {
    return { valid: false, reason: 'Invite link expired' }
  }

  // Check league status - can only join during setup
  if (league.status !== 'setup') {
    return { valid: false, reason: 'League is no longer accepting new teams' }
  }

  // Check team count (2-10 teams)
  const teamCount = await db.select({ count: count() })
    .from(teams)
    .where(eq(teams.leagueId, league.id))

  if (teamCount[0].count >= 10) {
    return { valid: false, reason: 'League is full (max 10 teams)' }
  }

  return { valid: true, league }
}
```

### Pattern 6: League Configuration as JSONB
**What:** Store flexible league settings in JSONB column for easy extension
**When to use:** League-specific configuration that may vary or expand
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/column-types/pg (jsonb)
import { jsonb } from 'drizzle-orm/pg-core'

export const leagues = pgTable('leagues', {
  // ... other columns
  config: jsonb('config').$type<{
    draftDate?: Date
    seasonYear: number
    teamMin: number  // default 2
    teamMax: number  // default 10
    scoringConfigId?: number
  }>().notNull().default({
    seasonYear: new Date().getFullYear(),
    teamMin: 2,
    teamMax: 10
  })
})

// Usage in league creation
await db.insert(leagues).values({
  name: leagueName,
  inviteCode: generateInviteCode(),
  config: {
    draftDate: parsedDraftDate,
    seasonYear: 2026,
    teamMin: 2,
    teamMax: 10
  }
})
```

### Anti-Patterns to Avoid

- **Missing league scope in queries:** Always filter by league_id - forgetting exposes data across leagues
- **Short invite codes:** Use minimum 12 characters with nanoid for adequate collision resistance
- **Allowing state transitions without validation:** Enforce valid state machine transitions (e.g., can't go from setup → complete)
- **Not checking invite expiration:** Always validate timestamp before allowing joins
- **Hardcoding team limits:** Use league config JSONB for flexibility
- **Exposing internal league IDs in URLs:** Use invite codes in public URLs, league IDs only in authenticated contexts
- **Not preventing duplicate joins:** Check if user already has a team in the league before allowing join
- **Returning detailed errors to client:** Log specific issues server-side, return generic "Invalid invite" to users

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Invite code generation | Custom random string builder | nanoid | Cryptographically secure, URL-safe, collision-resistant, 118 bytes |
| State machine validation | Manual if/else chains | Enum + transition map | Database-level constraint, type-safe, explicit valid transitions |
| Team name uniqueness | Application-level cache | Zod superRefine + DB query | Source of truth in database, handles race conditions |
| Date expiration checks | Manual timestamp comparison | date-fns isPast/isAfter | Handles timezones, DST, edge cases |
| Multi-tenant scoping | Custom middleware | Explicit where clauses | Clear, auditable, no magic, works with Drizzle type inference |
| League configuration | Separate columns for each setting | JSONB column | Add settings without migrations, query with jsonb operators if needed |

**Key insight:** nanoid provides better UX than UUID for user-facing codes (shorter, URL-safe). PostgreSQL enums + transition validation prevent invalid state changes at both DB and application level. Explicit league scoping with where clauses is simpler and more auditable than RLS for this use case.

## Common Pitfalls

### Pitfall 1: Missing League Scope Allows Cross-League Data Access
**What goes wrong:** Queries without league_id filter expose data from other leagues
**Why it happens:** Developer forgets to add where clause, assumes auth check is sufficient
**How to avoid:** Create helper functions that always include league scope, code review checklist
**Warning signs:** User can see team names from other leagues, security audit finds unscoped queries

### Pitfall 2: Race Condition on Team Name Uniqueness
**What goes wrong:** Two users join with same team name simultaneously, both succeed
**Why it happens:** Validation happens before insert, window for duplicate between check and insert
**How to avoid:** Add unique constraint on (league_id, name) at database level as fallback
**Warning signs:** Duplicate team names in same league after concurrent joins

### Pitfall 3: Invite Link Works After League Starts
**What goes wrong:** Users can join league during draft or active season via old invite link
**Why it happens:** Only checking expiration timestamp, not league status
**How to avoid:** Validate both expiration AND status === 'setup' before allowing join
**Warning signs:** Teams appear in league after draft completed, user reports joining active league

### Pitfall 4: User Can Join Same League Multiple Times
**What goes wrong:** Same user creates multiple teams in one league
**Why it happens:** Not checking existing team membership for user before allowing join
**How to avoid:** Query teams table for (userId, leagueId) combination, add unique constraint
**Warning signs:** User has 2+ teams in same league, league has more teams than unique users

### Pitfall 5: Invalid State Transitions Allowed
**What goes wrong:** League jumps from setup → active, skipping drafting
**Why it happens:** No validation of state machine transitions, just updating status column
**How to avoid:** Implement transition map, validate current state before allowing update
**Warning signs:** Leagues in impossible states, draft never happened but league is active

### Pitfall 6: Invite Codes Guessable or Too Short
**What goes wrong:** Users brute-force invite codes to access private leagues
**Why it happens:** Using sequential IDs or short random strings (< 10 characters)
**How to avoid:** Use nanoid with minimum 12 characters (68 bits entropy)
**Warning signs:** Unauthorized joins, users report privacy concerns

### Pitfall 7: Not Preventing Joins at Team Limit
**What goes wrong:** 11th team joins league despite 10-team maximum
**Why it happens:** Checking team count without transaction isolation or database constraint
**How to avoid:** Use database check constraint or transaction with FOR UPDATE lock on league row
**Warning signs:** Leagues with more than max teams, draft fails due to unexpected team count

### Pitfall 8: Exposing Internal IDs in Invite URLs
**What goes wrong:** Public invite URLs contain database IDs (e.g., /join/123)
**Why it happens:** Using league.id instead of league.inviteCode in URL
**How to avoid:** Always use inviteCode for public URLs, only use ID in authenticated contexts
**Warning signs:** Sequential IDs in URLs, easy to guess other league URLs

## Code Examples

Verified patterns from official sources and existing codebase:

### Complete League Creation Server Action
```typescript
// Source: Existing riders/actions.ts pattern + nanoid + Drizzle enum
'use server'

import { db } from '@/lib/db'
import { leagues } from '@/db/schema/leagues'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { addDays } from 'date-fns'

const createLeagueSchema = z.object({
  name: z.string()
    .min(2, "League name must be at least 2 characters")
    .max(100, "League name must be at most 100 characters"),
  draftDate: z.date().optional(),
  seasonYear: z.number().int()
    .min(2024)
    .max(2030)
    .default(new Date().getFullYear())
})

type CreateLeagueInput = z.infer<typeof createLeagueSchema>

async function checkAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function createLeague(formData: CreateLeagueInput) {
  const session = await checkAuth()

  const result = createLeagueSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors
    }
  }

  try {
    const inviteCode = nanoid(12)
    const inviteExpiresAt = addDays(new Date(), 7) // 7 days to join

    const [league] = await db.insert(leagues).values({
      name: result.data.name,
      inviteCode,
      inviteExpiresAt,
      ownerId: session.user.id,
      status: 'setup',
      config: {
        draftDate: result.data.draftDate,
        seasonYear: result.data.seasonYear,
        teamMin: 2,
        teamMax: 10
      }
    }).returning()

    revalidatePath('/leagues')
    return {
      success: true,
      leagueId: league.id,
      inviteCode: league.inviteCode
    }
  } catch (error) {
    return {
      success: false,
      error: { _form: ['Failed to create league'] }
    }
  }
}
```

### Join League with Invite Code
```typescript
// Source: Derived from Next.js Server Actions + validation patterns
'use server'

import { db } from '@/lib/db'
import { leagues, teams } from '@/db/schema/leagues'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and, count } from 'drizzle-orm'
import { isPast } from 'date-fns'

const joinLeagueSchema = z.object({
  inviteCode: z.string().length(12),
  teamName: z.string()
    .min(2, "Team name must be at least 2 characters")
    .max(50, "Team name must be at most 50 characters")
}).superRefine(async (data, ctx) => {
  // Validate invite code
  const [league] = await db.select()
    .from(leagues)
    .where(eq(leagues.inviteCode, data.inviteCode))
    .limit(1)

  if (!league) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid invite code',
      path: ['inviteCode']
    })
    return
  }

  // Check expiration
  if (league.inviteExpiresAt && isPast(league.inviteExpiresAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invite link has expired',
      path: ['inviteCode']
    })
    return
  }

  // Check league status
  if (league.status !== 'setup') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'League is no longer accepting new teams',
      path: ['inviteCode']
    })
    return
  }

  // Check team count
  const [{ teamCount }] = await db.select({ teamCount: count() })
    .from(teams)
    .where(eq(teams.leagueId, league.id))

  const maxTeams = (league.config as any).teamMax || 10
  if (teamCount >= maxTeams) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `League is full (${maxTeams} teams maximum)`,
      path: ['inviteCode']
    })
    return
  }

  // Check team name uniqueness in league
  const [existingTeam] = await db.select()
    .from(teams)
    .where(and(
      eq(teams.leagueId, league.id),
      eq(teams.name, data.teamName)
    ))
    .limit(1)

  if (existingTeam) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Team name already taken in this league',
      path: ['teamName']
    })
  }
})

type JoinLeagueInput = z.infer<typeof joinLeagueSchema>

export async function joinLeague(formData: JoinLeagueInput) {
  const session = await checkAuth()

  const result = await joinLeagueSchema.safeParseAsync(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors
    }
  }

  try {
    // Get league ID from invite code
    const [league] = await db.select()
      .from(leagues)
      .where(eq(leagues.inviteCode, result.data.inviteCode))
      .limit(1)

    // Check if user already has a team in this league
    const [existingUserTeam] = await db.select()
      .from(teams)
      .where(and(
        eq(teams.leagueId, league.id),
        eq(teams.userId, session.user.id)
      ))
      .limit(1)

    if (existingUserTeam) {
      return {
        success: false,
        error: { _form: ['You already have a team in this league'] }
      }
    }

    // Create team
    const [team] = await db.insert(teams).values({
      leagueId: league.id,
      userId: session.user.id,
      name: result.data.teamName
    }).returning()

    revalidatePath('/leagues')
    revalidatePath(`/leagues/${league.id}`)

    return {
      success: true,
      leagueId: league.id,
      teamId: team.id
    }
  } catch (error) {
    return {
      success: false,
      error: { _form: ['Failed to join league'] }
    }
  }
}
```

### Database Schema
```typescript
// Source: https://orm.drizzle.team/docs/column-types/pg
import { pgTable, pgEnum, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { user } from './users'

export const leagueStatusEnum = pgEnum('league_status', [
  'setup',
  'drafting',
  'active',
  'complete'
])

export const leagues = pgTable('leagues', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  inviteExpiresAt: timestamp('invite_expires_at'),
  status: leagueStatusEnum('status').notNull().default('setup'),
  ownerId: text('owner_id').notNull().references(() => user.id),
  config: jsonb('config').$type<{
    draftDate?: Date
    seasonYear: number
    teamMin: number
    teamMax: number
    scoringConfigId?: number
  }>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

export const teams = pgTable('teams', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  leagueId: integer('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => ({
  // Ensure user can only have one team per league
  uniqueUserLeague: unique().on(table.leagueId, table.userId),
  // Ensure team name is unique within league
  uniqueNameLeague: unique().on(table.leagueId, table.name)
}))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UUID for invite codes | nanoid | 2018+ | Shorter URLs (12-21 vs 36 chars), equally secure, more user-friendly |
| Text column for status | PostgreSQL enum | PostgreSQL 8.3+ (mature) | Database-level constraint, type-safe, explicit valid values |
| Separate config columns | JSONB config | PostgreSQL 9.4+ | Flexible without migrations, queryable with jsonb operators |
| Math.random() for tokens | crypto.randomUUID / nanoid | Node 14+ | Cryptographically secure, hardware RNG, no prediction attacks |
| Separate schemas per tenant | Shared DB with tenant_id | 2015+ best practice | Simpler management, easier queries, sufficient isolation for leagues |
| Manual date comparisons | date-fns helpers | 2016+ | Handles timezones, DST, edge cases automatically |

**Deprecated/outdated:**
- Math.random() for security tokens: Use crypto or nanoid
- Manual state validation: Use PostgreSQL enums with check constraints
- Sequential IDs in public URLs: Use secure random tokens
- Separate config columns: Use JSONB for flexible league settings

## Open Questions

1. **League Ownership Transfer**
   - What we know: League has ownerId field, owner likely has special permissions
   - What's unclear: Can ownership be transferred? What permissions does owner have vs members?
   - Recommendation: Start with owner-only permissions (delete league, change settings), defer transfer to later phase

2. **Invite Link Regeneration**
   - What we know: Invite links have expiration dates
   - What's unclear: Can owner regenerate invite code? Does old code become invalid?
   - Recommendation: Allow regeneration, keep old code valid unless explicitly revoked (add 'revoked' boolean)

3. **Team Limits Enforcement**
   - What we know: League config has teamMin/teamMax (default 2-10)
   - What's unclear: What happens if league is below minimum? Can league start with 1 team for testing?
   - Recommendation: Enforce minimum at state transition (setup → drafting), not at join time

4. **Multiple Leagues Per User**
   - What we know: User can create and join leagues
   - What's unclear: Any limit on number of leagues per user? Different teams across leagues?
   - Recommendation: No limit on leagues, user can have different team names in different leagues

5. **Invite Link Sharing via UI**
   - What we know: Invite code stored in database
   - What's unclear: How is link presented to owner? Copy button? QR code? Email share?
   - Recommendation: Show full URL with copy button, defer email/QR to later enhancement

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg) - PostgreSQL enums, JSONB, timestamp types
- [Drizzle ORM - Row-Level Security](https://orm.drizzle.team/docs/rls) - Multi-tenant patterns, Neon integration
- [Next.js - Getting Started: Updating Data](https://nextjs.org/docs/app/getting-started/updating-data) - Server Actions, form handling, revalidation
- [nanoid - GitHub](https://github.com/ai/nanoid) - Secure ID generation, usage examples
- [Zod - API Documentation](https://zod.dev/api) - superRefine for async validation
- Existing codebase - src/app/admin/riders/actions.ts - Established Server Action pattern, auth checks
- Existing codebase - src/db/schema/users.ts - Better Auth integration, user references

### Secondary (MEDIUM confidence)
- [Guides: Multi-tenant | Next.js](https://nextjs.org/docs/app/guides/multi-tenant) - Multi-tenant architecture patterns
- [Why Nano ID is Better Than UUID | MTechZilla](https://www.mtechzilla.com/blogs/why-nano-id-is-better-than-uuid) - nanoid vs UUID comparison, security analysis
- [Schema-based Multi-Tenancy with Drizzle ORM | Medium](https://medium.com/@vimulatus/schema-based-multi-tenancy-with-drizzle-orm-6562483c9b03) - Multi-tenant patterns with Drizzle
- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations) - Migration patterns for adding tables
- [Built-in invite-only authentication in NextAuth | GitHub Discussion](https://github.com/nextauthjs/next-auth/discussions/4106) - Invite link patterns
- [Secure Short Unique IDs | GitHub Gist](https://gist.github.com/heri16/98e7d39b881cf1f8a0bc9ac1ce126438) - Invite code generation with PostgreSQL

### Tertiary (LOW confidence - validate during implementation)
- [Multi-tenancy best practices | Next.js Discussion](https://github.com/vercel/next.js/discussions/20841) - Community patterns (2021, may be outdated)
- [Ensure uniqueness for zod schema field | Discussion](https://www.answeroverflow.com/m/1066438470932897932) - Zod unique validation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use except nanoid, official docs verified, Next.js 16 Server Actions stable
- Architecture: HIGH - Patterns verified from official Drizzle docs, Next.js docs, and existing codebase (riders/races implementation)
- Pitfalls: MEDIUM-HIGH - Based on official docs warnings, multi-tenant best practices, and common Next.js/Drizzle gotchas

**Research date:** 2026-02-12
**Valid until:** 2026-03-15 (30 days - stable ecosystem, Drizzle 0.45.1 mature, Next.js 16 stable, nanoid API stable)

**Key dependencies validated:**
- nanoid - To be added, latest version 3.3.7+, stable API since v2
- Drizzle ORM 0.45.1 - Current in package.json, enum and JSONB support verified
- Zod 4.3.6 - Current in package.json, superRefine async validation verified
- Next.js 16.1.6 - Current in package.json, Server Actions stable
- date-fns 4.1.0 - Current in package.json, date comparison helpers stable
- Better Auth 1.4.18 - Current in package.json, session management verified

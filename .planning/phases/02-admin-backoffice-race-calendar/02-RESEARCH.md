# Phase 2: Admin Backoffice & Race Calendar - Research

**Researched:** 2026-02-10
**Domain:** Next.js Admin Forms, Race Result Entry, Database Transactions & Audit Trails
**Confidence:** HIGH

## Summary

Phase 2 implements race result entry, scoring preview, transfer bid management, and result correction with audit trails. The technical foundation is Next.js 16 Server Actions with React Hook Form for complex data entry (dynamic arrays for race results), Drizzle ORM transactions for preview/commit patterns, and Zod for context-aware validation.

The established Next.js pattern is: Server Actions handle mutations with Zod validation, React Hook Form manages client-side UX (field arrays, instant feedback), and revalidatePath ensures fresh data after commits. For previewing scoring impact before commit, use Drizzle transactions with RETURNING clause to show calculated results, then conditionally commit or rollback based on admin approval.

Audit trails should be implemented at the application level (not database triggers) using a dedicated audit table that stores operation type, changed entity, user, timestamp, and before/after snapshots. This provides better control, flexibility for JSONB diffs, and avoids trigger performance overhead.

**Primary recommendation:** Use React Hook Form useFieldArray for result entry rows, validate with Zod discriminated unions (race-specific rules), preview scoring in transaction with RETURNING, then commit only on approval. Store audit records in dedicated table with JSONB for change diffs.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | Framework, Server Actions | Stable in 2026, Server Actions are production-ready for mutations |
| React Hook Form | 7.71.1 | Form state management, validation UX | Industry standard for complex forms, excellent useFieldArray support |
| Zod | 4.3.6 | Schema validation | TypeScript-first, shares schemas between client/server, discriminated unions |
| Drizzle ORM | 0.45.1 | Database queries, transactions | Already in use, excellent transaction support with rollback |
| TanStack Table | 8.21.3 | Data tables | Already in use for riders/races, headless architecture |
| shadcn/ui | Latest | UI components | Already in use, provides Table, Form, Dialog components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Date manipulation | Already in use, for race date validations |
| next-safe-action | N/A | Server Action middleware | Optional: wraps actions with auth/validation middleware |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Application-level audit | Database triggers | Triggers are harder to maintain, bypass issues, performance overhead |
| Transaction preview | Dry-run flag | Transactions with RETURNING are more standard PostgreSQL pattern |
| React Hook Form | useActionState only | RHF provides better client-side UX, field arrays, instant feedback |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
npm install  # Verify existing: react-hook-form, zod, drizzle-orm, @tanstack/react-table
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── admin/
│       ├── results/              # Race result entry
│       │   ├── page.tsx          # List races needing results
│       │   ├── [raceId]/
│       │   │   ├── page.tsx      # Result entry form
│       │   │   └── actions.ts    # Server Actions
│       │   └── components/
│       │       ├── result-form.tsx
│       │       └── preview-dialog.tsx
│       ├── transfers/            # Transfer bid management
│       │   ├── page.tsx
│       │   └── actions.ts
│       └── corrections/          # Result corrections
│           ├── page.tsx
│           └── actions.ts
├── db/
│   └── schema/
│       ├── results.ts            # Race results table
│       ├── transfers.ts          # Transfer bids table
│       └── audit.ts              # Audit trail table
└── lib/
    ├── scoring/                  # Scoring engine (queries scoringConfig)
    │   ├── calculate.ts
    │   └── preview.ts
    └── validation/
        └── race-results.ts       # Context-aware Zod schemas
```

### Pattern 1: Server Action with Validation and Revalidation
**What:** Standard Next.js mutation pattern from Phase 1
**When to use:** All admin data mutations (create, update, delete)
**Example:**
```typescript
// Source: Existing riders/actions.ts pattern
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const schema = z.object({
  // fields
})

export async function createRecord(formData: unknown) {
  await checkAdminAuth()

  const result = schema.safeParse(formData)
  if (!result.success) {
    return { success: false, error: result.error.flatten().fieldErrors }
  }

  try {
    await db.insert(table).values(result.data)
    revalidatePath('/admin/path')
    return { success: true }
  } catch (error) {
    return { success: false, error: { _form: ['Operation failed'] } }
  }
}
```

### Pattern 2: Dynamic Form with useFieldArray
**What:** React Hook Form pattern for race result entry (multiple rider positions)
**When to use:** Entering race results with dynamic number of positions
**Example:**
```typescript
// Source: https://react-hook-form.com/docs/usefieldarray
import { useFieldArray, useForm } from 'react-hook-form'

type ResultEntry = {
  riderId: number
  position: number
}

const { control, handleSubmit } = useForm({
  defaultValues: {
    results: [] as ResultEntry[]
  }
})

const { fields, append, remove } = useFieldArray({
  control,
  name: 'results'
})

// CRITICAL: Use field.id as key, not index
{fields.map((field, index) => (
  <div key={field.id}>
    <Controller
      name={`results.${index}.riderId`}
      control={control}
      render={({ field }) => <Select {...field} />}
    />
  </div>
))}
```

### Pattern 3: Transaction Preview with RETURNING
**What:** PostgreSQL transaction pattern for previewing scoring before commit
**When to use:** Admin needs to see scoring impact before committing results
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/transactions
export async function previewScoring(raceId: number, results: ResultInput[]) {
  await checkAdminAuth()

  return await db.transaction(async (tx) => {
    // Insert results (not committed yet)
    const inserted = await tx.insert(raceResults)
      .values(results)
      .returning()

    // Calculate scores based on inserted results
    const preview = await calculateScores(tx, raceId, inserted)

    // ROLLBACK - don't commit
    tx.rollback()

    return preview
  })
}
```

### Pattern 4: Context-Aware Validation with Zod
**What:** Zod schema that validates based on race type, eligible riders, valid positions
**When to use:** Race result entry where validation rules depend on race context
**Example:**
```typescript
// Source: https://zod.dev/api (discriminated unions)
import { z } from 'zod'

const raceResultSchema = z.object({
  raceId: z.number(),
  results: z.array(z.object({
    riderId: z.number(),
    position: z.number().min(1)
  }))
}).superRefine(async (data, ctx) => {
  // Fetch race and eligible riders
  const race = await getRace(data.raceId)
  const eligibleRiderIds = await getEligibleRiders(race)

  // Validate positions are sequential (1, 2, 3...)
  const positions = data.results.map(r => r.position).sort()
  if (!isSequential(positions)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Positions must be sequential (1, 2, 3...)',
      path: ['results']
    })
  }

  // Validate no duplicate riders
  const riderIds = data.results.map(r => r.riderId)
  if (hasDuplicates(riderIds)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Each rider can only appear once',
      path: ['results']
    })
  }

  // Validate riders are eligible for this race
  const ineligible = riderIds.filter(id => !eligibleRiderIds.includes(id))
  if (ineligible.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Riders not eligible: ${ineligible.join(', ')}`,
      path: ['results']
    })
  }
})
```

### Pattern 5: Application-Level Audit Trail
**What:** Dedicated audit table with operation type, entity, user, timestamp, before/after JSONB
**When to use:** Result corrections, transfer approvals - any operation requiring audit trail
**Example:**
```typescript
// Source: Derived from https://www.enterprisedb.com/postgres-tutorials/working-postgres-audit-triggers
// and best practices discussion

// Schema: db/schema/audit.ts
export const auditLog = pgTable('auditLog', {
  id: serial('id').primaryKey(),
  entityType: text('entityType').notNull(), // 'race_result', 'transfer_bid'
  entityId: integer('entityId').notNull(),
  operation: text('operation').notNull(), // 'CREATE', 'UPDATE', 'DELETE'
  userId: integer('userId').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  before: jsonb('before'), // Previous state
  after: jsonb('after'),   // New state
  reason: text('reason')   // Admin-provided reason for change
})

// Usage in Server Action
export async function correctResult(resultId: number, updates: ResultUpdate, reason: string) {
  await checkAdminAuth()
  const session = await getSession()

  return await db.transaction(async (tx) => {
    // Get current state
    const [before] = await tx.select().from(raceResults).where(eq(raceResults.id, resultId))

    // Update result
    const [after] = await tx.update(raceResults)
      .set(updates)
      .where(eq(raceResults.id, resultId))
      .returning()

    // Log audit trail
    await tx.insert(auditLog).values({
      entityType: 'race_result',
      entityId: resultId,
      operation: 'UPDATE',
      userId: session.user.id,
      before: before,
      after: after,
      reason: reason
    })

    // Recalculate scores
    await recalculateScores(tx, after.raceId)

    return { success: true }
  })
}
```

### Anti-Patterns to Avoid

- **Using array index as React key for useFieldArray:** Always use `field.id` - array indices break on reorder/remove
- **Empty objects in useFieldArray operations:** append/prepend/insert must receive full objects with all required fields
- **Database triggers for audit trails:** Application-level audit provides better control, avoids trigger bypass issues, easier debugging
- **Returning detailed database errors to client:** Log detailed errors server-side, return generic messages to users
- **Forgetting revalidatePath after mutations:** Next.js won't show fresh data without explicit revalidation
- **Multiple useFieldArray hooks with same name:** Each field array name must be unique
- **Validating only on client side:** Client validation is UX, server validation is security - always validate both

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state for arrays | Custom useState for dynamic fields | React Hook Form useFieldArray | Handles field IDs, operations (append/remove), validation, performance optimized |
| Schema validation | Manual field checks | Zod with superRefine | Type-safe, composable, async validation, discriminated unions for conditional rules |
| Transaction rollback | Manual savepoints | Drizzle tx.rollback() | Standard ORM pattern, handles nested transactions as savepoints |
| Audit trail JSON diffs | Custom before/after comparison | JSONB columns with application logic | PostgreSQL native JSON support, queryable with jsonb operators |
| Date validation | String parsing comparisons | date-fns + Zod date schemas | Handles timezones, DST, validation built-in |
| Server Action error handling | Throwing errors | Return success/error objects | Better UX (no error boundaries), predictable types, form-friendly |

**Key insight:** React Hook Form's useFieldArray and Zod's superRefine handle edge cases you won't anticipate (field reordering, async validation dependencies, circular refs). Drizzle transactions with RETURNING provide atomic preview-then-commit without custom dry-run flags.

## Common Pitfalls

### Pitfall 1: useFieldArray Re-Renders Breaking Fields
**What goes wrong:** Using array index as key causes fields to lose state when items are removed or reordered
**Why it happens:** React reuses DOM elements based on key, index-based keys don't track item identity
**How to avoid:** Always use `field.id` from useFieldArray: `{fields.map((field, idx) => <div key={field.id}>)}`
**Warning signs:** Input values jump to wrong fields after remove/reorder, validation errors on wrong fields

### Pitfall 2: Transaction Preview Not Actually Rolling Back
**What goes wrong:** Transaction commits partial results when preview fails
**Why it happens:** Forgetting to call `tx.rollback()` or throwing error that auto-commits
**How to avoid:** Explicit `tx.rollback()` at end of preview function, or wrap in try/finally to ensure rollback
**Warning signs:** Database shows inserted records after "preview" operation, scores calculated without approval

### Pitfall 3: Context-Aware Validation Running Before Base Schema Validates
**What goes wrong:** superRefine queries database for invalid data, causing SQL errors or wasted queries
**Why it happens:** superRefine runs after full schema validation, but if you put async logic in base schema it runs too early
**How to avoid:** Put all database lookups in superRefine, not in base schema transforms or refinements
**Warning signs:** Database errors for "invalid input syntax", unnecessary DB queries in validation errors

### Pitfall 4: Stale Data After Server Action Success
**What goes wrong:** Admin submits form successfully but table doesn't update
**Why it happens:** Forgetting `revalidatePath()` after mutation - Next.js caches previous data
**How to avoid:** Every Server Action mutation MUST call `revalidatePath()` with affected path
**Warning signs:** Need to hard refresh to see changes, optimistic updates work but real data doesn't appear

### Pitfall 5: Race Condition Between Preview and Commit
**What goes wrong:** Data changes between preview calculation and final commit, showing wrong scores
**Why it happens:** Preview and commit are separate transactions, database state can change between them
**How to avoid:** Store preview calculation in session/memory, re-validate on commit, or use single transaction with conditional commit (not rollback) based on approval flag passed to same function
**Warning signs:** Admin sees preview of +50 points, commits, but actual update shows +30 points

### Pitfall 6: Audit Trail Missing User Context
**What goes wrong:** Audit log shows changes but not which admin made them
**Why it happens:** Forgetting to capture session userId before transaction
**How to avoid:** Get session at start of Server Action (before transaction), pass userId to audit insert
**Warning signs:** Audit log has NULL userId, can't answer "who changed this result?"

### Pitfall 7: Not Validating Discriminated Union Discriminator
**What goes wrong:** Zod discriminated union fails to narrow type in validation logic
**Why it happens:** Discriminator field (e.g., `raceType`) not properly validated first
**How to avoid:** Use z.discriminatedUnion with explicit discriminator key: `z.discriminatedUnion('raceType', [grandTourSchema, oneDaySchema])`
**Warning signs:** TypeScript errors "Property does not exist on union type", Zod validation passes but logic fails

## Code Examples

Verified patterns from official sources and existing codebase:

### Server Action with Shared Zod Schema
```typescript
// Source: Existing src/app/admin/riders/actions.ts pattern
'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Shared schema - use on client AND server
export const resultSchema = z.object({
  raceId: z.number(),
  results: z.array(z.object({
    riderId: z.number(),
    position: z.number().min(1),
  }))
})

export type ResultInput = z.infer<typeof resultSchema>

export async function submitResults(formData: ResultInput) {
  await checkAdminAuth()

  // Server-side validation (REQUIRED - client validation is just UX)
  const result = resultSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors
    }
  }

  try {
    await db.insert(raceResults).values(result.data.results)
    revalidatePath('/admin/results')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: { _form: ['Failed to submit results'] }
    }
  }
}
```

### useFieldArray Client Component
```typescript
// Source: https://react-hook-form.com/docs/usefieldarray
'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resultSchema, type ResultInput } from './actions'

export function ResultEntryForm({ raceId }: { raceId: number }) {
  const { control, handleSubmit } = useForm<ResultInput>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
      raceId,
      results: []
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'results'
  })

  return (
    <form>
      {fields.map((field, index) => (
        <div key={field.id}> {/* CRITICAL: field.id not index */}
          <input
            {...control.register(`results.${index}.riderId`)}
            type="number"
          />
          <input
            {...control.register(`results.${index}.position`)}
            type="number"
          />
          <button type="button" onClick={() => remove(index)}>
            Remove
          </button>
        </div>
      ))}

      <button type="button" onClick={() => append({ riderId: 0, position: fields.length + 1 })}>
        Add Result
      </button>

      <button type="submit">Submit</button>
    </form>
  )
}
```

### Transaction Preview Pattern
```typescript
// Source: https://orm.drizzle.team/docs/transactions
export async function previewResultScoring(raceId: number, results: ResultInput[]) {
  await checkAdminAuth()

  return await db.transaction(async (tx) => {
    // Insert results temporarily
    const inserted = await tx.insert(raceResults)
      .values(results.map(r => ({ ...r, raceId })))
      .returning()

    // Calculate scores with scoring engine
    const scoringPreview = await calculateScoresForRace(tx, raceId)

    // ROLLBACK - don't commit
    tx.rollback()

    return {
      success: true,
      preview: scoringPreview,
      affectedTeams: scoringPreview.length
    }
  })
}
```

### Context-Aware Validation with Database Lookup
```typescript
// Source: https://zod.dev/api (superRefine)
const raceResultSchema = z.object({
  raceId: z.number(),
  results: z.array(z.object({
    riderId: z.number(),
    position: z.number().min(1)
  })).min(1, 'At least one result required')
}).superRefine(async (data, ctx) => {
  // Fetch race to get type and eligible riders
  const race = await db.select()
    .from(races)
    .where(eq(races.id, data.raceId))
    .limit(1)

  if (!race[0]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Race not found',
      path: ['raceId']
    })
    return
  }

  // Validate positions are sequential
  const positions = data.results.map(r => r.position).sort((a, b) => a - b)
  const isSequential = positions.every((pos, idx) => pos === idx + 1)

  if (!isSequential) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Positions must be sequential starting from 1',
      path: ['results']
    })
  }

  // Validate no duplicate positions
  const uniquePositions = new Set(positions)
  if (uniquePositions.size !== positions.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Duplicate positions detected',
      path: ['results']
    })
  }

  // Validate no duplicate riders
  const riderIds = data.results.map(r => r.riderId)
  const uniqueRiders = new Set(riderIds)
  if (uniqueRiders.size !== riderIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Each rider can only finish once',
      path: ['results']
    })
  }
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Forms with useState | React Hook Form | 2021+ | Better performance, less boilerplate, built-in validation |
| API routes for mutations | Server Actions | Next.js 13+ (stable in 14+) | Single-file mutations, no API layer, automatic revalidation |
| Try all union variants | Discriminated unions | Zod 3.0+ | Performance optimization, explicit type narrowing |
| Manual error boundaries | Return error objects from Server Actions | Next.js 14+ convention | Better UX, form-friendly errors, no page crash |
| Database triggers for audit | Application-level audit | 2023+ best practices | Better control, easier debugging, avoids trigger bypass |
| Manual transactions | Drizzle ORM transactions | Drizzle 0.28+ | Type-safe, automatic rollback on error, nested transaction support |

**Deprecated/outdated:**
- getServerSideProps for mutations: Use Server Actions instead
- API routes in /pages/api for data mutations: Use Server Actions in app directory
- Manual revalidation with res.revalidate: Use revalidatePath in Server Actions
- Throwing errors in Server Actions: Return error objects for better UX

## Open Questions

1. **Scoring Engine Implementation Details**
   - What we know: Should query scoringConfig table (not hardcode), TdF bonus requires race name matching, GT orders need race detection
   - What's unclear: Exact structure of scoring calculation functions, how to handle complex bonus rules (e.g., "double points if rider is team captain")
   - Recommendation: Create lib/scoring/calculate.ts that queries scoringConfig, returns structured preview, defer complex bonus logic to later refinement

2. **Transfer Window Validation**
   - What we know: Admin can review and approve/reject bids during transfer windows
   - What's unclear: How transfer windows are defined (date ranges in DB? JSONB config? Per race?), whether deadlines auto-close windows
   - Recommendation: Add transferWindows table with raceId, openDate, closeDate; validate bids against these windows

3. **Result Correction Workflow**
   - What we know: Admin can correct results, trigger score recalculation, requires audit trail
   - What's unclear: UI flow - does admin see current result with inline edit? Separate correction form? Approval workflow?
   - Recommendation: Inline edit on results table, confirmation dialog showing scoring impact, required "reason" field for audit

4. **Optimistic Updates for Result Entry**
   - What we know: React 19 useOptimistic available, Server Actions return fresh data
   - What's unclear: Whether to use optimistic updates for result entry or just show loading state
   - Recommendation: Start with simple loading state (pending from useActionState), add optimistic updates if UX feedback demands it

## Sources

### Primary (HIGH confidence)
- React Hook Form official docs - https://react-hook-form.com/docs/usefieldarray - useFieldArray patterns and best practices
- Drizzle ORM official docs - https://orm.drizzle.team/docs/transactions - Transaction patterns with rollback and RETURNING
- Next.js official docs - https://nextjs.org/docs/app/getting-started/updating-data - Server Actions mutation patterns
- Zod official docs - https://zod.dev/api - Discriminated unions, superRefine for async validation
- Existing codebase - src/app/admin/riders/actions.ts - Established Server Action pattern

### Secondary (MEDIUM confidence)
- [Next.js Server Actions: The Complete Guide (2026)](https://makerkit.dev/blog/tutorials/nextjs-server-actions) - Validation and error handling patterns
- [Guides: Forms | Next.js](https://nextjs.org/docs/app/guides/forms) - Official form handling guide
- [Getting Started: Caching and Revalidating | Next.js](https://nextjs.org/docs/app/getting-started/caching-and-revalidating) - revalidatePath and updateTag
- [Data Table - shadcn/ui](https://ui.shadcn.com/docs/components/radix/data-table) - TanStack Table integration patterns
- [Working with Postgres Audit Triggers | EDB](https://www.enterprisedb.com/postgres-tutorials/working-postgres-audit-triggers) - Audit trail patterns (trigger vs app-level)
- [The Ultimate Guide to PostgreSQL Data Change Tracking](https://blog.bemi.io/the-ultimate-guide-to-postgresql-data-change-tracking/) - Audit implementation approaches
- [PostgreSQL: How to perform a long running dry run transaction without blocking](https://www.postgresql.org/message-id/BD62E056-3F3B-4CC0-A8CA-E5B7B9CB35CA@princeton.edu) - Transaction preview pattern discussion

### Tertiary (LOW confidence - validate during implementation)
- [React Hook Form 7 - Dynamic Form Example with useFieldArray](https://jasonwatmore.com/post/2021/10/05/react-hook-form-7-dynamic-form-example-with-usefieldarray) - useFieldArray examples (2021, may be outdated)
- [3 Postgres Audit Methods: How to Choose?](https://satoricyber.com/postgres-security/postgres-audit/) - Audit approach comparison
- [Materialized vs. Standard Views: SQL Performance Guide](https://toolshelf.tech/blog/materialized-vs-standard-views-sql-performance-guide/) - Materialized view performance (may use for scoring leaderboards later)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, official docs verified, Next.js 16 Server Actions stable in 2026
- Architecture: HIGH - Patterns verified from official docs (React Hook Form, Drizzle, Next.js) and existing riders/races implementation
- Pitfalls: MEDIUM-HIGH - Based on official docs warnings, GitHub issue discussions, and common Next.js/React Hook Form gotchas from community

**Research date:** 2026-02-10
**Valid until:** 2026-03-15 (30 days - stable ecosystem, Next.js 16 mature, React Hook Form v7 stable)

**Key dependencies validated:**
- React Hook Form 7.71.1 - Current in package.json, stable API
- Drizzle ORM 0.45.1 - Current in package.json, transactions well-documented
- Zod 4.3.6 - Current in package.json (note: Zod 4.x is newer than training data, validated via official docs)
- Next.js 16.1.6 - Current in package.json, Server Actions stable
- TanStack Table 8.21.3 - Current in package.json, headless architecture stable

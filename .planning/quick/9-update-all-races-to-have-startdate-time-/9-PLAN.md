---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/fix-race-start-times.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - All races with startDate time of 00:00:00 UTC are updated to 12:00:00 UTC
    - Races already at 12:00:00 UTC are untouched
    - Zero rows have a startDate time of 00:00:00 UTC after the migration
  artifacts:
    - path: scripts/fix-race-start-times.ts
      provides: Migration script using @neondatabase/serverless Pool
  key_links:
    - from: scripts/fix-race-start-times.ts
      to: races table
      via: UPDATE WHERE EXTRACT(HOUR FROM "startDate") = 0 AND EXTRACT(MINUTE FROM "startDate") = 0
      pattern: UPDATE races
---

<objective>
Update all rows in the races table where startDate has a time of 00:00:00 UTC to use 12:00:00 UTC instead, keeping the date portion unchanged.

Purpose: Races entered without an explicit time default to midnight UTC. A noon default is more accurate and avoids races appearing to start the previous day in positive-offset timezones.
Output: Migration script at scripts/fix-race-start-times.ts, executed against production DB, zero midnight-time rows remaining.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/db/schema/races.ts

<interfaces>
<!-- From src/db/schema/races.ts -->
Column: startDate — timestamp("startDate", { withTimezone: true }).notNull()
Table name: "races" (Drizzle maps to SQL table "races")
Pattern from Phase 13: use @neondatabase/serverless Pool, wrap update in transaction, support --dry-run flag
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write and run the migration script</name>
  <files>scripts/fix-race-start-times.ts</files>
  <action>
Create scripts/fix-race-start-times.ts using the @neondatabase/serverless Pool pattern from scripts/migrate-order-types-v1.1.ts.

The script must:
1. Connect via `new Pool({ connectionString: process.env.DATABASE_URL })`
2. Support `--dry-run` flag (process.argv.includes("--dry-run"))
3. In dry-run mode: run a SELECT to preview affected rows, print count + IDs, exit without changes
4. In live mode:
   - BEGIN transaction
   - Run the UPDATE:
     ```sql
     UPDATE races
     SET "startDate" = "startDate" + INTERVAL '12 hours',
         "updatedAt" = NOW()
     WHERE EXTRACT(HOUR FROM "startDate" AT TIME ZONE 'UTC') = 0
       AND EXTRACT(MINUTE FROM "startDate" AT TIME ZONE 'UTC') = 0
       AND EXTRACT(SECOND FROM "startDate" AT TIME ZONE 'UTC') = 0
     ```
   - Print rowCount of updated rows
   - COMMIT (or ROLLBACK on error)
5. Release client and end pool in finally block

After writing the script, execute in dry-run first to preview:
```
DATABASE_URL="$(grep DATABASE_URL .env.local | cut -d= -f2-)" npx tsx scripts/fix-race-start-times.ts --dry-run
```

If the preview looks correct (shows affected race IDs), run live:
```
DATABASE_URL="$(grep DATABASE_URL .env.local | cut -d= -f2-)" npx tsx scripts/fix-race-start-times.ts
```

Note: The startDate column is stored with timezone. The WHERE clause uses `AT TIME ZONE 'UTC'` to extract the UTC time components, ensuring only true midnight-UTC rows are updated. Races already at 12:00:00 UTC will not match (EXTRACT(HOUR) = 12, not 0).
  </action>
  <verify>
    <automated>DATABASE_URL="$(grep DATABASE_URL .env.local | cut -d= -f2-)" npx tsx -e "import { Pool } from '@neondatabase/serverless'; const p = new Pool({ connectionString: process.env.DATABASE_URL }); p.query(\"SELECT COUNT(*) FROM races WHERE EXTRACT(HOUR FROM \\\"startDate\\\" AT TIME ZONE 'UTC') = 0 AND EXTRACT(MINUTE FROM \\\"startDate\\\" AT TIME ZONE 'UTC') = 0\").then(r => { console.log('Midnight UTC rows remaining:', r.rows[0].count); p.end(); })"</automated>
  </verify>
  <done>Script runs successfully, prints number of updated rows, and a follow-up query confirms 0 rows remain with startDate time of 00:00:00 UTC.</done>
</task>

<task type="auto">
  <name>Task 2: Commit the migration script</name>
  <files>scripts/fix-race-start-times.ts</files>
  <action>
Stage and commit the migration script:
```
git add scripts/fix-race-start-times.ts
git commit -m "chore(quick-9): fix race startDate times — set midnight UTC rows to 12:00 UTC"
```
  </action>
  <verify>
    <automated>git log --oneline -1</automated>
  </verify>
  <done>Commit exists with the migration script. The races table has no rows with startDate at 00:00:00 UTC.</done>
</task>

</tasks>

<verification>
After both tasks:
- `scripts/fix-race-start-times.ts` exists and committed
- Query confirms 0 races with midnight UTC startDate
- Updated races show time as 12:00:00 UTC (verify spot-check: SELECT id, name, "startDate" FROM races ORDER BY "startDate" LIMIT 5)
</verification>

<success_criteria>
All races previously stored with 00:00:00 UTC start time now have 12:00:00 UTC. Races with any other time (including already-correct 12:00:00) are untouched.
</success_criteria>

<output>
After completion, update .planning/STATE.md quick tasks table with entry for quick task 9.
</output>

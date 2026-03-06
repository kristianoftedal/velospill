---
phase: quick-11-reseed-scoring
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements:
  - SCORE-01
  - SCORE-02
  - SCORE-03
  - SCORE-04
  - SCORE-05
  - SCORE-06
  - SCORE-07
  - SCORE-08
  - SCORE-09
  - SCORE-10

must_haves:
  truths:
    - "grand_tour_tdf scoring entries exist in the DB (stage_finish, sprint, mountain, jersey, ttt, end-of-tour)"
    - "high_priority_one_day finish uses 20-position table with 50 for 1st"
    - "mini_tour stage_finish 2nd place awards 5 points"
    - "mini_tour end_gc extends to 8 positions"
    - "grand_tour combative jersey awards 2 points"
  artifacts:
    - path: "src/db/migrate-scoring-2026.ts"
      provides: "Migration script that has already been run against the DB"
      contains: "grand_tour_tdf"
  key_links:
    - from: "src/db/migrate-scoring-2026.ts"
      to: "scoringConfig table"
      via: "dotenv -e .env.local -- npx tsx src/db/migrate-scoring-2026.ts"
      pattern: "grand_tour_tdf.*stage_finish"
---

<objective>
Reseed the scoring database with the correct 2026 values from phase 11.

Purpose: The scoringConfig rows in the DB are stale/incorrect. The migration script `src/db/migrate-scoring-2026.ts` contains all the right values and is idempotent (INSERTs use onConflictDoNothing). Running it will fix the DB.

Output: DB scoring rows match the 2026 ruleset defined in the phase 11 plan — including grand_tour_tdf entries, updated one-day tables, mini tour updates, and combative jersey at 2 points.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/db/migrate-scoring-2026.ts

<interfaces>
<!-- How to run scripts in this project (from package.json patterns): -->
dotenv -e .env.local -- npx tsx src/db/migrate-scoring-2026.ts [--dry-run]

<!-- The migration script is already correct and complete. It performs: -->
<!-- - 10 UPDATEs (one-day tables, GT end results, mini tour values) -->
<!-- - 3 DELETEs (tdf_stage_bonus, sprint_double x2) -->
<!-- - 20 INSERTs (all grand_tour_tdf entries + sprint_giro) -->
<!-- - Uses onConflictDoNothing on all INSERTs — safe to re-run -->
<!-- - Dry-run via --dry-run flag (rolls back transaction) -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Dry-run migration to confirm it parses cleanly</name>
  <files></files>
  <action>
Run the migration in dry-run mode to verify it connects and lists all planned operations without error:

```
dotenv -e .env.local -- npx tsx src/db/migrate-scoring-2026.ts --dry-run
```

Read the output. Confirm you see:
- Section headers: UPDATES, DELETES, INSERTS
- ~10 UPDATE lines, ~3 DELETE lines, ~20 INSERT lines
- "Dry run completed - no changes committed" at the end

If the script errors before reaching the summary (connection error, TypeScript error), diagnose and fix before proceeding. Do NOT modify the migration values — only fix infrastructure issues (missing import, wrong path, etc.).
  </action>
  <verify>
    <automated>dotenv -e .env.local -- npx tsx src/db/migrate-scoring-2026.ts --dry-run 2>&1 | grep "Dry run completed"</automated>
  </verify>
  <done>Dry run prints summary with no errors and "Dry run completed" confirmation.</done>
</task>

<task type="auto">
  <name>Task 2: Run migration for real and verify DB state</name>
  <files></files>
  <action>
Run the migration against the live database:

```
dotenv -e .env.local -- npx tsx src/db/migrate-scoring-2026.ts
```

Confirm the output ends with "Migration completed successfully!" and shows the operation counts (10 updates, 3 deletes, 20 inserts).

Then verify the DB has the correct rows by running a quick spot-check query using npx tsx with dotenv:

```typescript
// Create a one-off check script inline via tsx eval or a temp file
// Check for grand_tour_tdf stage_finish (should have "1": 15 for 1st place)
// Check for high_priority_one_day finish (should have "1": 50, "20": 1)
// Check for mini_tour stage_finish (should have "2": 5 for 2nd place)
```

Use this one-liner to spot-check via psql or a quick tsx script. The simplest approach: write a temp verify script at `/tmp/verify-scoring.ts`:

```typescript
import { db } from "@/lib/db"
import { scoringConfig } from "./src/db/schema/config"
import { eq, and } from "drizzle-orm"

const checks = await Promise.all([
  db.select().from(scoringConfig).where(and(eq(scoringConfig.raceType, "grand_tour_tdf"), eq(scoringConfig.category, "stage_finish"))),
  db.select().from(scoringConfig).where(and(eq(scoringConfig.raceType, "high_priority_one_day"), eq(scoringConfig.category, "finish"))),
  db.select().from(scoringConfig).where(and(eq(scoringConfig.raceType, "mini_tour"), eq(scoringConfig.category, "stage_finish"))),
])

console.log("TdF stage_finish rules:", checks[0][0]?.rules)  // expect {"1":15,"2":12,...,"12":1}
console.log("High-pri one-day finish rules:", JSON.stringify(checks[1][0]?.rules).slice(0,40))  // expect "1":50
console.log("Mini tour stage_finish rules:", checks[2][0]?.rules)  // expect {"1":6,"2":5,...}
process.exit(0)
```

Run it with: `dotenv -e .env.local -- npx tsx /tmp/verify-scoring.ts`

Confirm each output matches expected values. If any value is wrong, the migration script's UPDATE did not find the row (row may have had a different key) — diagnose by querying the DB directly.
  </action>
  <verify>
    <automated>dotenv -e .env.local -- npx tsx src/db/migrate-scoring-2026.ts 2>&1 | grep "Migration completed successfully"</automated>
  </verify>
  <done>
Migration runs to completion with no errors. Spot checks confirm: (1) grand_tour_tdf stage_finish exists with "1": 15, (2) high_priority_one_day finish has "1": 50 across 20 positions, (3) mini_tour stage_finish has "2": 5 for 2nd place.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
- `grand_tour_tdf` rows exist in scoringConfig (stage_finish, sprint, 5 mountain categories, 4 jersey categories, ttt, 8 end-of-tour categories)
- `high_priority_one_day` / finish has 20 positions, 50 for 1st
- `mini_tour` / stage_finish has 5 for 2nd place
- `grand_tour` / jersey_combative has 2 points
- No `tdf_stage_bonus` or `sprint_double` rows remain under grand_tour
</verification>

<success_criteria>
- Migration script runs to completion with "Migration completed successfully!"
- Spot-check queries confirm updated values in the DB
- No rows remain with old stale values (tdf_stage_bonus, sprint_double)
</success_criteria>

<output>
After completion, create `.planning/quick/11-reseed-scoring-database-with-correct-val/11-SUMMARY.md` with what was done, any issues encountered, and final DB state confirmed.
</output>

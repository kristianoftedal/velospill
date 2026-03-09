---
phase: quick-14
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/recalc-points-2026.ts
autonomous: true
requirements: [QUICK-14]

must_haves:
  truths:
    - All race_results rows have points matching the current scoringConfig rules
    - Mathieu VAN DER POEL Omloop Het Nieuwsblad shows 30 (not 25) points
    - Team totals in all leagues reflect corrected point values
  artifacts:
    - path: src/db/recalc-points-2026.ts
      provides: One-shot recalc script with --dry-run flag
  key_links:
    - from: src/db/recalc-points-2026.ts
      to: scoringConfig table
      via: same resolveScoringRaceType logic as scoring-preview.ts
      pattern: resolveScoringRaceType
    - from: src/db/recalc-points-2026.ts
      to: race_results.points
      via: UPDATE in transaction
      pattern: tx.update(raceResults)
---

<objective>
Retroactively recalculate all stored points in race_results using the current (2026) scoringConfig.

Purpose: Quick task 11 updated the scoringConfig but did not recalculate already-stored points. All existing race_results.points values were computed with old rules (e.g., pos1=25 for low_priority_one_day). New rules give pos1=30. Team totals in every league are wrong until this is fixed.

Output: src/db/recalc-points-2026.ts (run once, then keep as audit trail)
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
<!-- Key types/exports the executor needs. No codebase exploration required. -->

From src/db/schema/results.ts:
```typescript
export const raceResults = pgTable("race_results", {
  id: serial("id").primaryKey(),
  raceId: integer("raceId").notNull(),
  riderId: integer("riderId").notNull(),
  category: text("category").notNull().default("finish"),
  position: integer("position").notNull(),
  points: integer("points").notNull().default(0),
  // ...timestamps
})
```

From src/db/schema/config.ts:
```typescript
export const scoringConfig = pgTable("scoringConfig", {
  id: serial("id").primaryKey(),
  raceType: text("raceType").notNull(),
  category: text("category").notNull(),
  rules: jsonb("rules").notNull(),          // Record<string, number> — key is position string
  validFrom: timestamp("validFrom").notNull(),
  validUntil: timestamp("validUntil"),
})
```

From src/db/schema/races.ts:
```typescript
export const races = pgTable("races", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  raceType: raceTypeEnum("raceType").notNull(),
  parentRaceId: integer("parentRaceId"),    // null for one-day races, set for stages
  // ...
})
```

resolveScoringRaceType (copy inline — do NOT import from scoring-preview.ts):
```typescript
function resolveScoringRaceType(raceType: string, raceName: string): string {
  if (raceType === "grand_tour") {
    const lowerName = raceName.toLowerCase()
    if (lowerName.includes("tour de france") || lowerName.includes("tdf")) {
      return "grand_tour_tdf"
    }
  }
  return raceType
}
```

scoringConfig lookup (same logic as scoring-preview.ts lines 126–145):
- Query: raceType + category + validFrom <= now AND (validUntil IS NULL OR validUntil > now)
- Fallback: if grand_tour_tdf not found, retry with grand_tour

calculatePoints:
```typescript
function calculatePoints(position: number, rules: Record<string, number>): number {
  return rules[String(position)] || 0
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write recalc-points-2026.ts script</name>
  <files>src/db/recalc-points-2026.ts</files>
  <action>
Create src/db/recalc-points-2026.ts following the same pattern as src/db/migrate-scoring-2026.ts.

Script structure:
1. Parse --dry-run flag from process.argv
2. Fetch all race_results rows joined with their race (and the race's parentRace if parentRaceId is set) — use db.query.raceResults.findMany with nested with: { race: { with: { parentRace: true } } }
3. Build a scoring config map: fetch all active scoringConfig rows (validFrom <= now, validUntil IS NULL or > now), index by "${raceType}:${category}"
4. For each result row:
   a. Determine raceTypeForScoring: if result.race.parentRaceId is set, use resolveScoringRaceType(parentRace.raceType, parentRace.name); else use resolveScoringRaceType(race.raceType, race.name)
   b. Look up config map entry for "${raceTypeForScoring}:${result.category}"
   c. If not found and raceTypeForScoring === "grand_tour_tdf", fallback to "grand_tour:${result.category}"
   d. If still not found, log a warning and skip (do not error out)
   e. Calculate newPoints = calculatePoints(result.position, rules)
   f. If newPoints !== result.points, record as a change: { id, raceId, raceName, position, category, oldPoints: result.points, newPoints }
5. Log all changes as a table (before/after)
6. If no --dry-run, wrap all UPDATEs in a single transaction: for each change, tx.update(raceResults).set({ points: newPoints }).where(eq(raceResults.id, change.id))
7. Log summary: N rows changed, N rows unchanged, N rows skipped (no config found)
8. On dry-run, throw rollback sentinel just like migrate-scoring-2026.ts does

Copy resolveScoringRaceType and calculatePoints inline — do NOT import from scoring-preview.ts (that file uses "@/lib/db" which is fine for scripts, but the functions are trivial to inline and avoids any import chain issues).

Import pattern (same as migrate-scoring-2026.ts):
```typescript
import { db } from "@/lib/db"
import { raceResults } from "./schema/results"
import { scoringConfig } from "./schema/config"
import { eq, lte, or, isNull, gt } from "drizzle-orm"
```

Run command: dotenv -e .env.local -- npx tsx src/db/recalc-points-2026.ts --dry-run
  </action>
  <verify>
    <automated>cd /Users/kristianoftedal/dev/velospill && dotenv -e .env.local -- npx tsx src/db/recalc-points-2026.ts --dry-run 2>&1 | tail -20</automated>
  </verify>
  <done>Dry run completes without errors, logs at least 20 changed rows (2 races x 10 positions), shows old=25 new=30 for position 1 in low_priority_one_day races</done>
</task>

<task type="auto">
  <name>Task 2: Run script to apply recalculation</name>
  <files></files>
  <action>
Run the script without --dry-run to apply the changes:

  dotenv -e .env.local -- npx tsx src/db/recalc-points-2026.ts

Verify by querying the database directly:

  dotenv -e .env.local -- npx tsx -e "
  import { db } from './src/lib/db';
  import { raceResults } from './src/db/schema/results';
  import { eq } from 'drizzle-orm';
  const rows = await db.select().from(raceResults).where(eq(raceResults.position, 1)).limit(5);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
  "

Confirm: position=1 rows show points=30 (for low_priority_one_day) or points=50 (for high_priority_one_day) rather than the old values.
  </action>
  <verify>
    <automated>cd /Users/kristianoftedal/dev/velospill && dotenv -e .env.local -- npx tsx src/db/recalc-points-2026.ts 2>&1 | tail -10</automated>
  </verify>
  <done>Script exits 0, summary shows N rows updated. Spot-check query confirms position-1 results have new point values matching 2026 scoringConfig.</done>
</task>

</tasks>

<verification>
After both tasks complete:
- Script exits 0 with "completed successfully" message
- Summary line shows >0 rows changed (expect 20 rows: 2 races x 10 positions each)
- spot-check: position 1, low_priority_one_day race → points = 30 (was 25)
- spot-check: position 2, low_priority_one_day race → points = 25 (was 20)
</verification>

<success_criteria>
All race_results.points values match the current 2026 scoringConfig. Mathieu VAN DER POEL's Omloop result shows 30 points. League team totals are now accurate.
</success_criteria>

<output>
After completion, create `.planning/quick/14-retroactively-recalculate-all-awarded-po/14-SUMMARY.md`
</output>

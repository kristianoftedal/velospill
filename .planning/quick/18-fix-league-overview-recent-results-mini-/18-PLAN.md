---
phase: quick-18
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/league-overview-queries.ts
autonomous: true
requirements: [QUICK-18]
must_haves:
  truths:
    - "Expanding Paris-Nice or Tirreno in Recent Results shows all stages, not an empty list"
    - "Stages that have results entered show hasResults=true and non-zero league points"
    - "Stages without results still appear in the list with hasResults=false"
  artifacts:
    - path: "src/lib/league-overview-queries.ts"
      provides: "getRecentRaceResults Query 3 with subquery WHERE clause"
      contains: "IN (SELECT \"raceId\" FROM league_races"
  key_links:
    - from: "Query 3 WHERE clause"
      to: "league_races table"
      via: "SQL subquery"
      pattern: "IN \\(SELECT .raceId. FROM league_races WHERE .leagueId."
---

<objective>
Fix the stage fetch in `getRecentRaceResults` so that expanding a mini tour (Paris-Nice, Tirreno-Adriatico) in the Recent Results accordion shows stages instead of an empty list.

Purpose: `inArray(races.parentRaceId, multiStageRaceIds)` silently returns zero rows on Drizzle 0.45.x when the column is a nullable integer. The working `getLeagueRacesWithScores` Query B uses a correlated SQL subquery instead, which produces correct results.

Output: Query 3 WHERE clause replaced; `multiStageRaceIds` variable and its guard removed.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/league-overview-queries.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace inArray with SQL subquery in Query 3</name>
  <files>src/lib/league-overview-queries.ts</files>
  <action>
In `getRecentRaceResults`, make the following minimal changes to Query 3 (lines ~183-227):

1. Remove the `multiStageRaceIds` variable (lines ~184-186):
   ```ts
   // DELETE these lines:
   const multiStageRaceIds = completedRaceRows
     .filter((r) => MULTI_STAGE_TYPES.has(r.raceType))
     .map((r) => r.raceId)
   ```

2. Remove the `if (multiStageRaceIds.length > 0)` guard and its closing brace — keep the `stageRows` declaration and the query body, just always execute the query.

3. Replace the WHERE clause inside the query:
   ```ts
   // BEFORE:
   .where(
     and(
       sql`${races.parentRaceId} IS NOT NULL`,
       inArray(races.parentRaceId, multiStageRaceIds)
     )
   )

   // AFTER:
   .where(
     and(
       sql`${races.parentRaceId} IS NOT NULL`,
       sql`${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId})`
     )
   )
   ```

4. The `stageRows` variable must still be initialised with the same explicit type annotation it has now (so TypeScript is happy if the query returns nothing). Keep it as a `let` with default `[]` only if you keep the guard — but since we're removing the guard, initialise it directly from `await db.select(...)`.

   Simplest approach: remove the `let stageRows = []` declaration and the `if` guard entirely, replacing with:
   ```ts
   const stageRows = await db
     .select({ ... })
     ...
   ```

5. Remove `inArray` from the import line if it is no longer used anywhere in the file. Check: `inArray` is also used in `getUpcomingRacesWithLineups` (line 72 and 180), so keep the import.

Do NOT change: the select shape, the joins, the groupBy/orderBy, the assembly block below, the return type, or anything else.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep league-overview-queries || echo "No type errors in target file"</automated>
  </verify>
  <done>
    - TypeScript compiles clean for src/lib/league-overview-queries.ts
    - `multiStageRaceIds` variable no longer exists in the file
    - Query 3 WHERE clause contains `IN (SELECT "raceId" FROM league_races WHERE "leagueId"`
    - Expanding Paris-Nice or Tirreno in /leagues/[id] Recent Results accordion shows stage rows
  </done>
</task>

</tasks>

<verification>
After the fix, navigate to a league overview page and expand a mini tour in the Recent Results section. Stages should appear with their names, hasResults flags, and league points. Previously the accordion expanded to an empty list.
</verification>

<success_criteria>
- `stageRows` query always runs (no `if (multiStageRaceIds.length > 0)` guard)
- WHERE clause uses `sql\`${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId})\``
- TypeScript compiles without errors
- Mini tour stage list is populated when expanded in Recent Results
</success_criteria>

<output>
After completion, create `.planning/quick/18-fix-league-overview-recent-results-mini-/18-SUMMARY.md`
</output>

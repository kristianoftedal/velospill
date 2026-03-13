---
phase: quick-17
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/league-overview-queries.ts
  - src/app/(main)/leagues/[leagueId]/page.tsx
autonomous: true
requirements: [QUICK-17]

must_haves:
  truths:
    - "Recent Results section shows partially-completed mini tours (at least one stage done)"
    - "Multi-stage races in Recent Results show accumulated points total in the header"
    - "Clicking a multi-stage race row expands to show per-stage breakdown (stage name, pts, Done/Pending badge)"
    - "One-day race results continue to display exactly as before"
    - "Races with zero fantasy points from any team are still included if they have results"
  artifacts:
    - path: "src/lib/league-overview-queries.ts"
      provides: "Updated getRecentRaceResults returning stages[] for multi-stage races"
      contains: "stages"
    - path: "src/app/(main)/leagues/[leagueId]/page.tsx"
      provides: "Expanded Recent Results render handling isMultiStage"
  key_links:
    - from: "getRecentRaceResults"
      to: "raceResults (stage rows)"
      via: "OR EXISTS subquery on child stages"
      pattern: "parentRaceId IS NOT NULL"
    - from: "page.tsx Recent Results section"
      to: "race.stages"
      via: "isMultiStage flag + useState expand set"
---

<objective>
Fix the league overview "Recent Results" section so that partially-completed multi-stage races
(mini tours, grand tours, womens grand tours) appear with their accumulated fantasy points and
a per-stage breakdown, matching the accordion pattern already used in the standings page.

Purpose: Mini tours run over several days. Currently, a mini tour with 3 of 5 stages scored
shows nothing in Recent Results because the parent race row has no direct results yet (only
stages do). Users are left with no visibility until the final classification results are entered.

Output:
- Updated getRecentRaceResults query that includes multi-stage parent races when ANY stage has results
- Updated RecentRaceResult type with optional stages[] and isMultiStage flag
- Updated page.tsx Recent Results render with expand/collapse accordion for multi-stage rows
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key patterns from v1.5 Phase 27 (standings stage accordion):
- MULTI_STAGE_TYPES = Set(['grand_tour','mini_tour','womens_grand_tour']) defined in scoring-queries.ts
- StageScore type: { raceId, raceName, stageNumber, startDate, totalLeaguePoints, hasResults }
- LeagueRaceScoreGrouped type: { raceId, raceName, raceType, startDate, totalLeaguePoints, isMultiStage, stages[], endOfTourPoints }
- Expand state uses Set<number> of raceIds — independent expand/collapse per race
- Expanded content uses colSpan table row with div grid inside TableCell to avoid invalid nested table HTML
- standings-client.tsx lines 177-250: reference accordion pattern for multi-stage table rows
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update getRecentRaceResults to include partial multi-stage races with stage breakdown</name>
  <files>src/lib/league-overview-queries.ts</files>
  <action>
Modify `getRecentRaceResults` in `src/lib/league-overview-queries.ts` to:

1. Change the parent race query to include multi-stage races where at least one stage has results,
   even if the parent race row itself has no direct results. Add an OR condition using a subquery:
   include parent races where `EXISTS (SELECT 1 FROM race_results rr INNER JOIN races s ON s.id = rr."raceId" WHERE s."parentRaceId" = races.id)`.
   Keep `INNER JOIN raceResults` for one-day races (they must have results directly).
   Use a LEFT JOIN + COALESCE for the parent result rows so multi-stage parents with no
   direct results still appear. Filter using:
   `WHERE (raceResults with direct points exist) OR (multi-stage type AND child stage has results)`.

   Concretely: switch the parent query to use a WHERE condition:
   ```
   and(
     isNull(races.parentRaceId),
     lt(races.startDate, new Date()),
     sql`${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId})`,
     sql`(
       EXISTS (SELECT 1 FROM race_results rr
               INNER JOIN draft_picks dp ON dp."riderId" = rr."riderId" AND dp."leagueId" = ${leagueId}
               WHERE rr."raceId" = ${races.id})
       OR
       EXISTS (SELECT 1 FROM race_results rr
               INNER JOIN races s ON s.id = rr."raceId"
               WHERE s."parentRaceId" = ${races.id})
     )`
   )
   ```
   Use LEFT JOIN on raceResults + draftPicks for parent points (multi-stage parents may have 0 points).

2. Add a stage sub-query: after fetching parent rows, fetch stage rows for multi-stage parents
   (same pattern as getLeagueRacesWithScores Query B). For each stage row include:
   `{ raceId, raceName, stageNumber, startDate, totalLeaguePoints, hasResults }`.
   Use LEFT JOIN on raceResults + draftPicks with ownership-at-race-time (pickedAt <= races.startDate).
   `hasResults` = EXISTS (SELECT 1 FROM race_results WHERE raceId = stage.id).

3. Detect multi-stage: `const MULTI_STAGE_TYPES = new Set(["grand_tour", "mini_tour", "womens_grand_tour"])`.
   Import this set inline (do NOT export from scoring-queries — define locally to keep the files independent).

4. Update return type: add `isMultiStage: boolean` and `stages: StageScore[]` to each returned race.
   For one-day races: `isMultiStage: false, stages: []`.
   For multi-stage races: `isMultiStage: true, stages: [...]` sorted by stageNumber ASC.
   `totalPoints` for multi-stage = sum of stage points + parent direct points (end-of-tour).

5. Update the exported `RecentRaceResult` type at the bottom to reflect the new shape.

6. Add necessary imports: `asc` (already imported), `sql` from drizzle-orm (check if already imported),
   and import `races` from schema if not already present (it is already imported).

   The existing imports include: `raceLineups`, `leagueRaces`, `teams`, `races`, `riders`,
   `raceResults`, `draftPicks`, `eq`, `and`, `isNull`, `gt`, `lt`, `lte`, `inArray`, `asc`, `desc`.
   Add `sql` if missing.
  </action>
  <verify>
    <automated>cd /Users/kristianoftedal/dev/velospill && npx tsc --noEmit --project tsconfig.json 2>&1 | grep "league-overview-queries" | head -20</automated>
  </verify>
  <done>
    TypeScript compiles clean for league-overview-queries.ts. RecentRaceResult type has isMultiStage and stages fields.
    getRecentRaceResults returns multi-stage races with partial stage completion.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update Recent Results section in page.tsx to render multi-stage accordion</name>
  <files>src/app/(main)/leagues/[leagueId]/page.tsx</files>
  <action>
The league overview page is a Server Component. The expand/collapse state for multi-stage rows
requires client-side interactivity. Two options:
  (a) Extract the Recent Results section into a new client component `RecentResultsClient`
  (b) Reuse the existing Accordion component (already imported) for multi-stage races

Use option (b) — the Accordion component is already imported and used for Upcoming Races.
Render multi-stage races differently inside the existing `recentResults.map()`:

For `race.isMultiStage === true`:
  - Use an `AccordionItem` with trigger showing: race name, start date badge, total accumulated points
  - Inside `AccordionContent`: render a list of stage rows showing:
    - Stage name (e.g., "Stage 1" or raceName)
    - Points for that stage (from stage.totalLeaguePoints)
    - A Done/Pending badge (stage.hasResults)
    - Only show stages where `hasResults === true` in the points column (show "-" for pending stages)
  - Show "X of Y stages complete" sub-text in trigger area
  - For stages with hasResults, link to `/leagues/${league.id}/standings/${stage.raceId}` (same pattern as standings-client)

For `race.isMultiStage === false` (one-day):
  - Keep EXACT existing render (no change to one-day race display)

The totalPoints shown in the trigger = `race.results.reduce(...)` for one-day races (unchanged).
For multi-stage races, points come from `race.stages.reduce((sum, s) => sum + s.totalLeaguePoints, 0)`
(note: RecentRaceResult for multi-stage won't have per-rider results — the query returns stage breakdowns
instead, so don't attempt `race.results.reduce` for multi-stage races).

Wait — the existing query still returns `results[]` for one-day races. For multi-stage races, the
query now returns stages[] with points but NOT per-rider result rows. Make sure page.tsx handles this:
- One-day: show per-rider results list as before (race.results)
- Multi-stage: show per-stage breakdown (race.stages)

Checklist:
- Import `ChevronDown`, `ChevronRight` from `lucide-react` for expand indicator — OR rely on the
  Accordion component which handles this internally. The shadcn Accordion already includes the chevron.
- Add `Link` href to stage names when hasResults (Link is already imported)
- Add `format` call for stage.startDate — already imported from date-fns
- Ensure `race.stages` type is available via the updated `RecentRaceResult` import (TypeScript will infer)

Do NOT change the imports for `getRecentRaceResults` or `RecentRaceResult` — these are re-exported
from the same file, TypeScript will pick up the new type automatically.
  </action>
  <verify>
    <automated>cd /Users/kristianoftedal/dev/velospill && npx tsc --noEmit --project tsconfig.json 2>&1 | grep -E "page\.tsx|league-overview" | head -20</automated>
  </verify>
  <done>
    TypeScript compiles clean. Recent Results section shows multi-stage races using Accordion with
    per-stage breakdown. One-day race display is unchanged. No new imports needed beyond what's
    already in the file (Accordion, Link, format, Badge are all present).
  </done>
</task>

</tasks>

<verification>
After both tasks:

1. TypeScript full compile check:
   `cd /Users/kristianoftedal/dev/velospill && npx tsc --noEmit 2>&1 | tail -20`

2. Dev server starts without errors:
   `cd /Users/kristianoftedal/dev/velospill && npm run dev` (background check, look for compilation errors)

3. Manual verification: navigate to a league overview page with an in-progress mini tour. The
   Recent Results section should show the mini tour with accumulated points, expandable to show
   completed stages with "Done" badges and pending stages with "Pending" badges.
</verification>

<success_criteria>
- Multi-stage races with at least one completed stage appear in Recent Results
- Accumulated score (sum of completed stage points) shown in accordion trigger
- Per-stage breakdown visible on expand: stage name, points, Done/Pending badge
- Stages with results link to /leagues/[id]/standings/[stageId]
- One-day race results render identically to before
- TypeScript compiles with no new errors
</success_criteria>

<output>
After completion, create `.planning/quick/17-fix-league-overview-recent-results-for-m/17-SUMMARY.md`
</output>

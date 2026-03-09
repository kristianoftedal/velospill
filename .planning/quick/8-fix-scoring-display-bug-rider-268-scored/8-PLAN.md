---
phase: quick
plan: 8
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/diagnose-scoring-bug-268.ts
  - src/lib/scoring-queries.ts
  - src/lib/team-queries.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Rider 268's 10 points from race 9 appear in team 15's total on the standings page for league 7"
    - "Rider 268's 10 points appear in the team 15 profile page breakdown for league 7"
  artifacts:
    - path: "scripts/diagnose-scoring-bug-268.ts"
      provides: "Diagnostic SQL output pinpointing which filter excluded the points"
  key_links:
    - from: "race_results (riderId=268, raceId=9)"
      to: "getLeagueStandings / getTeamSeasonProfile"
      via: "ownership-at-race-time filter AND league_races scoping AND lineupFilter"
      pattern: "races.startDate >= draftPicks.pickedAt"
---

<objective>
Diagnose and fix the scoring display bug where rider 268 scored 10 points in race 9 but those points do not appear in team 15's standings or team profile page for league 7.

Purpose: Points exist in the database (visible for the rider individually) but are excluded by one or more scoring query filters.
Output: Root cause identified, targeted fix applied, standings and team profile show correct totals.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key files:
- src/lib/scoring-queries.ts — getLeagueStandings, lineupFilter, league_races scoping
- src/lib/team-queries.ts — getTeamSeasonProfile (Query 2 uses same ownership + lineup filters)
- src/db/schema/leagues.ts — league_races table (leagueId, raceId)
- src/db/schema/races.ts — races table (parentRaceId for stage hierarchy)
- src/db/schema/draft.ts — draft_picks table (pickedAt for ownership-at-race-time)
- src/db/schema/results.ts — race_results table (riderId, raceId, points, category)
- src/db/schema/lineups.ts — race_lineups table (leagueId, teamId, raceId, riderId)

Known filtering layers (any one of these can silently drop points):
1. Ownership-at-race-time: races.startDate >= draftPicks.pickedAt
   - If rider 268 was transferred to team 15 AFTER race 9's startDate, this excludes the result
2. League race scoping: races.id IN (SELECT "raceId" FROM league_races WHERE "leagueId" = 7)
   - If race 9 is a stage, its parentRaceId must appear in league_races
   - The scoping check allows: race.id matches OR race.parentRaceId matches league_races
3. lineupFilter: If team 15 submitted a lineup for race 9's parent race in league 7,
   rider 268 must appear in race_lineups for that team/race/league
4. Season: races.season must match the league's seasonYear config

The points appear for the rider individually (getRaceScoreBreakdown uses lte(draftPicks.pickedAt, races.startDate) — note: direction is OPPOSITE of standings queries) but not in standings — this asymmetry is the primary clue.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Run diagnostic script to identify which filter excludes rider 268's points</name>
  <files>scripts/diagnose-scoring-bug-268.ts</files>
  <action>
Create a standalone diagnostic script at scripts/diagnose-scoring-bug-268.ts using the project's DB setup (@neondatabase/serverless via src/lib/db.ts) to run targeted SQL that exposes which filter is responsible.

The script should print results for each check:

```typescript
import { db } from "../src/lib/db"
import { sql } from "drizzle-orm"

const RIDER_ID = 268
const RACE_ID = 9
const TEAM_ID = 15
const LEAGUE_ID = 7

async function diagnose() {
  // Check 1: Does the race_result exist?
  const result = await db.execute(sql`
    SELECT id, "raceId", "riderId", category, position, points
    FROM race_results
    WHERE "riderId" = ${RIDER_ID} AND "raceId" = ${RACE_ID}
  `)
  console.log("1. race_result rows:", result.rows)

  // Check 2: Race details — is it a stage? What season? What startDate?
  const race = await db.execute(sql`
    SELECT id, name, "raceType", "startDate", "parentRaceId", season
    FROM races WHERE id = ${RACE_ID}
  `)
  console.log("2. race row:", race.rows)

  // Check 3: Parent race (if stage) — is it in league_races for league 7?
  const parentId = (race.rows[0] as any)?.parentRaceId ?? RACE_ID
  const leagueRaceCheck = await db.execute(sql`
    SELECT "leagueId", "raceId"
    FROM league_races
    WHERE "leagueId" = ${LEAGUE_ID}
      AND "raceId" IN (${RACE_ID}, ${parentId})
  `)
  console.log("3. league_races entries for race/parent:", leagueRaceCheck.rows)

  // Check 4: draft_picks for rider 268 in league 7 — pickedAt vs race startDate
  const picks = await db.execute(sql`
    SELECT dp.id, dp."teamId", dp."leagueId", dp."riderId", dp."pickedAt",
           r."startDate",
           dp."pickedAt" <= r."startDate" AS "pickedBefore",
           dp."pickedAt" > r."startDate" AS "pickedAfterRaceStart"
    FROM draft_picks dp
    CROSS JOIN (SELECT "startDate" FROM races WHERE id = ${RACE_ID}) r
    WHERE dp."riderId" = ${RIDER_ID} AND dp."leagueId" = ${LEAGUE_ID}
  `)
  console.log("4. draft_picks + ownership check:", picks.rows)

  // Check 5: lineup check — did team 15 submit a lineup for the relevant parent race in league 7?
  const lineupExists = await db.execute(sql`
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM race_lineups
      WHERE "leagueId" = ${LEAGUE_ID} AND "teamId" = ${TEAM_ID}
        AND "raceId" = ${parentId}
    ) THEN true ELSE false END AS "lineupExists",
    EXISTS (
      SELECT 1 FROM race_lineups
      WHERE "leagueId" = ${LEAGUE_ID} AND "teamId" = ${TEAM_ID}
        AND "raceId" = ${parentId} AND "riderId" = ${RIDER_ID}
    ) AS "riderInLineup"
  `)
  console.log("5. lineup check:", lineupExists.rows)
}

diagnose().then(() => process.exit(0)).catch(console.error)
```

Run the script: `npx tsx scripts/diagnose-scoring-bug-268.ts`

Read the output and identify the failing check:
- If check 3 shows no rows: race 9 (or its parent) is not in league_races for league 7 → fix: add missing league_races entry via admin or direct INSERT
- If check 4 shows pickedAfterRaceStart=true: rider was picked after the race started (ownership-at-race-time correctly excludes it for standings, but this means the result legitimately should not count) → need to understand if the pick was backdated or if it's a genuine transfer; the fix might be to adjust pickedAt
- If check 5 shows lineupExists=true + riderInLineup=false: rider was not in the submitted lineup → fix: add rider to lineup in race_lineups
  </action>
  <verify>
    <automated>npx tsx scripts/diagnose-scoring-bug-268.ts</automated>
  </verify>
  <done>Script runs without error and prints diagnostic output for all 5 checks, clearly identifying which filter is excluding the 10 points</done>
</task>

<task type="auto">
  <name>Task 2: Apply targeted fix based on diagnostic output</name>
  <files>src/lib/scoring-queries.ts, src/lib/team-queries.ts</files>
  <action>
Based on diagnostic output from Task 1, apply the appropriate fix. The three most likely root causes and their fixes:

**Case A — Missing league_races entry (check 3 fails):**
Race 9 or its parent is not registered in league_races for league 7. This means the league-scoping subquery excludes it.

Fix: Add the missing entry via a one-time migration script or direct SQL:
```sql
INSERT INTO league_races ("leagueId", "raceId") VALUES (7, <parentRaceId or 9>)
ON CONFLICT DO NOTHING;
```
Create this as scripts/fix-league-race-entry.ts and run it. No code changes needed in scoring queries.

**Case B — pickedAt after race startDate (check 4 shows pickedAfterRaceStart=true):**
The draft_picks.pickedAt timestamp for rider 268 in league 7 is LATER than race 9's startDate. This makes the ownership-at-race-time filter correctly exclude the points from standings (the rider was not on team 15 when race 9 happened).

Sub-case: the pick was created by a recent data correction (e.g., admin re-entry or a transfer processed late). Fix: If the pick should be back-dated (because the rider was actually on team 15 during race 9), update pickedAt:
```sql
UPDATE draft_picks SET "pickedAt" = <race9.startDate - 1 day>
WHERE "riderId" = 268 AND "leagueId" = 7;
```
Create scripts/fix-pickedat-268.ts for this. ONLY apply this if the business intent is that the rider was legitimately on team 15 during race 9.

**Case C — Rider not in lineup (check 5 shows lineupExists=true + riderInLineup=false):**
Team 15 submitted a lineup for the race but rider 268 was not included. The lineupFilter correctly excludes riders not in the lineup.

Fix: Insert the rider into race_lineups:
```sql
INSERT INTO race_lineups ("leagueId", "teamId", "raceId", "riderId")
VALUES (7, 15, <parentRaceId>, 268)
ON CONFLICT DO NOTHING;
```
Create scripts/fix-lineup-268.ts for this.

After applying the fix, verify by calling the scoring functions directly:
```typescript
import { getLeagueStandings } from "../src/lib/scoring-queries"
import { getTeamSeasonProfile } from "../src/lib/team-queries"

const standings = await getLeagueStandings(7, 2026)
const team15 = standings.find(s => s.teamId === 15)
console.log("Team 15 standing:", team15)

const profile = await getTeamSeasonProfile(15, 7, 2026)
const rider268 = profile?.riders.find(r => r.riderId === 268)
console.log("Rider 268 in profile:", rider268?.totalPoints)
```

The fix should be a data correction (script), NOT a change to the query logic — the filtering rules are correct. Only modify src/lib/scoring-queries.ts or src/lib/team-queries.ts if the diagnostic reveals an actual code bug (e.g., the league_races subquery condition is subtly wrong for a specific stage hierarchy).
  </action>
  <verify>
    <automated>npx tsx scripts/diagnose-scoring-bug-268.ts</automated>
  </verify>
  <done>
- Rider 268's 10 points from race 9 appear in team 15's total in getLeagueStandings(7, 2026) output
- Rider 268 shows points in getTeamSeasonProfile(15, 7, 2026) rider breakdown
- The fix is documented in the script (which serves as an audit record of what was changed)
  </done>
</task>

</tasks>

<verification>
Run both diagnostic and fix scripts, then verify the league standings page and team profile page in the browser:
- Visit /leagues/6 — team 15 should show updated total (10 points higher)
- Visit /leagues/6/teams/15 — rider 268 should show 10 points for race 9
</verification>

<success_criteria>
Rider 268's 10 points from race 9 appear correctly in:
1. Team 15's standings total on the league 7 standings page
2. Team 15's profile page rider breakdown for league 7
Root cause is documented in the diagnostic script output and fix script comments.
</success_criteria>

<output>
After completion, create `.planning/quick/8-fix-scoring-display-bug-rider-268-scored/8-SUMMARY.md`
</output>

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
  console.log("   (parentId used:", parentId, ")")

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

  // Bonus check: What does the full scoring query see for team 15 / rider 268?
  const scoringCheck = await db.execute(sql`
    SELECT
      dp."riderId",
      dp."teamId",
      dp."pickedAt",
      r.id AS "raceId",
      r.name AS "raceName",
      r."startDate",
      r."parentRaceId",
      r.season,
      rr.points,
      -- ownership-at-race-time check
      r."startDate" >= dp."pickedAt" AS "ownershipOk",
      -- league_races scoping check
      (r.id IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${LEAGUE_ID})
       OR r."parentRaceId" IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${LEAGUE_ID})) AS "leagueScopeOk"
    FROM draft_picks dp
    INNER JOIN race_results rr ON rr."riderId" = dp."riderId" AND rr."raceId" = ${RACE_ID}
    INNER JOIN races r ON r.id = rr."raceId"
    WHERE dp."riderId" = ${RIDER_ID} AND dp."leagueId" = ${LEAGUE_ID} AND dp."teamId" = ${TEAM_ID}
  `)
  console.log("6. Full scoring pipeline check for team 15 / rider 268 / race 9:", scoringCheck.rows)
}

diagnose().then(() => process.exit(0)).catch(console.error)

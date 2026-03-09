/**
 * Fix: Rider 268's pickedAt timestamp in league 7 is 2026-02-28 08:31:16 UTC,
 * which is after race 9 (Omloop Het Nieuwsblad) startDate of 2026-02-28 00:00:00 UTC.
 *
 * The ownership-at-race-time filter (races.startDate >= draftPicks.pickedAt) therefore
 * excludes rider 268's 10 points from team 15's standings total.
 *
 * Root cause: Race startDate is stored as midnight UTC, but the pick was entered
 * at 08:31 UTC on race day — after the midnight timestamp, even though the race
 * itself had not yet started.
 *
 * Fix: Backdate pickedAt to 2026-02-27 23:59:59+00 (1 second before race startDate)
 * so the ownership-at-race-time filter correctly includes the points.
 *
 * Business justification: Rider 268 was legitimately on team 15 at race time.
 * The pick was entered on race day but the system race startDate was midnight UTC.
 */
import { db } from "../src/lib/db"
import { sql } from "drizzle-orm"

const RIDER_ID = 268
const LEAGUE_ID = 7
const RACE_ID = 9
const TEAM_ID = 15

async function fix() {
  // Verify the current state before making changes
  const before = await db.execute(sql`
    SELECT dp.id, dp."teamId", dp."leagueId", dp."riderId", dp."pickedAt",
           r."startDate",
           dp."pickedAt" <= r."startDate" AS "ownershipOk"
    FROM draft_picks dp
    CROSS JOIN (SELECT "startDate" FROM races WHERE id = ${RACE_ID}) r
    WHERE dp."riderId" = ${RIDER_ID} AND dp."leagueId" = ${LEAGUE_ID}
  `)
  console.log("Before fix — draft_pick state:", before.rows)

  // Apply the fix: backdate pickedAt to 1 second before race startDate
  const updateResult = await db.execute(sql`
    UPDATE draft_picks
    SET "pickedAt" = (
      SELECT "startDate" - INTERVAL '1 second'
      FROM races
      WHERE id = ${RACE_ID}
    )
    WHERE "riderId" = ${RIDER_ID}
      AND "leagueId" = ${LEAGUE_ID}
      AND "teamId" = ${TEAM_ID}
    RETURNING id, "riderId", "teamId", "leagueId", "pickedAt"
  `)
  console.log("Updated rows:", updateResult.rows)

  // Verify the fix worked
  const after = await db.execute(sql`
    SELECT dp.id, dp."teamId", dp."leagueId", dp."riderId", dp."pickedAt",
           r."startDate",
           dp."pickedAt" <= r."startDate" AS "ownershipOk"
    FROM draft_picks dp
    CROSS JOIN (SELECT "startDate" FROM races WHERE id = ${RACE_ID}) r
    WHERE dp."riderId" = ${RIDER_ID} AND dp."leagueId" = ${LEAGUE_ID}
  `)
  console.log("After fix — draft_pick state:", after.rows)

  if ((after.rows[0] as any)?.ownershipOk === true) {
    console.log("SUCCESS: ownershipOk is now true — rider 268 will score for team 15 in race 9")
  } else {
    console.log("ERROR: ownershipOk is still false — fix did not work")
  }
}

fix().then(() => process.exit(0)).catch(console.error)

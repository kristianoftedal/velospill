import { db } from "@/lib/db"
import { raceLineups } from "@/db/schema/lineups"
import { races } from "@/db/schema/races"
import { riders } from "@/db/schema/riders"
import { rosterLimits } from "@/db/schema/config"
import { leagueRaces } from "@/db/schema/leagues"
import { eq, and, isNull, sql, count } from "drizzle-orm"

/**
 * Returns riders in a lineup for a specific team/league/race, joined with rider details.
 * If lineupPeriod is provided, only returns riders for that period.
 * If lineupPeriod is undefined, returns all riders (all periods combined).
 */
export async function getLineup(teamId: number, leagueId: number, raceId: number, lineupPeriod?: number | null) {
  const conditions = [
    eq(raceLineups.teamId, teamId),
    eq(raceLineups.leagueId, leagueId),
    eq(raceLineups.raceId, raceId),
  ]
  if (lineupPeriod != null) {
    conditions.push(eq(raceLineups.lineupPeriod, lineupPeriod))
  }

  return db
    .select({
      riderId: raceLineups.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      lineupPeriod: raceLineups.lineupPeriod,
    })
    .from(raceLineups)
    .innerJoin(riders, eq(riders.id, raceLineups.riderId))
    .where(and(...conditions))
    .orderBy(riders.name)
}

/**
 * Returns the roster size limit for a given race, based on its raceType.
 */
export async function getRosterLimitForRace(raceId: number) {
  const result = await db
    .select({
      rosterSize: rosterLimits.rosterSize,
    })
    .from(races)
    .innerJoin(rosterLimits, sql`${rosterLimits.raceType} = ${races.raceType}::text`)
    .where(eq(races.id, raceId))
    .limit(1)

  return result[0]?.rosterSize ?? null
}

/**
 * Returns upcoming parent races for lineup selection.
 * Shows lineup count per team to indicate submission status.
 */
export async function getUpcomingRacesForLineup(leagueId: number, teamId: number) {
  // All races are assumed to start at 13:00 UTC on their start date.
  // A race is visible for lineup selection until 13:00 UTC on race day.

  const lineupCountSubquery = db
    .select({
      raceId: raceLineups.raceId,
      lineupCount: count().as("lineupCount"),
    })
    .from(raceLineups)
    .where(
      and(
        eq(raceLineups.leagueId, leagueId),
        eq(raceLineups.teamId, teamId)
      )
    )
    .groupBy(raceLineups.raceId)
    .as("lineup_counts")

  return db
    .select({
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      rosterSize: rosterLimits.rosterSize,
      lineupCount: sql<number>`COALESCE("lineup_counts"."lineupCount", 0)`,
    })
    .from(races)
    .innerJoin(leagueRaces, and(
      eq(leagueRaces.raceId, races.id),
      eq(leagueRaces.leagueId, leagueId)
    ))
    .leftJoin(rosterLimits, sql`${rosterLimits.raceType} = ${races.raceType}::text`)
    .leftJoin(lineupCountSubquery, eq(lineupCountSubquery.raceId, races.id))
    .where(
      and(
        isNull(races.parentRaceId),
        sql`(
          (date_trunc('day', ${races.startDate} AT TIME ZONE 'Europe/Paris') + interval '13 hours') AT TIME ZONE 'Europe/Paris' > now()
          OR EXISTS (
            SELECT 1 FROM races rest_day
            WHERE rest_day."parentRaceId" = ${races.id}
              AND rest_day."isRestDay" = true
              AND (date_trunc('day', rest_day."startDate" AT TIME ZONE 'Europe/Paris') + interval '13 hours') AT TIME ZONE 'Europe/Paris' > now()
          )
        )`
      )
    )
    .orderBy(races.startDate)
}

/**
 * Boolean check: does a lineup exist for this team/league/race?
 */
export async function hasLineupForRace(teamId: number, leagueId: number, raceId: number) {
  const result = await db
    .select({ cnt: count() })
    .from(raceLineups)
    .where(
      and(
        eq(raceLineups.teamId, teamId),
        eq(raceLineups.leagueId, leagueId),
        eq(raceLineups.raceId, raceId)
      )
    )

  return (result[0]?.cnt ?? 0) > 0
}

export type LineupEntry = Awaited<ReturnType<typeof getLineup>>[number]
export type UpcomingRaceForLineup = Awaited<ReturnType<typeof getUpcomingRacesForLineup>>[number]

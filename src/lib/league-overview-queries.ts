import { db } from "@/lib/db"
import { raceLineups } from "@/db/schema/lineups"
import { leagueRaces, teams } from "@/db/schema/leagues"
import { races } from "@/db/schema/races"
import { riders } from "@/db/schema/riders"
import { raceResults } from "@/db/schema/results"
import { draftPicks } from "@/db/schema/draft"
import { eq, and, isNull, gt, lt, lte, inArray, asc, desc } from "drizzle-orm"

/**
 * Returns upcoming parent races for this league (startDate > now), ordered ASC, limit 5.
 * For each race, returns all teams in the league and their submitted lineups.
 */
export async function getUpcomingRacesWithLineups(leagueId: number) {
  // 1. Query upcoming parent races assigned to this league
  const upcomingRaceRows = await db
    .select({
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
    })
    .from(races)
    .innerJoin(leagueRaces, and(
      eq(leagueRaces.raceId, races.id),
      eq(leagueRaces.leagueId, leagueId)
    ))
    .where(and(
      isNull(races.parentRaceId),
      gt(races.startDate, new Date())
    ))
    .orderBy(asc(races.startDate))
    .limit(5)

  if (upcomingRaceRows.length === 0) return []

  const raceIds = upcomingRaceRows.map((r) => r.raceId)

  // 2. Query all teams in the league
  const leagueTeams = await db
    .select({ teamId: teams.id, teamName: teams.name })
    .from(teams)
    .where(eq(teams.leagueId, leagueId))

  // 3. Query all lineup entries for these races in this league
  const lineupRows = await db
    .select({
      raceId: raceLineups.raceId,
      teamId: raceLineups.teamId,
      teamName: teams.name,
      riderId: riders.id,
      riderName: riders.name,
      riderTeam: riders.team,
    })
    .from(raceLineups)
    .innerJoin(riders, eq(riders.id, raceLineups.riderId))
    .innerJoin(teams, eq(teams.id, raceLineups.teamId))
    .where(and(
      eq(raceLineups.leagueId, leagueId),
      inArray(raceLineups.raceId, raceIds)
    ))

  // 4. Build Map<raceId, Map<teamId, riders[]>>
  const raceTeamMap = new Map<number, Map<number, { riderId: number; riderName: string; riderTeam: string }[]>>()
  for (const row of lineupRows) {
    if (!raceTeamMap.has(row.raceId)) {
      raceTeamMap.set(row.raceId, new Map())
    }
    const teamMap = raceTeamMap.get(row.raceId)!
    if (!teamMap.has(row.teamId)) {
      teamMap.set(row.teamId, [])
    }
    teamMap.get(row.teamId)!.push({
      riderId: row.riderId,
      riderName: row.riderName,
      riderTeam: row.riderTeam,
    })
  }

  // 5. Build the final nested structure
  return upcomingRaceRows.map((race) => {
    const teamMap = raceTeamMap.get(race.raceId) ?? new Map()
    return {
      raceId: race.raceId,
      raceName: race.raceName,
      raceType: race.raceType,
      startDate: race.startDate,
      teams: leagueTeams.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        riders: teamMap.get(team.teamId) ?? [],
      })),
    }
  })
}

/**
 * Returns the 3 most recently completed parent races for this league that have results,
 * with each rider result tagged with their fantasy team name (ownership-at-race-time).
 * Only includes riders who have a draft pick in this league (unowned riders excluded).
 */
export async function getRecentRaceResults(leagueId: number) {
  // 1. Query completed parent races assigned to this league
  const completedRaceRows = await db
    .select({
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
    })
    .from(races)
    .innerJoin(leagueRaces, and(
      eq(leagueRaces.raceId, races.id),
      eq(leagueRaces.leagueId, leagueId)
    ))
    .where(and(
      isNull(races.parentRaceId),
      lt(races.startDate, new Date())
    ))
    .orderBy(desc(races.startDate))
    .limit(3)

  if (completedRaceRows.length === 0) return []

  const raceIds = completedRaceRows.map((r) => r.raceId)

  // 2. Query race results with ownership-at-race-time (inner join on draftPicks)
  const resultRows = await db
    .select({
      raceId: raceResults.raceId,
      position: raceResults.position,
      points: raceResults.points,
      riderId: riders.id,
      riderName: riders.name,
      riderTeam: riders.team,
      fantasyTeamId: teams.id,
      fantasyTeamName: teams.name,
    })
    .from(raceResults)
    .innerJoin(riders, eq(riders.id, raceResults.riderId))
    .innerJoin(races, eq(races.id, raceResults.raceId))
    .innerJoin(
      draftPicks,
      and(
        eq(draftPicks.riderId, raceResults.riderId),
        eq(draftPicks.leagueId, leagueId),
        lte(draftPicks.pickedAt, races.startDate) // ownership-at-race-time
      )
    )
    .innerJoin(teams, eq(teams.id, draftPicks.teamId))
    .where(inArray(raceResults.raceId, raceIds))
    .orderBy(asc(raceResults.raceId), asc(raceResults.position))

  // 3. Build nested structure grouped by raceId
  const raceResultMap = new Map<number, {
    riderId: number
    riderName: string
    riderTeam: string
    position: number
    points: number
    fantasyTeamId: number
    fantasyTeamName: string
  }[]>()
  for (const row of resultRows) {
    if (!raceResultMap.has(row.raceId)) {
      raceResultMap.set(row.raceId, [])
    }
    raceResultMap.get(row.raceId)!.push({
      riderId: row.riderId,
      riderName: row.riderName,
      riderTeam: row.riderTeam,
      position: row.position,
      points: row.points,
      fantasyTeamId: row.fantasyTeamId,
      fantasyTeamName: row.fantasyTeamName,
    })
  }

  return completedRaceRows.map((race) => ({
    raceId: race.raceId,
    raceName: race.raceName,
    raceType: race.raceType,
    startDate: race.startDate,
    results: raceResultMap.get(race.raceId) ?? [],
  }))
}

export type UpcomingRaceWithLineups = Awaited<ReturnType<typeof getUpcomingRacesWithLineups>>[number]
export type RecentRaceResult = Awaited<ReturnType<typeof getRecentRaceResults>>[number]

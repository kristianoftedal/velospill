import { db } from "@/lib/db"
import { raceLineups } from "@/db/schema/lineups"
import { leagueRaces, teams } from "@/db/schema/leagues"
import { races } from "@/db/schema/races"
import { riders } from "@/db/schema/riders"
import { raceResults } from "@/db/schema/results"
import { draftPicks } from "@/db/schema/draft"
import { eq, and, isNull, gt, lt, lte, inArray, asc, desc, sql } from "drizzle-orm"

// Multi-stage race type values — defined locally so this file stays independent of scoring-queries
const MULTI_STAGE_TYPES = new Set(["grand_tour", "mini_tour", "womens_grand_tour"])

export type StageScore = {
  raceId: number
  raceName: string
  stageNumber: number | null
  startDate: Date
  totalLeaguePoints: number
  hasResults: boolean
}

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
  const emptyTeamMap = new Map<number, { riderId: number; riderName: string; riderTeam: string }[]>()
  return upcomingRaceRows.map((race) => {
    const teamMap = raceTeamMap.get(race.raceId) ?? emptyTeamMap
    return {
      raceId: race.raceId,
      raceName: race.raceName,
      raceType: race.raceType,
      startDate: race.startDate,
      teams: leagueTeams.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        riders: teamMap.get(team.teamId) ?? ([] as { riderId: number; riderName: string; riderTeam: string }[]),
      })),
    }
  })
}

/**
 * Returns the 3 most recently started parent races for this league that have results
 * (direct results for one-day races, or at least one stage result for multi-stage races).
 * Multi-stage races include a stages[] breakdown with per-stage points and a Done/Pending flag.
 * One-day races include a results[] array of per-rider results.
 * Ownership-at-race-time: uses draftPicks.pickedAt <= races.startDate.
 */
export async function getRecentRaceResults(leagueId: number) {
  // Query 1: parent races assigned to this league that have started AND have at least one result
  // (direct results OR a child stage with results for multi-stage races).
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
      lt(races.startDate, new Date()),
      sql`(
        EXISTS (
          SELECT 1 FROM race_results rr
          INNER JOIN draft_picks dp ON dp."riderId" = rr."riderId" AND dp."leagueId" = ${leagueId}
          WHERE rr."raceId" = ${races.id}
        )
        OR
        EXISTS (
          SELECT 1 FROM race_results rr
          INNER JOIN races s ON s.id = rr."raceId"
          WHERE s."parentRaceId" = ${races.id}
        )
      )`
    ))
    .orderBy(desc(races.startDate))
    .limit(3)

  if (completedRaceRows.length === 0) return []

  const raceIds = completedRaceRows.map((r) => r.raceId)

  // Query 2: per-rider results for one-day races (we only use these for non-multi-stage races)
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

  // Query 3: stage rows for multi-stage parent races — per-stage league points and hasResults flag
  const multiStageRaceIds = completedRaceRows
    .filter((r) => MULTI_STAGE_TYPES.has(r.raceType))
    .map((r) => r.raceId)

  let stageRows: {
    raceId: number
    raceName: string
    stageNumber: number | null
    startDate: Date
    parentRaceId: number | null
    totalLeaguePoints: number
    hasResults: boolean
  }[] = []

  if (multiStageRaceIds.length > 0) {
    stageRows = await db
      .select({
        raceId: races.id,
        raceName: races.name,
        stageNumber: races.stageNumber,
        startDate: races.startDate,
        parentRaceId: races.parentRaceId,
        totalLeaguePoints: sql<number>`COALESCE(SUM(CASE WHEN ${draftPicks.id} IS NOT NULL THEN ${raceResults.points} ELSE 0 END), 0)`,
        hasResults: sql<boolean>`EXISTS (SELECT 1 FROM race_results rr WHERE rr."raceId" = ${races.id})`,
      })
      .from(races)
      .leftJoin(raceResults, eq(raceResults.raceId, races.id))
      .leftJoin(
        draftPicks,
        and(
          eq(draftPicks.riderId, raceResults.riderId),
          eq(draftPicks.leagueId, leagueId),
          lte(draftPicks.pickedAt, races.startDate) // ownership-at-race-time
        )
      )
      .where(
        and(
          sql`${races.parentRaceId} IS NOT NULL`,
          inArray(races.parentRaceId, multiStageRaceIds)
        )
      )
      .groupBy(races.id, races.name, races.stageNumber, races.startDate, races.parentRaceId)
      .orderBy(asc(races.stageNumber), asc(races.startDate))
  }

  // Application-side assembly

  // Build one-day results map keyed by raceId
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

  // Build stage map keyed by parentRaceId
  const stagesByParent = new Map<number, StageScore[]>()
  for (const row of stageRows) {
    if (row.parentRaceId == null) continue
    const parentId = Number(row.parentRaceId)
    if (!stagesByParent.has(parentId)) stagesByParent.set(parentId, [])
    stagesByParent.get(parentId)!.push({
      raceId: row.raceId,
      raceName: row.raceName,
      stageNumber: row.stageNumber,
      startDate: row.startDate,
      totalLeaguePoints: Number(row.totalLeaguePoints),
      hasResults: Boolean(row.hasResults),
    })
  }

  return completedRaceRows.map((race) => {
    const isMultiStage = MULTI_STAGE_TYPES.has(race.raceType)
    if (isMultiStage) {
      const stages = stagesByParent.get(race.raceId) ?? []
      // For multi-stage races the parent row may also have end-of-tour classification points
      const parentDirectPoints = raceResultMap.get(race.raceId)?.reduce((sum, r) => sum + r.points, 0) ?? 0
      const stagePointsTotal = stages.reduce((sum, s) => sum + s.totalLeaguePoints, 0)
      return {
        raceId: race.raceId,
        raceName: race.raceName,
        raceType: race.raceType,
        startDate: race.startDate,
        isMultiStage: true as const,
        totalPoints: stagePointsTotal + parentDirectPoints,
        results: [] as {
          riderId: number; riderName: string; riderTeam: string;
          position: number; points: number; fantasyTeamId: number; fantasyTeamName: string
        }[],
        stages,
      }
    }
    const results = raceResultMap.get(race.raceId) ?? []
    return {
      raceId: race.raceId,
      raceName: race.raceName,
      raceType: race.raceType,
      startDate: race.startDate,
      isMultiStage: false as const,
      totalPoints: results.reduce((sum, r) => sum + r.points, 0),
      results,
      stages: [] as StageScore[],
    }
  })
}

export type UpcomingRaceWithLineups = Awaited<ReturnType<typeof getUpcomingRacesWithLineups>>[number]
export type RecentRaceResult = Awaited<ReturnType<typeof getRecentRaceResults>>[number]

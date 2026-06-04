import { db } from "@/lib/db"
import { raceLineups } from "@/db/schema/lineups"
import { leagueRaces, teams } from "@/db/schema/leagues"
import { races } from "@/db/schema/races"
import { riders } from "@/db/schema/riders"
import { raceResults } from "@/db/schema/results"
import { rosterEvents } from "@/db/schema/roster-events"
import { eq, and, isNull, gt, lt, lte, inArray, asc, desc, sql } from "drizzle-orm"
const START_EVENT_TYPES = ["drafted", "transferred_in"] as const
import { ownershipAtRaceTime } from "./roster-ownership"

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

export type RecentRider = {
  riderId: number
  riderName: string
  riderTeam: string
  points: number
}

export type RecentBonus = {
  label: string
  points: number
}

export type RecentTeamResult = {
  fantasyTeamId: number
  fantasyTeamName: string
  teamPoints: number
  riders: RecentRider[]
  bonuses: RecentBonus[]
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
 * Ownership-at-race-time: uses roster_events via ownershipAtRaceTime helper.
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

  // Query 2: lineup composition for one-day races — every rider each team lined up,
  // so all lined-up riders appear even if they scored nothing. Points are attached
  // later from the order-adjusted breakdown so they match standings exactly.
  const lineupRows = await db
    .select({
      raceId: raceLineups.raceId,
      riderId: riders.id,
      riderName: riders.name,
      riderTeam: riders.team,
      fantasyTeamId: teams.id,
      fantasyTeamName: teams.name,
    })
    .from(raceLineups)
    .innerJoin(riders, eq(riders.id, raceLineups.riderId))
    .innerJoin(teams, eq(teams.id, raceLineups.teamId))
    .where(and(
      eq(raceLineups.leagueId, leagueId),
      inArray(raceLineups.raceId, raceIds)
    ))
    .orderBy(asc(raceLineups.raceId), asc(teams.name))

  // Query 3: stage rows for multi-stage parent races — per-stage league points and hasResults flag
  const stageRows = await db
    .select({
      raceId: races.id,
      raceName: races.name,
      stageNumber: races.stageNumber,
      startDate: races.startDate,
      parentRaceId: races.parentRaceId,
      totalLeaguePoints: sql<number>`COALESCE(SUM(CASE WHEN ${rosterEvents.id} IS NOT NULL THEN ${raceResults.points} ELSE 0 END), 0)`,
      hasResults: sql<boolean>`EXISTS (SELECT 1 FROM race_results rr WHERE rr."raceId" = ${races.id})`,
    })
    .from(races)
    .leftJoin(raceResults, eq(raceResults.raceId, races.id))
    .leftJoin(
      rosterEvents,
      and(
        eq(rosterEvents.riderId, raceResults.riderId),
        eq(rosterEvents.leagueId, leagueId),
        inArray(rosterEvents.eventType, [...START_EVENT_TYPES]),
        ownershipAtRaceTime(leagueId, sql`${rosterEvents.teamId}`, sql`${raceResults.riderId}`, sql`${races.startDate}`)
      )
    )
    .where(
      and(
        sql`${races.parentRaceId} IS NOT NULL`,
        sql`${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId})`
      )
    )
    .groupBy(races.id, races.name, races.stageNumber, races.startDate, races.parentRaceId)
    .orderBy(asc(races.stageNumber), asc(races.startDate))

  // Application-side assembly

  // Build lineup map keyed by raceId -> teamId -> team + riders (points filled in below)
  const lineupByRace = new Map<number, Map<number, { teamName: string; riders: RecentRider[] }>>()
  const riderNameById = new Map<number, string>()
  for (const row of lineupRows) {
    riderNameById.set(row.riderId, row.riderName)
    if (!lineupByRace.has(row.raceId)) lineupByRace.set(row.raceId, new Map())
    const teamMap = lineupByRace.get(row.raceId)!
    if (!teamMap.has(row.fantasyTeamId)) {
      teamMap.set(row.fantasyTeamId, { teamName: row.fantasyTeamName, riders: [] })
    }
    teamMap.get(row.fantasyTeamId)!.riders.push({
      riderId: row.riderId,
      riderName: row.riderName,
      riderTeam: row.riderTeam,
      points: 0,
    })
  }

  // Fetch order-adjusted breakdowns for one-day races — the same path standings uses,
  // so per-team totals (base points + order effects + bonuses) match standings exactly.
  const { getRaceScoreBreakdownWithOrders } = await import("./scoring-queries")
  const oneDayRaceIds = completedRaceRows
    .filter((r) => !MULTI_STAGE_TYPES.has(r.raceType))
    .map((r) => r.raceId)
  const breakdownByRace = new Map<
    number,
    Awaited<ReturnType<typeof getRaceScoreBreakdownWithOrders>>["entries"]
  >()
  await Promise.all(
    oneDayRaceIds.map(async (rid) => {
      const { entries } = await getRaceScoreBreakdownWithOrders(rid, leagueId)
      breakdownByRace.set(rid, entries)
    })
  )

  // Assemble per-team results for a one-day race: lineup riders carry their
  // order-adjusted points; bonus rows (admin bonuses, Gammel Venn) are listed separately;
  // teamPoints is the authoritative sum of all breakdown entries for that team.
  function buildOneDayTeams(raceId: number): RecentTeamResult[] {
    const teamMap =
      lineupByRace.get(raceId) ?? new Map<number, { teamName: string; riders: RecentRider[] }>()
    const entries = breakdownByRace.get(raceId) ?? []

    const riderPoints = new Map<string, number>() // `${teamId}:${riderId}` -> adjusted (non-bonus)
    const bonusByTeam = new Map<number, RecentBonus[]>()
    const teamTotals = new Map<number, number>()
    const teamNameById = new Map<number, string>()

    for (const e of entries) {
      teamNameById.set(e.teamId, e.teamName)
      teamTotals.set(e.teamId, (teamTotals.get(e.teamId) ?? 0) + e.adjustedPoints)
      if (e.isBonus) {
        const label =
          e.riderId > 0
            ? `Gammel Venn — ${riderNameById.get(e.riderId) ?? e.riderName}`
            : e.riderName || e.orderEffect || "Bonus"
        const arr = bonusByTeam.get(e.teamId) ?? []
        arr.push({ label, points: e.adjustedPoints })
        bonusByTeam.set(e.teamId, arr)
      } else {
        const k = `${e.teamId}:${e.riderId}`
        riderPoints.set(k, (riderPoints.get(k) ?? 0) + e.adjustedPoints)
      }
    }

    const teamIds = new Set<number>([...teamMap.keys(), ...teamNameById.keys()])
    const result: RecentTeamResult[] = []
    for (const teamId of teamIds) {
      const lineup = teamMap.get(teamId)
      const riders: RecentRider[] = (lineup?.riders ?? [])
        .map((r) => ({ ...r, points: riderPoints.get(`${teamId}:${r.riderId}`) ?? 0 }))
        .sort((a, b) => b.points - a.points)
      result.push({
        fantasyTeamId: teamId,
        fantasyTeamName: lineup?.teamName ?? teamNameById.get(teamId) ?? `Team ${teamId}`,
        teamPoints: teamTotals.get(teamId) ?? 0,
        riders,
        bonuses: bonusByTeam.get(teamId) ?? [],
      })
    }
    return result.sort((a, b) => b.teamPoints - a.teamPoints)
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
      const stagePointsTotal = stages.reduce((sum, s) => sum + s.totalLeaguePoints, 0)
      return {
        raceId: race.raceId,
        raceName: race.raceName,
        raceType: race.raceType,
        startDate: race.startDate,
        isMultiStage: true as const,
        totalPoints: stagePointsTotal,
        teams: [] as RecentTeamResult[],
        stages,
      }
    }
    const teamResults = buildOneDayTeams(race.raceId)
    return {
      raceId: race.raceId,
      raceName: race.raceName,
      raceType: race.raceType,
      startDate: race.startDate,
      isMultiStage: false as const,
      totalPoints: teamResults.reduce((sum, t) => sum + t.teamPoints, 0),
      teams: teamResults,
      stages: [] as StageScore[],
    }
  })
}

export type UpcomingRaceWithLineups = Awaited<ReturnType<typeof getUpcomingRacesWithLineups>>[number]
export type RecentRaceResult = Awaited<ReturnType<typeof getRecentRaceResults>>[number]

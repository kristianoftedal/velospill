import { db } from "@/lib/db"
import { draftPicks } from "@/db/schema/draft"
import { teams, leagueRaces } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { raceResults } from "@/db/schema/results"
import { races } from "@/db/schema/races"
import { raceLineups } from "@/db/schema/lineups"
import { bonusRiders } from "@/db/schema/bonus-riders"
import { eq, desc, sql, and, asc, gte, lte, or, isNull } from "drizzle-orm"

/**
 * Lineup filter: if a lineup exists for this team/race, only riders in the lineup score.
 * If no lineup exists, all riders score (backward compatible).
 * For stages, the lineup is looked up using the parent race ID.
 */
const lineupFilter = sql`(
  NOT EXISTS (
    SELECT 1 FROM ${raceLineups}
    WHERE ${raceLineups.leagueId} = ${draftPicks.leagueId}
      AND ${raceLineups.teamId} = ${draftPicks.teamId}
      AND ${raceLineups.raceId} = COALESCE(${races.parentRaceId}, ${races.id})
  )
  OR EXISTS (
    SELECT 1 FROM ${raceLineups}
    WHERE ${raceLineups.leagueId} = ${draftPicks.leagueId}
      AND ${raceLineups.teamId} = ${draftPicks.teamId}
      AND ${raceLineups.raceId} = COALESCE(${races.parentRaceId}, ${races.id})
      AND ${raceLineups.riderId} = ${draftPicks.riderId}
  )
)`

// Points are pre-calculated at result entry time. Phase 5 only aggregates stored points.
// Ownership-at-race-time: points stay with the team that owned the rider when the race took place.
// This is implemented by filtering race results where races.startDate >= draftPicks.pickedAt.
// For original draft picks, pickedAt is the draft timestamp (before any races), so all results flow through.
// For transferred riders, only results from races on/after the transfer date count for the new team.
//
// TdF-specific scoring (grand_tour_tdf) is handled at result entry time in scoring-preview.ts.
// This file aggregates pre-calculated points and does not need race-name-aware config lookups.

/**
 * Returns all teams in a league ranked by total fantasy points for the given season.
 * Uses LEFT JOIN so teams with zero points still appear in the standings.
 * Multi-tenant: draftPicks join is scoped by both teamId and leagueId.
 * Season scoping: races join filters by races.season so only race results from the
 * correct season contribute to points.
 * Ownership-at-race-time: races join filters by races.startDate >= draftPicks.pickedAt
 * so transferred riders' pre-transfer points stay with the original team.
 */
export async function getLeagueStandings(leagueId: number, season: number) {
  const rows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      userId: teams.userId,
      totalPoints: sql<number>`COALESCE(SUM(CASE WHEN ${races.id} IS NOT NULL AND ${lineupFilter} THEN ${raceResults.points} ELSE 0 END), 0)`,
    })
    .from(teams)
    .leftJoin(
      draftPicks,
      and(
        eq(draftPicks.teamId, teams.id),
        eq(draftPicks.leagueId, leagueId)
      )
    )
    .leftJoin(raceResults, eq(raceResults.riderId, draftPicks.riderId))
    .leftJoin(
      races,
      and(
        eq(races.id, raceResults.raceId),
        eq(races.season, season),
        gte(races.startDate, draftPicks.pickedAt),  // ownership-at-race-time
        or(isNull(draftPicks.droppedAt), gte(draftPicks.droppedAt, races.startDate)),  // include pre-drop race results
        sql`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}) OR ${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))`
      )
    )
    .where(eq(teams.leagueId, leagueId))
    .groupBy(teams.id, teams.name, teams.userId)
    .orderBy(desc(sql`COALESCE(SUM(CASE WHEN ${races.id} IS NOT NULL AND ${lineupFilter} THEN ${raceResults.points} ELSE 0 END), 0)`))

  // Derive rank with tie handling
  const ranked: LeagueStanding[] = rows.map((row, i) => {
    let rank = i + 1
    if (i > 0 && rows[i].totalPoints === rows[i - 1].totalPoints) {
      rank = (rows[i - 1] as LeagueStanding).rank
    }
    return {
      teamId: row.teamId,
      teamName: row.teamName,
      userId: row.userId,
      totalPoints: Number(row.totalPoints),
      rank,
    }
  })

  // Add bonus rider points for Uno-X order
  // Bonus riders score points only for the specific GT (parent race) they were picked for
  const bonusPointsRows = await db
    .select({
      teamId: bonusRiders.teamId,
      bonusPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
    })
    .from(bonusRiders)
    .innerJoin(raceResults, eq(raceResults.riderId, bonusRiders.riderId))
    .innerJoin(races, eq(races.id, raceResults.raceId))
    .where(
      and(
        eq(bonusRiders.leagueId, leagueId),
        eq(races.season, season),
        // Bonus rider scores include both the parent race itself and all its stages
        or(
          eq(races.id, bonusRiders.raceId),
          eq(races.parentRaceId, bonusRiders.raceId)
        ),
        // League race scoping
        sql`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}) OR ${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))`
      )
    )
    .groupBy(bonusRiders.teamId)

  // Merge bonus points into standings
  const bonusPointsMap = new Map<number, number>()
  for (const row of bonusPointsRows) {
    bonusPointsMap.set(row.teamId, Number(row.bonusPoints))
  }

  // Add bonus points to each standing
  const standingsWithBonus = ranked.map((standing) => ({
    ...standing,
    totalPoints: standing.totalPoints + (bonusPointsMap.get(standing.teamId) ?? 0),
  }))

  // Re-sort by totalPoints DESC
  standingsWithBonus.sort((a, b) => b.totalPoints - a.totalPoints)

  // Re-derive ranks with tie handling
  for (let i = 0; i < standingsWithBonus.length; i++) {
    if (i === 0) {
      standingsWithBonus[i].rank = 1
    } else if (standingsWithBonus[i].totalPoints === standingsWithBonus[i - 1].totalPoints) {
      standingsWithBonus[i].rank = standingsWithBonus[i - 1].rank
    } else {
      standingsWithBonus[i].rank = i + 1
    }
  }

  return standingsWithBonus
}

/**
 * Returns riders for a specific team with their aggregated fantasy points for the season.
 * Filters draftPicks by both teamId and leagueId for multi-tenant isolation.
 * Season scoping: races join filters by races.season.
 * Ownership-at-race-time: races join filters by races.startDate >= draftPicks.pickedAt
 * so pre-transfer race results are not credited to the new team.
 * Used in the "My Team" tab on the standings page.
 */
export async function getTeamRiderScores(teamId: number, leagueId: number, season: number) {
  const rows = await db
    .select({
      riderId: draftPicks.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      totalPoints: sql<number>`COALESCE(SUM(CASE WHEN ${races.id} IS NOT NULL AND ${lineupFilter} THEN ${raceResults.points} ELSE 0 END), 0)`,
    })
    .from(draftPicks)
    .innerJoin(riders, eq(riders.id, draftPicks.riderId))
    .leftJoin(raceResults, eq(raceResults.riderId, draftPicks.riderId))
    .leftJoin(
      races,
      and(
        eq(races.id, raceResults.raceId),
        eq(races.season, season),
        gte(races.startDate, draftPicks.pickedAt),  // ownership-at-race-time
        sql`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}) OR ${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))`
      )
    )
    .where(
      and(
        eq(draftPicks.teamId, teamId),
        eq(draftPicks.leagueId, leagueId),
        isNull(draftPicks.droppedAt)  // only show active (non-dropped) riders on the roster display
      )
    )
    .groupBy(draftPicks.riderId, riders.name, riders.team, riders.gender)
    .orderBy(desc(sql`COALESCE(SUM(CASE WHEN ${races.id} IS NOT NULL AND ${lineupFilter} THEN ${raceResults.points} ELSE 0 END), 0)`))

  const draftedRiders = rows.map((row) => ({
    riderId: row.riderId,
    riderName: row.riderName,
    riderTeam: row.riderTeam,
    gender: row.gender,
    totalPoints: Number(row.totalPoints),
    isBonus: false,
  }))

  // Add bonus riders for this team
  const bonusRidersRows = await db
    .select({
      riderId: bonusRiders.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      totalPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
    })
    .from(bonusRiders)
    .innerJoin(riders, eq(riders.id, bonusRiders.riderId))
    .leftJoin(raceResults, eq(raceResults.riderId, bonusRiders.riderId))
    .leftJoin(races, eq(races.id, raceResults.raceId))
    .where(
      and(
        eq(bonusRiders.teamId, teamId),
        eq(bonusRiders.leagueId, leagueId),
        // Only include results from the season and for the specific GT
        or(
          and(
            eq(races.season, season),
            or(
              eq(races.id, bonusRiders.raceId),
              eq(races.parentRaceId, bonusRiders.raceId)
            ),
            sql`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}) OR ${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))`
          ),
          sql`FALSE`  // fallback to handle NULL race results
        )
      )
    )
    .groupBy(bonusRiders.riderId, riders.name, riders.team, riders.gender)

  const bonusRidersScores = bonusRidersRows.map((row) => ({
    riderId: row.riderId,
    riderName: row.riderName,
    riderTeam: row.riderTeam,
    gender: row.gender,
    totalPoints: Number(row.totalPoints),
    isBonus: true,
  }))

  // Combine drafted riders and bonus riders, sort by total points DESC
  const allRiders = [...draftedRiders, ...bonusRidersScores]
  allRiders.sort((a, b) => b.totalPoints - a.totalPoints)

  return allRiders satisfies TeamRiderScore[]
}

export type LeagueStanding = {
  teamId: number
  teamName: string
  userId: string
  totalPoints: number
  rank: number
}

export type TeamRiderScore = {
  riderId: number
  riderName: string
  riderTeam: string
  gender: "M" | "F"
  totalPoints: number
  isBonus?: boolean
}

/**
 * Returns all drafted riders who have results in a given race for a given league.
 * Shows position, points, rider name, rider's pro team, and the fantasy team that drafted them.
 * Multi-tenant: draftPicks join is scoped by leagueId.
 * Ownership-at-race-time: draftPicks join filters by draftPicks.pickedAt <= races.startDate
 * so only the team that owned the rider at race time gets credit in the breakdown.
 * Sorted by position ASC.
 */
export async function getRaceScoreBreakdown(raceId: number, leagueId: number) {
  const rows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      riderId: riders.id,
      riderName: riders.name,
      riderTeam: riders.team,
      nationality: riders.nationality,
      position: raceResults.position,
      points: raceResults.points,
    })
    .from(raceResults)
    .innerJoin(riders, eq(riders.id, raceResults.riderId))
    .innerJoin(races, eq(races.id, raceResults.raceId))
    .innerJoin(
      draftPicks,
      and(
        eq(draftPicks.riderId, raceResults.riderId),
        eq(draftPicks.leagueId, leagueId),
        lte(draftPicks.pickedAt, races.startDate),  // ownership-at-race-time
        or(isNull(draftPicks.droppedAt), gte(draftPicks.droppedAt, races.startDate))  // include pre-drop race results
      )
    )
    .innerJoin(teams, eq(teams.id, draftPicks.teamId))
    .where(and(eq(raceResults.raceId, raceId), lineupFilter))
    .orderBy(asc(raceResults.position))

  const draftedRiderEntries = rows.map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    riderId: row.riderId,
    riderName: row.riderName,
    riderTeam: row.riderTeam,
    riderNationality: row.nationality,
    position: row.position,
    points: row.points,
  }))

  // Add bonus riders for this race (or parent race if this is a stage)
  // Check if any bonus riders scored in this race
  const bonusRiderRows = await db
    .select({
      teamId: bonusRiders.teamId,
      teamName: teams.name,
      riderId: bonusRiders.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      nationality: riders.nationality,
      position: raceResults.position,
      points: raceResults.points,
    })
    .from(bonusRiders)
    .innerJoin(teams, eq(teams.id, bonusRiders.teamId))
    .innerJoin(riders, eq(riders.id, bonusRiders.riderId))
    .innerJoin(raceResults, eq(raceResults.riderId, bonusRiders.riderId))
    .innerJoin(races, eq(races.id, raceResults.raceId))
    .where(
      and(
        eq(bonusRiders.leagueId, leagueId),
        eq(raceResults.raceId, raceId),
        // Bonus rider must have been picked for this race (if parent) or the parent of this race (if stage)
        or(
          eq(bonusRiders.raceId, raceId),
          eq(bonusRiders.raceId, races.parentRaceId)
        )
      )
    )
    .orderBy(asc(raceResults.position))

  const bonusRiderEntries = bonusRiderRows.map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    riderId: row.riderId,
    riderName: row.riderName,
    riderTeam: row.riderTeam,
    riderNationality: row.nationality,
    position: row.position,
    points: row.points,
  }))

  // Combine and sort by position
  const allEntries = [...draftedRiderEntries, ...bonusRiderEntries]
  allEntries.sort((a, b) => a.position - b.position)

  return allEntries satisfies RaceScoreEntry[]
}

// Multi-stage race type values — used to determine if a race needs stage grouping
const MULTI_STAGE_TYPES = new Set(["grand_tour", "mini_tour", "womens_grand_tour"])

export type StageScore = {
  raceId: number
  raceName: string
  stageNumber: number | null
  startDate: Date
  totalLeaguePoints: number
  hasResults: boolean
}

export type LeagueRaceScoreGrouped = {
  raceId: number
  raceName: string
  raceType: string
  startDate: Date
  totalLeaguePoints: number  // sum of stages + endOfTour
  isMultiStage: boolean      // true for grand_tour, mini_tour, womens_grand_tour
  stages: StageScore[]       // empty for one-day races
  endOfTourPoints: number    // points from results on the parent race row itself (not a stage)
}

/**
 * Returns all parent races in a given season where at least one rider from the league has results.
 * Multi-stage races (grand_tour, mini_tour, womens_grand_tour) are returned as parent rows
 * with a nested stages array (per-stage points + hasResults) and an endOfTourPoints field.
 * One-day races are returned as flat items with empty stages array.
 * Parent row totalLeaguePoints = sum of all stage points + endOfTourPoints.
 *
 * Uses three-query application-side assembly pattern:
 *   Query A — parent races with their own (end-of-tour) points
 *   Query B — stage rows for multi-stage parent races with per-stage points
 * Assembled in application code to avoid SQL JSON_AGG complexity.
 *
 * Ownership-at-race-time: draftPicks join filters by draftPicks.pickedAt <= races.startDate
 * so pre-transfer race results are credited to the correct (original) team.
 * Sorted by startDate DESC (most recent first).
 */
export async function getLeagueRacesWithScores(leagueId: number, season: number): Promise<LeagueRaceScoreGrouped[]> {
  // Query A — parent races (parentRaceId IS NULL) with their own direct league points.
  // For multi-stage races, these points represent end-of-tour classification results
  // entered against the parent race row itself. For one-day races, these are the full race points.
  const parentRows = await db
    .select({
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      totalLeaguePoints: sql<number>`COALESCE(SUM(CASE WHEN ${lineupFilter} THEN ${raceResults.points} ELSE 0 END), 0)`,
    })
    .from(races)
    .innerJoin(raceResults, eq(raceResults.raceId, races.id))
    .innerJoin(
      draftPicks,
      and(
        eq(draftPicks.riderId, raceResults.riderId),
        eq(draftPicks.leagueId, leagueId),
        lte(draftPicks.pickedAt, races.startDate),  // ownership-at-race-time
        or(isNull(draftPicks.droppedAt), gte(draftPicks.droppedAt, races.startDate))  // include pre-drop race results
      )
    )
    .where(
      and(
        isNull(races.parentRaceId),
        eq(races.season, season),
        sql`${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId})`
      )
    )
    .groupBy(races.id, races.name, races.raceType, races.startDate)
    .orderBy(desc(races.startDate))

  // Query B — stage rows (parentRaceId IS NOT NULL) with per-stage league points and hasResults flag.
  // Only fetch stages whose parent is in the league for this season.
  const stageRows = await db
    .select({
      raceId: races.id,
      raceName: races.name,
      stageNumber: races.stageNumber,
      startDate: races.startDate,
      parentRaceId: races.parentRaceId,
      totalLeaguePoints: sql<number>`COALESCE(SUM(CASE WHEN ${lineupFilter} THEN ${raceResults.points} ELSE 0 END), 0)`,
      hasResults: sql<boolean>`EXISTS (SELECT 1 FROM race_results rr WHERE rr."raceId" = ${races.id})`,
    })
    .from(races)
    .leftJoin(raceResults, eq(raceResults.raceId, races.id))
    .leftJoin(
      draftPicks,
      and(
        eq(draftPicks.riderId, raceResults.riderId),
        eq(draftPicks.leagueId, leagueId),
        lte(draftPicks.pickedAt, races.startDate),  // ownership-at-race-time
        or(isNull(draftPicks.droppedAt), gte(draftPicks.droppedAt, races.startDate))  // include pre-drop race results
      )
    )
    .where(
      and(
        sql`${races.parentRaceId} IS NOT NULL`,
        eq(races.season, season),
        sql`${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId})`
      )
    )
    .groupBy(races.id, races.name, races.stageNumber, races.startDate, races.parentRaceId)
    .orderBy(asc(races.stageNumber), asc(races.startDate))

  // Application-side assembly — group stage rows by parentRaceId
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

  // Build grouped result from parent rows
  return parentRows.map((row) => {
    const isMultiStage = MULTI_STAGE_TYPES.has(row.raceType)
    if (!isMultiStage) {
      return {
        raceId: row.raceId,
        raceName: row.raceName,
        raceType: row.raceType,
        startDate: row.startDate,
        totalLeaguePoints: Number(row.totalLeaguePoints),
        isMultiStage: false,
        stages: [],
        endOfTourPoints: 0,
      }
    }

    const stages = stagesByParent.get(row.raceId) ?? []
    const endOfTourPoints = Number(row.totalLeaguePoints)
    const stagePointsTotal = stages.reduce((sum, s) => sum + s.totalLeaguePoints, 0)
    return {
      raceId: row.raceId,
      raceName: row.raceName,
      raceType: row.raceType,
      startDate: row.startDate,
      totalLeaguePoints: stagePointsTotal + endOfTourPoints,
      isMultiStage: true,
      stages,
      endOfTourPoints,
    }
  })
}

export type RaceScoreEntry = {
  teamId: number
  teamName: string
  riderId: number
  riderName: string
  riderTeam: string
  riderNationality: string
  position: number
  points: number
}

export type LeagueRaceScore = {
  raceId: number
  raceName: string
  raceType: string
  startDate: Date
  totalLeaguePoints: number
}

// ─── Order-adjusted scoring functions ─────────────────────────────────────────

export type RaceScoreEntryWithOrders = RaceScoreEntry & {
  adjustedPoints: number
  orderEffect: string | null  // e.g. "Blodpose x3", "Shimanobil (0 pts)", null if no effect
  isCountered: boolean
  isBonus: boolean  // true for Gammel Venn and admin bonus rows
}

/**
 * Returns league standings with order effects incorporated into team totals.
 * Delegates to getOrderAdjustedStandings from order-queries.ts.
 * Backward-compatible: raw getLeagueStandings is still available.
 */
export async function getLeagueStandingsWithOrders(leagueId: number, season: number): Promise<LeagueStanding[]> {
  const { getOrderAdjustedStandings } = await import("./order-queries")
  const { standings } = await getOrderAdjustedStandings(leagueId, season)
  return standings
}

/**
 * Returns race score breakdown enriched with order effect annotations.
 * Shows base points, adjusted points, and a human-readable order effect label.
 * Also includes bonus rows for Gammel Venn and admin-entered bonus points.
 */
export async function getRaceScoreBreakdownWithOrders(
  raceId: number,
  leagueId: number
): Promise<{
  entries: RaceScoreEntryWithOrders[]
  counterResults: { attackOrderId: number; counterOrderId: number; description: string }[]
  hasOrders: boolean
}> {
  const {
    getActiveOrdersForRace,
    resolveCounters,
    applyOrderEffects,
  } = await import("./order-queries")
  const { db: localDb } = await import("@/lib/db")
  const { races: racesTable } = await import("@/db/schema/races")
  const { raceResults: raceResultsTable } = await import("@/db/schema/results")
  const { eq: eqFn, inArray: inArrayFn, and: andFn } = await import("drizzle-orm")

  // Get base breakdown
  const baseEntries = await getRaceScoreBreakdown(raceId, leagueId)

  // Get the race type for this race
  const raceRows = await localDb
    .select({ raceType: racesTable.raceType })
    .from(racesTable)
    .where(eqFn(racesTable.id, raceId))
    .limit(1)

  const raceType = raceRows[0]?.raceType ?? "unknown"

  // Get active orders for this race
  const activeOrders = await getActiveOrdersForRace(raceId, leagueId)

  if (activeOrders.length === 0) {
    return {
      entries: baseEntries.map((entry) => ({
        ...entry,
        adjustedPoints: entry.points,
        orderEffect: null,
        isCountered: false,
        isBonus: false,
      })),
      counterResults: [],
      hasOrders: false,
    }
  }

  // Resolve counters
  const { effectiveOrders, counterResults } = resolveCounters(activeOrders)

  // Compute Gammel Venn bonuses
  const gammelVennOrders = activeOrders.filter((o) => o.orderTypeName === "gammel_venn")
  const gammelVennBonuses: { teamId: number; riderId: number; points: number; orderTypeName: string }[] = []

  if (gammelVennOrders.length > 0) {
    const targetRiderIds = gammelVennOrders
      .map((o) => o.targetRiderId)
      .filter((id): id is number => id != null)

    if (targetRiderIds.length > 0) {
      const results = await localDb
        .select({ riderId: raceResultsTable.riderId, points: raceResultsTable.points })
        .from(raceResultsTable)
        .where(
          andFn(
            eqFn(raceResultsTable.raceId, raceId),
            inArrayFn(raceResultsTable.riderId, targetRiderIds)
          )
        )

      for (const order of gammelVennOrders) {
        if (order.targetRiderId == null) continue
        const result = results.find((r) => r.riderId === order.targetRiderId)
        if (!result || result.points <= 0) continue
        const multiplier = order.effectValues
          ? (order.effectValues[raceType] ?? 1)
          : 1
        gammelVennBonuses.push({
          teamId: order.teamId,
          riderId: order.targetRiderId,
          points: Math.floor(result.points * multiplier),
          orderTypeName: order.orderTypeName,
        })
      }
    }
  }

  // Build base scores array for applyOrderEffects
  type BaseScore = { teamId: number; riderId: number; points: number; riderNationality?: string; position?: number }
  const baseScores: BaseScore[] = baseEntries.map((entry) => ({
    teamId: entry.teamId,
    riderId: entry.riderId,
    points: entry.points,
    riderNationality: entry.riderNationality,
    position: entry.position,
  }))

  // Apply order effects
  const adjustments = applyOrderEffects(
    baseScores,
    effectiveOrders,
    raceType,
    counterResults,
    gammelVennBonuses
  )

  // Build a lookup of adjustments by (teamId, riderId)
  const adjMap = new Map<string, { adjustedPoints: number; description: string }>()
  for (const adj of adjustments) {
    if (adj.riderId == null) continue
    const key = `${adj.teamId}:${adj.riderId}`
    const existing = adjMap.get(key)
    if (existing) {
      // Multiple effects can stack (e.g. multiple order types) — aggregate
      existing.adjustedPoints = existing.adjustedPoints - adj.basePoints + adj.adjustedPoints
      existing.description = `${existing.description}, ${adj.description}`
    } else {
      adjMap.set(key, {
        adjustedPoints: adj.adjustedPoints,
        description: adj.description,
      })
    }
  }

  // No blowback in 2026 rules — countered orders simply have no effect
  const counteredRiderIds = new Set<string>()

  // Build enriched entries
  const entries: RaceScoreEntryWithOrders[] = baseEntries.map((entry) => {
    const key = `${entry.teamId}:${entry.riderId}`
    const adj = adjMap.get(key)
    return {
      ...entry,
      adjustedPoints: adj != null ? adj.adjustedPoints : entry.points,
      orderEffect: adj != null ? adj.description : null,
      isCountered: counteredRiderIds.has(key),
      isBonus: false,
    }
  })

  // Add admin bonus rows (Hammer, Innlagt Spurt, Lagtempo)
  const adminBonusOrders = adjustments.filter((adj) => adj.riderId == null && adj.basePoints === 0)
  const addedBonusKeys = new Set<string>()
  for (const bonus of adminBonusOrders) {
    const key = `${bonus.teamId}:bonus:${bonus.orderTypeName}`
    if (addedBonusKeys.has(key)) continue
    addedBonusKeys.add(key)
    // Find the team name from base entries
    const teamName = baseEntries.find((e) => e.teamId === bonus.teamId)?.teamName ?? `Team ${bonus.teamId}`
    entries.push({
      teamId: bonus.teamId,
      teamName,
      riderId: -1,  // sentinel for bonus row
      riderName: bonus.description,
      riderTeam: "",
      riderNationality: "",
      position: 9999,
      points: 0,
      adjustedPoints: bonus.adjustedPoints,
      orderEffect: bonus.description,
      isCountered: false,
      isBonus: true,
    })
  }

  // Add Gammel Venn bonus rows
  for (const bonus of gammelVennBonuses) {
    const teamName = baseEntries.find((e) => e.teamId === bonus.teamId)?.teamName ?? `Team ${bonus.teamId}`
    entries.push({
      teamId: bonus.teamId,
      teamName,
      riderId: bonus.riderId,
      riderName: `Gammel Venn bonus (rider #${bonus.riderId})`,
      riderTeam: "",
      riderNationality: "",
      position: 9999,
      points: 0,
      adjustedPoints: bonus.points,
      orderEffect: `gammel_venn bonus: +${bonus.points} pts`,
      isCountered: false,
      isBonus: true,
    })
  }

  return {
    entries,
    counterResults,
    hasOrders: true,
  }
}

// ─── Standings History ─────────────────────────────────────────────────────────

export type RaceColumn = {
  raceId: number
  raceName: string
  raceType: string
  startDate: Date
}

export type TeamRacePoints = {
  teamId: number
  teamName: string
  userId: string
  pointsByRace: Record<number, number>   // raceId -> points earned in that race
  cumulativeByRace: Record<number, number> // raceId -> cumulative total up to and including that race
  totalPoints: number
}

export type StandingsHistory = {
  races: RaceColumn[]
  teams: TeamRacePoints[]
}

/**
 * Returns per-team per-race points and cumulative totals for all completed parent races
 * in a league season. Races are ordered chronologically (startDate ASC).
 *
 * Only parent races (parentRaceId IS NULL) appear as columns — stage results roll up
 * to their parent race. Only races with at least one result appear as columns.
 *
 * Uses the same ownership-at-race-time and league-scoping patterns as getLeagueStandings.
 * Bonus rider points (from Uno-X orders) are included per parent race.
 */
export async function getStandingsHistory(leagueId: number, season: number): Promise<StandingsHistory> {
  // Step A: Get completed parent races for this league, ordered by startDate ASC.
  // A race is "completed" if at least one raceResult exists that belongs to this league.
  const parentRaceRows = await db
    .select({
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
    })
    .from(races)
    .innerJoin(raceResults, eq(raceResults.raceId, races.id))
    .innerJoin(
      draftPicks,
      and(
        eq(draftPicks.riderId, raceResults.riderId),
        eq(draftPicks.leagueId, leagueId),
        or(isNull(draftPicks.droppedAt), gte(draftPicks.droppedAt, races.startDate))  // include pre-drop race results
      )
    )
    .where(
      and(
        isNull(races.parentRaceId),
        eq(races.season, season),
        sql`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))`
      )
    )
    .groupBy(races.id, races.name, races.raceType, races.startDate)
    .orderBy(asc(races.startDate))

  // Deduplicate races (multiple join rows can produce duplicates before group-by settles)
  const seenRaceIds = new Set<number>()
  const raceColumns: RaceColumn[] = []
  for (const row of parentRaceRows) {
    if (!seenRaceIds.has(row.raceId)) {
      seenRaceIds.add(row.raceId)
      raceColumns.push({
        raceId: row.raceId,
        raceName: row.raceName,
        raceType: row.raceType,
        startDate: row.startDate,
      })
    }
  }

  if (raceColumns.length === 0) {
    // No completed races yet — return empty result with all teams at zero
    const teamRows = await db
      .select({ teamId: teams.id, teamName: teams.name, userId: teams.userId })
      .from(teams)
      .where(eq(teams.leagueId, leagueId))

    return {
      races: [],
      teams: teamRows.map((t) => ({
        teamId: t.teamId,
        teamName: t.teamName,
        userId: t.userId,
        pointsByRace: {},
        cumulativeByRace: {},
        totalPoints: 0,
      })),
    }
  }

  // Step B: Per-team per-parent-race points using ownership-at-race-time.
  // COALESCE(races.parentRaceId, races.id) buckets stage results under their parent.
  const perRacePointsRows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      userId: teams.userId,
      parentRaceId: sql<number>`COALESCE(${races.parentRaceId}, ${races.id})`,
      racePoints: sql<number>`COALESCE(SUM(CASE WHEN ${races.id} IS NOT NULL AND ${lineupFilter} THEN ${raceResults.points} ELSE 0 END), 0)`,
    })
    .from(teams)
    .leftJoin(
      draftPicks,
      and(
        eq(draftPicks.teamId, teams.id),
        eq(draftPicks.leagueId, leagueId)
      )
    )
    .leftJoin(raceResults, eq(raceResults.riderId, draftPicks.riderId))
    .leftJoin(
      races,
      and(
        eq(races.id, raceResults.raceId),
        eq(races.season, season),
        gte(races.startDate, draftPicks.pickedAt),  // ownership-at-race-time
        or(isNull(draftPicks.droppedAt), gte(draftPicks.droppedAt, races.startDate)),  // include pre-drop race results
        sql`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}) OR ${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))`
      )
    )
    .where(eq(teams.leagueId, leagueId))
    .groupBy(
      teams.id,
      teams.name,
      teams.userId,
      sql`COALESCE(${races.parentRaceId}, ${races.id})`
    )

  // Step C: Bonus rider points per parent race (mirror getLeagueStandings bonus query).
  const bonusPerRaceRows = await db
    .select({
      teamId: bonusRiders.teamId,
      parentRaceId: bonusRiders.raceId,
      bonusPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
    })
    .from(bonusRiders)
    .innerJoin(raceResults, eq(raceResults.riderId, bonusRiders.riderId))
    .innerJoin(races, eq(races.id, raceResults.raceId))
    .where(
      and(
        eq(bonusRiders.leagueId, leagueId),
        eq(races.season, season),
        or(
          eq(races.id, bonusRiders.raceId),
          eq(races.parentRaceId, bonusRiders.raceId)
        ),
        sql`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}) OR ${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))`
      )
    )
    .groupBy(bonusRiders.teamId, bonusRiders.raceId)

  // Step D: Application-side assembly.

  // Build bonus lookup: teamId -> parentRaceId -> bonusPoints
  const bonusMap = new Map<number, Map<number, number>>()
  for (const row of bonusPerRaceRows) {
    if (!bonusMap.has(row.teamId)) bonusMap.set(row.teamId, new Map())
    const teamBonus = bonusMap.get(row.teamId)!
    teamBonus.set(row.parentRaceId, (teamBonus.get(row.parentRaceId) ?? 0) + Number(row.bonusPoints))
  }

  // Collect all unique teams from Step B rows (deduplicate by teamId)
  const teamMap = new Map<number, { teamId: number; teamName: string; userId: string }>()
  for (const row of perRacePointsRows) {
    if (!teamMap.has(row.teamId)) {
      teamMap.set(row.teamId, { teamId: row.teamId, teamName: row.teamName, userId: row.userId })
    }
  }

  // Build per-team per-race points map: teamId -> parentRaceId -> draftPoints
  const draftPointsMap = new Map<number, Map<number, number>>()
  for (const row of perRacePointsRows) {
    if (row.parentRaceId == null) continue
    if (!seenRaceIds.has(Number(row.parentRaceId))) continue
    if (!draftPointsMap.has(row.teamId)) draftPointsMap.set(row.teamId, new Map())
    const teamRaceMap = draftPointsMap.get(row.teamId)!
    const existing = teamRaceMap.get(Number(row.parentRaceId)) ?? 0
    teamRaceMap.set(Number(row.parentRaceId), existing + Number(row.racePoints))
  }

  // Assemble final team entries
  const resultTeams: TeamRacePoints[] = Array.from(teamMap.values()).map((team) => {
    const draftRaceMap = draftPointsMap.get(team.teamId) ?? new Map<number, number>()
    const teamBonusMap = bonusMap.get(team.teamId) ?? new Map<number, number>()

    const pointsByRace: Record<number, number> = {}
    for (const col of raceColumns) {
      const draft = draftRaceMap.get(col.raceId) ?? 0
      const bonus = teamBonusMap.get(col.raceId) ?? 0
      pointsByRace[col.raceId] = draft + bonus
    }

    // Compute cumulative points in race-date order
    const cumulativeByRace: Record<number, number> = {}
    let running = 0
    for (const col of raceColumns) {
      running += pointsByRace[col.raceId] ?? 0
      cumulativeByRace[col.raceId] = running
    }

    return {
      teamId: team.teamId,
      teamName: team.teamName,
      userId: team.userId,
      pointsByRace,
      cumulativeByRace,
      totalPoints: running,
    }
  })

  // Sort teams by totalPoints DESC
  resultTeams.sort((a, b) => b.totalPoints - a.totalPoints)

  return {
    races: raceColumns,
    teams: resultTeams,
  }
}

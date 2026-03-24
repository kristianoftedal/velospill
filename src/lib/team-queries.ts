import { db } from "@/lib/db"
import { draftPicks } from "@/db/schema/draft"
import { teams, leagues, leagueRaces } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { raceResults } from "@/db/schema/results"
import { races } from "@/db/schema/races"
import { raceLineups } from "@/db/schema/lineups"
import { bonusRiders } from "@/db/schema/bonus-riders"
import { eq, asc, desc, sql, and, gte, or } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

const parentRaces = alias(races, "parentRaces")

/**
 * Lineup filter: if a lineup exists for this team/race, only riders in the lineup score.
 * If no lineup exists, all riders score (backward compatible).
 * For stages, the lineup is looked up using the parent race ID.
 *
 * Copied verbatim from scoring-queries.ts for consistency.
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

const categoryLabels: Record<string, string> = {
  finish: "Finish",
  stage_finish: "Stage Finish",
  sprint: "Sprint",
  mountain: "Mountain",
  jersey: "Jersey",
  ttt: "TTT",
  end_gc: "GC",
  end_sprint: "Points Jersey",
  end_mountain: "Mountain Jersey",
  end_youth: "Youth Jersey",
}

export type TeamRiderCategoryScore = {
  category: string
  categoryLabel: string
  position: number
  points: number
}

export type TeamRiderRaceEntry = {
  raceId: number
  raceName: string
  raceType: string
  startDate: Date
  racePoints: number
  categories: TeamRiderCategoryScore[]
  parentRaceId: number | null
  parentRaceName: string | null
}

export type TeamRiderEntry = {
  riderId: number
  riderName: string
  riderTeam: string
  gender: "M" | "F"
  totalPoints: number
  isBonus: boolean
  races: TeamRiderRaceEntry[]
}

export type TeamSeasonProfile = {
  team: {
    id: number
    name: string
    leagueId: number
    leagueName: string
  }
  riders: TeamRiderEntry[]
  totalPoints: number
}

/**
 * Returns a full season profile for a single fantasy team:
 * - Team metadata and league name
 * - Full roster of drafted riders with per-race scoring breakdown
 * - Bonus riders (Uno-X order picks) merged into the same roster
 *
 * Returns null if the team is not found or leagueId does not match.
 *
 * Uses three separate queries + application-side grouping (same pattern as getRiderSeasonProfile).
 */
export async function getTeamSeasonProfile(
  teamId: number,
  leagueId: number,
  season: number
): Promise<TeamSeasonProfile | null> {
  // ── Query 1: Team metadata + league name ──────────────────────────────────
  const teamRows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      leagueId: leagues.id,
      leagueName: leagues.name,
    })
    .from(teams)
    .innerJoin(leagues, eq(leagues.id, teams.leagueId))
    .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
    .limit(1)

  if (teamRows.length === 0) {
    return null
  }

  const teamRow = teamRows[0]

  // League race scoping SQL fragment — reused across queries
  const leagueRaceScope = sql`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}) OR ${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))`

  // ── Query 2: Per-rider, per-race scoring breakdown (main roster) ──────────
  // Fetches all race result rows for all drafted riders on this team.
  // lineupFilter ensures lineup-aware scoring (if a lineup was submitted, only
  // lineup riders score; if none submitted, all riders score).
  // Ownership-at-race-time: races.startDate >= draftPicks.pickedAt
  const resultsRows = await db
    .select({
      riderId: draftPicks.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      parentRaceId: races.parentRaceId,
      parentRaceName: parentRaces.name,
      category: raceResults.category,
      position: raceResults.position,
      points: raceResults.points,
    })
    .from(draftPicks)
    .innerJoin(riders, eq(riders.id, draftPicks.riderId))
    .innerJoin(raceResults, eq(raceResults.riderId, draftPicks.riderId))
    .innerJoin(
      races,
      and(
        eq(races.id, raceResults.raceId),
        eq(races.season, season),
        gte(races.startDate, draftPicks.pickedAt), // ownership-at-race-time
        leagueRaceScope
      )
    )
    .leftJoin(parentRaces, eq(parentRaces.id, races.parentRaceId))
    .where(
      and(
        eq(draftPicks.teamId, teamId),
        eq(draftPicks.leagueId, leagueId),
        lineupFilter
      )
    )
    .orderBy(asc(riders.name), asc(races.startDate))

  // ── Query 3: Bonus riders for this team ───────────────────────────────────
  const bonusResultsRows = await db
    .select({
      riderId: bonusRiders.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      parentRaceId: races.parentRaceId,
      parentRaceName: parentRaces.name,
      category: raceResults.category,
      position: raceResults.position,
      points: raceResults.points,
    })
    .from(bonusRiders)
    .innerJoin(riders, eq(riders.id, bonusRiders.riderId))
    .innerJoin(raceResults, eq(raceResults.riderId, bonusRiders.riderId))
    .innerJoin(races, eq(races.id, raceResults.raceId))
    .leftJoin(parentRaces, eq(parentRaces.id, races.parentRaceId))
    .where(
      and(
        eq(bonusRiders.teamId, teamId),
        eq(bonusRiders.leagueId, leagueId),
        eq(races.season, season),
        // Bonus rider scores include both the parent race itself and all its stages
        or(
          eq(races.id, bonusRiders.raceId),
          eq(races.parentRaceId, bonusRiders.raceId)
        ),
        leagueRaceScope
      )
    )
    .orderBy(asc(riders.name), asc(races.startDate))

  // ── Application-side assembly ─────────────────────────────────────────────
  // Build a merged map: riderId → { riderInfo, isBonus, raceMap }
  // raceMap: raceId → { raceInfo, categories[] }

  type RaceAccumulator = {
    raceId: number
    raceName: string
    raceType: string
    startDate: Date
    racePoints: number
    categories: TeamRiderCategoryScore[]
    parentRaceId: number | null
    parentRaceName: string | null
  }

  type RiderAccumulator = {
    riderId: number
    riderName: string
    riderTeam: string
    gender: "M" | "F"
    totalPoints: number
    isBonus: boolean
    raceMap: Map<number, RaceAccumulator>
  }

  const riderMap = new Map<number, RiderAccumulator>()

  function addResultRow(
    row: {
      riderId: number
      riderName: string
      riderTeam: string
      gender: "M" | "F"
      raceId: number
      raceName: string
      raceType: string
      startDate: Date
      parentRaceId: number | null
      parentRaceName: string | null
      category: string
      position: number
      points: number
    },
    isBonus: boolean
  ) {
    let riderEntry = riderMap.get(row.riderId)

    if (!riderEntry) {
      riderEntry = {
        riderId: row.riderId,
        riderName: row.riderName,
        riderTeam: row.riderTeam,
        gender: row.gender,
        totalPoints: 0,
        isBonus,
        raceMap: new Map(),
      }
      riderMap.set(row.riderId, riderEntry)
    }

    const categoryEntry: TeamRiderCategoryScore = {
      category: row.category,
      categoryLabel: categoryLabels[row.category] ?? row.category,
      position: row.position,
      points: row.points,
    }

    let raceEntry = riderEntry.raceMap.get(row.raceId)
    if (!raceEntry) {
      raceEntry = {
        raceId: row.raceId,
        raceName: row.raceName,
        raceType: row.raceType,
        startDate: row.startDate,
        racePoints: 0,
        categories: [],
        parentRaceId: row.parentRaceId,
        parentRaceName: row.parentRaceName,
      }
      riderEntry.raceMap.set(row.raceId, raceEntry)
    }

    raceEntry.categories.push(categoryEntry)
    raceEntry.racePoints += row.points
    riderEntry.totalPoints += row.points
  }

  // Process main roster results
  for (const row of resultsRows) {
    addResultRow(
      {
        riderId: row.riderId,
        riderName: row.riderName,
        riderTeam: row.riderTeam,
        gender: row.gender as "M" | "F",
        raceId: row.raceId,
        raceName: row.raceName,
        raceType: row.raceType,
        startDate: row.startDate,
        parentRaceId: row.parentRaceId ?? null,
        parentRaceName: row.parentRaceName ?? null,
        category: row.category,
        position: row.position,
        points: row.points,
      },
      false
    )
  }

  // Process bonus rider results (merge into same map, isBonus: true)
  for (const row of bonusResultsRows) {
    addResultRow(
      {
        riderId: row.riderId,
        riderName: row.riderName,
        riderTeam: row.riderTeam,
        gender: row.gender as "M" | "F",
        raceId: row.raceId,
        raceName: row.raceName,
        raceType: row.raceType,
        startDate: row.startDate,
        parentRaceId: row.parentRaceId ?? null,
        parentRaceName: row.parentRaceName ?? null,
        category: row.category,
        position: row.position,
        points: row.points,
      },
      true
    )
  }

  // Build final TeamRiderEntry[] sorted by totalPoints DESC
  const riderEntries: TeamRiderEntry[] = Array.from(riderMap.values())
    .map((riderAcc) => {
      // Sort races within each rider by startDate ASC
      const sortedRaces: TeamRiderRaceEntry[] = Array.from(
        riderAcc.raceMap.values()
      ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

      return {
        riderId: riderAcc.riderId,
        riderName: riderAcc.riderName,
        riderTeam: riderAcc.riderTeam,
        gender: riderAcc.gender,
        totalPoints: riderAcc.totalPoints,
        isBonus: riderAcc.isBonus,
        races: sortedRaces,
      }
    })
    .sort((a, b) => b.totalPoints - a.totalPoints) // highest contributor first

  // Total team points = sum of all rider totalPoints
  const totalPoints = riderEntries.reduce(
    (sum, rider) => sum + rider.totalPoints,
    0
  )

  return {
    team: {
      id: teamRow.teamId,
      name: teamRow.teamName,
      leagueId: teamRow.leagueId,
      leagueName: teamRow.leagueName,
    },
    riders: riderEntries,
    totalPoints,
  }
}

import { db } from "@/lib/db"
import { draftPicks } from "@/db/schema/draft"
import { teams } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { raceResults } from "@/db/schema/results"
import { races } from "@/db/schema/races"
import { eq, desc, sql, and, asc, gte, lte } from "drizzle-orm"

// Points are pre-calculated at result entry time. Phase 5 only aggregates stored points.
// Ownership-at-race-time: points stay with the team that owned the rider when the race took place.
// This is implemented by filtering race results where races.startDate >= draftPicks.pickedAt.
// For original draft picks, pickedAt is the draft timestamp (before any races), so all results flow through.
// For transferred riders, only results from races on/after the transfer date count for the new team.

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
      totalPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
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
        gte(races.startDate, draftPicks.pickedAt)  // ownership-at-race-time
      )
    )
    .where(eq(teams.leagueId, leagueId))
    .groupBy(teams.id, teams.name, teams.userId)
    .orderBy(desc(sql`COALESCE(SUM(${raceResults.points}), 0)`))

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

  return ranked
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
      totalPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
    })
    .from(draftPicks)
    .innerJoin(riders, eq(riders.id, draftPicks.riderId))
    .leftJoin(raceResults, eq(raceResults.riderId, draftPicks.riderId))
    .leftJoin(
      races,
      and(
        eq(races.id, raceResults.raceId),
        eq(races.season, season),
        gte(races.startDate, draftPicks.pickedAt)  // ownership-at-race-time
      )
    )
    .where(
      and(
        eq(draftPicks.teamId, teamId),
        eq(draftPicks.leagueId, leagueId)
      )
    )
    .groupBy(draftPicks.riderId, riders.name, riders.team, riders.gender)
    .orderBy(desc(sql`COALESCE(SUM(${raceResults.points}), 0)`))

  return rows.map((row) => ({
    riderId: row.riderId,
    riderName: row.riderName,
    riderTeam: row.riderTeam,
    gender: row.gender,
    totalPoints: Number(row.totalPoints),
  })) satisfies TeamRiderScore[]
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
        lte(draftPicks.pickedAt, races.startDate)  // ownership-at-race-time
      )
    )
    .innerJoin(teams, eq(teams.id, draftPicks.teamId))
    .where(eq(raceResults.raceId, raceId))
    .orderBy(asc(raceResults.position))

  return rows.map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    riderId: row.riderId,
    riderName: row.riderName,
    riderTeam: row.riderTeam,
    position: row.position,
    points: row.points,
  })) satisfies RaceScoreEntry[]
}

/**
 * Returns races in a given season where at least one rider from the league has results.
 * Aggregates total fantasy points earned across all drafted riders for that race.
 * Ownership-at-race-time: draftPicks join filters by draftPicks.pickedAt <= races.startDate
 * so pre-transfer race results are credited to the correct (original) team.
 * Sorted by startDate DESC (most recent first).
 */
export async function getLeagueRacesWithScores(leagueId: number, season: number) {
  const rows = await db
    .select({
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      totalLeaguePoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
    })
    .from(races)
    .innerJoin(raceResults, eq(raceResults.raceId, races.id))
    .innerJoin(
      draftPicks,
      and(
        eq(draftPicks.riderId, raceResults.riderId),
        eq(draftPicks.leagueId, leagueId),
        lte(draftPicks.pickedAt, races.startDate)  // ownership-at-race-time
      )
    )
    .where(eq(races.season, season))
    .groupBy(races.id, races.name, races.raceType, races.startDate)
    .orderBy(desc(races.startDate))

  return rows.map((row) => ({
    raceId: row.raceId,
    raceName: row.raceName,
    raceType: row.raceType,
    startDate: row.startDate,
    totalLeaguePoints: Number(row.totalLeaguePoints),
  })) satisfies LeagueRaceScore[]
}

export type RaceScoreEntry = {
  teamId: number
  teamName: string
  riderId: number
  riderName: string
  riderTeam: string
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

import { db } from "@/lib/db"
import { draftPicks } from "@/db/schema/draft"
import { teams } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { raceResults } from "@/db/schema/results"
import { races } from "@/db/schema/races"
import { eq, desc, sql, and } from "drizzle-orm"

// Points are pre-calculated at result entry time. Phase 5 only aggregates stored points.
// TODO: apply order multipliers when orders/bids system is built

/**
 * Returns all teams in a league ranked by total fantasy points for the given season.
 * Uses LEFT JOIN so teams with zero points still appear in the standings.
 * Multi-tenant: draftPicks join is scoped by both teamId and leagueId.
 * Season scoping: races join filters by races.season so only race results from the
 * correct season contribute to points.
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
        eq(races.season, season)
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
        eq(races.season, season)
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

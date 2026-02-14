import { db } from "@/lib/db"
import { orders } from "@/db/schema/orders"
import { orderTypes } from "@/db/schema/config"
import { races } from "@/db/schema/races"
import { draftPicks } from "@/db/schema/draft"
import { teams } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { eq, and, ne, gt, sql, desc } from "drizzle-orm"

// Alias for self-join on races (parent race)
import { alias } from "drizzle-orm/pg-core"

const parentRaces = alias(races, "parentRaces")

/**
 * Returns upcoming races (startDate > now) for a given league's season.
 * Includes a LEFT JOIN on the parent race so stages can display "Tour de France - Stage 3".
 */
export async function getUpcomingRacesForLeague(leagueId: number, season: number) {
  const rows = await db
    .select({
      id: races.id,
      name: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      parentRaceId: races.parentRaceId,
      stageNumber: races.stageNumber,
      parentRaceName: parentRaces.name,
    })
    .from(races)
    .leftJoin(parentRaces, eq(parentRaces.id, races.parentRaceId))
    .where(
      and(
        eq(races.season, season),
        gt(races.startDate, sql`now()`)
      )
    )
    .orderBy(races.startDate)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    raceType: row.raceType,
    startDate: row.startDate,
    parentRaceId: row.parentRaceId,
    stageNumber: row.stageNumber,
    parentRaceName: row.parentRaceName,
    displayName: row.parentRaceName && row.stageNumber
      ? `${row.parentRaceName} - Stage ${row.stageNumber}`
      : row.name,
  }))
}

export type UpcomingRace = Awaited<ReturnType<typeof getUpcomingRacesForLeague>>[number]

/**
 * Returns all orders for a team in a league, joined with orderTypes and races.
 * Sorted by submittedAt DESC.
 */
export async function getTeamOrders(teamId: number, leagueId: number) {
  const rows = await db
    .select({
      id: orders.id,
      raceId: orders.raceId,
      raceName: races.name,
      raceStartDate: races.startDate,
      orderTypeName: orderTypes.name,
      orderTypeDisplayName: orderTypes.displayName,
      status: orders.status,
      targetRiderId: orders.targetRiderId,
      targetTeamId: orders.targetTeamId,
      targetProTeam: orders.targetProTeam,
      targetCountry: orders.targetCountry,
      bonusPoints: orders.bonusPoints,
      submittedAt: orders.submittedAt,
      orderConfig: orders.orderConfig,
    })
    .from(orders)
    .innerJoin(orderTypes, eq(orderTypes.id, orders.orderTypeId))
    .innerJoin(races, eq(races.id, orders.raceId))
    .where(
      and(
        eq(orders.teamId, teamId),
        eq(orders.leagueId, leagueId)
      )
    )
    .orderBy(desc(orders.submittedAt))

  return rows
}

export type TeamOrder = Awaited<ReturnType<typeof getTeamOrders>>[number]

/**
 * Returns order types whose applicableRaceTypes JSONB array contains the given raceType.
 * Uses PostgreSQL JSONB containment operator @>.
 */
export async function getOrderTypesForRaceType(raceType: string) {
  const rows = await db
    .select({
      id: orderTypes.id,
      name: orderTypes.name,
      displayName: orderTypes.displayName,
      effect: orderTypes.effect,
      description: orderTypes.description,
      applicableRaceTypes: orderTypes.applicableRaceTypes,
    })
    .from(orderTypes)
    .where(
      sql`${orderTypes.applicableRaceTypes} @> ${JSON.stringify([raceType])}::jsonb`
    )
    .orderBy(orderTypes.displayName)

  return rows
}

export type OrderType = Awaited<ReturnType<typeof getOrderTypesForRaceType>>[number]

/**
 * Returns the team's drafted riders (id, name, team, gender).
 * Follows the draftPicks JOIN pattern from scoring-queries.ts.
 */
export async function getTeamRidersForOrders(teamId: number, leagueId: number) {
  const rows = await db
    .select({
      riderId: draftPicks.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
    })
    .from(draftPicks)
    .innerJoin(riders, eq(riders.id, draftPicks.riderId))
    .where(
      and(
        eq(draftPicks.teamId, teamId),
        eq(draftPicks.leagueId, leagueId)
      )
    )
    .orderBy(riders.name)

  return rows
}

export type TeamRiderForOrders = Awaited<ReturnType<typeof getTeamRidersForOrders>>[number]

/**
 * Returns riders drafted by OTHER teams in the league (opponent riders).
 */
export async function getOpponentRiders(leagueId: number, teamId: number) {
  const rows = await db
    .select({
      riderId: draftPicks.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      draftedByTeamId: draftPicks.teamId,
    })
    .from(draftPicks)
    .innerJoin(riders, eq(riders.id, draftPicks.riderId))
    .where(
      and(
        eq(draftPicks.leagueId, leagueId),
        ne(draftPicks.teamId, teamId)
      )
    )
    .orderBy(riders.name)

  return rows
}

export type OpponentRider = Awaited<ReturnType<typeof getOpponentRiders>>[number]

/**
 * Returns other teams in the league (id, name).
 */
export async function getOpponentTeams(leagueId: number, teamId: number) {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
    })
    .from(teams)
    .where(
      and(
        eq(teams.leagueId, leagueId),
        ne(teams.id, teamId)
      )
    )
    .orderBy(teams.name)

  return rows
}

export type OpponentTeam = Awaited<ReturnType<typeof getOpponentTeams>>[number]

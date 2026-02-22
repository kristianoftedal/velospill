import { db } from "@/lib/db"
import { orders } from "@/db/schema/orders"
import { orderTypes } from "@/db/schema/config"
import { races } from "@/db/schema/races"
import { draftPicks } from "@/db/schema/draft"
import { teams } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { raceResults } from "@/db/schema/results"
import { leagueRaces } from "@/db/schema/leagues"
import { eq, and, ne, gt, sql, desc, inArray } from "drizzle-orm"

// Alias for self-join on races (parent race)
import { alias } from "drizzle-orm/pg-core"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActiveOrder = {
  orderId: number
  teamId: number
  raceId: number
  orderTypeId: number
  orderTypeName: string
  effectType: string  // from orderTypes.effect.type
  effectTarget: string // from orderTypes.effect.target
  effectValues?: Record<string, number> // multiplier values per race type (blodpose_one_day, gammel_venn)
  effectValue?: number  // single multiplier value (blodpose_gt)
  restriction?: string
  targetRiderId: number | null
  targetTeamId: number | null
  targetProTeam: string | null
  targetCountry: string | null
  orderConfig: Record<string, string> | null
  bonusPoints: number | null
}

export type OrderAdjustment = {
  teamId: number
  riderId: number | null  // null for team-level adjustments
  raceId: number
  basePoints: number
  adjustedPoints: number
  orderTypeName: string
  description: string  // human-readable explanation
}

// ─── Active orders query ──────────────────────────────────────────────────────

/**
 * Returns all active orders for a specific race in a league.
 * Parses the JSONB effect field into typed fields.
 */
export async function getActiveOrdersForRace(raceId: number, leagueId: number): Promise<ActiveOrder[]> {
  const rows = await db
    .select({
      orderId: orders.id,
      teamId: orders.teamId,
      raceId: orders.raceId,
      orderTypeId: orders.orderTypeId,
      orderTypeName: orderTypes.name,
      effect: orderTypes.effect,
      targetRiderId: orders.targetRiderId,
      targetTeamId: orders.targetTeamId,
      targetProTeam: orders.targetProTeam,
      targetCountry: orders.targetCountry,
      orderConfig: orders.orderConfig,
      bonusPoints: orders.bonusPoints,
    })
    .from(orders)
    .innerJoin(orderTypes, eq(orderTypes.id, orders.orderTypeId))
    .where(
      and(
        eq(orders.raceId, raceId),
        eq(orders.leagueId, leagueId),
        eq(orders.status, "active")
      )
    )

  return rows.map((row) => {
    const effect = row.effect as Record<string, unknown>
    return {
      orderId: row.orderId,
      teamId: row.teamId,
      raceId: row.raceId,
      orderTypeId: row.orderTypeId,
      orderTypeName: row.orderTypeName,
      effectType: (effect.type as string) ?? "unknown",
      effectTarget: (effect.target as string) ?? "unknown",
      effectValues: (effect.values as Record<string, number>) ?? undefined,
      effectValue: (effect.value as number) ?? undefined,
      restriction: (effect.restriction as string) ?? undefined,
      targetRiderId: row.targetRiderId,
      targetTeamId: row.targetTeamId,
      targetProTeam: row.targetProTeam,
      targetCountry: row.targetCountry,
      orderConfig: row.orderConfig as Record<string, string> | null,
      bonusPoints: row.bonusPoints,
    }
  })
}

// ─── Counter mechanic resolution ─────────────────────────────────────────────

// Attack order names that can be countered
const ATTACK_ORDER_NAMES = ["shimanobil", "covid", "bondestreik"]
// Defense order names that can counter attacks
const DEFENSE_ORDER_NAMES = ["etappeseier", "blodpose_gt"]

export type CounterResult = {
  attackOrderId: number
  counterOrderId: number
  description: string
}

/**
 * Resolves the counter mechanic for a set of active orders.
 *
 * Attack orders (shimanobil, covid, bondestreik) can be countered by the
 * targeted team if they have a defense order (etappeseier, blodpose_gt) for
 * the same race. When countered, the attack has no effect and is returned
 * to the attacker for reuse in a future race. No penalty is applied.
 *
 * Defense orders always remain in effectiveOrders — they still provide their
 * own positive effect even if they countered an attack.
 */
export function resolveCounters(activeOrders: ActiveOrder[]): {
  effectiveOrders: ActiveOrder[]
  counterResults: CounterResult[]
} {
  const attackOrders = activeOrders.filter((o) => ATTACK_ORDER_NAMES.includes(o.orderTypeName))
  const defenseOrders = activeOrders.filter((o) => DEFENSE_ORDER_NAMES.includes(o.orderTypeName))
  const counterResults: CounterResult[] = []
  const counteredAttackIds = new Set<number>()

  for (const attack of attackOrders) {
    // The attack targets either a specific team (targetTeamId) or a specific rider (targetRiderId)
    // We need to find whether the targeted team has a defense order
    const targetedTeamId = attack.targetTeamId

    if (targetedTeamId == null) {
      // Shimanobil targets a rider — check if the rider's owning team has a defense order
      // We'll look for any defense order by any team other than the attacker
      // The "targeted team" is the team that owns the targetRiderId
      // TODO: Shimanobil counter requires rider ownership lookup — cannot resolve in pure function without targetTeamId
      // For simplicity: check if any defense order belongs to a team different from attacker
      const defenseForTargetedTeam = defenseOrders.find(
        (d) => d.teamId !== attack.teamId
      )
      if (defenseForTargetedTeam) {
        counteredAttackIds.add(attack.orderId)
        counterResults.push({
          attackOrderId: attack.orderId,
          counterOrderId: defenseForTargetedTeam.orderId,
          description: `${attack.orderTypeName} was countered by ${defenseForTargetedTeam.orderTypeName} — order returned to attacker (team ${attack.teamId}) for reuse`,
        })
      }
    } else {
      // covid / bondestreik target a team directly
      const defenseForTargetedTeam = defenseOrders.find(
        (d) => d.teamId === targetedTeamId
      )
      if (defenseForTargetedTeam) {
        counteredAttackIds.add(attack.orderId)
        counterResults.push({
          attackOrderId: attack.orderId,
          counterOrderId: defenseForTargetedTeam.orderId,
          description: `${attack.orderTypeName} was countered by ${defenseForTargetedTeam.orderTypeName} — order returned to attacker (team ${attack.teamId}) for reuse`,
        })
      }
    }
  }

  // Remove countered attack orders from effective orders; keep defense orders
  const effectiveOrders = activeOrders.filter((o) => !counteredAttackIds.has(o.orderId))

  return { effectiveOrders, counterResults }
}

// ─── Order effect application ─────────────────────────────────────────────────

export type BaseScore = {
  teamId: number
  riderId: number
  points: number
  riderNationality?: string
  position?: number
}

/**
 * Applies order effects to base scores, returning OrderAdjustment entries.
 *
 * Handles all 12 order types:
 * - multiplier: blodpose_one_day, blodpose_gt, gammel_venn
 * - zero_points: shimanobil
 * - half_points: covid
 * - multiply_finish_points: etappeseier
 * - gc_position_loss: hammer (admin bonus points)
 * - team_sprint_points: innlagt_spurt (admin bonus points)
 * - team_placement_points: lagtempo (admin bonus points)
 * - zero_finish_points: bondestreik
 * - choice: kaptein
 * - multiply_end_tour: sponsorens_ritt
 */
export function applyOrderEffects(
  baseScores: BaseScore[],
  effectiveOrders: ActiveOrder[],
  raceType: string,
  counterResults: CounterResult[] = [],
  gammelVennBonuses: { teamId: number; riderId: number; points: number; orderTypeName: string }[] = []
): OrderAdjustment[] {
  const adjustments: OrderAdjustment[] = []

  // World Championship: only kaptein applies
  const isWorldChampionship = raceType === "world_championship"

  for (const order of effectiveOrders) {
    if (isWorldChampionship && order.orderTypeName !== "kaptein") {
      continue
    }

    switch (order.effectType) {
      case "multiplier": {
        if (order.effectTarget === "unowned_rider") {
          // gammel_venn — handled via gammelVennBonuses below
          break
        }
        // blodpose_one_day, blodpose_gt — multiply own targeted rider
        // For blodpose_gt: after migration, uses values: {grand_tour: 3.5, grand_tour_tdf: 3}
        // The raceType passed here is from races.raceType which correctly reflects GT type for stages
        const multiplier = order.effectValues
          ? (order.effectValues[raceType] ?? 1)
          : (order.effectValue ?? 3)
        const targetEntry = baseScores.find(
          (s) => s.riderId === order.targetRiderId && s.teamId === order.teamId
        )
        if (targetEntry && multiplier !== 1) {
          adjustments.push({
            teamId: order.teamId,
            riderId: order.targetRiderId,
            raceId: order.raceId,
            basePoints: targetEntry.points,
            adjustedPoints: Math.floor(targetEntry.points * multiplier),
            orderTypeName: order.orderTypeName,
            description: `${order.orderTypeName} x${multiplier}`,
          })
        }
        break
      }

      case "zero_points": {
        // shimanobil — target opponent rider gets 0 points
        const targetEntry = baseScores.find(
          (s) => s.riderId === order.targetRiderId && s.teamId !== order.teamId
        )
        if (targetEntry && targetEntry.points > 0) {
          adjustments.push({
            teamId: targetEntry.teamId,
            riderId: order.targetRiderId,
            raceId: order.raceId,
            basePoints: targetEntry.points,
            adjustedPoints: 0,
            orderTypeName: order.orderTypeName,
            description: `${order.orderTypeName} (0 pts)`,
          })
        }
        break
      }

      case "half_points": {
        // covid — all riders on the targeted team get half points
        const targetedTeamEntries = baseScores.filter(
          (s) => s.teamId === order.targetTeamId
        )
        for (const entry of targetedTeamEntries) {
          const halved = Math.floor(entry.points / 2)
          if (halved !== entry.points) {
            adjustments.push({
              teamId: entry.teamId,
              riderId: entry.riderId,
              raceId: order.raceId,
              basePoints: entry.points,
              adjustedPoints: halved,
              orderTypeName: order.orderTypeName,
              description: `${order.orderTypeName} (half pts)`,
            })
          }
        }
        break
      }

      case "multiply_finish_points": {
        // etappeseier — multiply ALL own riders' finish points by race-specific multiplier
        // After migration: values: {grand_tour: 2.25, grand_tour_tdf: 2}
        const multiplier = order.effectValues?.[raceType] ?? 2
        const ownRiders = baseScores.filter(
          (s) => s.teamId === order.teamId
        )
        for (const entry of ownRiders) {
          if (entry.points > 0) {
            adjustments.push({
              teamId: order.teamId,
              riderId: entry.riderId,
              raceId: order.raceId,
              basePoints: entry.points,
              adjustedPoints: Math.floor(entry.points * multiplier),
              orderTypeName: order.orderTypeName,
              description: `${order.orderTypeName} x${multiplier} (finish pts)`,
            })
          }
        }
        break
      }

      case "gc_position_loss":
      case "team_sprint_points":
      case "team_placement_points": {
        // Admin-entered bonus points (Hammer, Innlagt Spurt, Lagtempo)
        if (order.bonusPoints != null && order.bonusPoints > 0) {
          adjustments.push({
            teamId: order.teamId,
            riderId: null,
            raceId: order.raceId,
            basePoints: 0,
            adjustedPoints: order.bonusPoints,
            orderTypeName: order.orderTypeName,
            description: `${order.orderTypeName} bonus: +${order.bonusPoints} pts`,
          })
        }
        break
      }

      case "zero_finish_points": {
        // bondestreik — all riders on the targeted team get 0 points
        const targetedTeamEntries = baseScores.filter(
          (s) => s.teamId === order.targetTeamId
        )
        for (const entry of targetedTeamEntries) {
          if (entry.points > 0) {
            adjustments.push({
              teamId: entry.teamId,
              riderId: entry.riderId,
              raceId: order.raceId,
              basePoints: entry.points,
              adjustedPoints: 0,
              orderTypeName: order.orderTypeName,
              description: `${order.orderTypeName} (0 pts)`,
            })
          }
        }
        break
      }

      case "choice": {
        // kaptein — applies in World Championship and women's one-day races
        const kapteinChoice = order.orderConfig?.kapteinChoice
        if (kapteinChoice === "single_rider") {
          const targetEntry = baseScores.find(
            (s) => s.riderId === order.targetRiderId && s.teamId === order.teamId
          )
          if (targetEntry && targetEntry.points > 0) {
            adjustments.push({
              teamId: order.teamId,
              riderId: order.targetRiderId,
              raceId: order.raceId,
              basePoints: targetEntry.points,
              adjustedPoints: targetEntry.points * 2,
              orderTypeName: order.orderTypeName,
              description: `${order.orderTypeName} x2 (single rider)`,
            })
          }
        } else if (kapteinChoice === "country_all") {
          const countryRiders = baseScores.filter(
            (s) => s.teamId === order.teamId && s.riderNationality === order.targetCountry
          )
          for (const entry of countryRiders) {
            if (entry.points > 0) {
              adjustments.push({
                teamId: order.teamId,
                riderId: entry.riderId,
                raceId: order.raceId,
                basePoints: entry.points,
                adjustedPoints: Math.floor(entry.points * 1.5),
                orderTypeName: order.orderTypeName,
                description: `${order.orderTypeName} x1.5 (${order.targetCountry})`,
              })
            }
          }
        }
        break
      }

      case "multiply_end_tour": {
        // sponsorens_ritt — multiply all own riders' end-of-tour points by configurable multiplier
        // After migration: value: 3 (changed from x2 to x3)
        const multiplier = order.effectValue ?? 3
        const ownRiders = baseScores.filter((s) => s.teamId === order.teamId)
        for (const entry of ownRiders) {
          if (entry.points > 0) {
            adjustments.push({
              teamId: order.teamId,
              riderId: entry.riderId,
              raceId: order.raceId,
              basePoints: entry.points,
              adjustedPoints: Math.floor(entry.points * multiplier),
              orderTypeName: order.orderTypeName,
              description: `${order.orderTypeName} x${multiplier}`,
            })
          }
        }
        break
      }
    }
  }

  // Counter results tracked for display only — no blowback effects applied (2026 rules)

  // Add Gammel Venn bonuses (unowned rider points credited to order submitter's team)
  for (const bonus of gammelVennBonuses) {
    adjustments.push({
      teamId: bonus.teamId,
      riderId: bonus.riderId,
      raceId: 0,
      basePoints: 0,
      adjustedPoints: bonus.points,
      orderTypeName: bonus.orderTypeName,
      description: `${bonus.orderTypeName} bonus: +${bonus.points} pts (unowned rider)`,
    })
  }

  return adjustments
}

// ─── Gammel Venn unowned rider bonus ─────────────────────────────────────────

/**
 * For Gammel Venn orders: look up the unowned rider's race results and
 * compute bonus points for the order submitter's team.
 */
async function computeGammelVennBonuses(
  orders: ActiveOrder[],
  raceId: number,
  raceType: string
): Promise<{ teamId: number; riderId: number; points: number; orderTypeName: string }[]> {
  const gammelVennOrders = orders.filter((o) => o.orderTypeName === "gammel_venn")
  if (gammelVennOrders.length === 0) return []

  const targetRiderIds = gammelVennOrders
    .map((o) => o.targetRiderId)
    .filter((id): id is number => id != null)

  if (targetRiderIds.length === 0) return []

  const results = await db
    .select({ riderId: raceResults.riderId, points: raceResults.points })
    .from(raceResults)
    .where(
      and(
        eq(raceResults.raceId, raceId),
        inArray(raceResults.riderId, targetRiderIds)
      )
    )

  const bonuses: { teamId: number; riderId: number; points: number; orderTypeName: string }[] = []
  for (const order of gammelVennOrders) {
    if (order.targetRiderId == null) continue
    const result = results.find((r) => r.riderId === order.targetRiderId)
    if (!result || result.points <= 0) continue

    const multiplier = order.effectValues
      ? (order.effectValues[raceType] ?? 1)
      : 1
    bonuses.push({
      teamId: order.teamId,
      riderId: order.targetRiderId,
      points: Math.floor(result.points * multiplier),
      orderTypeName: order.orderTypeName,
    })
  }

  return bonuses
}

// ─── Order-adjusted standings ─────────────────────────────────────────────────

import { getLeagueStandings, getRaceScoreBreakdown } from "./scoring-queries"
import type { LeagueStanding } from "./scoring-queries"

/**
 * Returns league standings with order effects applied to team totals.
 * Fetches all active orders for the league/season, resolves counters,
 * applies effects, and re-ranks teams.
 */
export async function getOrderAdjustedStandings(
  leagueId: number,
  season: number
): Promise<{ standings: LeagueStanding[]; orderAdjustments: OrderAdjustment[] }> {
  // Get base standings (raw raceResults points)
  const baseStandings = await getLeagueStandings(leagueId, season)

  // Fetch all active orders across all races in this league/season
  const allOrderRows = await db
    .select({
      orderId: orders.id,
      teamId: orders.teamId,
      raceId: orders.raceId,
      leagueId: orders.leagueId,
      orderTypeId: orders.orderTypeId,
      orderTypeName: orderTypes.name,
      effect: orderTypes.effect,
      targetRiderId: orders.targetRiderId,
      targetTeamId: orders.targetTeamId,
      targetProTeam: orders.targetProTeam,
      targetCountry: orders.targetCountry,
      orderConfig: orders.orderConfig,
      bonusPoints: orders.bonusPoints,
      raceType: races.raceType,
    })
    .from(orders)
    .innerJoin(orderTypes, eq(orderTypes.id, orders.orderTypeId))
    .innerJoin(races, eq(races.id, orders.raceId))
    .where(
      and(
        eq(orders.leagueId, leagueId),
        eq(orders.status, "active"),
        eq(races.season, season)
      )
    )

  if (allOrderRows.length === 0) {
    return { standings: baseStandings, orderAdjustments: [] }
  }

  // Group orders by raceId
  const ordersByRace = new Map<number, { raceType: string; orders: ActiveOrder[] }>()
  for (const row of allOrderRows) {
    const existing = ordersByRace.get(row.raceId)
    const effect = row.effect as Record<string, unknown>
    const activeOrder: ActiveOrder = {
      orderId: row.orderId,
      teamId: row.teamId,
      raceId: row.raceId,
      orderTypeId: row.orderTypeId,
      orderTypeName: row.orderTypeName,
      effectType: (effect.type as string) ?? "unknown",
      effectTarget: (effect.target as string) ?? "unknown",
      effectValues: (effect.values as Record<string, number>) ?? undefined,
      effectValue: (effect.value as number) ?? undefined,
      restriction: (effect.restriction as string) ?? undefined,
      targetRiderId: row.targetRiderId,
      targetTeamId: row.targetTeamId,
      targetProTeam: row.targetProTeam,
      targetCountry: row.targetCountry,
      orderConfig: row.orderConfig as Record<string, string> | null,
      bonusPoints: row.bonusPoints,
    }
    if (existing) {
      existing.orders.push(activeOrder)
    } else {
      ordersByRace.set(row.raceId, { raceType: row.raceType, orders: [activeOrder] })
    }
  }

  // Process each race with orders
  const allAdjustments: OrderAdjustment[] = []

  for (const [raceId, { raceType, orders: raceOrders }] of ordersByRace) {
    const { effectiveOrders, counterResults } = resolveCounters(raceOrders)

    // Get per-rider base scores for this race
    const breakdown = await getRaceScoreBreakdown(raceId, leagueId)
    const baseScores: BaseScore[] = breakdown.map((entry) => ({
      teamId: entry.teamId,
      riderId: entry.riderId,
      points: entry.points,
      riderNationality: entry.riderNationality,
      position: entry.position,
    }))

    // Compute Gammel Venn bonuses
    const gammelVennBonuses = await computeGammelVennBonuses(raceOrders, raceId, raceType)

    const adjustments = applyOrderEffects(
      baseScores,
      effectiveOrders,
      raceType,
      counterResults,
      gammelVennBonuses
    )

    // Fix raceId in adjustments that were set to 0 for simplicity
    for (const adj of adjustments) {
      if (adj.raceId === 0) adj.raceId = raceId
    }

    allAdjustments.push(...adjustments)
  }

  // Aggregate adjustments per team
  const teamAdjustmentDelta = new Map<number, number>()
  for (const adj of allAdjustments) {
    const delta = adj.adjustedPoints - adj.basePoints
    teamAdjustmentDelta.set(adj.teamId, (teamAdjustmentDelta.get(adj.teamId) ?? 0) + delta)
  }

  // Apply adjustments to base standings
  const adjustedStandings: LeagueStanding[] = baseStandings.map((standing) => ({
    ...standing,
    totalPoints: standing.totalPoints + (teamAdjustmentDelta.get(standing.teamId) ?? 0),
  }))

  // Re-sort by totalPoints DESC
  adjustedStandings.sort((a, b) => b.totalPoints - a.totalPoints)

  // Re-rank with tie handling
  for (let i = 0; i < adjustedStandings.length; i++) {
    if (i === 0) {
      adjustedStandings[i] = { ...adjustedStandings[i], rank: 1 }
    } else if (adjustedStandings[i].totalPoints === adjustedStandings[i - 1].totalPoints) {
      adjustedStandings[i] = { ...adjustedStandings[i], rank: adjustedStandings[i - 1].rank }
    } else {
      adjustedStandings[i] = { ...adjustedStandings[i], rank: i + 1 }
    }
  }

  return { standings: adjustedStandings, orderAdjustments: allAdjustments }
}

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
        gt(races.startDate, sql`now()`),
        sql`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}) OR ${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))`
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

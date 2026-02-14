import { db } from "@/lib/db"
import { transferBids, transferWindows } from "@/db/schema/transfers"
import { draftPicks } from "@/db/schema/draft"
import { riders } from "@/db/schema/riders"
import { eq, and, notInArray, lte, gt, gte, desc, count } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

/**
 * Returns all riders NOT currently on any team in this league, filtered by gender.
 * Uses notInArray subquery against draftPicks for the given leagueId.
 */
export async function getFreeAgents(leagueId: number, gender: "M" | "F") {
  const ownedRiderIds = db
    .select({ riderId: draftPicks.riderId })
    .from(draftPicks)
    .where(eq(draftPicks.leagueId, leagueId))

  return db
    .select({
      id: riders.id,
      name: riders.name,
      team: riders.team,
      nationality: riders.nationality,
      gender: riders.gender,
    })
    .from(riders)
    .where(
      and(
        notInArray(riders.id, ownedRiderIds),
        eq(riders.gender, gender)
      )
    )
    .orderBy(riders.name)
}

/**
 * Returns all riders on a team via draftPicks, joined with riders for name/team/gender.
 * Ordered by gender (M first), then rider name.
 */
export async function getTeamRoster(teamId: number, leagueId: number) {
  return db
    .select({
      riderId: draftPicks.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      nationality: riders.nationality,
      pickNumber: draftPicks.pickNumber,
      pickedAt: draftPicks.pickedAt,
    })
    .from(draftPicks)
    .innerJoin(riders, eq(riders.id, draftPicks.riderId))
    .where(
      and(
        eq(draftPicks.teamId, teamId),
        eq(draftPicks.leagueId, leagueId)
      )
    )
    .orderBy(riders.gender, riders.name)
}

/**
 * Returns all transfer bids for a team in a league, joined with riders twice (aliased)
 * to get both outgoing and incoming rider names.
 * Ordered by submittedAt DESC (most recent first).
 */
export async function getTeamBids(teamId: number, leagueId: number) {
  const outRider = alias(riders, "outRider")
  const inRider = alias(riders, "inRider")

  return db
    .select({
      bidId: transferBids.id,
      outRiderId: transferBids.outRiderId,
      outRiderName: outRider.name,
      inRiderId: transferBids.inRiderId,
      inRiderName: inRider.name,
      status: transferBids.status,
      reason: transferBids.reason,
      adminNote: transferBids.adminNote,
      submittedAt: transferBids.submittedAt,
      resolvedAt: transferBids.resolvedAt,
    })
    .from(transferBids)
    .innerJoin(outRider, eq(outRider.id, transferBids.outRiderId))
    .innerJoin(inRider, eq(inRider.id, transferBids.inRiderId))
    .where(
      and(
        eq(transferBids.teamId, teamId),
        eq(transferBids.leagueId, leagueId)
      )
    )
    .orderBy(desc(transferBids.submittedAt))
}

/**
 * Returns the currently active transfer window (where now() BETWEEN opensAt AND closesAt).
 * Returns null if no active window.
 */
export async function getActiveTransferWindow(leagueId: number) {
  const now = new Date()

  const result = await db
    .select()
    .from(transferWindows)
    .where(
      and(
        eq(transferWindows.leagueId, leagueId),
        lte(transferWindows.opensAt, now),
        gt(transferWindows.closesAt, now)
      )
    )
    .limit(1)

  return result[0] ?? null
}

/**
 * Counts approved transfers for a team within a specific transfer window's time range.
 * Used for limit checking when validating new transfer bids.
 */
export async function getTeamTransferCount(
  teamId: number,
  leagueId: number,
  windowId: number
) {
  // Get window dates for range checking
  const windowResult = await db
    .select({
      opensAt: transferWindows.opensAt,
      closesAt: transferWindows.closesAt,
    })
    .from(transferWindows)
    .where(eq(transferWindows.id, windowId))
    .limit(1)

  if (!windowResult[0]) return 0

  const { opensAt, closesAt } = windowResult[0]

  const result = await db
    .select({ total: count() })
    .from(transferBids)
    .where(
      and(
        eq(transferBids.teamId, teamId),
        eq(transferBids.leagueId, leagueId),
        eq(transferBids.status, "approved"),
        gte(transferBids.submittedAt, opensAt),
        lte(transferBids.submittedAt, closesAt)
      )
    )

  return result[0]?.total ?? 0
}

// Export inferred types for consumers
export type FreeAgent = Awaited<ReturnType<typeof getFreeAgents>>[number]
export type TeamRosterEntry = Awaited<ReturnType<typeof getTeamRoster>>[number]
export type TeamBid = Awaited<ReturnType<typeof getTeamBids>>[number]
export type ActiveTransferWindow = Awaited<ReturnType<typeof getActiveTransferWindow>>

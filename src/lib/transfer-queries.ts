import { db } from "@/lib/db"
import { transferBids, transferWindows } from "@/db/schema/transfers"
import { draftPicks } from "@/db/schema/draft"
import { riders } from "@/db/schema/riders"
import { races } from "@/db/schema/races"
import { teams, leagueRaces } from "@/db/schema/leagues"
import { rosterSlots } from "@/db/schema/roster-slots"
import { getLeagueStandings } from "@/lib/scoring-queries"
import { eq, and, notInArray, lte, gt, desc, isNull, asc, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

/**
 * Returns all riders NOT currently on any team in this league, filtered by gender.
 * Uses notInArray subquery against draftPicks for the given leagueId.
 */
export async function getFreeAgents(leagueId: number, gender: "M" | "F") {
  const ownedRiderIds = db
    .select({ riderId: draftPicks.riderId })
    .from(draftPicks)
    .where(and(eq(draftPicks.leagueId, leagueId), isNull(draftPicks.droppedAt)))

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
 * Returns all riders on a team roster via roster_slots, joined with riders for metadata
 * and draftPicks for pickedAt + pickNumber (needed for ownership-at-race-time context).
 * isOnIR derived from roster_slots.status IN ('on_ir', 'return_eligible').
 * Ordered by gender (M first), then rider name.
 */
export async function getTeamRoster(teamId: number, leagueId: number) {
  return db
    .select({
      riderId: rosterSlots.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      nationality: riders.nationality,
      pickNumber: draftPicks.pickNumber,
      pickedAt: draftPicks.pickedAt,
      isOnIR: sql<boolean>`${rosterSlots.status} IN ('on_ir', 'return_eligible')`.as("isOnIR"),
    })
    .from(rosterSlots)
    .innerJoin(riders, eq(riders.id, rosterSlots.riderId))
    .innerJoin(
      draftPicks,
      and(
        eq(draftPicks.riderId, rosterSlots.riderId),
        eq(draftPicks.teamId, rosterSlots.teamId),
        eq(draftPicks.leagueId, rosterSlots.leagueId)
      )
    )
    .where(
      and(
        eq(rosterSlots.teamId, teamId),
        eq(rosterSlots.leagueId, leagueId)
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
      bidAmount: transferBids.bidAmount,
      adminNote: transferBids.adminNote,
      submittedAt: transferBids.submittedAt,
      resolvedAt: transferBids.resolvedAt,
    })
    .from(transferBids)
    .leftJoin(outRider, eq(outRider.id, transferBids.outRiderId))
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
 * Resolves conflicting bids for the same free agent using waiver wire priority.
 * Per user decision #2: "Priority by standings — team with lowest total points gets priority."
 *
 * Algorithm:
 * 1. Fetch all pending bids for the league
 * 2. Group by inRiderId — bids for different riders don't conflict
 * 3. For groups with >1 bid, sort by team totalPoints ASC (lowest = highest priority)
 * 4. Tiebreaker: submittedAt ASC (earlier bid wins)
 * 5. Return ordered list of winning bids (one per unique inRiderId), losers marked
 *
 * Returns: priority-ordered winning bids (one per free agent) and the rejected bid IDs with notes.
 */
export async function resolveConflictingBids(leagueId: number, season: number) {
  // Step 1: Fetch all pending bids for this league
  const pendingBids = await db
    .select({
      bidId: transferBids.id,
      teamId: transferBids.teamId,
      inRiderId: transferBids.inRiderId,
      bidAmount: transferBids.bidAmount,
      submittedAt: transferBids.submittedAt,
    })
    .from(transferBids)
    .where(
      and(
        eq(transferBids.leagueId, leagueId),
        eq(transferBids.status, "pending")
      )
    )

  if (pendingBids.length === 0) {
    return { winningBids: [], rejectedBids: [] }
  }

  // Step 2: Get standings for priority ordering
  const standings = await getLeagueStandings(leagueId, season)
  const pointsByTeamId = new Map<number, number>(
    standings.map((s) => [s.teamId, s.totalPoints])
  )

  // Step 3: Group bids by inRiderId
  const bidsByRider = new Map<number, typeof pendingBids>()
  for (const bid of pendingBids) {
    const existing = bidsByRider.get(bid.inRiderId) ?? []
    existing.push(bid)
    bidsByRider.set(bid.inRiderId, existing)
  }

  const winningBids: Array<{ bidId: number; teamId: number; priority: number }> = []
  const rejectedBids: Array<{ bidId: number; note: string }> = []

  let priorityCounter = 1

  for (const [, bids] of bidsByRider) {
    // Sort by bidAmount DESC (highest bid wins), tiebreaker totalPoints ASC (fewer points wins), then submittedAt ASC
    const sorted = [...bids].sort((a, b) => {
      // Highest bid wins
      if (a.bidAmount !== b.bidAmount) return b.bidAmount - a.bidAmount
      // Tiebreaker: fewer total points wins
      const pointsA = pointsByTeamId.get(a.teamId) ?? 0
      const pointsB = pointsByTeamId.get(b.teamId) ?? 0
      if (pointsA !== pointsB) return pointsA - pointsB
      // Tiebreaker: earlier submission wins
      const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
      const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
      return timeA - timeB
    })

    // First bid in sorted order wins
    winningBids.push({
      bidId: sorted[0].bidId,
      teamId: sorted[0].teamId,
      priority: priorityCounter++,
    })

    // Remaining bids are rejected
    for (let i = 1; i < sorted.length; i++) {
      rejectedBids.push({
        bidId: sorted[i].bidId,
        note: "Outbid (higher bid amount)",
      })
    }
  }

  // Sort winning bids by priority (lowest priority number = first to process)
  winningBids.sort((a, b) => a.priority - b.priority)

  return { winningBids, rejectedBids }
}

/**
 * Generates transfer window proposals from the race calendar for a given season.
 * Per user decision #4: "Transfer windows auto-generated from league settings, with admin override."
 *
 * Only parent races (parentRaceId IS NULL) are used — stages are skipped.
 * Window timing is determined by race type.
 * Returns proposals — the admin action inserts them.
 */
export async function generateTransferWindows(leagueId: number, season: number) {
  // Fetch only league-assigned parent races for the season, ordered by startDate
  const parentRaceRows = await db
    .select({
      id: races.id,
      name: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
    })
    .from(races)
    .innerJoin(
      leagueRaces,
      and(
        eq(leagueRaces.raceId, races.id),
        eq(leagueRaces.leagueId, leagueId)
      )
    )
    .where(
      and(
        eq(races.season, season),
        isNull(races.parentRaceId)
      )
    )
    .orderBy(asc(races.startDate))

  // Map race type to window parameters
  const windowParams: Record<
    string,
    { daysBeforeOpen: number }
  > = {
    grand_tour:              { daysBeforeOpen: 7 },
    womens_grand_tour:       { daysBeforeOpen: 7 },
    world_championship:      { daysBeforeOpen: 7 },
    high_priority_one_day:   { daysBeforeOpen: 5 },
    low_priority_one_day:    { daysBeforeOpen: 3 },
    mini_tour:               { daysBeforeOpen: 3 },
    womens_one_day:          { daysBeforeOpen: 3 },
  }

  return parentRaceRows.map((race) => {
    const params = windowParams[race.raceType] ?? { daysBeforeOpen: 3 }

    const startDate = new Date(race.startDate)

    // Opens N days before startDate (midnight UTC)
    const opensAt = new Date(startDate)
    opensAt.setUTCDate(opensAt.getUTCDate() - params.daysBeforeOpen)
    opensAt.setUTCHours(0, 0, 0, 0)

    // Closes 1 day before startDate at 23:59:59 UTC
    const closesAt = new Date(startDate)
    closesAt.setUTCDate(closesAt.getUTCDate() - 1)
    closesAt.setUTCHours(23, 59, 59, 0)

    return {
      leagueId,
      raceId: race.id,
      opensAt,
      closesAt,
      description: `Transfer window for ${race.name}`,
      isAutoGenerated: true as const,
    }
  })
}

/**
 * Returns the transfer budget for a team.
 */
export async function getTeamBudget(teamId: number) {
  const result = await db
    .select({ transferBudget: teams.transferBudget })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)

  return result[0]?.transferBudget ?? 0
}

export type ResolvedBid = { bidId: number; teamId: number; priority: number }
export type GeneratedWindow = Awaited<ReturnType<typeof generateTransferWindows>>[number]

// Export inferred types for consumers
export type FreeAgent = Awaited<ReturnType<typeof getFreeAgents>>[number]
export type TeamRosterEntry = Awaited<ReturnType<typeof getTeamRoster>>[number]
export type TeamBid = Awaited<ReturnType<typeof getTeamBids>>[number]
export type ActiveTransferWindow = Awaited<ReturnType<typeof getActiveTransferWindow>>

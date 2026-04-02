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
 * Checks for recently closed waiver windows that still have pending bids,
 * and auto-resolves them. Called lazily on transfers page load.
 *
 * Only resolves windows that closed within the last 7 days (avoid re-processing ancient windows).
 * Uses the resolveConflicts pure function + approveBid for execution.
 */
export async function autoResolveExpiredWaivers(leagueId: number, season: number) {
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)

  // Find waiver windows that have closed but still have pending bids
  const closedWaiverWindows = await db
    .select({ id: transferWindows.id, closesAt: transferWindows.closesAt })
    .from(transferWindows)
    .where(
      and(
        eq(transferWindows.leagueId, leagueId),
        eq(transferWindows.windowType, "waiver"),
        lte(transferWindows.closesAt, now),
        gt(transferWindows.closesAt, sevenDaysAgo)
      )
    )

  if (closedWaiverWindows.length === 0) return { resolved: 0 }

  // Check if there are any pending bids for this league
  const pendingBids = await db
    .select({ id: transferBids.id })
    .from(transferBids)
    .where(
      and(
        eq(transferBids.leagueId, leagueId),
        eq(transferBids.status, "pending")
      )
    )
    .limit(1)

  if (pendingBids.length === 0) return { resolved: 0 }

  // There are pending bids and a recently-closed waiver window — resolve them
  const { getLeagueStandings } = await import("@/lib/scoring-queries")
  const standings = await getLeagueStandings(leagueId, season)
  const pointsByTeamId = new Map<number, number>(
    standings.map((s) => [s.teamId, s.totalPoints])
  )

  // Fetch all pending bids
  const allPendingBids = await db
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

  const { winningBids, rejectedBids } = resolveConflicts(allPendingBids, pointsByTeamId)

  // Reject losing bids
  for (const { bidId, note } of rejectedBids) {
    await db
      .update(transferBids)
      .set({
        status: "rejected",
        resolvedAt: new Date(),
        resolvedBy: "system",
        adminNote: note,
      })
      .where(eq(transferBids.id, bidId))
  }

  // Approve winning bids using the admin approveBid logic
  const { approveBidSystem } = await import("@/app/admin/transfers/actions")
  let approved = 0

  for (const { bidId } of winningBids) {
    const result = await approveBidSystem(bidId)
    if (result.success) {
      approved++
    } else {
      // Auto-reject on failure
      await db
        .update(transferBids)
        .set({
          status: "rejected",
          resolvedAt: new Date(),
          resolvedBy: "system",
          adminNote: "Auto-rejected: " + (result.error ?? "rider claimed by higher-priority team"),
        })
        .where(eq(transferBids.id, bidId))
    }
  }

  return { resolved: approved + rejectedBids.length }
}


/**
 * Pure conflict resolution algorithm — no DB access.
 * Takes pending bids and a map of teamId → totalPoints, returns winning and rejected bids.
 *
 * Rules:
 * 1. Bids are grouped by inRiderId (bids for different riders don't conflict)
 * 2. Within each group, highest bidAmount wins
 * 3. Tiebreaker: fewest totalPoints wins (waiver wire priority — worst team gets first pick)
 * 4. Tiebreaker: earliest submittedAt wins
 * 5. One winner per inRiderId, rest are rejected
 */
export function resolveConflicts(
  pendingBids: Array<{
    bidId: number
    teamId: number
    inRiderId: number
    bidAmount: number
    submittedAt: Date | string | null
  }>,
  pointsByTeamId: Map<number, number>
): {
  winningBids: Array<{ bidId: number; teamId: number; priority: number }>
  rejectedBids: Array<{ bidId: number; note: string }>
} {
  if (pendingBids.length === 0) {
    return { winningBids: [], rejectedBids: [] }
  }

  // Group bids by inRiderId
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
    // Sort by bidAmount DESC, totalPoints ASC, submittedAt ASC
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

    // First in sorted order wins
    winningBids.push({
      bidId: sorted[0].bidId,
      teamId: sorted[0].teamId,
      priority: priorityCounter++,
    })

    // Remaining are rejected
    for (let i = 1; i < sorted.length; i++) {
      rejectedBids.push({
        bidId: sorted[i].bidId,
        note: "Outbid (higher bid amount)",
      })
    }
  }

  // Sort winning bids by priority
  winningBids.sort((a, b) => a.priority - b.priority)

  return { winningBids, rejectedBids }
}

/**
 * Resolves conflicting bids for the same free agent using waiver wire priority.
 * Delegates to resolveConflicts after fetching data from the database.
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

  // Step 3: Delegate to pure algorithm
  return resolveConflicts(pendingBids, pointsByTeamId)
}

/**
 * Generates transfer windows from the race calendar for a given season.
 *
 * New system (per user decision):
 * For each consecutive pair of races:
 *   - Waiver window: opens at 13:00 UTC on current race day, closes 23:59 UTC the day before next race
 *   - Free agency: opens at 00:00 UTC on next race day, closes 13:00 UTC on next race day
 *
 * For the first race of the season:
 *   - Waiver window: opens 7 days before, closes 23:59 the day before
 *   - Free agency: opens 00:00 race day, closes 13:00 race day
 *
 * Only parent races (parentRaceId IS NULL) are used.
 * Returns proposals — the admin action inserts them.
 */
export async function generateTransferWindows(leagueId: number, season: number) {
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

  const windows: Array<{
    leagueId: number
    raceId: number | null
    opensAt: Date
    closesAt: Date
    windowType: string
    description: string
    isAutoGenerated: true
  }> = []

  for (let i = 0; i < parentRaceRows.length; i++) {
    const race = parentRaceRows[i]
    const raceDate = new Date(race.startDate)

    // Free agency: 00:00 to 13:00 UTC on race day
    const faOpen = new Date(raceDate)
    faOpen.setUTCHours(0, 0, 0, 0)
    const faClose = new Date(raceDate)
    faClose.setUTCHours(13, 0, 0, 0)

    windows.push({
      leagueId,
      raceId: race.id,
      opensAt: faOpen,
      closesAt: faClose,
      windowType: "free_agency",
      description: `Free agency for ${race.name}`,
      isAutoGenerated: true,
    })

    // Waiver window: 13:00 UTC on race day → 23:59 the day before the NEXT race
    if (i < parentRaceRows.length - 1) {
      const nextRace = parentRaceRows[i + 1]
      const nextRaceDate = new Date(nextRace.startDate)

      const waiverOpen = new Date(raceDate)
      waiverOpen.setUTCHours(13, 0, 0, 0)

      const waiverClose = new Date(nextRaceDate)
      waiverClose.setUTCDate(waiverClose.getUTCDate() - 1)
      waiverClose.setUTCHours(23, 59, 59, 0)

      // Only create waiver window if it would have positive duration
      if (waiverClose > waiverOpen) {
        windows.push({
          leagueId,
          raceId: race.id,
          opensAt: waiverOpen,
          closesAt: waiverClose,
          windowType: "waiver",
          description: `Waiver window after ${race.name}`,
          isAutoGenerated: true,
        })
      }
    }
  }

  // First race special case: waiver window opens 7 days before first race
  if (parentRaceRows.length > 0) {
    const firstRace = parentRaceRows[0]
    const firstRaceDate = new Date(firstRace.startDate)

    const earlyWaiverOpen = new Date(firstRaceDate)
    earlyWaiverOpen.setUTCDate(earlyWaiverOpen.getUTCDate() - 7)
    earlyWaiverOpen.setUTCHours(0, 0, 0, 0)

    const earlyWaiverClose = new Date(firstRaceDate)
    earlyWaiverClose.setUTCDate(earlyWaiverClose.getUTCDate() - 1)
    earlyWaiverClose.setUTCHours(23, 59, 59, 0)

    if (earlyWaiverClose > earlyWaiverOpen) {
      windows.unshift({
        leagueId,
        raceId: firstRace.id,
        opensAt: earlyWaiverOpen,
        closesAt: earlyWaiverClose,
        windowType: "waiver",
        description: `Pre-season waiver window before ${firstRace.name}`,
        isAutoGenerated: true,
      })
    }
  }

  return windows
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

/**
 * Returns all transfer bids in a league (all teams), ordered by most recent first.
 * Used to show league-wide transfer activity.
 */
export async function getLeagueTransfers(leagueId: number) {
  const outRider = alias(riders, "outRider")
  const inRider = alias(riders, "inRider")

  return db
    .select({
      bidId: transferBids.id,
      teamName: teams.name,
      outRiderName: outRider.name,
      inRiderName: inRider.name,
      status: transferBids.status,
      bidAmount: transferBids.bidAmount,
      submittedAt: transferBids.submittedAt,
      resolvedAt: transferBids.resolvedAt,
    })
    .from(transferBids)
    .innerJoin(teams, eq(teams.id, transferBids.teamId))
    .leftJoin(outRider, eq(outRider.id, transferBids.outRiderId))
    .innerJoin(inRider, eq(inRider.id, transferBids.inRiderId))
    .where(eq(transferBids.leagueId, leagueId))
    .orderBy(desc(transferBids.submittedAt))
}

export type LeagueTransfer = Awaited<ReturnType<typeof getLeagueTransfers>>[number]

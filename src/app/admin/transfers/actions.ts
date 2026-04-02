"use server"

import { db } from "@/lib/db"
import { transferBids, transferWindows, transferAudit } from "@/db/schema/transfers"
import { draftPicks } from "@/db/schema/draft"
import { rosterSlots } from "@/db/schema/roster-slots"
import { riders } from "@/db/schema/riders"
import { races } from "@/db/schema/races"
import { leagues, teams, LeagueConfig } from "@/db/schema/leagues"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq, and, ne, desc, isNull, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { resolveConflictingBids, generateTransferWindows } from "@/lib/transfer-queries"
import { z } from "zod"

async function checkAdminAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    throw new Error("Unauthorized")
  }
  const [dbUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!dbUser || dbUser.role !== "admin") {
    throw new Error("Unauthorized")
  }
  return session
}

export async function getPendingBids() {
  await checkAdminAuth()

  const outRider = alias(riders, "outRider")
  const inRider = alias(riders, "inRider")

  return db
    .select({
      bidId: transferBids.id,
      leagueId: transferBids.leagueId,
      leagueName: leagues.name,
      teamId: transferBids.teamId,
      teamName: teams.name,
      outRiderId: transferBids.outRiderId,
      outRiderName: outRider.name,
      inRiderId: transferBids.inRiderId,
      inRiderName: inRider.name,
      bidAmount: transferBids.bidAmount,
      reason: transferBids.reason,
      submittedAt: transferBids.submittedAt,
    })
    .from(transferBids)
    .innerJoin(leagues, eq(leagues.id, transferBids.leagueId))
    .innerJoin(teams, eq(teams.id, transferBids.teamId))
    .leftJoin(outRider, eq(outRider.id, transferBids.outRiderId))
    .innerJoin(inRider, eq(inRider.id, transferBids.inRiderId))
    .where(eq(transferBids.status, "pending"))
    .orderBy(transferBids.submittedAt)
}

export async function getBidHistory(limit = 50) {
  await checkAdminAuth()

  const outRider = alias(riders, "outRider")
  const inRider = alias(riders, "inRider")

  return db
    .select({
      bidId: transferBids.id,
      leagueId: transferBids.leagueId,
      leagueName: leagues.name,
      teamId: transferBids.teamId,
      teamName: teams.name,
      outRiderId: transferBids.outRiderId,
      outRiderName: outRider.name,
      inRiderId: transferBids.inRiderId,
      inRiderName: inRider.name,
      bidAmount: transferBids.bidAmount,
      status: transferBids.status,
      reason: transferBids.reason,
      adminNote: transferBids.adminNote,
      resolvedAt: transferBids.resolvedAt,
      resolvedBy: transferBids.resolvedBy,
    })
    .from(transferBids)
    .innerJoin(leagues, eq(leagues.id, transferBids.leagueId))
    .innerJoin(teams, eq(teams.id, transferBids.teamId))
    .leftJoin(outRider, eq(outRider.id, transferBids.outRiderId))
    .innerJoin(inRider, eq(inRider.id, transferBids.inRiderId))
    .where(ne(transferBids.status, "pending"))
    .orderBy(desc(transferBids.resolvedAt))
    .limit(limit)
}

export async function approveBid(bidId: number) {
  const session = await checkAdminAuth()
  return _approveBidInternal(bidId, session.user.id)
}

/**
 * System-level bid approval — no auth check. Used by auto-resolve.
 */
export async function approveBidSystem(bidId: number) {
  return _approveBidInternal(bidId, "system")
}

async function _approveBidInternal(bidId: number, actorId: string) {
  try {
    await db.transaction(async (tx) => {
      // Step 1: Fetch bid and verify it's pending
      const bid = await tx.query.transferBids.findFirst({
        where: and(eq(transferBids.id, bidId), eq(transferBids.status, "pending")),
      })
      if (!bid) {
        throw new Error("Bid not found or not pending")
      }

      // Step 2: Re-verify inRider is still a free agent (race condition protection)
      const existingPick = await tx.query.draftPicks.findFirst({
        where: and(
          eq(draftPicks.leagueId, bid.leagueId),
          eq(draftPicks.riderId, bid.inRiderId),
          isNull(draftPicks.droppedAt)
        ),
      })
      if (existingPick) {
        throw new Error("Incoming rider is no longer a free agent")
      }

      // Step 3: Re-verify outRider still belongs to team (only if this is a swap)
      let currentPick = null
      let currentSlot = null
      if (bid.outRiderId != null) {
        currentPick = await tx.query.draftPicks.findFirst({
          where: and(
            eq(draftPicks.leagueId, bid.leagueId),
            eq(draftPicks.teamId, bid.teamId),
            eq(draftPicks.riderId, bid.outRiderId)
          ),
        })
        if (!currentPick) {
          currentSlot = await tx.query.rosterSlots.findFirst({
            where: and(
              eq(rosterSlots.leagueId, bid.leagueId),
              eq(rosterSlots.teamId, bid.teamId),
              eq(rosterSlots.riderId, bid.outRiderId!)
            ),
          })
          if (!currentSlot) {
            throw new Error("Outgoing rider is no longer on this team")
          }
        }
      }

      // Step 4: Get inRider gender
      const inRiderRecord = await tx.query.riders.findFirst({
        where: eq(riders.id, bid.inRiderId),
      })
      if (!inRiderRecord) {
        throw new Error("Incoming rider not found")
      }

      // Step 5: Drop outgoing rider
      if (bid.outRiderId != null) {
        if (currentPick) {
          await tx.delete(draftPicks).where(eq(draftPicks.id, currentPick.id))
        }
        await tx.delete(rosterSlots).where(
          and(
            eq(rosterSlots.leagueId, bid.leagueId),
            eq(rosterSlots.riderId, bid.outRiderId)
          )
        )
      }

      // Step 6: Insert new draftPick
      await tx.insert(draftPicks).values({
        leagueId: bid.leagueId,
        teamId: bid.teamId,
        riderId: bid.inRiderId,
        pickNumber: -bidId,
        round: -1,
        gender: inRiderRecord.gender,
        wasAutomatic: false,
        pickedAt: new Date(),
      })

      // Insert/update roster slot
      await tx
        .insert(rosterSlots)
        .values({
          leagueId: bid.leagueId,
          teamId: bid.teamId,
          riderId: bid.inRiderId,
          status: "active",
        })
        .onConflictDoUpdate({
          target: [rosterSlots.leagueId, rosterSlots.riderId],
          set: {
            teamId: bid.teamId,
            status: "active",
          },
        })

      // Step 7: Update bid status
      await tx
        .update(transferBids)
        .set({
          status: "approved",
          resolvedAt: new Date(),
          resolvedBy: actorId,
        })
        .where(eq(transferBids.id, bidId))

      // Step 7b: Deduct transfer budget
      if (bid.bidAmount > 0) {
        await tx
          .update(teams)
          .set({
            transferBudget: sql`${teams.transferBudget} - ${bid.bidAmount}`,
          })
          .where(eq(teams.id, bid.teamId))
      }

      // Step 8: Insert audit entry
      await tx.insert(transferAudit).values({
        transferBidId: bidId,
        leagueId: bid.leagueId,
        action: "APPROVED",
        performedBy: actorId,
      })
    })

    revalidatePath("/admin/transfers")
    const bid = await db.query.transferBids.findFirst({
      where: eq(transferBids.id, bidId),
    })
    if (bid) {
      revalidatePath(`/leagues/${bid.leagueId}/transfers`)
      revalidatePath(`/leagues/${bid.leagueId}/standings`)
    }

    return { success: true }
  } catch (error: any) {
    if (error.code === "23505") {
      return { success: false, error: "Rider is already on a team in this league" }
    }
    return { success: false, error: (error as Error).message }
  }
}

export async function rejectBid(bidId: number, adminNote: string) {
  const session = await checkAdminAuth()

  try {
    const bid = await db.query.transferBids.findFirst({
      where: and(eq(transferBids.id, bidId), eq(transferBids.status, "pending")),
    })
    if (!bid) {
      return { success: false, error: "Bid not found or not pending" }
    }

    await db
      .update(transferBids)
      .set({
        status: "rejected",
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
        adminNote,
      })
      .where(eq(transferBids.id, bidId))

    await db.insert(transferAudit).values({
      transferBidId: bidId,
      leagueId: bid.leagueId,
      action: "REJECTED",
      performedBy: session.user.id,
      note: adminNote,
    })

    revalidatePath("/admin/transfers")
    revalidatePath(`/leagues/${bid.leagueId}/transfers`)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Returns all active leagues. Used by admin UI to populate league selectors.
 */
export async function getActiveLeagues() {
  await checkAdminAuth()

  return db
    .select({ id: leagues.id, name: leagues.name })
    .from(leagues)
    .where(eq(leagues.status, "active"))
    .orderBy(leagues.name)
}

/**
 * Returns all transfer windows for a league, with joined race name where applicable.
 */
export async function getTransferWindows(leagueId: number) {
  await checkAdminAuth()

  return db
    .select({
      id: transferWindows.id,
      leagueId: transferWindows.leagueId,
      raceId: transferWindows.raceId,
      raceName: races.name,
      opensAt: transferWindows.opensAt,
      closesAt: transferWindows.closesAt,
      description: transferWindows.description,
      isAutoGenerated: transferWindows.isAutoGenerated,
    })
    .from(transferWindows)
    .leftJoin(races, eq(races.id, transferWindows.raceId))
    .where(eq(transferWindows.leagueId, leagueId))
    .orderBy(transferWindows.opensAt)
}

/**
 * Batch-resolves all pending bids for a league using waiver wire priority.
 * Per user decision #2: team with lowest total points gets priority.
 *
 * Flow:
 * 1. Reject conflicting non-winning bids first
 * 2. Approve winning bids in priority order (one per free agent)
 * 3. If approveBid throws (race condition), auto-reject with note
 */
export async function resolveWaiverWire(leagueId: number) {
  const session = await checkAdminAuth()

  // Fetch league to get seasonYear
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, leagueId),
  })
  if (!league) {
    return { success: false, error: "League not found" }
  }
  const config = league.config as LeagueConfig
  const season = config.seasonYear

  // Get priority-ordered winning bids and bids to auto-reject
  const { winningBids, rejectedBids } = await resolveConflictingBids(leagueId, season)

  // First: reject the conflicting losing bids (non-winners)
  for (const { bidId, note } of rejectedBids) {
    await db
      .update(transferBids)
      .set({
        status: "rejected",
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
        adminNote: note,
      })
      .where(eq(transferBids.id, bidId))

    const bid = await db.query.transferBids.findFirst({
      where: eq(transferBids.id, bidId),
    })
    if (bid) {
      await db.insert(transferAudit).values({
        transferBidId: bidId,
        leagueId: bid.leagueId,
        action: "REJECTED",
        performedBy: session.user.id,
        note,
      })
    }
  }

  // Then: approve winning bids in priority order
  let approved = 0
  let autoRejected = 0

  for (const { bidId } of winningBids) {
    const result = await approveBid(bidId)
    if (result.success) {
      approved++
    } else {
      // Race condition or other error — auto-reject with note
      await db
        .update(transferBids)
        .set({
          status: "rejected",
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
          adminNote: "Rider claimed by higher-priority team",
        })
        .where(eq(transferBids.id, bidId))

      const bid = await db.query.transferBids.findFirst({
        where: eq(transferBids.id, bidId),
      })
      if (bid) {
        await db.insert(transferAudit).values({
          transferBidId: bidId,
          leagueId: bid.leagueId,
          action: "REJECTED",
          performedBy: session.user.id,
          note: "Rider claimed by higher-priority team",
        })
      }
      autoRejected++
    }
  }

  revalidatePath("/admin/transfers")
  revalidatePath(`/leagues/${leagueId}/transfers`)

  return {
    success: true,
    approved,
    rejected: rejectedBids.length + autoRejected,
  }
}

/**
 * Auto-generates transfer windows for a league based on its race calendar.
 * Deletes existing auto-generated windows first, then inserts new ones.
 * Per user decision #4: windows auto-generated with admin override.
 */
export async function generateWindowsForLeague(leagueId: number) {
  await checkAdminAuth()

  // Fetch league to get seasonYear
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, leagueId),
  })
  if (!league) {
    return { success: false, error: "League not found" }
  }
  const config = league.config as LeagueConfig
  const season = config.seasonYear

  // Generate window proposals
  const proposals = await generateTransferWindows(leagueId, season)

  // Delete existing auto-generated windows for this league
  await db
    .delete(transferWindows)
    .where(
      and(
        eq(transferWindows.leagueId, leagueId),
        eq(transferWindows.isAutoGenerated, true)
      )
    )

  // Insert proposed windows (only if there are proposals)
  if (proposals.length > 0) {
    await db.insert(transferWindows).values(proposals)
  }

  revalidatePath("/admin/transfers")

  return { success: true, windowsCreated: proposals.length }
}

const createTransferWindowSchema = z.object({
  leagueId: z.number().int().positive(),
  raceId: z.number().int().positive().optional(),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
  description: z.string().max(255).optional(),
})

/**
 * Manually creates a transfer window. Admin can create windows not tied to a race.
 */
export async function createTransferWindow(data: {
  leagueId: number
  raceId?: number
  opensAt: string
  closesAt: string
  description?: string
}) {
  await checkAdminAuth()

  const parsed = createTransferWindowSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: "Invalid input" }
  }

  const { leagueId, raceId, opensAt, closesAt, description } = parsed.data

  await db.insert(transferWindows).values({
    leagueId,
    raceId: raceId ?? null,
    opensAt: new Date(opensAt),
    closesAt: new Date(closesAt),
    description: description ?? null,
    isAutoGenerated: false,
  })

  revalidatePath("/admin/transfers")

  return { success: true }
}

/**
 * Closes a transfer window early by setting closesAt to now.
 * Admin override to end a window before its scheduled close time.
 */
export async function closeTransferWindow(windowId: number) {
  await checkAdminAuth()

  await db
    .update(transferWindows)
    .set({ closesAt: new Date() })
    .where(eq(transferWindows.id, windowId))

  revalidatePath("/admin/transfers")

  return { success: true }
}

export type PendingBid = Awaited<ReturnType<typeof getPendingBids>>[number]
export type BidHistoryEntry = Awaited<ReturnType<typeof getBidHistory>>[number]
export type ActiveLeague = Awaited<ReturnType<typeof getActiveLeagues>>[number]
export type TransferWindow = Awaited<ReturnType<typeof getTransferWindows>>[number]

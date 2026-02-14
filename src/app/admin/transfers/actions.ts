"use server"

import { db } from "@/lib/db"
import { transferBids, transferAudit } from "@/db/schema/transfers"
import { draftPicks } from "@/db/schema/draft"
import { riders } from "@/db/schema/riders"
import { leagues, teams } from "@/db/schema/leagues"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq, and, ne, desc } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

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
      reason: transferBids.reason,
      submittedAt: transferBids.submittedAt,
    })
    .from(transferBids)
    .innerJoin(leagues, eq(leagues.id, transferBids.leagueId))
    .innerJoin(teams, eq(teams.id, transferBids.teamId))
    .innerJoin(outRider, eq(outRider.id, transferBids.outRiderId))
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
      status: transferBids.status,
      reason: transferBids.reason,
      adminNote: transferBids.adminNote,
      resolvedAt: transferBids.resolvedAt,
      resolvedBy: transferBids.resolvedBy,
    })
    .from(transferBids)
    .innerJoin(leagues, eq(leagues.id, transferBids.leagueId))
    .innerJoin(teams, eq(teams.id, transferBids.teamId))
    .innerJoin(outRider, eq(outRider.id, transferBids.outRiderId))
    .innerJoin(inRider, eq(inRider.id, transferBids.inRiderId))
    .where(ne(transferBids.status, "pending"))
    .orderBy(desc(transferBids.resolvedAt))
    .limit(limit)
}

export async function approveBid(bidId: number) {
  const session = await checkAdminAuth()

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
          eq(draftPicks.riderId, bid.inRiderId)
        ),
      })
      if (existingPick) {
        throw new Error("Incoming rider is no longer a free agent")
      }

      // Step 3: Re-verify outRider still belongs to team
      const currentPick = await tx.query.draftPicks.findFirst({
        where: and(
          eq(draftPicks.leagueId, bid.leagueId),
          eq(draftPicks.teamId, bid.teamId),
          eq(draftPicks.riderId, bid.outRiderId)
        ),
      })
      if (!currentPick) {
        throw new Error("Outgoing rider is no longer on this team")
      }

      // Step 4: Get inRider gender (needed for new draftPick.gender)
      const inRiderRecord = await tx.query.riders.findFirst({
        where: eq(riders.id, bid.inRiderId),
      })
      if (!inRiderRecord) {
        throw new Error("Incoming rider not found")
      }

      // Step 5: Delete old draftPick
      await tx.delete(draftPicks).where(eq(draftPicks.id, currentPick.id))

      // Step 6: Insert new draftPick
      // pickNumber = -(bidId) is a sentinel: negative = transfer-generated, unique per bid
      // pickedAt = NOW() is critical for ownership-at-race-time scoring
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

      // Step 7: Update bid status
      await tx
        .update(transferBids)
        .set({
          status: "approved",
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
        })
        .where(eq(transferBids.id, bidId))

      // Step 8: Insert audit entry
      await tx.insert(transferAudit).values({
        transferBidId: bidId,
        leagueId: bid.leagueId,
        action: "APPROVED",
        performedBy: session.user.id,
      })
    })

    revalidatePath("/admin/transfers")
    // Revalidate the specific league's transfer and standings pages
    // We need to get the leagueId from the bid — we re-fetch outside transaction for revalidation
    const bid = await db.query.transferBids.findFirst({
      where: eq(transferBids.id, bidId),
    })
    if (bid) {
      revalidatePath(`/leagues/${bid.leagueId}/transfers`)
      revalidatePath(`/leagues/${bid.leagueId}/standings`)
    }

    return { success: true }
  } catch (error: any) {
    // Handle unique constraint violation on riderLeagueUnique
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

export type PendingBid = Awaited<ReturnType<typeof getPendingBids>>[number]
export type BidHistoryEntry = Awaited<ReturnType<typeof getBidHistory>>[number]

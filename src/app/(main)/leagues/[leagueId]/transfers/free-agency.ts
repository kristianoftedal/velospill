"use server"

import { db } from "@/lib/db"
import { transferBids, transferAudit } from "@/db/schema/transfers"
import { draftPicks } from "@/db/schema/draft"
import { rosterSlots } from "@/db/schema/roster-slots"
import { riders } from "@/db/schema/riders"
import { teams } from "@/db/schema/leagues"
import { eq, and, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

/**
 * Executes an immediate free agency transfer — no bid queuing.
 * Creates a transfer_bid record with status='approved' for audit trail,
 * then swaps the riders in draftPicks and rosterSlots.
 */
export async function approveFreeAgencyTransfer(data: {
  leagueId: number
  teamId: number
  outRiderId: number | null
  inRiderId: number
  userId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const { leagueId, teamId, outRiderId, inRiderId, userId } = data

  try {
    await db.transaction(async (tx) => {
      // Re-verify inRider is still a free agent
      const existingPick = await tx.query.draftPicks.findFirst({
        where: and(
          eq(draftPicks.leagueId, leagueId),
          eq(draftPicks.riderId, inRiderId),
          isNull(draftPicks.droppedAt)
        ),
      })
      if (existingPick) {
        throw new Error("Rider is no longer a free agent")
      }

      // Get inRider gender
      const inRiderRecord = await tx.query.riders.findFirst({
        where: eq(riders.id, inRiderId),
      })
      if (!inRiderRecord) {
        throw new Error("Incoming rider not found")
      }

      // Drop outgoing rider if provided
      if (outRiderId != null) {
        // Soft-delete draft pick
        await tx
          .update(draftPicks)
          .set({ droppedAt: new Date() })
          .where(
            and(
              eq(draftPicks.teamId, teamId),
              eq(draftPicks.leagueId, leagueId),
              eq(draftPicks.riderId, outRiderId),
              isNull(draftPicks.droppedAt)
            )
          )
        // Delete roster slot
        await tx
          .delete(rosterSlots)
          .where(
            and(
              eq(rosterSlots.leagueId, leagueId),
              eq(rosterSlots.riderId, outRiderId)
            )
          )
      }

      // Create bid record for audit trail (pre-approved)
      const [bid] = await tx
        .insert(transferBids)
        .values({
          leagueId,
          teamId,
          outRiderId,
          inRiderId,
          bidAmount: 0,
          status: "approved",
          reason: "Free agency pickup",
          resolvedAt: new Date(),
          resolvedBy: userId,
        })
        .returning()

      // Insert new draft pick
      await tx.insert(draftPicks).values({
        leagueId,
        teamId,
        riderId: inRiderId,
        pickNumber: -bid.id,
        round: -1,
        gender: inRiderRecord.gender,
        wasAutomatic: false,
        pickedAt: new Date(),
      })

      // Insert or update roster slot
      await tx
        .insert(rosterSlots)
        .values({
          leagueId,
          teamId,
          riderId: inRiderId,
          status: "active",
        })
        .onConflictDoUpdate({
          target: [rosterSlots.leagueId, rosterSlots.riderId],
          set: {
            teamId,
            status: "active",
          },
        })

      // Audit entry
      await tx.insert(transferAudit).values({
        transferBidId: bid.id,
        leagueId,
        action: "FREE_AGENCY_PICKUP",
        performedBy: userId,
      })
    })

    revalidatePath(`/leagues/${leagueId}/transfers`)
    revalidatePath(`/leagues/${leagueId}`)
    revalidatePath(`/admin/transfers`)

    return { success: true }
  } catch (error: any) {
    if (error.code === "23505") {
      return { success: false, error: "Rider is already on a team in this league" }
    }
    return { success: false, error: (error as Error).message }
  }
}

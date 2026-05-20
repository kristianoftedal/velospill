"use server"

import { db } from "@/lib/db"
import { transferBids, transferAudit } from "@/db/schema/transfers"
import { rosterSlots } from "@/db/schema/roster-slots"
import { riders } from "@/db/schema/riders"
import { teams } from "@/db/schema/leagues"
import { irRequests } from "@/db/schema/ir"
import { eq, and, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { emitRosterEvent } from "@/lib/roster-events"

/**
 * Executes an immediate free agency transfer — no bid queuing.
 * Creates a transfer_bid record with status='approved' for audit trail,
 * then updates roster_slots and emits roster events.
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
      const existingSlot = await tx.query.rosterSlots.findFirst({
        where: and(
          eq(rosterSlots.leagueId, leagueId),
          eq(rosterSlots.riderId, inRiderId)
        ),
      })
      if (existingSlot) {
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
        // Delete roster slot
        await tx
          .delete(rosterSlots)
          .where(
            and(
              eq(rosterSlots.leagueId, leagueId),
              eq(rosterSlots.riderId, outRiderId)
            )
          )

        // Resolve any active IR requests for the dropped rider
        await tx
          .update(irRequests)
          .set({
            status: "returned",
            resolvedAt: new Date(),
            adminNote: "Auto-resolved: rider dropped via free agency transfer",
          })
          .where(
            and(
              eq(irRequests.leagueId, leagueId),
              eq(irRequests.teamId, teamId),
              eq(irRequests.riderId, outRiderId),
              inArray(irRequests.status, ["approved", "return_eligible"])
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

      // Roster events
      const now = new Date()
      if (outRiderId != null) {
        await emitRosterEvent(tx, {
          leagueId,
          teamId,
          riderId: outRiderId,
          eventType: "transferred_out",
          occurredAt: now,
          metadata: { bidId: bid.id, action: "free_agency" },
        })
      }
      await emitRosterEvent(tx, {
        leagueId,
        teamId,
        riderId: inRiderId,
        eventType: "transferred_in",
        occurredAt: now,
        metadata: { bidId: bid.id, action: "free_agency" },
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
    revalidatePath(`/leagues/${leagueId}/roster`)
    revalidatePath(`/leagues/${leagueId}/lineup`)
    revalidatePath(`/leagues/${leagueId}/ir`)
    revalidatePath(`/admin/transfers`)

    return { success: true }
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { success: false, error: "Rider is already on a team in this league" }
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

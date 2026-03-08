"use server"

import { db } from "@/lib/db"
import { transferBids, transferAudit } from "@/db/schema/transfers"
import { draftPicks } from "@/db/schema/draft"
import { riders } from "@/db/schema/riders"
import { leagues } from "@/db/schema/leagues"
import { eq, and, count } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  getAuthenticatedUser,
  checkLeagueMembership,
} from "@/lib/league-auth"
import {
  getActiveTransferWindow,
  getTeamTransferCount,
  getTeamBudget,
} from "@/lib/transfer-queries"
import { irRequests } from "@/db/schema/ir"
import { rosterSlots } from "@/db/schema/roster-slots"

const submitBidSchema = z.object({
  leagueId: z.number(),
  outRiderId: z.number().optional(),
  inRiderId: z.number(),
  bidAmount: z.number().int().min(0),
  reason: z.string().optional(),
})

export async function submitTransferBid(formData: {
  leagueId: number
  outRiderId?: number
  inRiderId: number
  bidAmount: number
  reason?: string
}): Promise<{ success: true } | { success: false; error: string }> {
  // 1. Auth
  let session: Awaited<ReturnType<typeof getAuthenticatedUser>>
  try {
    session = await getAuthenticatedUser()
  } catch {
    return { success: false, error: "Unauthorized" }
  }

  // 2. Zod validation
  const parsed = submitBidSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: "Invalid form data" }
  }
  const { leagueId, outRiderId, inRiderId, bidAmount, reason } = parsed.data

  // Check league membership
  const { isMember, team } = await checkLeagueMembership(session.user.id, leagueId)
  if (!isMember || !team) {
    return { success: false, error: "You are not a member of this league" }
  }

  // 3. League status guard
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)

  if (!league) {
    return { success: false, error: "League not found" }
  }

  if (league.status !== "active") {
    return { success: false, error: "Transfers are only available for active leagues" }
  }

  // 4. Validate outRider belongs to this team (if provided)
  if (outRiderId != null) {
    const outPick = await db
      .select()
      .from(draftPicks)
      .where(
        and(
          eq(draftPicks.teamId, team.id),
          eq(draftPicks.leagueId, leagueId),
          eq(draftPicks.riderId, outRiderId)
        )
      )
      .limit(1)

    if (!outPick[0]) {
      return { success: false, error: "Rider to drop is not on your team" }
    }
  }

  // 5. Validate inRider is a free agent (no draftPick for this league + rider)
  const inPick = await db
    .select()
    .from(draftPicks)
    .where(
      and(
        eq(draftPicks.leagueId, leagueId),
        eq(draftPicks.riderId, inRiderId)
      )
    )
    .limit(1)

  if (inPick[0]) {
    return { success: false, error: "Selected rider is not a free agent" }
  }

  // 6. Gender constraint and roster slot check
  const [inRiderRecord] = await db
    .select({ gender: riders.gender })
    .from(riders)
    .where(eq(riders.id, inRiderId))
    .limit(1)

  if (!inRiderRecord) {
    return { success: false, error: "Rider not found" }
  }

  if (outRiderId != null) {
    // Swap: outgoing and incoming must have same gender
    const [outRiderRecord] = await db
      .select({ gender: riders.gender })
      .from(riders)
      .where(eq(riders.id, outRiderId))
      .limit(1)

    if (!outRiderRecord) {
      return { success: false, error: "Rider not found" }
    }

    if (outRiderRecord.gender !== inRiderRecord.gender) {
      return {
        success: false,
        error: "You can only swap riders within the same gender pool (men for men, women for women)",
      }
    }
  } else {
    // Pickup without drop: verify team has an available roster slot for this gender.
    const MAX_MEN = 18
    const MAX_WOMEN = 6
    const [genderCountResult] = await db
      .select({ value: count() })
      .from(rosterSlots)
      .innerJoin(riders, eq(riders.id, rosterSlots.riderId))
      .where(
        and(
          eq(rosterSlots.teamId, team.id),
          eq(rosterSlots.leagueId, leagueId),
          eq(rosterSlots.status, "active"),
          eq(riders.gender, inRiderRecord.gender)
        )
      )
    const activeCount = Number(genderCountResult?.value ?? 0)
    const max = inRiderRecord.gender === "M" ? MAX_MEN : MAX_WOMEN
    if (activeCount >= max) {
      return {
        success: false,
        error: `Your roster is full for ${inRiderRecord.gender === "M" ? "men" : "women"} (${max} max). Drop a rider first.`,
      }
    }
  }

  // IR-09: Block transfers if any IR rider for this team is return_eligible
  const [eligibleReturn] = await db
    .select({ id: irRequests.id })
    .from(irRequests)
    .where(
      and(
        eq(irRequests.teamId, team.id),
        eq(irRequests.leagueId, leagueId),
        eq(irRequests.status, "return_eligible")
      )
    )
    .limit(1)

  if (eligibleReturn) {
    return {
      success: false,
      error: "You have riders eligible to return from IR. Return them before submitting a transfer.",
    }
  }

  // 7. Transfer window validation
  const activeWindow = await getActiveTransferWindow(leagueId)

  if (!activeWindow) {
    return { success: false, error: "No active transfer window" }
  }

  if (activeWindow.maxTransfers != null && outRiderId != null) {
    const usedTransfers = await getTeamTransferCount(team.id, leagueId, activeWindow.id)
    if (usedTransfers >= activeWindow.maxTransfers) {
      return {
        success: false,
        error: `Transfer limit reached (${activeWindow.maxTransfers} per window)`,
      }
    }
  }

  // 8. Budget validation
  if (bidAmount > 0) {
    const budget = await getTeamBudget(team.id)
    if (bidAmount > budget) {
      return {
        success: false,
        error: `Insufficient budget. You have ${budget} EUR remaining.`,
      }
    }
  }

  // Insert transfer bid
  const [bid] = await db
    .insert(transferBids)
    .values({
      leagueId,
      teamId: team.id,
      outRiderId: outRiderId ?? null,
      inRiderId,
      bidAmount,
      status: "pending",
      reason: reason ?? null,
    })
    .returning()

  // 9. Insert audit entry
  await db.insert(transferAudit).values({
    transferBidId: bid.id,
    leagueId,
    action: "SUBMITTED",
    performedBy: session.user.id,
  })

  // 10. Revalidate paths
  revalidatePath(`/leagues/${leagueId}/transfers`)
  revalidatePath(`/admin/transfers`)

  return { success: true }
}

export async function cancelTransferBid(
  bidId: number,
  leagueId: number
): Promise<{ success: true } | { success: false; error: string }> {
  // 1. Auth + membership
  let session: Awaited<ReturnType<typeof getAuthenticatedUser>>
  try {
    session = await getAuthenticatedUser()
  } catch {
    return { success: false, error: "Unauthorized" }
  }

  const { isMember, team } = await checkLeagueMembership(session.user.id, leagueId)
  if (!isMember || !team) {
    return { success: false, error: "You are not a member of this league" }
  }

  // 2. Fetch bid, verify ownership + pending status
  const [bid] = await db
    .select()
    .from(transferBids)
    .where(eq(transferBids.id, bidId))
    .limit(1)

  if (!bid) {
    return { success: false, error: "Bid not found" }
  }

  if (bid.teamId !== team.id) {
    return { success: false, error: "You can only cancel your own bids" }
  }

  if (bid.status !== "pending") {
    return { success: false, error: "Only pending bids can be cancelled" }
  }

  // 3. Update bid status
  await db
    .update(transferBids)
    .set({ status: "cancelled", resolvedAt: new Date() })
    .where(eq(transferBids.id, bidId))

  // 4. Insert audit entry
  await db.insert(transferAudit).values({
    transferBidId: bid.id,
    leagueId,
    action: "CANCELLED",
    performedBy: session.user.id,
  })

  // 5. Revalidate paths
  revalidatePath(`/leagues/${leagueId}/transfers`)
  revalidatePath(`/admin/transfers`)

  return { success: true }
}

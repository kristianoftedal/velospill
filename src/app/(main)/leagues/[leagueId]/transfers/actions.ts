"use server"

import { db } from "@/lib/db"
import { transferBids, transferAudit } from "@/db/schema/transfers"
import { draftPicks } from "@/db/schema/draft"
import { riders } from "@/db/schema/riders"
import { leagues } from "@/db/schema/leagues"
import { eq, and } from "drizzle-orm"
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

const submitBidSchema = z.object({
  leagueId: z.number(),
  outRiderId: z.number(),
  inRiderId: z.number(),
  bidAmount: z.number().int().min(0),
  reason: z.string().optional(),
})

export async function submitTransferBid(formData: {
  leagueId: number
  outRiderId: number
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

  // 4. Validate outRider belongs to this team
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

  // 6. Gender constraint: outgoing and incoming rider must have same gender
  const [outRiderRecord] = await db
    .select({ gender: riders.gender })
    .from(riders)
    .where(eq(riders.id, outRiderId))
    .limit(1)

  const [inRiderRecord] = await db
    .select({ gender: riders.gender })
    .from(riders)
    .where(eq(riders.id, inRiderId))
    .limit(1)

  if (!outRiderRecord || !inRiderRecord) {
    return { success: false, error: "Rider not found" }
  }

  if (outRiderRecord.gender !== inRiderRecord.gender) {
    return {
      success: false,
      error: "You can only swap riders within the same gender pool (men for men, women for women)",
    }
  }

  // 7. Transfer window validation
  const activeWindow = await getActiveTransferWindow(leagueId)

  if (!activeWindow) {
    return { success: false, error: "No active transfer window" }
  }

  if (activeWindow.maxTransfers != null) {
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

  // IR-05: Count active roster size (total picks minus approved IR riders)
  // A waiver pickup is a net-zero swap (out + in), but we need to verify
  // the team actually has a genuinely free slot (not just the out rider freeing one).
  // The current transfer flow always drops an outRider, so active count stays the same.
  // However, if somehow a pickup is submitted without an outRider (future-proofing guard):
  // keep this comment as a placeholder. The primary IR-05 value is that approved IR riders
  // do NOT count against the limit — meaning a team with 10 picks and 1 approved IR rider
  // effectively has 9 active riders, and can submit a normal transfer pick-up.
  // No additional code change is needed here for Phase 20: the existing transfer flow
  // (always drops outRider) already works correctly. This comment documents the IR-05
  // invariant for Phase 22 (IR return flow).

  // Insert transfer bid
  const [bid] = await db
    .insert(transferBids)
    .values({
      leagueId,
      teamId: team.id,
      outRiderId,
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

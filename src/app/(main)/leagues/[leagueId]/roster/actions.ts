"use server"

import { db } from "@/lib/db"
import { irRequests } from "@/db/schema/ir"
import { transferBids } from "@/db/schema/transfers"
import { rosterSlots } from "@/db/schema/roster-slots"
import { leagues } from "@/db/schema/leagues"
import { eq, and, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAuthenticatedUser, checkLeagueMembership } from "@/lib/league-auth"
import { emitRosterEvent } from "@/lib/roster-events"

/**
 * Drops a rider from the player's active roster.
 *
 * Guards:
 * - Must be authenticated
 * - Must be a member of the league
 * - League must be active
 * - Rider must be on the team (in roster_slots)
 *
 * Side effects:
 * - Deletes the roster_slots row
 * - Emits a 'dropped' roster event (preserves historical scoring via event log)
 * - Hard-deletes any active IR requests for the dropped rider
 * - Cancels any pending transfer bids with the dropped rider as outgoing
 */
export async function dropRider(data: {
  leagueId: number
  riderId: number
}): Promise<{ success: true } | { success: false; error: string }> {
  // 1. Auth
  let session: Awaited<ReturnType<typeof getAuthenticatedUser>>
  try {
    session = await getAuthenticatedUser()
  } catch {
    return { success: false, error: "Unauthorized" }
  }

  // 2. League membership
  const { isMember, team } = await checkLeagueMembership(session.user.id, data.leagueId)
  if (!isMember || !team) {
    return { success: false, error: "Not a member of this league" }
  }

  // 3. League active guard
  const [leagueRow] = await db
    .select({ status: leagues.status })
    .from(leagues)
    .where(eq(leagues.id, data.leagueId))
    .limit(1)

  if (!leagueRow || leagueRow.status !== "active") {
    return { success: false, error: "Roster changes are only allowed in active leagues" }
  }

  // 4. Ownership check — rider must be on this team (via roster_slots)
  const [riderOnTeam] = await db
    .select({ id: rosterSlots.id })
    .from(rosterSlots)
    .where(
      and(
        eq(rosterSlots.teamId, team.id),
        eq(rosterSlots.leagueId, data.leagueId),
        eq(rosterSlots.riderId, data.riderId)
      )
    )
    .limit(1)

  if (!riderOnTeam) {
    return { success: false, error: "Rider is not on your team" }
  }

  await db.transaction(async (tx) => {
    // 5. Delete the roster_slots row
    await tx
      .delete(rosterSlots)
      .where(
        and(
          eq(rosterSlots.leagueId, data.leagueId),
          eq(rosterSlots.riderId, data.riderId)
        )
      )

    // Roster event — preserves historical ownership via event log
    await emitRosterEvent(tx, {
      leagueId: data.leagueId,
      teamId: team.id,
      riderId: data.riderId,
      eventType: "dropped",
      occurredAt: new Date(),
    })

    // 6. Cleanup IR — hard-delete pending or approved IR requests for this rider
    await tx
      .delete(irRequests)
      .where(
        and(
          eq(irRequests.teamId, team.id),
          eq(irRequests.leagueId, data.leagueId),
          eq(irRequests.riderId, data.riderId),
          inArray(irRequests.status, ["pending", "approved", "return_eligible"])
        )
      )

    // 7. Cleanup transfer bids — cancel pending bids with this rider as outgoing
    await tx
      .update(transferBids)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(transferBids.teamId, team.id),
          eq(transferBids.leagueId, data.leagueId),
          eq(transferBids.outRiderId, data.riderId),
          eq(transferBids.status, "pending")
        )
      )
  })

  // 8. Revalidate
  revalidatePath(`/leagues/${data.leagueId}/roster`)
  revalidatePath(`/leagues/${data.leagueId}`)
  revalidatePath(`/leagues/${data.leagueId}/ir`)

  return { success: true }
}

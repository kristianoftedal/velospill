"use server"

import { db } from "@/lib/db"
import { irRequests } from "@/db/schema/ir"
import { rosterSlots } from "@/db/schema/roster-slots"
import { riders } from "@/db/schema/riders"
import { eq, and, inArray, count } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAuthenticatedUser, checkLeagueMembership } from "@/lib/league-auth"
import { emitRosterEvent } from "@/lib/roster-events"

/**
 * Submits an IR request for a rider on the player's team.
 *
 * Guards:
 * - Must be authenticated
 * - Must be a member of the league
 * - Rider must be on the team (in roster_slots)
 * - Team must have fewer than 2 active IR slots (pending or approved)
 * - Rider must not already have an active IR request in this league
 */
export async function submitIrRequest(data: {
  leagueId: number
  riderId: number
  reason?: string
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
    return { success: false, error: "You are not a member of this league" }
  }

  // 3. Verify rider is on this team
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

  // 4. Count occupied IR slots (pending or approved)
  const [slotCount] = await db
    .select({ value: count() })
    .from(irRequests)
    .where(
      and(
        eq(irRequests.teamId, team.id),
        eq(irRequests.leagueId, data.leagueId),
        inArray(irRequests.status, ["pending", "approved"])
      )
    )

  if (Number(slotCount?.value ?? 0) >= 2) {
    return { success: false, error: "IR slots full (max 2)" }
  }

  // 5. Check for duplicate active IR request for this rider
  const [existingRequest] = await db
    .select({ id: irRequests.id })
    .from(irRequests)
    .where(
      and(
        eq(irRequests.teamId, team.id),
        eq(irRequests.riderId, data.riderId),
        eq(irRequests.leagueId, data.leagueId),
        inArray(irRequests.status, ["pending", "approved"])
      )
    )
    .limit(1)

  if (existingRequest) {
    return { success: false, error: "This rider already has an active IR request" }
  }

  // 6. Insert IR request
  await db.insert(irRequests).values({
    leagueId: data.leagueId,
    teamId: team.id,
    riderId: data.riderId,
    status: "pending",
    reason: data.reason ?? null,
  })

  // 7. Revalidate relevant pages
  revalidatePath(`/leagues/${data.leagueId}/ir`)
  revalidatePath("/admin/ir")

  return { success: true }
}

/**
 * Returns an IR-eligible rider to the active roster when there is roster space.
 * Transitions IR request status from 'return_eligible' → 'returned'.
 * The rider stays in roster_slots (IR only adjusts the status, not the roster).
 */
export async function returnRider(
  requestId: number,
  leagueId: number
): Promise<{ success: true } | { success: false; error: string }> {
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

  // Fetch and verify request is return_eligible and belongs to this team
  const [request] = await db
    .select()
    .from(irRequests)
    .where(
      and(
        eq(irRequests.id, requestId),
        eq(irRequests.teamId, team.id),
        eq(irRequests.leagueId, leagueId),
        eq(irRequests.status, "return_eligible")
      )
    )
    .limit(1)

  if (!request) {
    return { success: false, error: "IR request not found or not eligible for return" }
  }

  // Verify roster has space (active count must be < limit)
  const [riderRecord] = await db
    .select({ gender: riders.gender })
    .from(riders)
    .where(eq(riders.id, request.riderId))
    .limit(1)

  if (!riderRecord) {
    return { success: false, error: "Rider not found" }
  }

  const MAX_MEN = 18
  const MAX_WOMEN = 6
  const maxForGender = riderRecord.gender === "M" ? MAX_MEN : MAX_WOMEN

  // Count active roster slots for this gender to check if there is space
  const [genderCountResult] = await db
    .select({ value: count() })
    .from(rosterSlots)
    .innerJoin(riders, eq(riders.id, rosterSlots.riderId))
    .where(
      and(
        eq(rosterSlots.teamId, team.id),
        eq(rosterSlots.leagueId, leagueId),
        eq(rosterSlots.status, "active"),
        eq(riders.gender, riderRecord.gender)
      )
    )

  const activeOfGender = Number(genderCountResult?.value ?? 0)

  if (activeOfGender >= maxForGender) {
    return {
      success: false,
      error: `Roster is full for ${riderRecord.gender === "M" ? "men" : "women"} (${maxForGender} max). Drop a rider first.`,
    }
  }

  // Mark as returned and update roster_slots atomically
  await db.transaction(async (tx) => {
    await tx
      .update(irRequests)
      .set({ status: "returned", resolvedAt: new Date() })
      .where(eq(irRequests.id, requestId))

    await tx
      .update(rosterSlots)
      .set({ status: "active" })
      .where(
        and(
          eq(rosterSlots.leagueId, leagueId),
          eq(rosterSlots.riderId, request.riderId)
        )
      )

    // Roster event
    await emitRosterEvent(tx, {
      leagueId,
      teamId: team.id,
      riderId: request.riderId,
      eventType: "ir_returned",
      occurredAt: new Date(),
      metadata: { irRequestId: requestId },
    })
  })

  revalidatePath(`/leagues/${leagueId}/ir`)
  revalidatePath(`/leagues/${leagueId}`)
  revalidatePath(`/leagues/${leagueId}/transfers`)

  return { success: true }
}

/**
 * Atomically drops a roster rider and returns the IR-eligible rider.
 * Used when the roster is full — player selects who to drop in the dialog.
 * Removes the dropped rider's roster slot, emits a dropped event, then marks IR request as returned.
 */
export async function dropAndReturnRider(input: {
  requestId: number
  dropRiderId: number
  leagueId: number
}): Promise<{ success: true } | { success: false; error: string }> {
  const { requestId, dropRiderId, leagueId } = input

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

  // Verify IR request is return_eligible and belongs to this team
  const [request] = await db
    .select()
    .from(irRequests)
    .where(
      and(
        eq(irRequests.id, requestId),
        eq(irRequests.teamId, team.id),
        eq(irRequests.leagueId, leagueId),
        eq(irRequests.status, "return_eligible")
      )
    )
    .limit(1)

  if (!request) {
    return { success: false, error: "IR request not found or not eligible for return" }
  }

  // Verify the rider to drop is on this team
  const [dropSlot] = await db
    .select()
    .from(rosterSlots)
    .where(
      and(
        eq(rosterSlots.teamId, team.id),
        eq(rosterSlots.leagueId, leagueId),
        eq(rosterSlots.riderId, dropRiderId)
      )
    )
    .limit(1)

  if (!dropSlot) {
    return { success: false, error: "Rider to drop is not on your team" }
  }

  // Verify the rider to drop is not themselves on IR (approved or return_eligible)
  const [dropRiderIr] = await db
    .select({ id: irRequests.id })
    .from(irRequests)
    .where(
      and(
        eq(irRequests.teamId, team.id),
        eq(irRequests.riderId, dropRiderId),
        inArray(irRequests.status, ["approved", "return_eligible"])
      )
    )
    .limit(1)

  if (dropRiderIr) {
    return { success: false, error: "Cannot drop a rider who is currently on IR" }
  }

  // Atomically: delete roster_slots for dropped rider, update IR to returned, activate returning rider's slot
  await db.transaction(async (tx) => {
    // Delete roster_slots row for dropped rider
    await tx.delete(rosterSlots).where(
      and(
        eq(rosterSlots.leagueId, leagueId),
        eq(rosterSlots.riderId, dropRiderId)
      )
    )

    // Update irRequests to returned
    await tx
      .update(irRequests)
      .set({ status: "returned", resolvedAt: new Date() })
      .where(eq(irRequests.id, requestId))

    // Update returning rider's roster_slots to active
    await tx
      .update(rosterSlots)
      .set({ status: "active" })
      .where(
        and(
          eq(rosterSlots.leagueId, leagueId),
          eq(rosterSlots.riderId, request.riderId)
        )
      )

    // Roster events
    const now = new Date()
    await emitRosterEvent(tx, {
      leagueId,
      teamId: team.id,
      riderId: dropRiderId,
      eventType: "dropped",
      occurredAt: now,
      metadata: { reason: "ir_return_swap", irRequestId: requestId },
    })
    await emitRosterEvent(tx, {
      leagueId,
      teamId: team.id,
      riderId: request.riderId,
      eventType: "ir_returned",
      occurredAt: now,
      metadata: { irRequestId: requestId },
    })
  })

  revalidatePath(`/leagues/${leagueId}/ir`)
  revalidatePath(`/leagues/${leagueId}`)
  revalidatePath(`/leagues/${leagueId}/transfers`)
  revalidatePath(`/leagues/${leagueId}/roster`)

  return { success: true }
}

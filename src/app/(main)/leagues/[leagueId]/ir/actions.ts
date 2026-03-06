"use server"

import { db } from "@/lib/db"
import { irRequests } from "@/db/schema/ir"
import { draftPicks } from "@/db/schema/draft"
import { eq, and, inArray, count } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAuthenticatedUser, checkLeagueMembership } from "@/lib/league-auth"

/**
 * Submits an IR request for a rider on the player's team.
 *
 * Guards:
 * - Must be authenticated
 * - Must be a member of the league
 * - Rider must be on the team (in draftPicks)
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
    .select({ id: draftPicks.id })
    .from(draftPicks)
    .where(
      and(
        eq(draftPicks.teamId, team.id),
        eq(draftPicks.leagueId, data.leagueId),
        eq(draftPicks.riderId, data.riderId)
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

"use server"

import { db } from "@/lib/db"
import { orders } from "@/db/schema/orders"
import { orderTypes } from "@/db/schema/config"
import { races } from "@/db/schema/races"
import { leagues, teams } from "@/db/schema/leagues"
import { draftPicks } from "@/db/schema/draft"
import { eq, and, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  getAuthenticatedUser,
  checkLeagueMembership,
} from "@/lib/league-auth"

const submitOrderSchema = z.object({
  leagueId: z.number(),
  raceId: z.number(),
  orderTypeId: z.number(),
  targetRiderId: z.number().optional(),
  targetTeamId: z.number().optional(),
  targetProTeam: z.string().optional(),
  targetCountry: z.string().optional(),
  orderConfig: z.record(z.string(), z.string()).optional(),
})

export async function submitOrder(formData: {
  leagueId: number
  raceId: number
  orderTypeId: number
  targetRiderId?: number
  targetTeamId?: number
  targetProTeam?: string
  targetCountry?: string
  orderConfig?: Record<string, string>
}): Promise<{ success: true } | { success: false; error: string }> {
  // 1. Auth check
  let session: Awaited<ReturnType<typeof getAuthenticatedUser>>
  try {
    session = await getAuthenticatedUser()
  } catch {
    return { success: false, error: "Unauthorized" }
  }

  // 2. Zod validation
  const parsed = submitOrderSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: "Invalid form data" }
  }
  const { leagueId, raceId, orderTypeId, targetRiderId, targetTeamId, targetProTeam, targetCountry, orderConfig } = parsed.data

  // 3. Check league membership
  const { isMember, team } = await checkLeagueMembership(session.user.id, leagueId)
  if (!isMember || !team) {
    return { success: false, error: "You are not a member of this league" }
  }

  // 4. League status guard
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)

  if (!league) {
    return { success: false, error: "League not found" }
  }

  if (league.status !== "active") {
    return { success: false, error: "Orders are only available for active leagues" }
  }

  // 5. Fetch the race and validate deadline
  const [race] = await db
    .select()
    .from(races)
    .where(eq(races.id, raceId))
    .limit(1)

  if (!race) {
    return { success: false, error: "Race not found" }
  }

  const now = new Date()
  if (race.startDate <= now) {
    return { success: false, error: "Cannot submit an order for a race that has already started" }
  }

  // 6. Fetch the order type
  const [orderType] = await db
    .select()
    .from(orderTypes)
    .where(eq(orderTypes.id, orderTypeId))
    .limit(1)

  if (!orderType) {
    return { success: false, error: "Order type not found" }
  }

  // 7. Determine effective race type
  // For stages (has parentRaceId), use the parent race type for order type compatibility
  let effectiveRaceType = race.raceType
  let parentRace: typeof races.$inferSelect | null = null

  if (race.parentRaceId) {
    const [parent] = await db
      .select()
      .from(races)
      .where(eq(races.id, race.parentRaceId))
      .limit(1)
    if (parent) {
      parentRace = parent
      effectiveRaceType = parent.raceType
    }
  }

  // 8. World Championship guard — only kaptein is allowed for world championship races
  if (effectiveRaceType === "world_championship") {
    if (orderType.name !== "kaptein") {
      return { success: false, error: "Only the Kaptein order is allowed for World Championship races" }
    }
  }

  // 9. Race type compatibility check
  const applicableRaceTypes = orderType.applicableRaceTypes as string[]
  if (!applicableRaceTypes.includes(effectiveRaceType)) {
    return {
      success: false,
      error: `This order type is not available for ${effectiveRaceType.replace(/_/g, " ")} races`,
    }
  }

  // 10. GT-specific restriction check
  const effect = orderType.effect as Record<string, unknown>
  if (effect.restriction) {
    const restriction = effect.restriction as string
    const raceName = parentRace ? parentRace.name : race.name

    let restrictionValid = true
    if (restriction === "giro_only" && !raceName.toLowerCase().includes("giro")) {
      restrictionValid = false
    } else if (restriction === "tdf_only" && !raceName.toLowerCase().includes("tour de france")) {
      restrictionValid = false
    } else if (restriction.startsWith("vuelta_only") && !raceName.toLowerCase().includes("vuelta")) {
      restrictionValid = false
    }

    if (!restrictionValid) {
      return {
        success: false,
        error: `This order type (${orderType.displayName}) is restricted to a specific Grand Tour that does not match the selected race`,
      }
    }

    // Note: restriction enforcement is based on name matching (e.g. "giro_only" checks for "giro" in race name)
    console.log(`[order-action] GT restriction "${restriction}" validated against race name: "${raceName}"`)
  }

  // 11. Target validation based on effect.target
  const effectTarget = effect.target as string | undefined

  if (effectTarget === "own_rider") {
    if (!targetRiderId) {
      return { success: false, error: "You must select one of your own riders" }
    }
    const ownPick = await db
      .select()
      .from(draftPicks)
      .where(
        and(
          eq(draftPicks.teamId, team.id),
          eq(draftPicks.leagueId, leagueId),
          eq(draftPicks.riderId, targetRiderId)
        )
      )
      .limit(1)
    if (!ownPick[0]) {
      return { success: false, error: "Target rider is not on your team" }
    }
  } else if (effectTarget === "opponent_rider") {
    if (!targetRiderId) {
      return { success: false, error: "You must select an opponent's rider" }
    }
    const opponentPick = await db
      .select()
      .from(draftPicks)
      .where(
        and(
          eq(draftPicks.leagueId, leagueId),
          eq(draftPicks.riderId, targetRiderId),
          ne(draftPicks.teamId, team.id)
        )
      )
      .limit(1)
    if (!opponentPick[0]) {
      return { success: false, error: "Target rider is not on an opponent's team" }
    }
  } else if (effectTarget === "opponent_all_riders") {
    if (!targetTeamId) {
      return { success: false, error: "You must select an opponent's team" }
    }
    const opponentTeam = await db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.leagueId, leagueId),
          eq(teams.id, targetTeamId),
          ne(teams.id, team.id)
        )
      )
      .limit(1)
    if (!opponentTeam[0]) {
      return { success: false, error: "Target team is not a valid opponent in this league" }
    }
  } else if (effectTarget === "all_own_riders") {
    // No target needed — applies to all own riders
  } else if (effectTarget === "own_rider_or_country") {
    // Kaptein: requires orderConfig.kapteinChoice
    const kapteinChoice = orderConfig?.kapteinChoice
    if (!kapteinChoice) {
      return { success: false, error: "You must select a Kaptein choice (single rider or country)" }
    }
    if (kapteinChoice === "single_rider") {
      if (!targetRiderId) {
        return { success: false, error: "You must select one of your own riders as Kaptein" }
      }
      const ownPick = await db
        .select()
        .from(draftPicks)
        .where(
          and(
            eq(draftPicks.teamId, team.id),
            eq(draftPicks.leagueId, leagueId),
            eq(draftPicks.riderId, targetRiderId)
          )
        )
        .limit(1)
      if (!ownPick[0]) {
        return { success: false, error: "Target Kaptein rider is not on your team" }
      }
    } else if (kapteinChoice === "country_all") {
      if (!targetCountry) {
        return { success: false, error: "You must specify a country for Kaptein" }
      }
    } else {
      return { success: false, error: "Invalid Kaptein choice" }
    }
  } else if (effectTarget === "unowned_gc_top10") {
    // Hammer: targetRiderId must NOT be on any team in the league
    if (!targetRiderId) {
      return { success: false, error: "You must select a rider not owned by any team" }
    }
    const anyPick = await db
      .select()
      .from(draftPicks)
      .where(
        and(
          eq(draftPicks.leagueId, leagueId),
          eq(draftPicks.riderId, targetRiderId)
        )
      )
      .limit(1)
    if (anyPick[0]) {
      return { success: false, error: "Target rider is already drafted by a team in this league" }
    }
  } else if (effectTarget === "real_team") {
    if (!targetProTeam || targetProTeam.trim() === "") {
      return { success: false, error: "You must specify a professional cycling team name" }
    }
  }

  // 12. Insert the order
  await db.insert(orders).values({
    leagueId,
    teamId: team.id,
    raceId,
    orderTypeId,
    status: "pending",
    targetRiderId: targetRiderId ?? null,
    targetTeamId: targetTeamId ?? null,
    targetProTeam: targetProTeam ?? null,
    targetCountry: targetCountry ?? null,
    orderConfig: orderConfig ? { kapteinChoice: orderConfig.kapteinChoice as "single_rider" | "country_all" | undefined } : null,
  })

  // 13. Revalidate paths
  revalidatePath(`/leagues/${leagueId}/orders`)
  revalidatePath(`/admin/orders`)

  return { success: true }
}

export async function cancelOrder(
  orderId: number,
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

  // 2. Fetch order, verify ownership and status
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) {
    return { success: false, error: "Order not found" }
  }

  if (order.teamId !== team.id) {
    return { success: false, error: "You can only cancel your own orders" }
  }

  if (order.status !== "pending") {
    return { success: false, error: "Only pending orders can be cancelled" }
  }

  // 3. Delete the order (pending orders are deleted, not status-updated)
  await db.delete(orders).where(eq(orders.id, orderId))

  // 4. Revalidate paths
  revalidatePath(`/leagues/${leagueId}/orders`)
  revalidatePath(`/admin/orders`)

  return { success: true }
}

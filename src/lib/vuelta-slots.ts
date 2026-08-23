"use server"

import { db } from "@/lib/db"
import { rosterSlots } from "@/db/schema/roster-slots"
import { riders } from "@/db/schema/riders"
import { teams, leagues } from "@/db/schema/leagues"
import { appSettings } from "@/db/schema/settings"
import { eq, and, count } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { MAX_VUELTA_SLOTS } from "@/lib/roster-limits"

export async function toggleVueltaSlots(enabled: boolean) {
  const existing = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "vuelta_slots_enabled"))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(appSettings).values({ key: "vuelta_slots_enabled", enabled })
  } else {
    await db
      .update(appSettings)
      .set({ enabled })
      .where(eq(appSettings.key, "vuelta_slots_enabled"))
  }

  revalidatePath("/admin/vuelta-slots")
  return { success: true }
}

export async function getAllVueltaSlots() {
  return db
    .select({
      slotId: rosterSlots.id,
      leagueId: rosterSlots.leagueId,
      leagueName: leagues.name,
      teamId: rosterSlots.teamId,
      teamName: teams.name,
      riderId: rosterSlots.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      addedAt: rosterSlots.addedAt,
    })
    .from(rosterSlots)
    .innerJoin(riders, eq(riders.id, rosterSlots.riderId))
    .innerJoin(teams, eq(teams.id, rosterSlots.teamId))
    .innerJoin(leagues, eq(leagues.id, rosterSlots.leagueId))
    .where(eq(rosterSlots.isVueltaSlot, true))
    .orderBy(leagues.name, teams.name, riders.name)
}

export async function moveToVueltaSlot(data: {
  leagueId: number
  teamId: number
  riderId: number
}): Promise<{ success: true } | { success: false; error: string }> {
  const { leagueId, teamId, riderId } = data

  const [currentCount] = await db
    .select({ value: count() })
    .from(rosterSlots)
    .where(
      and(
        eq(rosterSlots.teamId, teamId),
        eq(rosterSlots.leagueId, leagueId),
        eq(rosterSlots.isVueltaSlot, true)
      )
    )

  if (Number(currentCount?.value ?? 0) >= MAX_VUELTA_SLOTS) {
    return { success: false, error: `Maximum ${MAX_VUELTA_SLOTS} Vuelta slots allowed` }
  }

  const slot = await db.query.rosterSlots.findFirst({
    where: and(
      eq(rosterSlots.leagueId, leagueId),
      eq(rosterSlots.teamId, teamId),
      eq(rosterSlots.riderId, riderId),
      eq(rosterSlots.isVueltaSlot, false)
    ),
  })

  if (!slot) {
    return { success: false, error: "Rider not found on your roster" }
  }

  if (slot.status !== "active") {
    return { success: false, error: "Only active riders can be moved to a Vuelta slot" }
  }

  const [riderRecord] = await db
    .select({ gender: riders.gender })
    .from(riders)
    .where(eq(riders.id, riderId))
    .limit(1)

  if (!riderRecord || riderRecord.gender !== "M") {
    return { success: false, error: "Only men's riders can be moved to Vuelta slots" }
  }

  await db
    .update(rosterSlots)
    .set({ isVueltaSlot: true })
    .where(eq(rosterSlots.id, slot.id))

  revalidatePath(`/leagues/${leagueId}/roster`)
  revalidatePath(`/leagues/${leagueId}`)
  return { success: true }
}

export async function moveFromVueltaSlot(data: {
  leagueId: number
  teamId: number
  riderId: number
}): Promise<{ success: true } | { success: false; error: string }> {
  const { leagueId, teamId, riderId } = data

  const slot = await db.query.rosterSlots.findFirst({
    where: and(
      eq(rosterSlots.leagueId, leagueId),
      eq(rosterSlots.teamId, teamId),
      eq(rosterSlots.riderId, riderId),
      eq(rosterSlots.isVueltaSlot, true)
    ),
  })

  if (!slot) {
    return { success: false, error: "Rider not found in Vuelta slot" }
  }

  await db
    .update(rosterSlots)
    .set({ isVueltaSlot: false })
    .where(eq(rosterSlots.id, slot.id))

  revalidatePath(`/leagues/${leagueId}/roster`)
  revalidatePath(`/leagues/${leagueId}`)
  return { success: true }
}

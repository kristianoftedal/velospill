import { db } from "@/lib/db"
import { rosterSlots } from "@/db/schema/roster-slots"
import { riders } from "@/db/schema/riders"
import { appSettings } from "@/db/schema/settings"
import { eq, and, count } from "drizzle-orm"

export const MAX_MEN_ROSTER = 18
export const MAX_WOMEN_ROSTER = 6
export const MAX_VUELTA_SLOTS = 2

export async function getActiveRosterCountByGender(
  teamId: number,
  leagueId: number
): Promise<{ men: number; women: number }> {
  const rows = await db
    .select({
      gender: riders.gender,
      count: count(),
    })
    .from(rosterSlots)
    .innerJoin(riders, eq(riders.id, rosterSlots.riderId))
    .where(
      and(
        eq(rosterSlots.teamId, teamId),
        eq(rosterSlots.leagueId, leagueId),
        eq(rosterSlots.status, "active"),
        eq(rosterSlots.isVueltaSlot, false)
      )
    )
    .groupBy(riders.gender)

  let men = 0
  let women = 0
  for (const row of rows) {
    if (row.gender === "M") men = Number(row.count)
    else if (row.gender === "F") women = Number(row.count)
  }

  return { men, women }
}

export async function checkRosterLimit(
  teamId: number,
  leagueId: number,
  gender: "M" | "F"
): Promise<string | null> {
  const counts = await getActiveRosterCountByGender(teamId, leagueId)
  const max = gender === "M" ? MAX_MEN_ROSTER : MAX_WOMEN_ROSTER
  const current = gender === "M" ? counts.men : counts.women
  const label = gender === "M" ? "men" : "women"

  if (current >= max) {
    return `Roster limit reached: maximum ${max} ${label} riders allowed (currently ${current})`
  }

  return null
}

export type RosterOverage = {
  men: number
  women: number
  menOver: number
  womenOver: number
  isOver: boolean
  hasDisabledVueltaSlotRiders: boolean
}

export async function getVueltaSlotsEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ enabled: appSettings.enabled })
    .from(appSettings)
    .where(eq(appSettings.key, "vuelta_slots_enabled"))
    .limit(1)
  return row?.enabled ?? false
}

export async function getTeamVueltaSlotCount(
  teamId: number,
  leagueId: number
): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(rosterSlots)
    .where(
      and(
        eq(rosterSlots.teamId, teamId),
        eq(rosterSlots.leagueId, leagueId),
        eq(rosterSlots.isVueltaSlot, true)
      )
    )
  return Number(result?.value ?? 0)
}

export async function getRosterOverage(
  teamId: number,
  leagueId: number
): Promise<RosterOverage> {
  const [counts, vueltaSlotCount, vueltaSlotsEnabled] = await Promise.all([
    getActiveRosterCountByGender(teamId, leagueId),
    getTeamVueltaSlotCount(teamId, leagueId),
    getVueltaSlotsEnabled(),
  ])
  const menOver = Math.max(0, counts.men - MAX_MEN_ROSTER)
  const womenOver = Math.max(0, counts.women - MAX_WOMEN_ROSTER)
  const hasDisabledVueltaSlotRiders = !vueltaSlotsEnabled && vueltaSlotCount > 0
  return {
    men: counts.men,
    women: counts.women,
    menOver,
    womenOver,
    isOver: menOver > 0 || womenOver > 0 || hasDisabledVueltaSlotRiders,
    hasDisabledVueltaSlotRiders,
  }
}

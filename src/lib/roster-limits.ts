import { db } from "@/lib/db"
import { rosterSlots } from "@/db/schema/roster-slots"
import { riders } from "@/db/schema/riders"
import { eq, and, count } from "drizzle-orm"

export const MAX_MEN_ROSTER = 18
export const MAX_WOMEN_ROSTER = 6

/**
 * Returns the count of active (non-IR) roster slots for a team, split by gender.
 * Only counts slots with status = 'active' — IR riders are excluded.
 */
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
        eq(rosterSlots.status, "active")
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

/**
 * Checks whether adding a rider of the given gender would exceed the roster limit.
 * Returns null if allowed, or an error message string if blocked.
 */
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
}

export async function getRosterOverage(
  teamId: number,
  leagueId: number
): Promise<RosterOverage> {
  const counts = await getActiveRosterCountByGender(teamId, leagueId)
  const menOver = Math.max(0, counts.men - MAX_MEN_ROSTER)
  const womenOver = Math.max(0, counts.women - MAX_WOMEN_ROSTER)
  return {
    men: counts.men,
    women: counts.women,
    menOver,
    womenOver,
    isOver: menOver > 0 || womenOver > 0,
  }
}

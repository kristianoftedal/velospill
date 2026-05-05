"use server"

import { db } from "@/lib/db"
import { raceLineups } from "@/db/schema/lineups"
import { races } from "@/db/schema/races"
import { rosterLimits } from "@/db/schema/config"
import { rosterSlots } from "@/db/schema/roster-slots"
import { riders } from "@/db/schema/riders"
import { eq, and, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import {
  getAuthenticatedUser,
  checkLeagueMembership,
} from "@/lib/league-auth"

const MENS_RACE_TYPES = ["grand_tour", "high_priority_one_day", "low_priority_one_day", "mini_tour", "world_championship"]
const WOMENS_RACE_TYPES = ["womens_grand_tour", "womens_one_day"]

export async function setLineup(
  leagueId: number,
  raceId: number,
  riderIds: number[],
  lineupPeriod?: number | null
): Promise<{ success: true } | { success: false; error: string }> {
  // 1. Auth
  let session: Awaited<ReturnType<typeof getAuthenticatedUser>>
  try {
    session = await getAuthenticatedUser()
  } catch {
    return { success: false, error: "Unauthorized" }
  }

  // 2. League membership
  const { isMember, team } = await checkLeagueMembership(session.user.id, leagueId)
  if (!isMember || !team) {
    return { success: false, error: "You are not a member of this league" }
  }

  // 3. Fetch race — verify exists, check deadline
  const [race] = await db
    .select()
    .from(races)
    .where(eq(races.id, raceId))
    .limit(1)

  if (!race) {
    return { success: false, error: "Race not found" }
  }

  if (race.parentRaceId !== null) {
    return { success: false, error: "Lineups are set on parent races only, not individual stages" }
  }

  // Deadline check: for period 1 (or no period), use race start date.
  // For period > 1, use the rest day deadline from lineup-periods.
  let raceDeadline: Date
  if (lineupPeriod && lineupPeriod > 1) {
    const { getLineupPeriodDeadline } = await import("@/lib/lineup-periods")
    const deadline = await getLineupPeriodDeadline(raceId, lineupPeriod)
    if (!deadline) {
      return { success: false, error: "Could not determine deadline for this lineup period" }
    }
    const parisDate = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Paris' }).format(deadline)
    const noonUtc = new Date(`${parisDate}T12:00:00Z`)
    const noonInParis = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }).format(noonUtc))
    raceDeadline = new Date(`${parisDate}T${String(13 - (noonInParis - 12)).padStart(2, '0')}:00:00Z`)
  } else {
    const parisDate = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Paris' }).format(race.startDate)
    const noonUtc = new Date(`${parisDate}T12:00:00Z`)
    const noonInParis = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }).format(noonUtc))
    raceDeadline = new Date(`${parisDate}T${String(13 - (noonInParis - 12)).padStart(2, '0')}:00:00Z`)
  }
  if (new Date() >= raceDeadline) {
    return { success: false, error: "Lineup deadline has passed" }
  }

  // 4. Fetch roster limit for this race type
  const [limit] = await db
    .select({ rosterSize: rosterLimits.rosterSize })
    .from(rosterLimits)
    .where(eq(rosterLimits.raceType, race.raceType))
    .limit(1)

  if (!limit) {
    return { success: false, error: "No roster limit configured for this race type" }
  }

  if (riderIds.length > limit.rosterSize) {
    return {
      success: false,
      error: `Lineup cannot exceed ${limit.rosterSize} riders (got ${riderIds.length})`,
    }
  }

  // 5. Validate all riders belong to this team
  const teamPicks = await db
    .select({ riderId: rosterSlots.riderId })
    .from(rosterSlots)
    .where(
      and(
        eq(rosterSlots.teamId, team.id),
        eq(rosterSlots.leagueId, leagueId)
      )
    )

  const ownedRiderIds = new Set(teamPicks.map((p) => p.riderId))
  for (const riderId of riderIds) {
    if (!ownedRiderIds.has(riderId)) {
      return { success: false, error: `Rider ${riderId} is not on your team` }
    }
  }

  // 6. Validate gender matches race type
  const requiredGender = MENS_RACE_TYPES.includes(race.raceType)
    ? "M"
    : WOMENS_RACE_TYPES.includes(race.raceType)
    ? "F"
    : null

  if (requiredGender) {
    const selectedRiders = await db
      .select({ id: riders.id, gender: riders.gender })
      .from(riders)
      .where(inArray(riders.id, riderIds))

    for (const rider of selectedRiders) {
      if (rider.gender !== requiredGender) {
        return {
          success: false,
          error: `This race requires ${requiredGender === "M" ? "men's" : "women's"} riders only`,
        }
      }
    }
  }

  // 7. Transaction: delete existing + insert new (scoped by lineupPeriod)
  await db.transaction(async (tx) => {
    const deleteConditions = [
      eq(raceLineups.leagueId, leagueId),
      eq(raceLineups.teamId, team.id),
      eq(raceLineups.raceId, raceId),
    ]
    if (lineupPeriod != null) {
      deleteConditions.push(eq(raceLineups.lineupPeriod, lineupPeriod))
    }
    await tx
      .delete(raceLineups)
      .where(and(...deleteConditions))

    if (riderIds.length > 0) {
      await tx.insert(raceLineups).values(
        riderIds.map((riderId) => ({
          leagueId,
          teamId: team.id,
          raceId,
          riderId,
          lineupPeriod: lineupPeriod ?? null,
        }))
      )
    }
  })

  // 8. Revalidate
  revalidatePath(`/leagues/${leagueId}/lineup`)
  revalidatePath(`/leagues/${leagueId}/lineup/${raceId}`)

  return { success: true }
}

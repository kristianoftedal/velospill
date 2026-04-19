import { db } from "@/lib/db"
import { rosterEvents } from "@/db/schema/roster-events"
import { teams } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { raceResults } from "@/db/schema/results"
import { races } from "@/db/schema/races"
import { eq, and, asc, sql, inArray } from "drizzle-orm"

const categoryLabels: Record<string, string> = {
  finish: "Finish",
  stage_finish: "Stage Finish",
  sprint: "Sprint",
  mountain: "Mountain",
  jersey: "Jersey",
  ttt: "TTT",
  end_gc: "GC",
  end_sprint: "Points Jersey",
  end_mountain: "Mountain Jersey",
  end_youth: "Youth Jersey",
}

export type RiderCategoryScore = {
  category: string
  categoryLabel: string
  position: number
  points: number
}

export type RiderRaceEntry = {
  raceId: number
  raceName: string
  raceType: string
  startDate: Date
  parentRaceId: number | null
  totalRacePoints: number
  categories: RiderCategoryScore[]
}

export type RiderOwnershipEntry = {
  raceId: number
  raceName: string
  startDate: Date
  teamId: number
  teamName: string
  leagueId: number
}

export type RiderSeasonProfile = {
  rider: {
    id: number
    name: string
    team: string
    nationality: string
    gender: "M" | "F"
    totalPoints: number
  }
  races: RiderRaceEntry[]
  ownership: RiderOwnershipEntry[]
}

/**
 * Returns a full season profile for a single rider:
 * - Rider metadata and total season points
 * - Per-race scoring breakdown with category-level detail
 * - Ownership history (which team held the rider at each race, per league)
 *
 * Returns null if the rider does not exist.
 */
export async function getRiderSeasonProfile(
  riderId: number
): Promise<RiderSeasonProfile | null> {
  // ── Query 1: Rider metadata + total points ────────────────────────────────
  const riderRows = await db
    .select({
      id: riders.id,
      name: riders.name,
      team: riders.team,
      nationality: riders.nationality,
      gender: riders.gender,
      totalPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
    })
    .from(riders)
    .leftJoin(raceResults, eq(raceResults.riderId, riders.id))
    .where(eq(riders.id, riderId))
    .groupBy(
      riders.id,
      riders.name,
      riders.team,
      riders.nationality,
      riders.gender
    )
    .limit(1)

  if (riderRows.length === 0) {
    return null
  }

  const riderRow = riderRows[0]

  // ── Query 2: Per-race scoring breakdown with categories ───────────────────
  const resultsRows = await db
    .select({
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      parentRaceId: races.parentRaceId,
      category: raceResults.category,
      position: raceResults.position,
      points: raceResults.points,
    })
    .from(raceResults)
    .innerJoin(races, eq(races.id, raceResults.raceId))
    .where(eq(raceResults.riderId, riderId))
    .orderBy(asc(races.startDate), asc(raceResults.category))

  // Group by raceId in application code, aggregating categories
  const raceMap = new Map<
    number,
    {
      raceId: number
      raceName: string
      raceType: string
      startDate: Date
      parentRaceId: number | null
      totalRacePoints: number
      categories: RiderCategoryScore[]
    }
  >()

  for (const row of resultsRows) {
    const existing = raceMap.get(row.raceId)
    const categoryEntry: RiderCategoryScore = {
      category: row.category,
      categoryLabel: categoryLabels[row.category] ?? row.category,
      position: row.position,
      points: row.points,
    }

    if (existing) {
      existing.totalRacePoints += row.points
      existing.categories.push(categoryEntry)
    } else {
      raceMap.set(row.raceId, {
        raceId: row.raceId,
        raceName: row.raceName,
        raceType: row.raceType,
        startDate: row.startDate,
        parentRaceId: row.parentRaceId,
        totalRacePoints: row.points,
        categories: [categoryEntry],
      })
    }
  }

  // Build sorted RiderRaceEntry[] (chronological by startDate)
  const raceEntries: RiderRaceEntry[] = Array.from(raceMap.values()).sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  )

  // ── Query 3: Ownership history ────────────────────────────────────────────
  const ownershipRows = await db
    .select({
      leagueId: rosterEvents.leagueId,
      teamId: teams.id,
      teamName: teams.name,
      pickedAt: rosterEvents.occurredAt,
    })
    .from(rosterEvents)
    .innerJoin(teams, eq(teams.id, rosterEvents.teamId))
    .where(
      and(
        eq(rosterEvents.riderId, riderId),
        inArray(rosterEvents.eventType, ["drafted", "transferred_in"])
      )
    )
    .orderBy(asc(rosterEvents.occurredAt))

  // For each race, find the active owner per league
  // Active owner = most recent draftPick where pickedAt <= race.startDate
  const ownershipEntries: RiderOwnershipEntry[] = []

  for (const race of raceEntries) {
    // Group ownershipRows by leagueId, pick the most recent pickedAt <= race.startDate
    const byLeague = new Map<
      number,
      { leagueId: number; teamId: number; teamName: string; pickedAt: Date }
    >()

    for (const pick of ownershipRows) {
      if (pick.pickedAt <= race.startDate) {
        const existing = byLeague.get(pick.leagueId)
        // Keep the most recent pickedAt (ownershipRows are sorted ASC so later entries overwrite)
        if (!existing || pick.pickedAt >= existing.pickedAt) {
          byLeague.set(pick.leagueId, {
            leagueId: pick.leagueId,
            teamId: pick.teamId,
            teamName: pick.teamName,
            pickedAt: pick.pickedAt,
          })
        }
      }
    }

    for (const [leagueId, pick] of byLeague) {
      ownershipEntries.push({
        raceId: race.raceId,
        raceName: race.raceName,
        startDate: race.startDate,
        teamId: pick.teamId,
        teamName: pick.teamName,
        leagueId,
      })
    }
  }

  return {
    rider: {
      id: riderRow.id,
      name: riderRow.name,
      team: riderRow.team,
      nationality: riderRow.nationality,
      gender: riderRow.gender,
      totalPoints: Number(riderRow.totalPoints),
    },
    races: raceEntries,
    ownership: ownershipEntries,
  }
}

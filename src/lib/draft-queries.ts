import { db } from "@/lib/db"
import { draftSessions, draftPicks } from "@/db/schema/draft"
import { teams } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { eq, notInArray, ilike, asc, and } from "drizzle-orm"
import { getTeamIndexForPick } from "@/lib/draft-snake-order"

/**
 * Returns available (unpicked) riders for a given league and gender.
 * Optionally filter by search term, team name, or nationality.
 */
export async function getAvailableRiders(
  leagueId: number,
  gender: 'M' | 'F',
  search?: string,
  filterTeam?: string,
  filterNationality?: string
) {
  // Get all riderIds already picked for this league
  const pickedRiders = await db
    .select({ riderId: draftPicks.riderId })
    .from(draftPicks)
    .where(eq(draftPicks.leagueId, leagueId))

  const pickedIds = pickedRiders.map((p) => p.riderId)

  // Build where conditions
  const conditions = [eq(riders.gender, gender)]

  if (pickedIds.length > 0) {
    conditions.push(notInArray(riders.id, pickedIds))
  }

  if (search) {
    conditions.push(ilike(riders.name, `%${search}%`))
  }

  if (filterTeam) {
    conditions.push(eq(riders.team, filterTeam))
  }

  if (filterNationality) {
    conditions.push(eq(riders.nationality, filterNationality))
  }

  const result = await db
    .select()
    .from(riders)
    .where(and(...conditions))
    .orderBy(asc(riders.name))

  return result
}

/**
 * Fetches full draft state for a league: session, all picks, and all teams.
 * Returns null if no draft session exists.
 */
export async function getDraftState(leagueId: number) {
  const [session] = await db
    .select()
    .from(draftSessions)
    .where(eq(draftSessions.leagueId, leagueId))
    .limit(1)

  if (!session) {
    return null
  }

  const picks = await db
    .select()
    .from(draftPicks)
    .where(eq(draftPicks.leagueId, leagueId))
    .orderBy(asc(draftPicks.pickNumber))

  const leagueTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.createdAt))

  return { session, picks, teams: leagueTeams }
}

/**
 * Returns the best available rider for auto-pick (first alphabetically).
 * Returns null if no riders are available.
 */
export async function getBestAvailableRider(leagueId: number, gender: 'M' | 'F') {
  const available = await getAvailableRiders(leagueId, gender)
  return available[0] ?? null
}

/**
 * Computes the next draft state after a pick at currentPickIndex.
 *
 * Men play menRounds rounds, women play womenRounds rounds.
 * Each gender uses an independent snake order.
 */
export function computeNextDraftState(
  currentPickIndex: number,
  teamCount: number,
  menRounds: number,
  womenRounds: number
) {
  const nextPickIndex = currentPickIndex + 1
  const menTotalPicks = teamCount * menRounds
  const totalPicks = teamCount * (menRounds + womenRounds)

  const isComplete = nextPickIndex >= totalPicks
  const isMenComplete = nextPickIndex >= menTotalPicks

  const nextGender: 'M' | 'F' = isMenComplete ? 'F' : 'M'

  let nextRound: number
  let nextTeamIndex: number

  if (!isMenComplete) {
    // Still in men's draft
    nextRound = Math.floor(nextPickIndex / teamCount)
    nextTeamIndex = getTeamIndexForPick(nextPickIndex, teamCount)
  } else {
    // In women's draft — snake order resets independently
    const womenPickIndex = nextPickIndex - menTotalPicks
    nextRound = menRounds + Math.floor(womenPickIndex / teamCount)
    nextTeamIndex = getTeamIndexForPick(womenPickIndex, teamCount)
  }

  return {
    nextPickIndex,
    nextRound,
    nextGender,
    nextTeamIndex,
    isComplete,
    isMenComplete,
  }
}

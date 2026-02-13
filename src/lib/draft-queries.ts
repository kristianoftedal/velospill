import { db } from "@/lib/db"
import { draftSessions, draftPicks } from "@/db/schema/draft"
import { teams, leagues } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { user } from "@/db/schema/users"
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
 * Enriched pick type with rider details attached.
 */
export type EnrichedPick = {
  id: number
  leagueId: number
  teamId: number
  riderId: number
  pickNumber: number
  round: number
  gender: 'M' | 'F'
  wasAutomatic: boolean
  pickedAt: Date | string
  rider: {
    name: string
    team: string
    specialty: string
    nationality: string
  } | null
}

/**
 * Enriched team type with owner name attached.
 */
export type EnrichedTeam = {
  id: number
  name: string
  leagueId: number
  userId: string
  createdAt: Date | string
  userName: string
}

/**
 * Returns picks for a league, each enriched with rider info (name, team, specialty, nationality).
 */
export async function getEnrichedPicks(leagueId: number): Promise<EnrichedPick[]> {
  const rows = await db
    .select({
      id: draftPicks.id,
      leagueId: draftPicks.leagueId,
      teamId: draftPicks.teamId,
      riderId: draftPicks.riderId,
      pickNumber: draftPicks.pickNumber,
      round: draftPicks.round,
      gender: draftPicks.gender,
      wasAutomatic: draftPicks.wasAutomatic,
      pickedAt: draftPicks.pickedAt,
      riderName: riders.name,
      riderTeam: riders.team,
      riderSpecialty: riders.specialty,
      riderNationality: riders.nationality,
    })
    .from(draftPicks)
    .leftJoin(riders, eq(draftPicks.riderId, riders.id))
    .where(eq(draftPicks.leagueId, leagueId))
    .orderBy(asc(draftPicks.pickNumber))

  return rows.map((row) => ({
    id: row.id,
    leagueId: row.leagueId,
    teamId: row.teamId,
    riderId: row.riderId,
    pickNumber: row.pickNumber,
    round: row.round,
    gender: row.gender,
    wasAutomatic: row.wasAutomatic,
    pickedAt: row.pickedAt,
    rider: row.riderName
      ? {
          name: row.riderName,
          team: row.riderTeam ?? "",
          specialty: row.riderSpecialty ?? "",
          nationality: row.riderNationality ?? "",
        }
      : null,
  }))
}

/**
 * Returns teams for a league, each enriched with the owner's display name.
 */
export async function getEnrichedTeams(leagueId: number): Promise<EnrichedTeam[]> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      leagueId: teams.leagueId,
      userId: teams.userId,
      createdAt: teams.createdAt,
      userName: user.name,
    })
    .from(teams)
    .leftJoin(user, eq(teams.userId, user.id))
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.createdAt))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    leagueId: row.leagueId,
    userId: row.userId,
    createdAt: row.createdAt,
    userName: row.userName ?? "Unknown",
  }))
}

/**
 * Fetches full draft state for a league with enriched picks and teams.
 * Returns null if no draft session exists.
 */
export async function getDraftStateEnriched(leagueId: number) {
  const [session] = await db
    .select()
    .from(draftSessions)
    .where(eq(draftSessions.leagueId, leagueId))
    .limit(1)

  if (!session) {
    return null
  }

  const [picks, leagueTeams] = await Promise.all([
    getEnrichedPicks(leagueId),
    getEnrichedTeams(leagueId),
  ])

  return { session, picks, teams: leagueTeams }
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

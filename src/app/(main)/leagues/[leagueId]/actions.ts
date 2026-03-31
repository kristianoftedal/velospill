"use server"

import { db } from "@/lib/db"
import { leagues, teams, leagueRaces, LeagueConfig } from "@/db/schema/leagues"
import { races } from "@/db/schema/races"
import { orders } from "@/db/schema/orders"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq, and, count, desc, isNull } from "drizzle-orm"
import { checkLeagueMembership, checkLeagueOwnership } from "@/lib/league-auth"

async function checkAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

/** Lightweight list of user's leagues for navigation — just id, name, status */
export async function getMyLeaguesList() {
  const session = await checkAuth()

  return db
    .select({
      id: leagues.id,
      name: leagues.name,
      status: leagues.status,
    })
    .from(teams)
    .innerJoin(leagues, eq(teams.leagueId, leagues.id))
    .where(eq(teams.userId, session.user.id))
    .orderBy(desc(leagues.createdAt))
}

export async function getMyLeagues() {
  const session = await checkAuth()

  // Get all leagues the user belongs to via teams
  const result = await db
    .select({
      leagueId: leagues.id,
      leagueName: leagues.name,
      status: leagues.status,
      config: leagues.config,
      teamName: teams.name,
      createdAt: leagues.createdAt,
    })
    .from(teams)
    .innerJoin(leagues, eq(teams.leagueId, leagues.id))
    .where(eq(teams.userId, session.user.id))
    .orderBy(desc(leagues.createdAt))

  // Get team count for each league
  const leagueIds = [...new Set(result.map((r) => r.leagueId))]
  const teamCounts = await Promise.all(
    leagueIds.map(async (leagueId) => {
      const [{ teamCount }] = await db
        .select({ teamCount: count() })
        .from(teams)
        .where(eq(teams.leagueId, leagueId))
      return { leagueId, teamCount }
    })
  )

  const teamCountMap = Object.fromEntries(
    teamCounts.map((tc) => [tc.leagueId, tc.teamCount])
  )

  return result.map((r) => ({
    id: r.leagueId,
    name: r.leagueName,
    status: r.status,
    teamCount: teamCountMap[r.leagueId] ?? 0,
    maxTeams: (r.config as LeagueConfig).teamMax || 10,
    userTeamName: r.teamName,
    createdAt: r.createdAt,
  }))
}

export async function getLeagueDetails(leagueId: number) {
  const session = await checkAuth()

  // Check membership or ownership
  const { isMember } = await checkLeagueMembership(session.user.id, leagueId)
  const isLeagueOwner = await checkLeagueOwnership(session.user.id, leagueId)
  if (!isMember && !isLeagueOwner) {
    throw new Error("Not a member of this league")
  }

  // Fetch league
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)

  if (!league) {
    return null
  }

  // Fetch teams with user info
  const teamList = await db
    .select({
      id: teams.id,
      name: teams.name,
      userId: teams.userId,
      userName: user.name,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .innerJoin(user, eq(teams.userId, user.id))
    .where(eq(teams.leagueId, leagueId))
    .orderBy(teams.createdAt)

  const isOwner = isLeagueOwner

  // Get user's team
  const userTeam = teamList.find((t) => t.userId === session.user.id)

  return {
    league,
    teams: teamList,
    isOwner,
    userTeamId: userTeam?.id ?? null,
  }
}

const validTransitions: Record<string, string[]> = {
  setup: ["drafting"],
  drafting: ["active"],
  active: ["complete"],
  complete: [],
}

export async function transitionLeagueStatus(
  leagueId: number,
  newStatus: "setup" | "drafting" | "active" | "complete"
) {
  const session = await checkAuth()

  // Check ownership
  const isOwner = await checkLeagueOwnership(session.user.id, leagueId)
  if (!isOwner) {
    return { success: false, error: "Only the league owner can change status" }
  }

  // Fetch current league
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)

  if (!league) {
    return { success: false, error: "League not found" }
  }

  const currentStatus = league.status
  const allowed = validTransitions[currentStatus] ?? []

  if (!allowed.includes(newStatus)) {
    return {
      success: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`,
    }
  }

  // Extra validation: setup -> drafting requires minimum team count
  if (currentStatus === "setup" && newStatus === "drafting") {
    const [{ teamCount }] = await db
      .select({ teamCount: count() })
      .from(teams)
      .where(eq(teams.leagueId, leagueId))

    const config = league.config as LeagueConfig
    const teamMin = config.teamMin || 2

    if (teamCount < teamMin) {
      return {
        success: false,
        error: `Need at least ${teamMin} teams to start drafting (currently ${teamCount})`,
      }
    }
  }

  // Perform update
  await db
    .update(leagues)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(leagues.id, leagueId))

  revalidatePath(`/leagues/${leagueId}`)
  revalidatePath("/leagues")

  return { success: true, newStatus }
}

export async function getSeasonRacesForPicker(leagueId: number) {
  const session = await checkAuth()
  const isOwner = await checkLeagueOwnership(session.user.id, leagueId)
  if (!isOwner) throw new Error("Unauthorized")

  const [league] = await db
    .select({ config: leagues.config })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)

  if (!league) return []

  const season = (league.config as LeagueConfig).seasonYear

  const [allRaces, assigned] = await Promise.all([
    db.select({
      id: races.id,
      name: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
    })
      .from(races)
      .where(and(eq(races.season, season), isNull(races.parentRaceId)))
      .orderBy(races.startDate),
    db.select({ raceId: leagueRaces.raceId })
      .from(leagueRaces)
      .where(eq(leagueRaces.leagueId, leagueId)),
  ])

  const assignedSet = new Set(assigned.map(r => r.raceId))
  return allRaces.map(r => ({
    ...r,
    startDate: r.startDate.toISOString(),
    assigned: assignedSet.has(r.id),
  }))
}

export async function assignRaceToLeague(leagueId: number, raceId: number) {
  const session = await checkAuth()
  const isOwner = await checkLeagueOwnership(session.user.id, leagueId)
  if (!isOwner) return { success: false, error: "Only the league owner can assign races" }

  await db.insert(leagueRaces).values({ leagueId, raceId }).onConflictDoNothing()

  revalidatePath(`/leagues/${leagueId}`)
  revalidatePath(`/leagues/${leagueId}/orders`)
  revalidatePath(`/leagues/${leagueId}/transfers`)
  return { success: true }
}

export async function removeRaceFromLeague(leagueId: number, raceId: number) {
  const session = await checkAuth()
  const isOwner = await checkLeagueOwnership(session.user.id, leagueId)
  if (!isOwner) return { success: false, error: "Only the league owner can remove races" }

  // Check if any orders exist for this race in this league
  const existingOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.raceId, raceId), eq(orders.leagueId, leagueId)))
    .limit(1)

  const hasOrders = existingOrders.length > 0

  await db.delete(leagueRaces)
    .where(and(eq(leagueRaces.leagueId, leagueId), eq(leagueRaces.raceId, raceId)))

  revalidatePath(`/leagues/${leagueId}`)
  revalidatePath(`/leagues/${leagueId}/orders`)
  revalidatePath(`/leagues/${leagueId}/transfers`)
  return { success: true, hadOrders: hasOrders }
}

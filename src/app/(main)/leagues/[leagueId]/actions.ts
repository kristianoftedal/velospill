"use server"

import { db } from "@/lib/db"
import { leagues, teams, LeagueConfig } from "@/db/schema/leagues"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq, and, count, desc } from "drizzle-orm"
import { checkLeagueMembership, checkLeagueOwnership } from "@/lib/league-auth"

async function checkAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
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

  // Check membership
  const { isMember } = await checkLeagueMembership(session.user.id, leagueId)
  if (!isMember) {
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

  const isOwner = league.ownerId === session.user.id

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

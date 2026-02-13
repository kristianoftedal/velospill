"use server"

import { db } from "@/lib/db"
import { leagues, teams } from "@/db/schema/leagues"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { eq, and, count } from "drizzle-orm"
import { isPast } from "date-fns"
import { checkLeagueMembership } from "@/lib/league-auth"

async function checkAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function validateInvite(inviteCode: string): Promise<
  | { valid: false; reason: string }
  | {
      valid: true
      league: {
        id: number
        name: string
        ownerName: string
        teamCount: number
        maxTeams: number
      }
    }
> {
  const leagueResult = await db
    .select({
      id: leagues.id,
      name: leagues.name,
      inviteCode: leagues.inviteCode,
      inviteExpiresAt: leagues.inviteExpiresAt,
      status: leagues.status,
      ownerId: leagues.ownerId,
      config: leagues.config,
      ownerName: user.name,
    })
    .from(leagues)
    .leftJoin(user, eq(leagues.ownerId, user.id))
    .where(eq(leagues.inviteCode, inviteCode))
    .limit(1)

  const league = leagueResult[0]
  if (!league) {
    return { valid: false, reason: "Invalid invite code" }
  }

  if (league.inviteExpiresAt && isPast(league.inviteExpiresAt)) {
    return { valid: false, reason: "Invite link has expired" }
  }

  if (league.status !== "setup") {
    return { valid: false, reason: "League is no longer accepting new teams" }
  }

  const teamCountResult = await db
    .select({ count: count() })
    .from(teams)
    .where(eq(teams.leagueId, league.id))

  const teamCount = teamCountResult[0]?.count ?? 0
  const maxTeams = league.config?.teamMax ?? 10

  if (teamCount >= maxTeams) {
    return { valid: false, reason: "League is full" }
  }

  return {
    valid: true,
    league: {
      id: league.id,
      name: league.name,
      ownerName: league.ownerName ?? "Unknown",
      teamCount,
      maxTeams,
    },
  }
}

const teamNameSchema = z.object({
  teamName: z
    .string()
    .min(2, "Team name must be at least 2 characters")
    .max(50, "Team name must be at most 50 characters"),
})

export async function joinLeague(
  inviteCode: string,
  teamName: string
): Promise<
  | { success: true; leagueId: number }
  | { success: false; error: { _form?: string[]; teamName?: string[] } }
> {
  const session = await checkAuth()

  const validation = teamNameSchema.safeParse({ teamName })
  if (!validation.success) {
    return {
      success: false,
      error: { teamName: validation.error.flatten().fieldErrors.teamName ?? [] },
    }
  }

  // Re-validate invite (don't trust client state)
  const inviteResult = await validateInvite(inviteCode)
  if (!inviteResult.valid) {
    return { success: false, error: { _form: [inviteResult.reason] } }
  }

  const leagueId = inviteResult.league.id

  // Check if user already in league
  const { isMember } = await checkLeagueMembership(session.user.id, leagueId)
  if (isMember) {
    return {
      success: false,
      error: { _form: ["You already have a team in this league"] },
    }
  }

  // Check team name uniqueness within the league
  const existingName = await db
    .select()
    .from(teams)
    .where(and(eq(teams.leagueId, leagueId), eq(teams.name, validation.data.teamName)))
    .limit(1)

  if (existingName.length > 0) {
    return {
      success: false,
      error: { teamName: ["Team name already taken in this league"] },
    }
  }

  try {
    await db.insert(teams).values({
      leagueId,
      userId: session.user.id,
      name: validation.data.teamName,
    })

    revalidatePath("/leagues")
    return { success: true, leagueId }
  } catch {
    // DB-level unique constraints (leagueId+userId, leagueId+name) catch race conditions
    return {
      success: false,
      error: { _form: ["Failed to join league. The team name may already be taken."] },
    }
  }
}

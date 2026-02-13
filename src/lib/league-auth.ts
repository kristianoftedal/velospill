import { db } from "@/lib/db"
import { teams, leagues } from "@/db/schema/leagues"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

/**
 * Get the currently authenticated user session.
 * Throws if not authenticated.
 */
export async function getAuthenticatedUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

/**
 * Check whether a user is a member of a league.
 * Returns the team record if found, or null if not a member.
 */
export async function checkLeagueMembership(
  userId: string,
  leagueId: number
): Promise<{ isMember: boolean; team: typeof teams.$inferSelect | null }> {
  const result = await db
    .select()
    .from(teams)
    .where(and(eq(teams.leagueId, leagueId), eq(teams.userId, userId)))
    .limit(1)

  const team = result[0] ?? null
  return { isMember: !!team, team }
}

/**
 * Check whether a user is the owner of a league.
 */
export async function checkLeagueOwnership(
  userId: string,
  leagueId: number
): Promise<boolean> {
  const result = await db
    .select()
    .from(leagues)
    .where(and(eq(leagues.id, leagueId), eq(leagues.ownerId, userId)))
    .limit(1)

  return !!result[0]
}

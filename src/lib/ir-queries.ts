import { db } from "@/lib/db"
import { irRequests } from "@/db/schema/ir"
import { draftPicks } from "@/db/schema/draft"
import { leagues, teams } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { eq, and, count } from "drizzle-orm"

export type IrSlot = {
  id: number
  riderId: number
  riderName: string
  status: "pending" | "approved" | "rejected"
  reason: string | null
  adminNote: string | null
  submittedAt: Date
  resolvedAt: Date | null
}

export type PendingIrRequest = {
  id: number
  leagueId: number
  leagueName: string
  teamId: number
  teamName: string
  riderId: number
  riderName: string
  reason: string | null
  submittedAt: Date
}

/**
 * Returns all IR requests for a team in a given league, joined with rider name.
 * Ordered by submittedAt DESC.
 */
export async function getTeamIrSlots(teamId: number, leagueId: number): Promise<IrSlot[]> {
  const rows = await db
    .select({
      id: irRequests.id,
      riderId: irRequests.riderId,
      riderName: riders.name,
      status: irRequests.status,
      reason: irRequests.reason,
      adminNote: irRequests.adminNote,
      submittedAt: irRequests.submittedAt,
      resolvedAt: irRequests.resolvedAt,
    })
    .from(irRequests)
    .innerJoin(riders, eq(riders.id, irRequests.riderId))
    .where(and(eq(irRequests.teamId, teamId), eq(irRequests.leagueId, leagueId)))
    .orderBy(irRequests.submittedAt)

  // Return in DESC order (newest first)
  return rows.reverse()
}

/**
 * Returns the active roster count for a team:
 *   active = total draft picks - approved IR requests
 * Approved IR riders are freed from the active roster limit.
 */
export async function getActiveRosterCount(teamId: number, leagueId: number): Promise<number> {
  const [picksResult] = await db
    .select({ value: count() })
    .from(draftPicks)
    .where(and(eq(draftPicks.teamId, teamId), eq(draftPicks.leagueId, leagueId)))

  const [approvedIrResult] = await db
    .select({ value: count() })
    .from(irRequests)
    .where(
      and(
        eq(irRequests.teamId, teamId),
        eq(irRequests.leagueId, leagueId),
        eq(irRequests.status, "approved")
      )
    )

  const totalPicks = picksResult?.value ?? 0
  const approvedIr = approvedIrResult?.value ?? 0

  return Number(totalPicks) - Number(approvedIr)
}

/**
 * Returns all pending IR requests across all leagues for the admin queue.
 * Joined with league name, team name, and rider name.
 * Ordered by submittedAt ASC (oldest first).
 */
export async function getPendingIrRequests(): Promise<PendingIrRequest[]> {
  return db
    .select({
      id: irRequests.id,
      leagueId: irRequests.leagueId,
      leagueName: leagues.name,
      teamId: irRequests.teamId,
      teamName: teams.name,
      riderId: irRequests.riderId,
      riderName: riders.name,
      reason: irRequests.reason,
      submittedAt: irRequests.submittedAt,
    })
    .from(irRequests)
    .innerJoin(leagues, eq(leagues.id, irRequests.leagueId))
    .innerJoin(teams, eq(teams.id, irRequests.teamId))
    .innerJoin(riders, eq(riders.id, irRequests.riderId))
    .where(eq(irRequests.status, "pending"))
    .orderBy(irRequests.submittedAt)
}

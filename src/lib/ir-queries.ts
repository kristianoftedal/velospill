import { db } from "@/lib/db"
import { irRequests } from "@/db/schema/ir"
import { draftPicks } from "@/db/schema/draft"
import { leagues, teams } from "@/db/schema/leagues"
import { riders } from "@/db/schema/riders"
import { eq, and, count, inArray } from "drizzle-orm"

export type IrSlot = {
  id: number
  riderId: number
  riderName: string
  status: "pending" | "approved" | "rejected" | "return_eligible" | "returned"
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
 * Returns the active roster count for a team:
 *   active = total draft picks - (approved OR return_eligible IR requests)
 * Both approved and return_eligible riders free a slot — they haven't returned yet.
 */
export async function getActiveRosterCount(teamId: number, leagueId: number): Promise<number> {
  const [picksResult] = await db
    .select({ value: count() })
    .from(draftPicks)
    .where(and(eq(draftPicks.teamId, teamId), eq(draftPicks.leagueId, leagueId)))

  const [irResult] = await db
    .select({ value: count() })
    .from(irRequests)
    .where(
      and(
        eq(irRequests.teamId, teamId),
        eq(irRequests.leagueId, leagueId),
        inArray(irRequests.status, ["approved", "return_eligible"])
      )
    )

  const totalPicks = picksResult?.value ?? 0
  const irCount = irResult?.value ?? 0

  return Number(totalPicks) - Number(irCount)
}

/**
 * Returns the count of IR requests for a team with status 'return_eligible'.
 * Used by the league page banner and transfer form blocking.
 */
export async function getEligibleToReturnCount(teamId: number, leagueId: number): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(irRequests)
    .where(
      and(
        eq(irRequests.teamId, teamId),
        eq(irRequests.leagueId, leagueId),
        eq(irRequests.status, "return_eligible")
      )
    )
  return Number(result?.value ?? 0)
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

export type ApprovedIrRequest = {
  id: number
  leagueId: number
  leagueName: string
  teamId: number
  teamName: string
  riderId: number
  riderName: string
  reason: string | null
  submittedAt: Date
  resolvedAt: Date | null
}

/**
 * Returns all approved IR requests across all leagues for the admin "Mark Eligible" section.
 * Excludes return_eligible and returned — only shows approved (pending return decision).
 * Ordered by resolvedAt ASC (oldest approval first).
 */
export async function getApprovedIrRequests(): Promise<ApprovedIrRequest[]> {
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
      resolvedAt: irRequests.resolvedAt,
    })
    .from(irRequests)
    .innerJoin(leagues, eq(leagues.id, irRequests.leagueId))
    .innerJoin(teams, eq(teams.id, irRequests.teamId))
    .innerJoin(riders, eq(riders.id, irRequests.riderId))
    .where(eq(irRequests.status, "approved"))
    .orderBy(irRequests.resolvedAt)
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

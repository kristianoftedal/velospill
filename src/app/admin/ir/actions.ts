"use server"

import { db } from "@/lib/db"
import { irRequests } from "@/db/schema/ir"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import { getPendingIrRequests, getApprovedIrRequests } from "@/lib/ir-queries"

async function checkAdminAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    throw new Error("Unauthorized")
  }
  const [dbUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!dbUser || dbUser.role !== "admin") {
    throw new Error("Unauthorized")
  }
  return session
}

/**
 * Returns all pending IR requests for the admin queue.
 */
export async function getPendingIrRequestsAction() {
  await checkAdminAuth()
  return getPendingIrRequests()
}

/**
 * Approves a pending IR request.
 * Sets status to "approved", records resolvedAt and resolvedBy.
 */
export async function approveIrRequest(
  requestId: number
): Promise<{ success: true } | { success: false; error: string }> {
  let session: Awaited<ReturnType<typeof checkAdminAuth>>
  try {
    session = await checkAdminAuth()
  } catch {
    return { success: false, error: "Unauthorized" }
  }

  // Fetch the request and verify it is pending
  const [request] = await db
    .select()
    .from(irRequests)
    .where(and(eq(irRequests.id, requestId), eq(irRequests.status, "pending")))
    .limit(1)

  if (!request) {
    return { success: false, error: "Request not found or not pending" }
  }

  await db
    .update(irRequests)
    .set({
      status: "approved",
      resolvedAt: new Date(),
      resolvedBy: session.user.id,
    })
    .where(eq(irRequests.id, requestId))

  revalidatePath("/admin/ir")
  revalidatePath(`/leagues/${request.leagueId}/ir`)

  return { success: true }
}

/**
 * Rejects a pending IR request with an admin note.
 * Sets status to "rejected", records resolvedAt, resolvedBy, and adminNote.
 */
export async function rejectIrRequest(
  requestId: number,
  adminNote: string
): Promise<{ success: true } | { success: false; error: string }> {
  let session: Awaited<ReturnType<typeof checkAdminAuth>>
  try {
    session = await checkAdminAuth()
  } catch {
    return { success: false, error: "Unauthorized" }
  }

  // Validate adminNote is non-empty
  if (!adminNote || adminNote.trim().length === 0) {
    return { success: false, error: "Admin note is required when rejecting a request" }
  }

  // Fetch the request and verify it is pending
  const [request] = await db
    .select()
    .from(irRequests)
    .where(and(eq(irRequests.id, requestId), eq(irRequests.status, "pending")))
    .limit(1)

  if (!request) {
    return { success: false, error: "Request not found or not pending" }
  }

  await db
    .update(irRequests)
    .set({
      status: "rejected",
      resolvedAt: new Date(),
      resolvedBy: session.user.id,
      adminNote: adminNote.trim(),
    })
    .where(eq(irRequests.id, requestId))

  revalidatePath("/admin/ir")
  revalidatePath(`/leagues/${request.leagueId}/ir`)

  return { success: true }
}

/**
 * Returns all approved IR requests for the admin "Mark Eligible" section.
 */
export async function getApprovedIrRequestsAction() {
  await checkAdminAuth()
  return getApprovedIrRequests()
}

/**
 * Marks an approved IR request as return_eligible.
 * Transitions: approved → return_eligible.
 * The player will then be prompted to return their rider to the active roster.
 */
export async function markEligibleToReturn(
  requestId: number
): Promise<{ success: true } | { success: false; error: string }> {
  let session: Awaited<ReturnType<typeof checkAdminAuth>>
  try {
    session = await checkAdminAuth()
  } catch {
    return { success: false, error: "Unauthorized" }
  }

  const [request] = await db
    .select()
    .from(irRequests)
    .where(and(eq(irRequests.id, requestId), eq(irRequests.status, "approved")))
    .limit(1)

  if (!request) {
    return { success: false, error: "Request not found or not in approved status" }
  }

  await db
    .update(irRequests)
    .set({
      status: "return_eligible",
      resolvedAt: new Date(),
      resolvedBy: session.user.id,
    })
    .where(eq(irRequests.id, requestId))

  revalidatePath("/admin/ir")
  revalidatePath(`/leagues/${request.leagueId}/ir`)
  revalidatePath(`/leagues/${request.leagueId}`)

  return { success: true }
}

export type { PendingIrRequest } from "@/lib/ir-queries"
export type { ApprovedIrRequest } from "@/lib/ir-queries"

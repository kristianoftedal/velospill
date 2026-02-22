"use server"

import { db } from "@/lib/db"
import { orders } from "@/db/schema/orders"
import { riders } from "@/db/schema/riders"
import { races } from "@/db/schema/races"
import { leagues, teams } from "@/db/schema/leagues"
import { orderTypes } from "@/db/schema/config"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq, ne, desc, asc, and } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

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

export async function getPendingOrders() {
  await checkAdminAuth()

  const targetRider = alias(riders, "targetRider")
  const targetTeamAlias = alias(teams, "targetTeam")

  return db
    .select({
      orderId: orders.id,
      leagueId: orders.leagueId,
      leagueName: leagues.name,
      teamId: orders.teamId,
      teamName: teams.name,
      raceId: orders.raceId,
      raceName: races.name,
      raceStartDate: races.startDate,
      orderTypeName: orderTypes.name,
      orderTypeDisplayName: orderTypes.displayName,
      orderTypeEffect: orderTypes.effect,
      status: orders.status,
      targetRiderId: orders.targetRiderId,
      targetRiderName: targetRider.name,
      targetTeamId: orders.targetTeamId,
      targetTeamName: targetTeamAlias.name,
      targetProTeam: orders.targetProTeam,
      targetCountry: orders.targetCountry,
      orderConfig: orders.orderConfig,
      bonusPoints: orders.bonusPoints,
      submittedAt: orders.submittedAt,
    })
    .from(orders)
    .innerJoin(leagues, eq(leagues.id, orders.leagueId))
    .innerJoin(teams, eq(teams.id, orders.teamId))
    .innerJoin(races, eq(races.id, orders.raceId))
    .innerJoin(orderTypes, eq(orderTypes.id, orders.orderTypeId))
    .leftJoin(targetRider, eq(targetRider.id, orders.targetRiderId))
    .leftJoin(targetTeamAlias, eq(targetTeamAlias.id, orders.targetTeamId))
    .where(eq(orders.status, "pending"))
    .orderBy(asc(orders.submittedAt))
}

export async function getOrderHistory(limit = 50) {
  await checkAdminAuth()

  const targetRider = alias(riders, "targetRider")
  const targetTeamAlias = alias(teams, "targetTeam")

  return db
    .select({
      orderId: orders.id,
      leagueId: orders.leagueId,
      leagueName: leagues.name,
      teamId: orders.teamId,
      teamName: teams.name,
      raceId: orders.raceId,
      raceName: races.name,
      raceStartDate: races.startDate,
      orderTypeName: orderTypes.name,
      orderTypeDisplayName: orderTypes.displayName,
      orderTypeEffect: orderTypes.effect,
      status: orders.status,
      targetRiderId: orders.targetRiderId,
      targetRiderName: targetRider.name,
      targetTeamId: orders.targetTeamId,
      targetTeamName: targetTeamAlias.name,
      targetProTeam: orders.targetProTeam,
      targetCountry: orders.targetCountry,
      orderConfig: orders.orderConfig,
      bonusPoints: orders.bonusPoints,
      adminNote: orders.adminNote,
      submittedAt: orders.submittedAt,
      resolvedAt: orders.resolvedAt,
    })
    .from(orders)
    .innerJoin(leagues, eq(leagues.id, orders.leagueId))
    .innerJoin(teams, eq(teams.id, orders.teamId))
    .innerJoin(races, eq(races.id, orders.raceId))
    .innerJoin(orderTypes, eq(orderTypes.id, orders.orderTypeId))
    .leftJoin(targetRider, eq(targetRider.id, orders.targetRiderId))
    .leftJoin(targetTeamAlias, eq(targetTeamAlias.id, orders.targetTeamId))
    .where(ne(orders.status, "pending"))
    .orderBy(desc(orders.resolvedAt))
    .limit(limit)
}

export async function approveOrder(orderId: number) {
  const session = await checkAdminAuth()

  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    })
    if (!order) {
      return { success: false, error: "Order not found" }
    }
    if (order.status !== "pending") {
      return { success: false, error: "Order is not pending" }
    }

    await db
      .update(orders)
      .set({
        status: "active",
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
      })
      .where(eq(orders.id, orderId))

    revalidatePath("/admin/orders")
    revalidatePath(`/leagues/${order.leagueId}/orders`)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: (error as Error).message }
  }
}

export async function rejectOrder(orderId: number, adminNote: string) {
  const session = await checkAdminAuth()

  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    })
    if (!order) {
      return { success: false, error: "Order not found" }
    }
    if (order.status !== "pending") {
      return { success: false, error: "Order is not pending" }
    }

    await db
      .update(orders)
      .set({
        status: "rejected",
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
        adminNote,
      })
      .where(eq(orders.id, orderId))

    revalidatePath("/admin/orders")
    revalidatePath(`/leagues/${order.leagueId}/orders`)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: (error as Error).message }
  }
}

export async function setBonusPoints(orderId: number, bonusPoints: number) {
  await checkAdminAuth()

  try {
    if (!Number.isInteger(bonusPoints) || bonusPoints < 0) {
      return { success: false, error: "Bonus points must be a non-negative integer" }
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    })
    if (!order) {
      return { success: false, error: "Order not found" }
    }
    if (order.status !== "active") {
      return { success: false, error: "Bonus points can only be set on active orders" }
    }

    await db
      .update(orders)
      .set({ bonusPoints })
      .where(eq(orders.id, orderId))

    revalidatePath("/admin/orders")
    revalidatePath(`/leagues/${order.leagueId}/orders`)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: (error as Error).message }
  }
}

export async function getActivatedUnoXOrders() {
  await checkAdminAuth()

  return db
    .select({
      leagueId: orders.leagueId,
      leagueName: leagues.name,
      raceId: orders.raceId,
      raceName: races.name,
      season: races.season,
      orderId: orders.id,
      teamId: orders.teamId,
      teamName: teams.name,
    })
    .from(orders)
    .innerJoin(leagues, eq(leagues.id, orders.leagueId))
    .innerJoin(teams, eq(teams.id, orders.teamId))
    .innerJoin(races, eq(races.id, orders.raceId))
    .innerJoin(orderTypes, eq(orderTypes.id, orders.orderTypeId))
    .where(
      and(
        eq(orders.status, "active"),
        eq(orderTypes.name, "uno_x")
      )
    )
    .orderBy(asc(races.startDate))
}

export async function getBonusRiderDraftState(leagueId: number, raceId: number, season: number) {
  await checkAdminAuth()

  const { computeReverseDraftOrder, getBonusRidersForRace } = await import("@/lib/order-queries")

  const [draftOrder, picks] = await Promise.all([
    computeReverseDraftOrder(leagueId, season),
    getBonusRidersForRace(leagueId, raceId),
  ])

  const allPicked = draftOrder.length > 0 && picks.length === draftOrder.length

  return {
    draftOrder,
    picks,
    allPicked,
  }
}

export type PendingOrder = Awaited<ReturnType<typeof getPendingOrders>>[number]
export type OrderHistoryEntry = Awaited<ReturnType<typeof getOrderHistory>>[number]

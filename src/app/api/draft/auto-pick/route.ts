import { type NextRequest, NextResponse } from "next/server"
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { db } from "@/lib/db"
import { draftSessions, draftPicks } from "@/db/schema/draft"
import { teams } from "@/db/schema/leagues"
import { eq, asc } from "drizzle-orm"
import { pusherServer } from "@/lib/pusher-server"
import { getBestAvailableRider, computeNextDraftState } from "@/lib/draft-queries"

export const runtime = "nodejs"

const MEN_ROUNDS = 18
const WOMEN_ROUNDS = 6
const TIMER_MS = 60_000
const QSTASH_DELAY_S = 65

async function scheduleAutoPick(leagueId: number, expectedPickIndex: number) {
  const { Client } = await import("@upstash/qstash")
  const qstash = new Client({ token: process.env.QSTASH_TOKEN! })
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/draft/auto-pick`
  await qstash.publishJSON({
    url,
    body: { leagueId, expectedPickIndex },
    delay: QSTASH_DELAY_S,
  })
}

async function handler(request: NextRequest) {
  let body: { leagueId: number; expectedPickIndex: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { leagueId, expectedPickIndex } = body

  if (typeof leagueId !== "number" || typeof expectedPickIndex !== "number") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
  }

  // Fetch draft session
  const [draftSession] = await db
    .select()
    .from(draftSessions)
    .where(eq(draftSessions.leagueId, leagueId))
    .limit(1)

  // Idempotency check 1: no active draft
  if (!draftSession || draftSession.status === "complete" || draftSession.status === "pending") {
    return NextResponse.json({ skipped: true, reason: "no active draft" })
  }

  // Idempotency check 2: pick already made (someone picked before timer expired)
  if (draftSession.currentPickIndex !== expectedPickIndex) {
    return NextResponse.json({ skipped: true, reason: "pick already made" })
  }

  // Timing check: 5s grace period against premature delivery
  if (
    draftSession.timerExpiresAt &&
    new Date() < new Date(draftSession.timerExpiresAt.getTime() - 5000)
  ) {
    return NextResponse.json({ tooEarly: true })
  }

  // Get best available rider for auto-pick
  const rider = await getBestAvailableRider(leagueId, draftSession.currentGender as 'M' | 'F')

  if (!rider) {
    return NextResponse.json(
      { error: "No available riders for auto-pick" },
      { status: 500 }
    )
  }

  // Fetch teams for next state computation
  const leagueTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.createdAt))

  const teamCount = leagueTeams.length
  const currentPickIndex = draftSession.currentPickIndex
  const { nextPickIndex, nextRound, nextGender, nextTeamIndex, isComplete, isMenComplete } =
    computeNextDraftState(currentPickIndex, teamCount, MEN_ROUNDS, WOMEN_ROUNDS)

  const nextTeamId = isComplete ? null : leagueTeams[nextTeamIndex].id
  const nextTimerExpiresAt = isComplete ? null : new Date(Date.now() + TIMER_MS)
  const nextStatus = isComplete
    ? "complete"
    : isMenComplete
    ? "women"
    : (draftSession.status as "men" | "women")
  const completedAt = isComplete ? new Date() : null

  // Compute round for this pick
  const menTotalPicks = teamCount * MEN_ROUNDS
  let currentRound: number
  if (draftSession.currentGender === "M") {
    currentRound = Math.floor(currentPickIndex / teamCount)
  } else {
    currentRound = MEN_ROUNDS + Math.floor((currentPickIndex - menTotalPicks) / teamCount)
  }

  // The auto-pick team is the current team on the session
  const currentTeamId = draftSession.currentTeamId!

  // Insert pick and update session in transaction
  let insertedPick: typeof draftPicks.$inferSelect

  await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(draftPicks)
      .values({
        leagueId,
        teamId: currentTeamId,
        riderId: rider.id,
        pickNumber: currentPickIndex,
        round: currentRound,
        gender: draftSession.currentGender as 'M' | 'F',
        wasAutomatic: true,
      })
      .returning()
    insertedPick = p

    await tx
      .update(draftSessions)
      .set({
        currentPickIndex: nextPickIndex,
        currentTeamId: nextTeamId,
        currentGender: nextGender,
        timerExpiresAt: nextTimerExpiresAt,
        status: nextStatus as "men" | "women" | "complete" | "pending" | "paused",
        ...(completedAt ? { completedAt } : {}),
      })
      .where(eq(draftSessions.leagueId, leagueId))
  })

  // After transaction: schedule next auto-pick if not complete
  if (!isComplete) {
    await scheduleAutoPick(leagueId, nextPickIndex)
  }

  // After transaction: trigger Pusher events (include rider info for client recap)
  await pusherServer.trigger(`presence-draft-${leagueId}`, "pick-made", {
    pick: {
      ...insertedPick!,
      rider: {
        name: rider.name,
        team: rider.team,
        specialty: rider.specialty,
        nationality: rider.nationality,
      },
    },
    nextTeamId,
    nextPickIndex,
    timerExpiresAt: nextTimerExpiresAt,
    status: nextStatus,
    wasAutomatic: true,
  })

  if (isComplete) {
    await pusherServer.trigger(`presence-draft-${leagueId}`, "draft-complete", {
      leagueId,
    })
  }

  return NextResponse.json({
    success: true,
    riderId: rider.id,
    riderName: rider.name,
    wasAutomatic: true,
  })
}

export const POST = verifySignatureAppRouter(handler)

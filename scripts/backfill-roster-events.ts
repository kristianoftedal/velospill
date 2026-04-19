/**
 * Backfill roster_events from draftPicks + transferBids + ir_requests.
 *
 * Usage:
 *   npx tsx scripts/backfill-roster-events.ts           # insert events
 *   npx tsx scripts/backfill-roster-events.ts --dry-run  # log counts only
 *
 * Idempotent: skips events that already exist (matched by leagueId, teamId, riderId, eventType, occurredAt).
 */

import { db } from "@/lib/db"
import { draftPicks } from "@/db/schema/draft"
import { transferBids } from "@/db/schema/transfers"
import { irRequests } from "@/db/schema/ir"
import { rosterEvents, rosterEventTypeEnum } from "@/db/schema/roster-events"
import { eq, and, sql, asc } from "drizzle-orm"

const dryRun = process.argv.includes("--dry-run")

type EventRow = typeof rosterEvents.$inferInsert

async function main() {
  console.log(`\n=== Backfill roster_events ${dryRun ? "(DRY RUN)" : ""} ===\n`)

  // ── Step 1: Load all source data ──────────────────────────────────────────

  const allPicks = await db
    .select()
    .from(draftPicks)
    .orderBy(asc(draftPicks.pickedAt))

  const allBids = await db
    .select()
    .from(transferBids)

  const allIrRequests = await db
    .select()
    .from(irRequests)

  // Build bid lookup by id
  const bidById = new Map(allBids.map((b) => [b.id, b]))

  // ── Step 2: Generate events from draftPicks ───────────────────────────────

  const events: EventRow[] = []

  for (const pick of allPicks) {
    if (pick.pickNumber >= 0) {
      // Real draft pick
      events.push({
        leagueId: pick.leagueId,
        teamId: pick.teamId,
        riderId: pick.riderId,
        eventType: "drafted",
        occurredAt: pick.pickedAt,
        metadata: {
          pickNumber: pick.pickNumber,
          round: pick.round,
          gender: pick.gender,
          wasAutomatic: pick.wasAutomatic,
          source: "backfill:draftPick",
          draftPickId: pick.id,
        },
      })
    } else {
      // Transfer-generated pick (pickNumber = -bidId)
      const bidId = Math.abs(pick.pickNumber)
      const bid = bidById.get(bidId)

      events.push({
        leagueId: pick.leagueId,
        teamId: pick.teamId,
        riderId: pick.riderId,
        eventType: "transferred_in",
        occurredAt: pick.pickedAt,
        metadata: {
          bidId,
          source: "backfill:draftPick:transfer",
          draftPickId: pick.id,
          windowType: bid ? "transfer" : "unknown",
        },
      })

      // If the bid has an outRiderId, emit transferred_out for the previous owner
      if (bid?.outRiderId != null) {
        events.push({
          leagueId: pick.leagueId,
          teamId: bid.teamId, // same team — they swapped riders
          riderId: bid.outRiderId,
          eventType: "transferred_out",
          occurredAt: pick.pickedAt,
          metadata: {
            bidId,
            source: "backfill:transferBid:outRider",
          },
        })
      }
    }

    // If droppedAt is set, emit a 'dropped' event
    if (pick.droppedAt != null) {
      events.push({
        leagueId: pick.leagueId,
        teamId: pick.teamId,
        riderId: pick.riderId,
        eventType: "dropped",
        occurredAt: pick.droppedAt,
        metadata: {
          source: "backfill:draftPick:droppedAt",
          draftPickId: pick.id,
        },
      })
    }
  }

  // ── Step 3: Generate IR events ────────────────────────────────────────────

  for (const ir of allIrRequests) {
    // Only emit events for requests that were actually approved
    if (ir.status === "pending" || ir.status === "rejected") continue

    // ir_placed: when the request was approved
    if (ir.resolvedAt) {
      events.push({
        leagueId: ir.leagueId,
        teamId: ir.teamId,
        riderId: ir.riderId,
        eventType: "ir_placed",
        occurredAt: ir.resolvedAt,
        metadata: {
          irRequestId: ir.id,
          source: "backfill:irRequest",
        },
      })
    }

    // ir_returned: only for requests that completed the full cycle
    if (ir.status === "returned" && ir.resolvedAt) {
      // For returned requests, we need to distinguish the "returned" timestamp
      // from the "placed" timestamp. The resolvedAt on a returned request is the
      // return time. But we already used resolvedAt for ir_placed above.
      //
      // The actual flow is: request submitted → approved (resolvedAt set) → status changes
      // to return_eligible → status changes to returned (resolvedAt updated).
      //
      // Since resolvedAt gets overwritten on each status change, for returned requests
      // resolvedAt = the return time, and we use submittedAt as a proxy for placement
      // (the approval happened between submission and return).
      //
      // Fix the ir_placed event to use submittedAt instead for returned requests:
      const placedEvent = events.find(
        (e) =>
          e.eventType === "ir_placed" &&
          e.leagueId === ir.leagueId &&
          e.teamId === ir.teamId &&
          e.riderId === ir.riderId &&
          (e.metadata as any)?.irRequestId === ir.id
      )
      if (placedEvent) {
        placedEvent.occurredAt = ir.submittedAt // approximate: use submission time
      }

      events.push({
        leagueId: ir.leagueId,
        teamId: ir.teamId,
        riderId: ir.riderId,
        eventType: "ir_returned",
        occurredAt: ir.resolvedAt,
        metadata: {
          irRequestId: ir.id,
          source: "backfill:irRequest:returned",
        },
      })
    }
  }

  // ── Step 4: De-duplicate and insert ───────────────────────────────────────

  // Check existing events to skip duplicates
  const existingEvents = await db
    .select({
      leagueId: rosterEvents.leagueId,
      teamId: rosterEvents.teamId,
      riderId: rosterEvents.riderId,
      eventType: rosterEvents.eventType,
      occurredAt: rosterEvents.occurredAt,
    })
    .from(rosterEvents)

  const existingKeys = new Set(
    existingEvents.map(
      (e) => `${e.leagueId}:${e.teamId}:${e.riderId}:${e.eventType}:${e.occurredAt.toISOString()}`
    )
  )

  const newEvents = events.filter(
    (e) =>
      !existingKeys.has(
        `${e.leagueId}:${e.teamId}:${e.riderId}:${e.eventType}:${e.occurredAt!.toISOString()}`
      )
  )

  // ── Step 5: Summary ───────────────────────────────────────────────────────

  // Count by league and event type
  const counts = new Map<string, Map<string, number>>()
  for (const e of newEvents) {
    const leagueKey = `league:${e.leagueId}`
    if (!counts.has(leagueKey)) counts.set(leagueKey, new Map())
    const leagueCounts = counts.get(leagueKey)!
    leagueCounts.set(e.eventType!, (leagueCounts.get(e.eventType!) ?? 0) + 1)
  }

  console.log(`Total source draftPicks: ${allPicks.length}`)
  console.log(`Total source IR requests: ${allIrRequests.length}`)
  console.log(`Total events generated: ${events.length}`)
  console.log(`Already existing (skipped): ${events.length - newEvents.length}`)
  console.log(`New events to insert: ${newEvents.length}\n`)

  for (const [league, typeCounts] of counts) {
    console.log(`  ${league}:`)
    for (const [type, count] of typeCounts) {
      console.log(`    ${type}: ${count}`)
    }
  }

  if (dryRun) {
    console.log("\n(dry run — no events inserted)")
    process.exit(0)
  }

  // Insert in batches of 100 within transactions
  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < newEvents.length; i += BATCH_SIZE) {
    const batch = newEvents.slice(i, i + BATCH_SIZE)
    await db.transaction(async (tx) => {
      await tx.insert(rosterEvents).values(batch)
    })
    inserted += batch.length
  }

  console.log(`\n✅ Inserted ${inserted} roster events.`)

  // ── Step 6: Link transfer pairs ───────────────────────────────────────────
  // After insertion, link transferred_out → transferred_in via relatedEventId
  // for events that share the same (leagueId, metadata.bidId, occurredAt)

  const transferOutEvents = await db
    .select()
    .from(rosterEvents)
    .where(eq(rosterEvents.eventType, "transferred_out"))

  let linked = 0
  for (const outEvent of transferOutEvents) {
    if (outEvent.relatedEventId != null) continue
    const meta = outEvent.metadata as any
    if (!meta?.bidId) continue

    // Find matching transferred_in with same bidId and occurredAt
    const [matchingIn] = await db
      .select()
      .from(rosterEvents)
      .where(
        and(
          eq(rosterEvents.leagueId, outEvent.leagueId),
          eq(rosterEvents.eventType, "transferred_in"),
          eq(rosterEvents.occurredAt, outEvent.occurredAt),
          sql`(${rosterEvents.metadata}->>'bidId')::int = ${meta.bidId}`
        )
      )
      .limit(1)

    if (matchingIn) {
      // Link in → out
      await db
        .update(rosterEvents)
        .set({ relatedEventId: outEvent.id })
        .where(eq(rosterEvents.id, matchingIn.id))
      linked++
    }
  }

  if (linked > 0) {
    console.log(`🔗 Linked ${linked} transfer pairs via relatedEventId.`)
  }

  console.log("\nDone.")
  process.exit(0)
}

main().catch((err) => {
  console.error("Backfill failed:", err)
  process.exit(1)
})

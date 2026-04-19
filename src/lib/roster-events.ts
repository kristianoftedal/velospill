import { rosterEvents } from "@/db/schema/roster-events"
import { eq } from "drizzle-orm"
import type { PgTransaction } from "drizzle-orm/pg-core"

// Infer the insert type, omitting the auto-generated id
export type RosterEventInsert = typeof rosterEvents.$inferInsert

type Tx = Parameters<Parameters<typeof import("@/lib/db").db.transaction>[0]>[0]

/**
 * Emit a single roster event within an existing transaction.
 * Returns the inserted row (with id) — needed for relatedEventId linking.
 */
export async function emitRosterEvent(
  tx: Tx,
  event: Omit<RosterEventInsert, "id">
): Promise<typeof rosterEvents.$inferSelect> {
  const [inserted] = await tx
    .insert(rosterEvents)
    .values(event)
    .returning()
  return inserted
}

/**
 * Emit a transfer pair: transferred_out + transferred_in, linked by relatedEventId.
 * The transferred_out event is created first, then transferred_in references it.
 */
export async function emitTransferPair(
  tx: Tx,
  params: {
    leagueId: number
    outTeamId: number
    inTeamId: number
    riderId: number
    occurredAt: Date
    metadata?: Record<string, unknown>
  }
): Promise<{ outEvent: typeof rosterEvents.$inferSelect; inEvent: typeof rosterEvents.$inferSelect }> {
  const outEvent = await emitRosterEvent(tx, {
    leagueId: params.leagueId,
    teamId: params.outTeamId,
    riderId: params.riderId,
    eventType: "transferred_out",
    occurredAt: params.occurredAt,
    metadata: params.metadata ?? null,
  })

  const inEvent = await emitRosterEvent(tx, {
    leagueId: params.leagueId,
    teamId: params.inTeamId,
    riderId: params.riderId,
    eventType: "transferred_in",
    occurredAt: params.occurredAt,
    relatedEventId: outEvent.id,
    metadata: params.metadata ?? null,
  })

  return { outEvent, inEvent }
}

/**
 * One-time backfill: populate roster_slots from current draftPicks + irRequests.
 *
 * Logic:
 *   - Every row in draftPicks gets an 'active' slot by default.
 *   - If the rider has an approved IR request → status becomes 'on_ir'.
 *   - If the rider has a return_eligible IR request → status becomes 'return_eligible'.
 *   - pending/rejected/returned IR requests do not change the slot status.
 *
 * Idempotent: uses ON CONFLICT DO NOTHING so safe to re-run.
 *
 * Run with: npx tsx src/db/migrate-roster-slots.ts
 */

import "dotenv/config"
import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { inArray } from "drizzle-orm"
import * as schema from "./schema"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function main() {
  console.log("Starting roster_slots backfill...")

  // 1. Load all draftPicks (current roster state)
  const picks = await db
    .select({
      leagueId: schema.draftPicks.leagueId,
      teamId: schema.draftPicks.teamId,
      riderId: schema.draftPicks.riderId,
      addedAt: schema.draftPicks.pickedAt,
    })
    .from(schema.draftPicks)

  if (picks.length === 0) {
    console.log("No draftPicks found. Nothing to backfill.")
    return
  }

  console.log(`Found ${picks.length} draftPicks rows.`)

  // 2. Load IR requests that override status (approved or return_eligible only)
  const irOverrides = await db
    .select({
      leagueId: schema.irRequests.leagueId,
      riderId: schema.irRequests.riderId,
      status: schema.irRequests.status,
    })
    .from(schema.irRequests)
    .where(inArray(schema.irRequests.status, ["approved", "return_eligible"]))

  // Build a lookup: `${leagueId}:${riderId}` → ir status
  const irMap = new Map<string, "on_ir" | "return_eligible">()
  for (const ir of irOverrides) {
    const key = `${ir.leagueId}:${ir.riderId}`
    // approved → on_ir, return_eligible → return_eligible
    irMap.set(key, ir.status === "approved" ? "on_ir" : "return_eligible")
  }

  console.log(`Found ${irOverrides.length} active IR overrides.`)

  // 3. Build rows to insert
  const rows = picks.map((pick) => {
    const key = `${pick.leagueId}:${pick.riderId}`
    const irStatus = irMap.get(key)
    return {
      leagueId: pick.leagueId,
      teamId: pick.teamId,
      riderId: pick.riderId,
      status: (irStatus ?? "active") as "active" | "on_ir" | "return_eligible",
      addedAt: pick.addedAt,
    }
  })

  // 4. Insert in batches of 100 (Neon serverless safe batch size)
  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    try {
      await db
        .insert(schema.rosterSlots)
        .values(batch)
        .onConflictDoNothing()
      inserted += batch.length
    } catch (err) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, err)
      throw err
    }
  }

  // 5. Report results
  console.log("\nBackfill complete.")
  console.log(`  draftPicks rows:      ${picks.length}`)
  console.log(`  roster_slots inserted: ${inserted}`)
  console.log(`  IR overrides applied:  ${irOverrides.length}`)
}

main()
  .then(() => {
    console.log("Done.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Backfill failed:", err)
    process.exit(1)
  })

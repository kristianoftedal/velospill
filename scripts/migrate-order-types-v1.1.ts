#!/usr/bin/env tsx

/**
 * Migration: Order Types v1.1
 * Updates order type configurations for 2026 ruleset
 *
 * Changes:
 * - ORDER-01: Blodpose GT - Split multipliers (x3 TdF, x3.5 Giro/Vuelta)
 * - ORDER-02: Etappeseier - Restructure to multiply_finish_points with per-GT values
 * - ORDER-03: Hammer - Bump to 5 pts/position, max 50
 * - ORDER-04: Lagtempo - Bump to 10 pts per top-20
 * - ORDER-05: Sponsorens ritt - Change to 3x multiplier
 * - ORDER-08: Kaptein - Add womens_one_day support
 */

import { Pool } from "@neondatabase/serverless"

const isDryRun = process.argv.includes("--dry-run")

interface UpdateOperation {
  order: string
  field: string
  oldValue: any
  newValue: any
  sql: string
  params: any[]
}

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  const client = await pool.connect()

  try {
    console.log("🔄 Starting Order Types v1.1 migration...")
    console.log(`   Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`)
    console.log("")

    const updates: UpdateOperation[] = [
      // ORDER-01: Blodpose GT - Split multipliers
      {
        order: "blodpose_gt",
        field: "effect",
        oldValue: { type: "multiplier", value: 3, target: "own_rider" },
        newValue: {
          type: "multiplier",
          values: { grand_tour: 3.5, grand_tour_tdf: 3 },
          target: "own_rider",
        },
        sql: `UPDATE "orderTypes" SET effect = $1, description = $2 WHERE name = $3`,
        params: [
          JSON.stringify({
            type: "multiplier",
            values: { grand_tour: 3.5, grand_tour_tdf: 3 },
            target: "own_rider",
          }),
          "x3 for TdF or x3.5 for Giro/Vuelta for one of your riders",
          "blodpose_gt",
        ],
      },

      // ORDER-02: Etappeseier - Restructure to multiply_finish_points
      {
        order: "etappeseier",
        field: "effect",
        oldValue: { type: "double_top10_stage", target: "all_own_riders" },
        newValue: {
          type: "multiply_finish_points",
          values: { grand_tour: 2.25, grand_tour_tdf: 2 },
          target: "all_own_riders",
        },
        sql: `UPDATE "orderTypes" SET effect = $1, description = $2 WHERE name = $3`,
        params: [
          JSON.stringify({
            type: "multiply_finish_points",
            values: { grand_tour: 2.25, grand_tour_tdf: 2 },
            target: "all_own_riders",
          }),
          "All your riders get multiplied stage finish points (x2 TdF, x2.25 Giro/Vuelta)",
          "etappeseier",
        ],
      },

      // ORDER-03: Hammer - Bump to 5 pts/position, max 50
      {
        order: "hammer",
        field: "effect.points_per_position + max_points",
        oldValue: { points_per_position: 3, max_points: 30 },
        newValue: { points_per_position: 5, max_points: 50 },
        sql: `UPDATE "orderTypes" SET effect = $1, description = $2 WHERE name = $3`,
        params: [
          JSON.stringify({
            type: "gc_position_loss",
            points_per_position: 5,
            max_points: 50,
            restriction: "stage_11_plus",
            target: "unowned_gc_top10",
          }),
          "Pick a GC top-10 rider not on your team, 5 pts per GC position lost, max 50 (stage 11+)",
          "hammer",
        ],
      },

      // ORDER-04: Lagtempo - Bump to 10 pts per top-20
      {
        order: "lagtempo",
        field: "effect.points_per_top20",
        oldValue: { points_per_top20: 5 },
        newValue: { points_per_top20: 10 },
        sql: `UPDATE "orderTypes" SET effect = $1, description = $2 WHERE name = $3`,
        params: [
          JSON.stringify({
            type: "team_placement_points",
            points_per_top20: 10,
            restriction: "vuelta_only_no_ttt",
            target: "real_team",
          }),
          "Choose a real team, 10 pts per top-20 placement (Vuelta only, can't play on TTT stage)",
          "lagtempo",
        ],
      },

      // ORDER-05: Sponsorens ritt - Change to 3x multiplier
      {
        order: "sponsorens_ritt",
        field: "effect",
        oldValue: { type: "double_end_tour", target: "all_own_riders" },
        newValue: { type: "multiply_end_tour", value: 3, target: "all_own_riders" },
        sql: `UPDATE "orderTypes" SET effect = $1, description = $2 WHERE name = $3`,
        params: [
          JSON.stringify({
            type: "multiply_end_tour",
            value: 3,
            target: "all_own_riders",
          }),
          "3x end-of-tour points for all your riders",
          "sponsorens_ritt",
        ],
      },

      // ORDER-08: Kaptein - Add womens_one_day support
      {
        order: "kaptein",
        field: "applicableRaceTypes",
        oldValue: ["world_championship"],
        newValue: ["world_championship", "womens_one_day"],
        sql: `UPDATE "orderTypes" SET "applicableRaceTypes" = $1, description = $2 WHERE name = $3`,
        params: [
          JSON.stringify(["world_championship", "womens_one_day"]),
          "x2 for one rider OR x1.5 for all riders from a chosen country (WC and Women's races)",
          "kaptein",
        ],
      },
    ]

    if (isDryRun) {
      console.log("📋 Planned updates (DRY RUN):")
      console.log("")
      updates.forEach((update, index) => {
        console.log(`${index + 1}. ${update.order} (${update.field})`)
        console.log(`   SQL: ${update.sql}`)
        console.log(`   Params: ${JSON.stringify(update.params, null, 2)}`)
        console.log(`   Old: ${JSON.stringify(update.oldValue)}`)
        console.log(`   New: ${JSON.stringify(update.newValue)}`)
        console.log("")
      })
      console.log("✅ DRY RUN complete - no changes made")
      return
    }

    // Execute updates in a transaction
    await client.query("BEGIN")

    console.log("📝 Executing updates...")
    console.log("")

    for (const update of updates) {
      console.log(`   Updating ${update.order}...`)
      console.log(`     Field: ${update.field}`)
      console.log(`     Old: ${JSON.stringify(update.oldValue)}`)
      console.log(`     New: ${JSON.stringify(update.newValue)}`)

      const result = await client.query(update.sql, update.params)

      if (result.rowCount === 0) {
        throw new Error(`No rows updated for ${update.order} - order may not exist`)
      }

      console.log(`     ✓ Updated ${result.rowCount} row(s)`)
      console.log("")
    }

    await client.query("COMMIT")

    console.log("✅ Migration complete!")
    console.log(`   Updated ${updates.length} order types`)
  } catch (error) {
    if (!isDryRun) {
      await client.query("ROLLBACK")
      console.error("❌ Migration failed - rolled back")
    }
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })

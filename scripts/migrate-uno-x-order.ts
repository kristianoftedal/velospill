#!/usr/bin/env tsx

/**
 * Migration: Uno-X Order Type
 * Adds the bonus_riders table and Uno-X order type configuration
 *
 * Changes:
 * - DDL: Create bonus_riders table with indexes
 * - Data: Insert Uno-X order type into orderTypes table
 */

import { Pool } from "@neondatabase/serverless"
import { readFileSync } from "fs"
import { join } from "path"

const isDryRun = process.argv.includes("--dry-run")

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  const client = await pool.connect()

  try {
    console.log("🔄 Starting Uno-X order migration...")
    console.log(`   Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`)
    console.log("")

    // Read the DDL migration file
    const migrationSQL = readFileSync(
      join(__dirname, "../src/db/migrations/0002_add_bonus_riders.sql"),
      "utf-8"
    )

    // Uno-X order type data
    const unoXOrder = {
      name: "uno_x",
      displayName: "Uno-X",
      applicableRaceTypes: JSON.stringify(["grand_tour", "womens_grand_tour"]),
      effect: JSON.stringify({
        type: "bonus_rider_draft",
        target: "unowned_rider_pool",
        description: "Each team picks one bonus rider from the unowned pool in reverse standings order"
      }),
      description: "Pick a bonus rider from the unowned pool for this GT (reverse standings draft order)",
    }

    if (isDryRun) {
      console.log("📋 Planned operations (DRY RUN):")
      console.log("")
      console.log("1. Create bonus_riders table:")
      console.log(migrationSQL)
      console.log("")
      console.log("2. Insert Uno-X order type:")
      console.log(`   Name: ${unoXOrder.name}`)
      console.log(`   Display: ${unoXOrder.displayName}`)
      console.log(`   Applicable: ${unoXOrder.applicableRaceTypes}`)
      console.log(`   Effect: ${unoXOrder.effect}`)
      console.log(`   Description: ${unoXOrder.description}`)
      console.log("")
      console.log("✅ DRY RUN complete - no changes made")
      return
    }

    // Execute in a transaction
    await client.query("BEGIN")

    console.log("📝 Executing migration...")
    console.log("")

    // 1. Create bonus_riders table
    console.log("   Creating bonus_riders table...")
    await client.query(migrationSQL)
    console.log("     ✓ Table created")
    console.log("")

    // 2. Insert Uno-X order type (idempotent with ON CONFLICT)
    console.log("   Inserting Uno-X order type...")
    const insertSQL = `
      INSERT INTO "orderTypes" (name, "displayName", "applicableRaceTypes", effect, description)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO NOTHING
    `
    const result = await client.query(insertSQL, [
      unoXOrder.name,
      unoXOrder.displayName,
      unoXOrder.applicableRaceTypes,
      unoXOrder.effect,
      unoXOrder.description,
    ])

    if (result.rowCount === 0) {
      console.log("     ⚠️  Order type already exists (skipped)")
    } else {
      console.log("     ✓ Inserted Uno-X order type")
    }
    console.log("")

    await client.query("COMMIT")

    console.log("✅ Migration complete!")
    console.log("   - bonus_riders table created")
    console.log("   - Uno-X order type added")
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

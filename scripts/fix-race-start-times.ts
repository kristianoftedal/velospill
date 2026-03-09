#!/usr/bin/env tsx

/**
 * Migration: Fix Race Start Times
 * Updates all races where startDate has a time of 00:00:00 UTC to use 12:00:00 UTC instead.
 *
 * Purpose: Races entered without an explicit time default to midnight UTC.
 * A noon default is more accurate and avoids races appearing to start the
 * previous day in positive-offset timezones.
 */

import { Pool } from "@neondatabase/serverless"

const isDryRun = process.argv.includes("--dry-run")

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  const client = await pool.connect()

  try {
    console.log("Starting fix-race-start-times migration...")
    console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`)
    console.log("")

    if (isDryRun) {
      const result = await client.query(`
        SELECT id, name, "startDate"
        FROM races
        WHERE EXTRACT(HOUR FROM "startDate" AT TIME ZONE 'UTC') = 0
          AND EXTRACT(MINUTE FROM "startDate" AT TIME ZONE 'UTC') = 0
          AND EXTRACT(SECOND FROM "startDate" AT TIME ZONE 'UTC') = 0
        ORDER BY "startDate", id
      `)

      console.log(`DRY RUN: ${result.rowCount} race(s) would be updated`)
      console.log("")

      if (result.rowCount && result.rowCount > 0) {
        console.log("Affected races:")
        for (const row of result.rows) {
          console.log(`  id=${row.id}  startDate=${row.startDate}  name=${row.name}`)
        }
      } else {
        console.log("No races with 00:00:00 UTC startDate found.")
      }

      console.log("")
      console.log("DRY RUN complete - no changes made")
      return
    }

    // Live mode: update inside a transaction
    await client.query("BEGIN")

    const result = await client.query(`
      UPDATE races
      SET "startDate" = "startDate" + INTERVAL '12 hours',
          "updatedAt" = NOW()
      WHERE EXTRACT(HOUR FROM "startDate" AT TIME ZONE 'UTC') = 0
        AND EXTRACT(MINUTE FROM "startDate" AT TIME ZONE 'UTC') = 0
        AND EXTRACT(SECOND FROM "startDate" AT TIME ZONE 'UTC') = 0
    `)

    await client.query("COMMIT")

    console.log(`Migration complete! Updated ${result.rowCount} race(s) from 00:00:00 UTC to 12:00:00 UTC.`)
  } catch (error) {
    if (!isDryRun) {
      await client.query("ROLLBACK")
      console.error("Migration failed - rolled back")
    }
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})

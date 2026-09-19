import { Pool } from "@neondatabase/serverless"
import * as dotenv from "dotenv"
import { resolve } from "path"

dotenv.config({ path: resolve(process.cwd(), ".env.local") })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL not set")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })

/**
 * Applies src/db/migrations/0012_system_actor_and_window_resolution.sql.
 * Idempotent — safe to re-run.
 */
async function applyMigration() {
  const client = await pool.connect()
  try {
    console.log("Seeding the 'system' actor row...")
    await client.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "role")
       VALUES ('system', 'System', 'system@velospill.local', true, 'system')
       ON CONFLICT ("id") DO NOTHING;`
    )

    console.log('Adding transfer_windows."resolvedAt"...')
    await client.query(
      `ALTER TABLE "transfer_windows"
         ADD COLUMN IF NOT EXISTS "resolvedAt" timestamp with time zone;`
    )

    console.log("Backfilling resolvedAt on already-closed waiver windows...")
    const backfill = await client.query(
      `UPDATE "transfer_windows"
          SET "resolvedAt" = "closesAt"
        WHERE "windowType" = 'waiver'
          AND "closesAt" <= now()
          AND "resolvedAt" IS NULL;`
    )
    console.log(`  marked ${backfill.rowCount} past window(s) resolved`)

    const { rows: userRows } = await client.query(
      `SELECT "id", "role" FROM "user" WHERE "id" = 'system';`
    )
    if (userRows.length === 0) throw new Error("system user was not created")

    const { rows: colRows } = await client.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'transfer_windows' AND column_name = 'resolvedAt';`
    )
    if (colRows.length === 0) throw new Error("resolvedAt column was not created")

    console.log("OK:", userRows[0], colRows[0])

    const { rows: pending } = await client.query(
      `SELECT "leagueId", count(*)::int AS pending
         FROM "transfer_bids"
        WHERE "status" = 'pending'
        GROUP BY "leagueId";`
    )
    if (pending.length > 0) {
      console.log(
        "\nNOTE: pending bids exist but their windows were backfilled as resolved.",
        "\nResolve them in /admin/transfers, or clear resolvedAt on the relevant window",
        "\nto let the next cron run pick it up:"
      )
      console.table(pending)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

applyMigration()
  .then(() => {
    console.log("Migration applied.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Migration failed:", err)
    process.exit(1)
  })

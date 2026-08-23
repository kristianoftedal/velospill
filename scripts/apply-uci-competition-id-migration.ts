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

async function applyMigration() {
  const client = await pool.connect()
  try {
    console.log('Adding races."uciCompetitionId"...')
    await client.query(
      `ALTER TABLE "races" ADD COLUMN IF NOT EXISTS "uciCompetitionId" text;`
    )

    const { rows } = await client.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'races' AND column_name = 'uciCompetitionId';`
    )
    if (rows.length === 0) throw new Error("Column was not created")
    console.log("OK:", rows[0])
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

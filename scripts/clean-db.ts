import { Pool } from "@neondatabase/serverless"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function cleanDatabase() {
  const client = await pool.connect()

  try {
    // Get all tables
    const tablesResult = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
    `)

    // Drop all tables
    for (const row of tablesResult.rows) {
      await client.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`)
      console.log(`Dropped table: ${row.tablename}`)
    }

    // Get all enums
    const enumsResult = await client.query(`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      GROUP BY t.typname
    `)

    // Drop all enums
    for (const row of enumsResult.rows) {
      await client.query(`DROP TYPE IF EXISTS "${row.typname}" CASCADE`)
      console.log(`Dropped enum: ${row.typname}`)
    }

    console.log("Database cleaned successfully")
  } catch (error) {
    console.error("Error cleaning database:", error)
  } finally {
    client.release()
    await pool.end()
  }
}

cleanDatabase()

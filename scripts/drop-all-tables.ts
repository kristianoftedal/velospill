import { Pool } from "@neondatabase/serverless"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function dropAllTables() {
  const client = await pool.connect()

  try {
    // Drop all tables
    const tables = [
      'standings', 'player_scores', 'race_results', 'roster_spots',
      'rosters', 'draft_picks', 'league_players', 'leagues',
      'seasons', 'sessions', 'users'
    ]

    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`)
        console.log(`Dropped table: ${table}`)
      } catch (e) {
        console.log(`Table ${table} doesn't exist or already dropped`)
      }
    }

    console.log("All old tables dropped successfully")
  } catch (error) {
    console.error("Error dropping tables:", error)
  } finally {
    client.release()
    await pool.end()
  }
}

dropAllTables()

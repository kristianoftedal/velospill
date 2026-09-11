/**
 * Prints league standings through the real scoring path (getLeagueStandings), so the
 * effect of the makeLineupFilter changes can be compared against the pre-fix figures.
 *
 * Reference: before the fix, base totals were 2354 / 2232 / 1988 — inflated because
 * the deleted NULL-period rows left several periods matching no lineup at all, which
 * makes every rider on the roster score.
 *
 * Usage:
 *   npm run standings:check          # current season
 *   npm run standings:check -- 2025  # explicit season
 */
import { db } from "../src/lib/db"
import { getLeagueStandings } from "../src/lib/scoring-queries"
import { sql } from "drizzle-orm"

const LEAGUE_ID = 7

async function main() {
  const arg = process.argv.find((a) => /^\d{4}$/.test(a))
  const season = arg
    ? Number(arg)
    : ((await db.execute(sql`SELECT MAX(season)::int AS s FROM races`)).rows[0] as { s: number }).s

  const rows = await getLeagueStandings(LEAGUE_ID, season)
  console.log(`League ${LEAGUE_ID}, season ${season}\n`)
  for (const r of rows) {
    console.log(`  ${String(r.totalPoints).padStart(6)}  team ${r.teamId}  ${r.teamName}`)
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

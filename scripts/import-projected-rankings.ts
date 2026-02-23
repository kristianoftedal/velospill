import { db } from "@/lib/db"
import { projectedRankings } from "@/db/schema/projected-rankings"
import { riders } from "@/db/schema/riders"
import { eq } from "drizzle-orm"
import * as fs from "fs"
import * as path from "path"

interface RankingEntry {
  rank: number
  riderName: string
  team: string
  nationality: string
  projectedPoints: number
  breakdown: {
    highPriorityOneDay: number
    lowPriorityOneDay: number
    grandTour: number
    grandTourTdf: number
    miniTour: number
  }
  confirmedRaces: number
  injuryStatus: "healthy" | "injured" | "doubtful"
  injuryNote: string | null
  season: number
  lastUpdated: string
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalizeName(a)
  const nb = normalizeName(b)

  // Exact match
  if (na === nb) return true

  // Check if one contains the other (handles middle name variations)
  if (na.includes(nb) || nb.includes(na)) return true

  // Check reversed name order (Last, First vs First Last)
  const partsA = na.split(/\s+/)
  const partsB = nb.split(/\s+/)
  if (partsA.length >= 2 && partsB.length >= 2) {
    const reversedA = [...partsA].reverse().join(" ")
    if (reversedA === nb) return true
  }

  return false
}

async function main() {
  console.log("=".repeat(60))
  console.log("Importing projected rankings into database")
  console.log("=".repeat(60) + "\n")

  const inputFile = path.join(process.cwd(), "data", "projected-rankings.json")

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`)
    console.error("Run 'npx tsx scripts/scrape-projected-rankings.ts' first.")
    process.exit(1)
  }

  const rawData = fs.readFileSync(inputFile, "utf-8")
  const rankings: RankingEntry[] = JSON.parse(rawData)

  console.log(`Loaded ${rankings.length} rankings from JSON\n`)

  // Fetch all riders from DB for matching
  const dbRiders = await db.select({ id: riders.id, name: riders.name }).from(riders)
  console.log(`Found ${dbRiders.length} riders in database for matching\n`)

  // Match rankings to DB riders
  let matched = 0
  const insertData = rankings.map((entry) => {
    let riderId: number | null = null

    // Try to find matching rider
    for (const dbRider of dbRiders) {
      if (fuzzyMatch(entry.riderName, dbRider.name)) {
        riderId = dbRider.id
        matched++
        break
      }
    }

    return {
      rank: entry.rank,
      riderName: entry.riderName,
      riderId,
      team: entry.team,
      nationality: entry.nationality,
      projectedPoints: entry.projectedPoints,
      breakdown: entry.breakdown,
      confirmedRaces: entry.confirmedRaces,
      injuryStatus: entry.injuryStatus,
      injuryNote: entry.injuryNote,
      season: entry.season,
      lastUpdated: new Date(entry.lastUpdated),
    }
  })

  console.log(`Matched ${matched}/${rankings.length} riders to database records\n`)

  // Delete existing rankings for season 2026
  console.log("Deleting existing 2026 rankings...")
  await db.delete(projectedRankings).where(eq(projectedRankings.season, 2026))

  // Insert new rankings
  console.log(`Inserting ${insertData.length} rankings...`)
  await db.insert(projectedRankings).values(insertData)

  console.log("\nDone! Rankings imported successfully.")
}

main()
  .catch((error) => {
    console.error("Error importing rankings:", error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })

import { db } from "@/lib/db"
import { races } from "./schema/races"
import { riders } from "./schema/riders"
import { raceResults } from "./schema/results"
import { scoringConfig } from "./schema/config"
import { eq, and, sql } from "drizzle-orm"

/**
 * Insert TTT results for Tour de France 2026 Stage 1.
 *
 * Run with:  dotenv -e .env.local -- npx tsx src/db/insert-tdf-2026-stage1-ttt.ts
 */

const TTT_RESULTS: Array<{ position: number; riderNames: string[] }> = [
  {
    position: 1,
    riderNames: [
      "Jonas Vingegaard",
      "Davide Piganzoli",
      "Sepp Kuss",
      "Matteo Jorgenson",
      "Bruno Armirail",
      "Victor Campenaerts",
      "Edoardo Affini",
      "Per Strand Hagenes",
    ],
  },
  {
    position: 2,
    riderNames: [
      "Filippo Ganna",
      "Tobias Foss",
      "Thymen Arensman",
      "Kévin Vauquelin",
      "Dorian Godon",
      "Joshua Tarling",
      "Michał Kwiatkowski",
      "Egan Bernal",
    ],
  },
  {
    position: 3,
    riderNames: [
      "Tadej Pogačar",
      "Isaac del Toro",
      "Brandon McNulty",
      "Felix Großschartner",
      "Tim Wellens",
      "Florian Vermeersch",
      "Adam Yates",
      "Nils Politt",
    ],
  },
]

async function main() {
  // Find TdF 2026 Stage 1
  const stage = await db.query.races.findFirst({
    where: and(eq(races.stageNumber, 1), eq(races.season, 2026)),
    with: { parentRace: true },
  })

  if (!stage) {
    // Try finding by looking for parent race named Tour de France
    const parentRace = await db
      .select()
      .from(races)
      .where(
        and(
          eq(races.season, 2026),
          eq(races.raceType, "grand_tour"),
          sql`LOWER(${races.name}) LIKE '%tour de france%'`,
        ),
      )
      .limit(1)

    if (parentRace.length === 0) {
      console.error("Could not find Tour de France 2026 parent race")
      process.exit(1)
    }

    const stageRace = await db.query.races.findFirst({
      where: and(eq(races.parentRaceId, parentRace[0].id), eq(races.stageNumber, 1)),
    })

    if (!stageRace) {
      console.error("Could not find Stage 1 of Tour de France 2026")
      process.exit(1)
    }

    await insertResults(stageRace.id, parentRace[0].id)
    return
  }

  await insertResults(stage.id, stage.parentRaceId!)
}

async function insertResults(raceId: number, parentRaceId: number) {
  // Get scoring rules for grand_tour_tdf / ttt
  const [scoringRules] = await db
    .select({ rules: scoringConfig.rules })
    .from(scoringConfig)
    .where(
      and(
        eq(scoringConfig.raceType, "grand_tour_tdf"),
        eq(scoringConfig.category, "ttt"),
      ),
    )
    .limit(1)

  if (!scoringRules) {
    console.error("No TTT scoring config found for grand_tour_tdf")
    process.exit(1)
  }

  const rules = scoringRules.rules as Record<string, number>

  // Resolve rider names to IDs
  const allRiderNames = TTT_RESULTS.flatMap((p) => p.riderNames)
  const allRiders = await db.select({ id: riders.id, name: riders.name }).from(riders)

  const nameToId = new Map<string, number>()
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/ß/g, "ss").toLowerCase()

  for (const riderName of allRiderNames) {
    const match = allRiders.find(
      (r) => r.name.toLowerCase() === riderName.toLowerCase(),
    )
    if (match) {
      nameToId.set(riderName, match.id)
    } else {
      const parts = norm(riderName).split(/\s+/)
      const fuzzy = allRiders.find((r) => {
        const rNorm = norm(r.name)
        return parts.every((p) => rNorm.includes(p))
      })
      if (fuzzy) {
        nameToId.set(riderName, fuzzy.id)
        console.log(`  Fuzzy matched: "${riderName}" -> "${fuzzy.name}" (id=${fuzzy.id})`)
      } else {
        console.error(`  NOT FOUND: "${riderName}"`)
      }
    }
  }

  const missingRiders = allRiderNames.filter((n) => !nameToId.has(n))
  if (missingRiders.length > 0) {
    console.error(`Missing riders: ${missingRiders.join(", ")}`)
    console.error("Aborting.")
    process.exit(1)
  }

  // Delete existing TTT results for this race
  await db.execute(
    sql`DELETE FROM race_results WHERE "raceId" = ${raceId} AND category = 'ttt'`,
  )

  // Insert
  let inserted = 0
  for (const { position, riderNames } of TTT_RESULTS) {
    const points = rules[String(position)] ?? 0
    let slot = 1
    for (const riderName of riderNames) {
      const riderId = nameToId.get(riderName)!
      await db.insert(raceResults).values({
        raceId,
        riderId,
        category: "ttt",
        position,
        slot,
        time: null,
        points,
      })
      slot++
      inserted++
    }
  }

  console.log(`Inserted ${inserted} TTT result rows for raceId=${raceId}`)
  console.log("Points awarded: pos 1 = %d, pos 2 = %d, pos 3 = %d", rules["1"] ?? 0, rules["2"] ?? 0, rules["3"] ?? 0)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

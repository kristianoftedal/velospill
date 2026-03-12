import { db } from "@/lib/db"
import { scoringConfig } from "./schema/config"
import { races } from "./schema/races"
import { raceResults } from "./schema/results"
import { eq, and, ilike } from "drizzle-orm"

/**
 * Retroactively recalculates points for Strade Bianche Donne
 * using the current womens_one_day finish scoring rules.
 *
 * Run with: npx tsx src/db/retroactive-strade-bianche-donne.ts [--dry-run]
 */

const isDryRun = process.argv.includes("--dry-run")

async function recalculate() {
  console.log(`🔄 Retroactive scoring fix: Strade Bianche Donne ${isDryRun ? "(DRY RUN)" : ""}`)
  console.log("=".repeat(60))

  if (isDryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be committed\n")
  }

  // Find the race
  const race = await db.query.races.findFirst({
    where: ilike(races.name, "%strade bianche donne%"),
  })

  if (!race) {
    console.error("❌ Race 'Strade Bianche Donne' not found in database")
    process.exit(1)
  }

  console.log(`✅ Found race: "${race.name}" (id=${race.id}, type=${race.raceType})`)

  if (race.raceType !== "womens_one_day") {
    console.error(`❌ Race type is "${race.raceType}", expected "womens_one_day". Aborting.`)
    process.exit(1)
  }

  // Fetch current womens_one_day finish scoring rules
  const [scoring] = await db
    .select({ rules: scoringConfig.rules })
    .from(scoringConfig)
    .where(
      and(
        eq(scoringConfig.raceType, "womens_one_day"),
        eq(scoringConfig.category, "finish"),
      ),
    )
    .limit(1)

  if (!scoring) {
    console.error("❌ No scoring config found for womens_one_day / finish")
    process.exit(1)
  }

  const rules = scoring.rules as Record<string, number>
  console.log("\n📊 Current womens_one_day finish scoring:")
  Object.entries(rules)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([pos, pts]) => console.log(`  P${pos}: ${pts} pts`))

  // Fetch existing finish results
  const results = await db
    .select()
    .from(raceResults)
    .where(
      and(
        eq(raceResults.raceId, race.id),
        eq(raceResults.category, "finish"),
      ),
    )

  if (results.length === 0) {
    console.log("\n⚠️  No finish results found for this race — nothing to update")
    process.exit(0)
  }

  console.log(`\n🔢 Found ${results.length} result(s) to update:\n`)

  let updatedCount = 0
  for (const result of results) {
    const newPoints = rules[String(result.position)] ?? 0
    const changed = result.points !== newPoints
    console.log(
      `  P${result.position}: ${result.points} pts → ${newPoints} pts${changed ? " ✏️" : " (no change)"}`,
    )

    if (changed && !isDryRun) {
      await db
        .update(raceResults)
        .set({ points: newPoints, updatedAt: new Date() })
        .where(eq(raceResults.id, result.id))
      updatedCount++
    } else if (changed) {
      updatedCount++
    }
  }

  if (isDryRun) {
    console.log(`\n✅ DRY RUN complete — ${updatedCount} row(s) would be updated`)
  } else {
    console.log(`\n✅ Done — updated ${updatedCount} row(s)`)
  }

  process.exit(0)
}

recalculate().catch((error) => {
  console.error("❌ Error:", error)
  process.exit(1)
})

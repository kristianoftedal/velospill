import { db } from "@/lib/db"
import { raceResults } from "./schema/results"
import { scoringConfig } from "./schema/config"
import { eq, lte, or, isNull, gt } from "drizzle-orm"

/**
 * One-shot script to retroactively recalculate all race_results.points
 * using the current (2026) scoringConfig rules.
 *
 * Quick task 11 updated scoringConfig but did not recalculate already-stored
 * points. This script fixes all stored values.
 *
 * Run with:  dotenv -e .env.local -- npx tsx src/db/recalc-points-2026.ts [--dry-run]
 */

const isDryRun = process.argv.includes("--dry-run")

// ============================================================================
// Helper functions (inlined — do NOT import from scoring-preview.ts)
// ============================================================================

function resolveScoringRaceType(raceType: string, raceName: string): string {
  if (raceType === "grand_tour") {
    const lowerName = raceName.toLowerCase()
    if (lowerName.includes("tour de france") || lowerName.includes("tdf")) {
      return "grand_tour_tdf"
    }
  }
  return raceType
}

function calculatePoints(position: number, rules: Record<string, number>): number {
  return rules[String(position)] || 0
}

// ============================================================================
// Main
// ============================================================================

type Change = {
  id: number
  raceId: number
  raceName: string
  category: string
  position: number
  oldPoints: number
  newPoints: number
}

async function recalcPoints2026() {
  console.log(`Recalculate race_results points (2026 rules) ${isDryRun ? "[DRY RUN]" : ""}`)
  console.log("=".repeat(70))

  if (isDryRun) {
    console.log("DRY RUN MODE — no changes will be committed\n")
  }

  // 1. Fetch all race_results with race + parentRace
  console.log("Fetching all race_results...")
  const allResults = await db.query.raceResults.findMany({
    with: {
      race: {
        with: {
          parentRace: true,
        },
      },
    },
  })
  console.log(`  Found ${allResults.length} race_results rows\n`)

  // 2. Build scoring config map: "${raceType}:${category}" → rules
  console.log("Fetching active scoringConfig entries...")
  const now = new Date()
  const activeConfigs = await db
    .select()
    .from(scoringConfig)
    .where(
      eq(scoringConfig.id, scoringConfig.id) // fetch all, filter below
    )

  // Filter to currently active configs
  const currentConfigs = activeConfigs.filter((cfg) => {
    const validFrom = cfg.validFrom
    const validUntil = cfg.validUntil
    return (
      validFrom <= now &&
      (validUntil === null || validUntil > now)
    )
  })

  const configMap = new Map<string, Record<string, number>>()
  for (const cfg of currentConfigs) {
    const key = `${cfg.raceType}:${cfg.category}`
    configMap.set(key, cfg.rules as Record<string, number>)
  }
  console.log(`  Loaded ${configMap.size} active config entries\n`)

  // 3. Calculate changes
  const changes: Change[] = []
  let skippedCount = 0
  let unchangedCount = 0

  for (const result of allResults) {
    const race = result.race

    // Determine raceTypeForScoring (same logic as scoring-preview.ts)
    let raceTypeForScoring: string
    let raceName: string

    if (race.parentRaceId && race.parentRace) {
      // Stage — use parent race type and name
      raceTypeForScoring = resolveScoringRaceType(race.parentRace.raceType, race.parentRace.name)
      raceName = race.parentRace.name
    } else {
      raceTypeForScoring = resolveScoringRaceType(race.raceType, race.name)
      raceName = race.name
    }

    // Look up config
    let rules = configMap.get(`${raceTypeForScoring}:${result.category}`)

    // Fallback: grand_tour_tdf → grand_tour
    if (!rules && raceTypeForScoring === "grand_tour_tdf") {
      rules = configMap.get(`grand_tour:${result.category}`)
    }

    if (!rules) {
      console.warn(
        `  [SKIP] No config for raceType="${raceTypeForScoring}" category="${result.category}" ` +
        `(race="${raceName}", result id=${result.id})`
      )
      skippedCount++
      continue
    }

    const newPoints = calculatePoints(result.position, rules)

    if (newPoints !== result.points) {
      changes.push({
        id: result.id,
        raceId: result.raceId,
        raceName,
        category: result.category,
        position: result.position,
        oldPoints: result.points,
        newPoints,
      })
    } else {
      unchangedCount++
    }
  }

  // 4. Log changes table
  console.log("=".repeat(70))
  if (changes.length === 0) {
    console.log("No point changes needed — all values already match 2026 rules.")
  } else {
    console.log(`Changes to apply (${changes.length} rows):`)
    console.log(
      "  " +
      "id".padEnd(6) +
      "race".padEnd(35) +
      "category".padEnd(20) +
      "pos".padEnd(5) +
      "old".padEnd(6) +
      "new"
    )
    console.log("  " + "-".repeat(75))
    for (const c of changes) {
      console.log(
        "  " +
        String(c.id).padEnd(6) +
        c.raceName.substring(0, 33).padEnd(35) +
        c.category.substring(0, 18).padEnd(20) +
        String(c.position).padEnd(5) +
        String(c.oldPoints).padEnd(6) +
        String(c.newPoints)
      )
    }
  }

  console.log("\n" + "=".repeat(70))
  console.log("Summary:")
  console.log(`  Changed:   ${changes.length}`)
  console.log(`  Unchanged: ${unchangedCount}`)
  console.log(`  Skipped:   ${skippedCount} (no config found)`)

  // 5. Apply changes (unless dry run)
  if (isDryRun) {
    console.log("\nDRY RUN — rolling back (no changes committed)")
    throw new Error("DRY_RUN_ROLLBACK")
  }

  if (changes.length > 0) {
    console.log(`\nApplying ${changes.length} updates in a single transaction...`)
    await db.transaction(async (tx) => {
      for (const change of changes) {
        await tx
          .update(raceResults)
          .set({ points: change.newPoints })
          .where(eq(raceResults.id, change.id))
      }
    })
    console.log("Transaction committed successfully.")
  }

  console.log("\nRecalculation completed successfully!")
}

recalcPoints2026()
  .catch((error) => {
    if (error instanceof Error && error.message === "DRY_RUN_ROLLBACK") {
      console.log("\nDry run completed — no changes committed")
      process.exit(0)
    }
    console.error("\nRecalculation failed:", error)
    process.exit(1)
  })
  .finally(() => {
    if (!isDryRun) {
      process.exit(0)
    }
  })

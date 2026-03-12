import { db } from "@/lib/db"
import { scoringConfig } from "./schema/config"
import { races } from "./schema/races"
import { raceResults } from "./schema/results"
import { eq, and, ilike } from "drizzle-orm"

/**
 * 1. Updates mini_tour/stage_finish scoring config to seed values: 6/5/4/3/2/1
 * 2. Retroactively recalculates stage_finish points for all completed Paris-Nice stages
 *
 * Run with: npx tsx src/db/retroactive-paris-nice-stages.ts [--dry-run]
 */

const isDryRun = process.argv.includes("--dry-run")

const CORRECT_STAGE_FINISH_RULES: Record<string, number> = {
  "1": 6, "2": 5, "3": 4, "4": 3, "5": 2, "6": 1,
}

async function recalculate() {
  console.log(`🔄 Retroactive scoring fix: Paris-Nice stages ${isDryRun ? "(DRY RUN)" : ""}`)
  console.log("=".repeat(60))

  if (isDryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be committed\n")
  }

  // Find Paris-Nice parent race
  const parentRace = await db.query.races.findFirst({
    where: and(
      ilike(races.name, "%paris-nice%"),
      eq(races.raceType, "mini_tour"),
    ),
  })

  if (!parentRace) {
    console.error("❌ Paris-Nice parent race not found")
    process.exit(1)
  }

  console.log(`✅ Found race: "${parentRace.name}" (id=${parentRace.id})`)

  // Step 1: Update scoring config to correct values
  console.log("\n⚙️  Updating mini_tour/stage_finish scoring config...")
  console.log("  Old (migration): P1=6, P2=5, P3=3, P4=2, P5=1")
  console.log("  New (seed):      P1=6, P2=5, P3=4, P4=3, P5=2, P6=1")
  if (!isDryRun) {
    await db
      .update(scoringConfig)
      .set({ rules: CORRECT_STAGE_FINISH_RULES })
      .where(
        and(
          eq(scoringConfig.raceType, "mini_tour"),
          eq(scoringConfig.category, "stage_finish"),
        ),
      )
    console.log("  ✅ Scoring config updated")
  } else {
    console.log("  (skipped — dry run)")
  }

  // Fetch all stages
  const stages = await db
    .select({ id: races.id, name: races.name, stageNumber: races.stageNumber })
    .from(races)
    .where(eq(races.parentRaceId, parentRace.id))

  if (stages.length === 0) {
    console.log("⚠️  No stages found — nothing to update")
    process.exit(0)
  }

  console.log(`📋 Found ${stages.length} stage(s)`)

  // Step 2: Recalculate stage results using corrected rules
  console.log("\n🔢 Recalculating stage results...")

  // Fetch mini_tour scoring rules, overriding stage_finish with correct values
  const scoringRows = await db
    .select({ category: scoringConfig.category, rules: scoringConfig.rules })
    .from(scoringConfig)
    .where(eq(scoringConfig.raceType, "mini_tour"))

  const scoringMap = new Map(scoringRows.map((r) => [r.category, r.rules as Record<string, number>]))
  // Always use the correct target rules for stage_finish (regardless of dry-run state)
  scoringMap.set("stage_finish", CORRECT_STAGE_FINISH_RULES)

  console.log("\n📊 Current mini_tour scoring config:")
  for (const [cat, rules] of scoringMap.entries()) {
    const top = Object.entries(rules)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .slice(0, 6)
      .map(([p, pts]) => `P${p}=${pts}`)
      .join(", ")
    console.log(`  ${cat}: ${top}`)
  }

  let totalUpdated = 0

  for (const stage of stages.sort((a, b) => (a.stageNumber ?? 0) - (b.stageNumber ?? 0))) {
    // Fetch results for this stage
    const results = await db
      .select()
      .from(raceResults)
      .where(eq(raceResults.raceId, stage.id))

    if (results.length === 0) continue

    console.log(`\n🚴 Stage ${stage.stageNumber ?? "?"} (id=${stage.id}): ${results.length} result(s)`)

    for (const result of results) {
      const rules = scoringMap.get(result.category)
      if (!rules) {
        console.log(`  ⚠️  No scoring rules for category "${result.category}" — skipping`)
        continue
      }

      const newPoints = rules[String(result.position)] ?? 0
      const changed = result.points !== newPoints

      console.log(
        `  [${result.category}] P${result.position}: ${result.points} pts → ${newPoints} pts${changed ? " ✏️" : " (no change)"}`,
      )

      if (changed && !isDryRun) {
        await db
          .update(raceResults)
          .set({ points: newPoints, updatedAt: new Date() })
          .where(eq(raceResults.id, result.id))
        totalUpdated++
      } else if (changed) {
        totalUpdated++
      }
    }
  }

  if (isDryRun) {
    console.log(`\n✅ DRY RUN complete — ${totalUpdated} row(s) would be updated`)
  } else {
    console.log(`\n✅ Done — updated ${totalUpdated} row(s)`)
  }

  process.exit(0)
}

recalculate().catch((error) => {
  console.error("❌ Error:", error)
  process.exit(1)
})

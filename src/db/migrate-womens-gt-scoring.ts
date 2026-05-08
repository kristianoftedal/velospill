import { db } from "@/lib/db"
import { scoringConfig } from "./schema/config"
import { races } from "./schema/races"
import { raceResults } from "./schema/results"
import { eq, and, or, isNull, lte, gt, inArray } from "drizzle-orm"

/**
 * Fixes womens_grand_tour scoring configs in the database.
 *
 * Problem: the DB has grand_tour scale values for womens_grand_tour
 * (stage_finish 12/10/8, end_gc 25/20/16 etc.), but womens_grand_tour
 * should use mini_tour scale scoring. scoring-preview.ts had a mini_tour
 * mapping workaround but that causes mountain categories (mountain_cc_hcx2_af,
 * mountain_1_2cat) to get 0 points because they don't exist in mini_tour.
 *
 * Fix:
 * 1. Update all womens_grand_tour scoring configs to mini_tour scale values
 *    (preserving womens_grand_tour-specific mountain category names)
 * 2. Recalculate any stored race_results for womens_grand_tour races
 *
 * Run with: dotenv -e .env.local -- npx tsx src/db/migrate-womens-gt-scoring.ts [--dry-run]
 */

const isDryRun = process.argv.includes("--dry-run")

// Correct mini_tour-scale values for all womens_grand_tour categories.
// Mountain category names are womens_grand_tour-specific; values match mini_tour scale.
const CORRECT_CONFIGS: Record<string, Record<string, number>> = {
  stage_finish:       { "1": 6, "2": 5, "3": 4, "4": 3, "5": 2, "6": 1 },
  sprint:             { "1": 1, "2": 1, "3": 1 },
  mountain_cc_hcx2_af: { "1": 2, "2": 1 },   // equiv. to mini_tour mountain_highest
  mountain_1_2cat:    { "1": 1 },              // equiv. to mini_tour mountain_2nd_highest
  jersey_gc:          { "1": 1 },
  jersey_points:      { "1": 1 },
  jersey_kom:         { "1": 1 },
  jersey_combative:   { "1": 1 },
  ttt:                { "1": 3, "2": 1 },
  end_gc:             { "1": 8, "2": 6, "3": 4, "4": 3, "5": 2, "6": 2, "7": 1, "8": 1 },
  end_points:         { "1": 4, "2": 2, "3": 1 },
  end_kom:            { "1": 4, "2": 2, "3": 1 },
  end_youth:          { "1": 2 },
  end_combative:      { "1": 2 },
  end_team:           { "1": 2 },
}

// Categories to delete from womens_grand_tour (no mini_tour equivalent)
const CATEGORIES_TO_DELETE = ["end_other"]

async function migrate() {
  console.log(`Migrate womens_grand_tour scoring to mini_tour scale ${isDryRun ? "(DRY RUN)" : ""}`)
  console.log("=".repeat(65))

  if (isDryRun) {
    console.log("DRY RUN MODE — no changes will be committed\n")
  }

  // ── Step 1: Load current womens_grand_tour configs ─────────────────────────
  const now = new Date()
  const currentConfigs = await db
    .select()
    .from(scoringConfig)
    .where(
      and(
        eq(scoringConfig.raceType, "womens_grand_tour"),
        lte(scoringConfig.validFrom, now),
        or(isNull(scoringConfig.validUntil), gt(scoringConfig.validUntil, now)),
      ),
    )

  console.log("Current womens_grand_tour configs (to be updated):")
  for (const cfg of currentConfigs.sort((a, b) => a.category.localeCompare(b.category))) {
    const correct = CORRECT_CONFIGS[cfg.category]
    const toDelete = CATEGORIES_TO_DELETE.includes(cfg.category)
    const old = JSON.stringify(cfg.rules)
    const next = toDelete ? "[DELETE]" : correct ? JSON.stringify(correct) : "[no change]"
    const marker = toDelete ? " <-- DELETE" : correct && JSON.stringify(cfg.rules) !== JSON.stringify(correct) ? " <-- UPDATE" : ""
    console.log(`  ${cfg.category.padEnd(25)} ${old.padEnd(45)} → ${next}${marker}`)
  }

  // Check for categories in CORRECT_CONFIGS not yet in DB
  const existingCategories = new Set(currentConfigs.map((c) => c.category))
  for (const [cat] of Object.entries(CORRECT_CONFIGS)) {
    if (!existingCategories.has(cat)) {
      console.log(`  ${cat.padEnd(25)} [MISSING — will INSERT]`)
    }
  }

  console.log()

  if (!isDryRun) {
    // Update existing categories
    for (const cfg of currentConfigs) {
      if (CATEGORIES_TO_DELETE.includes(cfg.category)) {
        console.log(`  Deleting womens_grand_tour/${cfg.category}...`)
        await db.delete(scoringConfig).where(eq(scoringConfig.id, cfg.id))
        continue
      }
      const correct = CORRECT_CONFIGS[cfg.category]
      if (!correct) continue
      if (JSON.stringify(cfg.rules) === JSON.stringify(correct)) continue
      console.log(`  Updating womens_grand_tour/${cfg.category}...`)
      await db.update(scoringConfig).set({ rules: correct }).where(eq(scoringConfig.id, cfg.id))
    }

    // Insert any missing categories
    for (const [cat, rules] of Object.entries(CORRECT_CONFIGS)) {
      if (!existingCategories.has(cat)) {
        console.log(`  Inserting womens_grand_tour/${cat}...`)
        await db.insert(scoringConfig).values({
          raceType: "womens_grand_tour",
          category: cat,
          rules,
          description: `Women's GT ${cat} (mini_tour scale)`,
          validFrom: now,
        })
      }
    }
    console.log("Scoring configs updated.\n")
  } else {
    console.log("(Config updates skipped — dry run)\n")
  }

  // ── Step 2: Find all womens_grand_tour races with stored results ────────────
  const wgtParents = await db
    .select({ id: races.id, name: races.name, season: races.season })
    .from(races)
    .where(and(eq(races.raceType, "womens_grand_tour"), isNull(races.parentRaceId)))

  if (wgtParents.length === 0) {
    console.log("No womens_grand_tour parent races found.")
    process.exit(0)
  }

  console.log(`Found ${wgtParents.length} womens_grand_tour race(s):`)
  for (const r of wgtParents) console.log(`  "${r.name}" (id=${r.id}, season=${r.season})`)
  console.log()

  // Get all stage + parent race IDs
  const allWgtRaces = await db
    .select({ id: races.id, name: races.name, parentRaceId: races.parentRaceId })
    .from(races)
    .where(
      or(
        inArray(races.id, wgtParents.map((r) => r.id)),
        inArray(races.parentRaceId, wgtParents.map((r) => r.id)),
      ),
    )

  const raceIds = allWgtRaces.map((r) => r.id)
  const raceNameMap = new Map(allWgtRaces.map((r) => [r.id, r.name]))

  // Fetch all results
  const allResults = await db
    .select()
    .from(raceResults)
    .where(inArray(raceResults.raceId, raceIds))

  if (allResults.length === 0) {
    console.log("No race_results found for any womens_grand_tour race — nothing to recalculate.")
    process.exit(0)
  }

  console.log(`Found ${allResults.length} race_results to check.\n`)

  // ── Step 3: Recalculate points ─────────────────────────────────────────────
  // Use CORRECT_CONFIGS (the target values, regardless of dry-run state)
  let checked = 0
  let updated = 0
  let skipped = 0

  for (const result of allResults) {
    checked++
    const rules = CORRECT_CONFIGS[result.category]

    if (!rules) {
      console.log(
        `  [SKIP] "${raceNameMap.get(result.raceId)}" category="${result.category}" position=${result.position} — no config`,
      )
      skipped++
      continue
    }

    const newPoints = rules[String(result.position)] ?? 0
    const changed = result.points !== newPoints

    if (changed) {
      console.log(
        `  [UPDATE] "${raceNameMap.get(result.raceId)}" ${result.category} P${result.position}: ${result.points} → ${newPoints}`,
      )
      updated++
      if (!isDryRun) {
        await db
          .update(raceResults)
          .set({ points: newPoints, updatedAt: new Date() })
          .where(eq(raceResults.id, result.id))
      }
    }
  }

  console.log("\n" + "=".repeat(65))
  console.log("Summary:")
  console.log(`  Configs updated: ${isDryRun ? "(dry run)" : "done"}`)
  console.log(`  Results checked: ${checked}`)
  console.log(`  Results updated: ${updated}${isDryRun ? " (dry run — not committed)" : ""}`)
  console.log(`  Results skipped: ${skipped} (no config)`)

  if (isDryRun) {
    console.log("\nDRY RUN complete — re-run without --dry-run to apply")
  } else {
    console.log("\nMigration complete!")
  }

  process.exit(0)
}

migrate().catch((e) => {
  console.error("Error:", e)
  process.exit(1)
})

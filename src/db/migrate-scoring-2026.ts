import { db } from "@/lib/db"
import { scoringConfig } from "./schema/config"
import { eq, and } from "drizzle-orm"

/**
 * Migration script to update existing scoringConfig data to 2026 ruleset
 *
 * Run with: npx tsx src/db/migrate-scoring-2026.ts [--dry-run]
 *
 * Changes:
 * - Updates one-day race point tables (20 and 15 positions)
 * - Updates GT Giro/Vuelta end-of-tour values
 * - Adds TdF-specific scoring with grand_tour_tdf raceType
 * - Updates mini tour values
 * - Removes obsolete categories (tdf_stage_bonus, sprint_double)
 */

const isDryRun = process.argv.includes("--dry-run")

async function migrateScoring2026() {
  console.log(`🔄 Scoring Config 2026 Migration ${isDryRun ? "(DRY RUN)" : ""}`)
  console.log("=" .repeat(60))

  const validFrom = new Date("2026-01-01")
  let updateCount = 0
  let insertCount = 0
  let deleteCount = 0

  if (isDryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be committed\n")
  }

  try {
    await db.transaction(async (tx) => {
      // ========================================================================
      // UPDATES - Existing entries that need new point values
      // ========================================================================

      console.log("\n📝 UPDATES - Modifying existing scoring entries:")
      console.log("-" .repeat(60))

      // Update high-priority one-day (20 positions, 50 for 1st)
      console.log("  [UPDATE] high_priority_one_day / finish → 20 positions (50 for 1st)")
      if (!isDryRun) {
        await tx.update(scoringConfig)
          .set({
            rules: {
              "1": 50, "2": 40, "3": 35, "4": 30, "5": 25,
              "6": 20, "7": 18, "8": 16, "9": 14, "10": 12,
              "11": 10, "12": 9, "13": 8, "14": 7, "15": 6,
              "16": 5, "17": 4, "18": 3, "19": 2, "20": 1
            }
          })
          .where(and(
            eq(scoringConfig.raceType, "high_priority_one_day"),
            eq(scoringConfig.category, "finish")
          ))
      }
      updateCount++

      // Update low-priority one-day (15 positions, 30 for 1st)
      console.log("  [UPDATE] low_priority_one_day / finish → 15 positions (30 for 1st)")
      if (!isDryRun) {
        await tx.update(scoringConfig)
          .set({
            rules: {
              "1": 30, "2": 25, "3": 20, "4": 16, "5": 14,
              "6": 12, "7": 10, "8": 8, "9": 7, "10": 6,
              "11": 5, "12": 4, "13": 3, "14": 2, "15": 1
            }
          })
          .where(and(
            eq(scoringConfig.raceType, "low_priority_one_day"),
            eq(scoringConfig.category, "finish")
          ))
      }
      updateCount++

      // Update grand_tour end_gc (trim to 12 positions)
      console.log("  [UPDATE] grand_tour / end_gc → 12 positions (25 for 1st)")
      if (!isDryRun) {
        await tx.update(scoringConfig)
          .set({
            rules: {
              "1": 25, "2": 20, "3": 16, "4": 14, "5": 12,
              "6": 10, "7": 8, "8": 6, "9": 4, "10": 3,
              "11": 2, "12": 1
            }
          })
          .where(and(
            eq(scoringConfig.raceType, "grand_tour"),
            eq(scoringConfig.category, "end_gc")
          ))
      }
      updateCount++

      // Update grand_tour end_youth
      console.log("  [UPDATE] grand_tour / end_youth → 5/3/1 points")
      if (!isDryRun) {
        await tx.update(scoringConfig)
          .set({ rules: { "1": 5, "2": 3, "3": 1 } })
          .where(and(
            eq(scoringConfig.raceType, "grand_tour"),
            eq(scoringConfig.category, "end_youth")
          ))
      }
      updateCount++

      // Update grand_tour end_team
      console.log("  [UPDATE] grand_tour / end_team → 5/3/1 points")
      if (!isDryRun) {
        await tx.update(scoringConfig)
          .set({ rules: { "1": 5, "2": 3, "3": 1 } })
          .where(and(
            eq(scoringConfig.raceType, "grand_tour"),
            eq(scoringConfig.category, "end_team")
          ))
      }
      updateCount++

      // Update mini_tour stage_finish (2nd place: 4 → 5)
      console.log("  [UPDATE] mini_tour / stage_finish → 2nd place now 5 points")
      if (!isDryRun) {
        await tx.update(scoringConfig)
          .set({ rules: { "1": 6, "2": 5, "3": 3, "4": 2, "5": 1 } })
          .where(and(
            eq(scoringConfig.raceType, "mini_tour"),
            eq(scoringConfig.category, "stage_finish")
          ))
      }
      updateCount++

      // Update mini_tour mountain_highest (1/1 → 2/1)
      console.log("  [UPDATE] mini_tour / mountain_highest → 2/1 points")
      if (!isDryRun) {
        await tx.update(scoringConfig)
          .set({ rules: { "1": 2, "2": 1 } })
          .where(and(
            eq(scoringConfig.raceType, "mini_tour"),
            eq(scoringConfig.category, "mountain_highest")
          ))
      }
      updateCount++

      // Update mini_tour end_gc (extend to 8 positions)
      console.log("  [UPDATE] mini_tour / end_gc → extended to 8 positions")
      if (!isDryRun) {
        await tx.update(scoringConfig)
          .set({ rules: { "1": 8, "2": 6, "3": 4, "4": 3, "5": 2, "6": 2, "7": 1, "8": 1 } })
          .where(and(
            eq(scoringConfig.raceType, "mini_tour"),
            eq(scoringConfig.category, "end_gc")
          ))
      }
      updateCount++

      // Update womens_one_day finish
      console.log("  [UPDATE] womens_one_day / finish → match new high-priority values")
      if (!isDryRun) {
        await tx.update(scoringConfig)
          .set({
            rules: {
              "1": 50, "2": 40, "3": 35, "4": 30, "5": 25,
              "6": 20, "7": 18, "8": 16, "9": 14, "10": 12,
              "11": 10, "12": 9, "13": 8, "14": 7, "15": 6,
              "16": 5, "17": 4, "18": 3, "19": 2, "20": 1
            }
          })
          .where(and(
            eq(scoringConfig.raceType, "womens_one_day"),
            eq(scoringConfig.category, "finish")
          ))
      }
      updateCount++

      // Update world_championship finish
      console.log("  [UPDATE] world_championship / finish → match new high-priority values")
      if (!isDryRun) {
        await tx.update(scoringConfig)
          .set({
            rules: {
              "1": 50, "2": 40, "3": 35, "4": 30, "5": 25,
              "6": 20, "7": 18, "8": 16, "9": 14, "10": 12,
              "11": 10, "12": 9, "13": 8, "14": 7, "15": 6,
              "16": 5, "17": 4, "18": 3, "19": 2, "20": 1
            }
          })
          .where(and(
            eq(scoringConfig.raceType, "world_championship"),
            eq(scoringConfig.category, "finish")
          ))
      }
      updateCount++

      // ========================================================================
      // DELETES - Remove obsolete entries
      // ========================================================================

      console.log("\n🗑️  DELETES - Removing obsolete categories:")
      console.log("-" .repeat(60))

      // Delete tdf_stage_bonus (replaced by grand_tour_tdf stage_finish)
      console.log("  [DELETE] grand_tour / tdf_stage_bonus → replaced by grand_tour_tdf")
      if (!isDryRun) {
        await tx.delete(scoringConfig)
          .where(and(
            eq(scoringConfig.raceType, "grand_tour"),
            eq(scoringConfig.category, "tdf_stage_bonus")
          ))
      }
      deleteCount++

      // Delete sprint_double (replaced by sprint_giro)
      console.log("  [DELETE] grand_tour / sprint_double → replaced by sprint_giro")
      if (!isDryRun) {
        await tx.delete(scoringConfig)
          .where(and(
            eq(scoringConfig.raceType, "grand_tour"),
            eq(scoringConfig.category, "sprint_double")
          ))
      }
      deleteCount++

      // Delete womens_grand_tour sprint_double
      console.log("  [DELETE] womens_grand_tour / sprint_double → no longer needed")
      if (!isDryRun) {
        await tx.delete(scoringConfig)
          .where(and(
            eq(scoringConfig.raceType, "womens_grand_tour"),
            eq(scoringConfig.category, "sprint_double")
          ))
      }
      deleteCount++

      // ========================================================================
      // INSERTS - New TdF-specific entries with grand_tour_tdf raceType
      // ========================================================================

      console.log("\n➕ INSERTS - Adding TdF-specific scoring entries:")
      console.log("-" .repeat(60))

      const newEntries = [
        // TdF stage finish
        {
          raceType: "grand_tour_tdf",
          category: "stage_finish",
          rules: {
            "1": 15, "2": 12, "3": 10, "4": 9, "5": 8,
            "6": 7, "7": 6, "8": 5, "9": 4, "10": 3,
            "11": 2, "12": 1
          },
          description: "Tour de France stage finish",
          validFrom,
        },

        // TdF sprint
        {
          raceType: "grand_tour_tdf",
          category: "sprint",
          rules: { "1": 3, "2": 2, "3": 2, "4": 1, "5": 1 },
          description: "Tour de France sprint classification",
          validFrom,
        },

        // Giro sprint (replaces sprint_double)
        {
          raceType: "grand_tour",
          category: "sprint_giro",
          rules: { "1": 2, "2": 1, "3": 1 },
          description: "Giro sprint — when 2 sprints on stage, both score with these points",
          validFrom,
        },

        // TdF mountain categories
        {
          raceType: "grand_tour_tdf",
          category: "mountain_cc_hcx2_af",
          rules: { "1": 4, "2": 3, "3": 2, "4": 2, "5": 1, "6": 1 },
          description: "TdF CC / HCx2 / Arrivee en Altitude",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "mountain_hc",
          rules: { "1": 4, "2": 3, "3": 2, "4": 1 },
          description: "TdF HC climb",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "mountain_1cat",
          rules: { "1": 3, "2": 2, "3": 1 },
          description: "TdF 1st category",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "mountain_2cat",
          rules: { "1": 2, "2": 1 },
          description: "TdF 2nd category",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "mountain_3_4cat",
          rules: { "1": 1 },
          description: "TdF 3rd/4th category",
          validFrom,
        },

        // TdF jersey bonuses
        {
          raceType: "grand_tour_tdf",
          category: "jersey_gc",
          rules: { "1": 2, "2": 1, "3": 1 },
          description: "TdF GC jersey per stage",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "jersey_points",
          rules: { "1": 1 },
          description: "TdF Points jersey per stage",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "jersey_kom",
          rules: { "1": 1 },
          description: "TdF KOM jersey per stage",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "jersey_combative",
          rules: { "1": 2 },
          description: "TdF Combative jersey per stage (2026: 2 points)",
          validFrom,
        },

        // TdF TTT
        {
          raceType: "grand_tour_tdf",
          category: "ttt",
          rules: { "1": 6, "2": 4, "3": 2 },
          description: "TdF Team Time Trial",
          validFrom,
        },

        // TdF end-of-tour
        {
          raceType: "grand_tour_tdf",
          category: "end_gc",
          rules: {
            "1": 30, "2": 25, "3": 20, "4": 16, "5": 14,
            "6": 12, "7": 10, "8": 8, "9": 7, "10": 6,
            "11": 5, "12": 4, "13": 3, "14": 2, "15": 1
          },
          description: "TdF GC final classification",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "end_points",
          rules: { "1": 15, "2": 10, "3": 8, "4": 6, "5": 4, "6": 2 },
          description: "TdF Points classification final",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "end_kom",
          rules: { "1": 15, "2": 10, "3": 8, "4": 6, "5": 4, "6": 2 },
          description: "TdF KOM classification final",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "end_youth",
          rules: { "1": 6, "2": 4, "3": 2 },
          description: "TdF Youth classification final",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "end_combative",
          rules: { "1": 5 },
          description: "TdF Combative classification final",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "end_team",
          rules: { "1": 6, "2": 4, "3": 2 },
          description: "TdF Team classification final",
          validFrom,
        },
        {
          raceType: "grand_tour_tdf",
          category: "end_other",
          rules: { "1": 3 },
          description: "TdF Best team mate / other special classifications",
          validFrom,
        },
      ]

      for (const entry of newEntries) {
        console.log(`  [INSERT] ${entry.raceType} / ${entry.category}`)
        if (!isDryRun) {
          await tx.insert(scoringConfig)
            .values(entry)
            .onConflictDoNothing()
        }
        insertCount++
      }

      // ========================================================================
      // Summary
      // ========================================================================

      console.log("\n" + "=".repeat(60))
      console.log("📊 Migration Summary:")
      console.log("-" .repeat(60))
      console.log(`  Updates:  ${updateCount}`)
      console.log(`  Deletes:  ${deleteCount}`)
      console.log(`  Inserts:  ${insertCount}`)
      console.log(`  Total:    ${updateCount + deleteCount + insertCount} operations`)

      if (isDryRun) {
        console.log("\n⚠️  DRY RUN - Rolling back transaction (no changes made)")
        throw new Error("DRY_RUN_ROLLBACK")
      }
    })

    if (!isDryRun) {
      console.log("\n✅ Migration completed successfully!")
    }
  } catch (error) {
    if (error instanceof Error && error.message === "DRY_RUN_ROLLBACK") {
      console.log("\n✅ Dry run completed - no changes committed")
      process.exit(0)
    }
    throw error
  }
}

migrateScoring2026()
  .catch((error) => {
    console.error("\n❌ Migration failed:", error)
    process.exit(1)
  })
  .finally(() => {
    if (!isDryRun) {
      process.exit(0)
    }
  })

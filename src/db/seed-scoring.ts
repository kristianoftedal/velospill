import { db } from "@/lib/db"
import { scoringConfig, rosterLimits, orderTypes } from "./schema/config"

async function seedScoring() {
  console.log("🌱 Seeding scoring configuration...")

  // Check if data already exists
  const existingScoring = await db.select().from(scoringConfig).limit(1)
  const existingRoster = await db.select().from(rosterLimits).limit(1)
  const existingOrders = await db.select().from(orderTypes).limit(1)

  if (existingScoring.length > 0 || existingRoster.length > 0 || existingOrders.length > 0) {
    console.log("⚠️  Scoring data already exists. Skipping seed.")
    return
  }

  const validFrom = new Date("2026-01-01")

  // ============================================================================
  // SCORING CONFIG
  // ============================================================================

  const scoringEntries = [
    // ONE-DAY RACE SCORING
    {
      raceType: "high_priority_one_day",
      category: "finish",
      rules: {
        "1": 40, "2": 30, "3": 25, "4": 20, "5": 18,
        "6": 16, "7": 14, "8": 13, "9": 12, "10": 11,
        "11": 10, "12": 9, "13": 8, "14": 7, "15": 6,
        "16": 5, "17": 4, "18": 3, "19": 2, "20": 1
      },
      description: "High priority one-day race finish scoring",
      validFrom,
    },
    {
      raceType: "low_priority_one_day",
      category: "finish",
      rules: {
        "1": 25, "2": 20, "3": 16, "4": 12, "5": 11,
        "6": 10, "7": 9, "8": 8, "9": 7, "10": 6,
        "11": 5, "12": 4, "13": 3, "14": 2, "15": 1
      },
      description: "Low priority one-day race finish scoring",
      validFrom,
    },

    // GRAND TOUR STAGE SCORING
    {
      raceType: "grand_tour",
      category: "stage_finish",
      rules: {
        "1": 12, "2": 10, "3": 8, "4": 7, "5": 6,
        "6": 5, "7": 4, "8": 3, "9": 2, "10": 1
      },
      description: "Giro/Vuelta stage finish",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "tdf_stage_bonus",
      rules: { "1": 2, "2": 1, "3": 1 },
      description: "Tour de France additional stage bonus",
      validFrom,
    },

    // GRAND TOUR SPRINT SCORING
    {
      raceType: "grand_tour",
      category: "sprint",
      rules: { "1": 2, "2": 2, "3": 1, "4": 1, "5": 1 },
      description: "Single sprint classification",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "sprint_double",
      rules: { "1": 2, "2": 1, "3": 1 },
      description: "When 2 sprint classifications on stage",
      validFrom,
    },

    // GRAND TOUR MOUNTAIN SCORING
    {
      raceType: "grand_tour",
      category: "mountain_cc_hcx2_af",
      rules: { "1": 3, "2": 2, "3": 2, "4": 1, "5": 1 },
      description: "CC / HCx2 / Arrivee en Altitude",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "mountain_hc",
      rules: { "1": 3, "2": 2, "3": 1 },
      description: "HC climb (1cat in Giro)",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "mountain_1cat",
      rules: { "1": 2, "2": 1, "3": 1 },
      description: "1st category (2cat in Giro)",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "mountain_2cat",
      rules: { "1": 1, "2": 1 },
      description: "2nd category (3cat in Giro)",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "mountain_3_4cat",
      rules: { "1": 1 },
      description: "3rd/4th category (4cat in Giro)",
      validFrom,
    },

    // GRAND TOUR JERSEY BONUSES (per stage, not on final stage)
    {
      raceType: "grand_tour",
      category: "jersey_gc",
      rules: { "1": 2, "2": 1, "3": 1 },
      description: "GC jersey per stage",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "jersey_points",
      rules: { "1": 1 },
      description: "Points jersey per stage",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "jersey_kom",
      rules: { "1": 1 },
      description: "KOM jersey per stage",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "jersey_combative",
      rules: { "1": 2 },
      description: "Combative jersey per stage",
      validFrom,
    },

    // GRAND TOUR TTT
    {
      raceType: "grand_tour",
      category: "ttt",
      rules: { "1": 6, "2": 4, "3": 2 },
      description: "Team Time Trial",
      validFrom,
    },

    // GRAND TOUR END RESULTS
    {
      raceType: "grand_tour",
      category: "end_gc",
      rules: {
        "1": 25, "2": 20, "3": 16, "4": 14, "5": 12,
        "6": 10, "7": 9, "8": 8, "9": 7, "10": 6,
        "11": 5, "12": 4, "13": 3, "14": 2, "15": 1
      },
      description: "GC final classification",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "end_points",
      rules: { "1": 12, "2": 8, "3": 6, "4": 4, "5": 2 },
      description: "Points classification final",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "end_kom",
      rules: { "1": 12, "2": 8, "3": 6, "4": 4, "5": 2 },
      description: "KOM classification final",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "end_youth",
      rules: { "1": 6, "2": 4, "3": 2 },
      description: "Youth classification final",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "end_combative",
      rules: { "1": 5 },
      description: "Combative classification final",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "end_team",
      rules: { "1": 6, "2": 4, "3": 2 },
      description: "Team classification final",
      validFrom,
    },
    {
      raceType: "grand_tour",
      category: "end_other",
      rules: { "1": 3 },
      description: "Giro: Innlagt Spurt, Bruddkonkurransen, Intergiro. TdF: Best team mate.",
      validFrom,
    },

    // MINI TOUR STAGE SCORING
    {
      raceType: "mini_tour",
      category: "stage_finish",
      rules: { "1": 6, "2": 4, "3": 3, "4": 2, "5": 1 },
      description: "Mini tour stage finish",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "sprint",
      rules: { "1": 1, "2": 1, "3": 1 },
      description: "Single sprint. Two sprints: top 2 score. Three+ sprints: only first scores.",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "mountain_highest",
      rules: { "1": 1, "2": 1 },
      description: "Highest category mountain",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "mountain_2nd_highest",
      rules: { "1": 1 },
      description: "2nd highest category mountain",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "jersey_gc",
      rules: { "1": 1 },
      description: "GC jersey per stage",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "jersey_points",
      rules: { "1": 1 },
      description: "Points jersey per stage",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "jersey_kom",
      rules: { "1": 1 },
      description: "KOM jersey per stage",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "jersey_combative",
      rules: { "1": 1 },
      description: "Combative jersey per stage",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "ttt",
      rules: { "1": 3, "2": 1 },
      description: "Team Time Trial",
      validFrom,
    },

    // MINI TOUR END RESULTS
    {
      raceType: "mini_tour",
      category: "end_gc",
      rules: { "1": 8, "2": 6, "3": 4, "4": 3, "5": 2, "6": 1 },
      description: "GC final classification",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "end_points",
      rules: { "1": 4, "2": 2, "3": 1 },
      description: "Points classification final",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "end_kom",
      rules: { "1": 4, "2": 2, "3": 1 },
      description: "KOM classification final",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "end_youth",
      rules: { "1": 2 },
      description: "Youth classification final",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "end_combative",
      rules: { "1": 2 },
      description: "Combative classification final",
      validFrom,
    },
    {
      raceType: "mini_tour",
      category: "end_team",
      rules: { "1": 2 },
      description: "Team classification final",
      validFrom,
    },

    // WOMEN'S GRAND TOUR (same as men's grand tour)
    {
      raceType: "womens_grand_tour",
      category: "stage_finish",
      rules: {
        "1": 12, "2": 10, "3": 8, "4": 7, "5": 6,
        "6": 5, "7": 4, "8": 3, "9": 2, "10": 1
      },
      description: "Women's GT stage finish",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "sprint",
      rules: { "1": 2, "2": 2, "3": 1, "4": 1, "5": 1 },
      description: "Single sprint classification",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "sprint_double",
      rules: { "1": 2, "2": 1, "3": 1 },
      description: "When 2 sprint classifications on stage",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "mountain_cc_hcx2_af",
      rules: { "1": 3, "2": 2, "3": 2, "4": 1, "5": 1 },
      description: "HC/AF/CC (highest cat in Women's GT)",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "mountain_1_2cat",
      rules: { "1": 1, "2": 1 },
      description: "1cat and 2cat both count as 2nd highest",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "jersey_gc",
      rules: { "1": 2, "2": 1, "3": 1 },
      description: "GC jersey per stage",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "jersey_points",
      rules: { "1": 1 },
      description: "Points jersey per stage",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "jersey_kom",
      rules: { "1": 1 },
      description: "KOM jersey per stage",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "jersey_combative",
      rules: { "1": 2 },
      description: "Combative jersey per stage",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "ttt",
      rules: { "1": 6, "2": 4, "3": 2 },
      description: "Team Time Trial",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "end_gc",
      rules: {
        "1": 25, "2": 20, "3": 16, "4": 14, "5": 12,
        "6": 10, "7": 9, "8": 8, "9": 7, "10": 6,
        "11": 5, "12": 4, "13": 3, "14": 2, "15": 1
      },
      description: "GC final classification",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "end_points",
      rules: { "1": 12, "2": 8, "3": 6, "4": 4, "5": 2 },
      description: "Points classification final",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "end_kom",
      rules: { "1": 12, "2": 8, "3": 6, "4": 4, "5": 2 },
      description: "KOM classification final",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "end_youth",
      rules: { "1": 6, "2": 4, "3": 2 },
      description: "Youth classification final",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "end_combative",
      rules: { "1": 5 },
      description: "Combative classification final",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "end_team",
      rules: { "1": 6, "2": 4, "3": 2 },
      description: "Team classification final",
      validFrom,
    },
    {
      raceType: "womens_grand_tour",
      category: "end_other",
      rules: { "1": 3 },
      description: "Other special classifications",
      validFrom,
    },

    // WOMEN'S ONE-DAY (same as high priority one-day)
    {
      raceType: "womens_one_day",
      category: "finish",
      rules: {
        "1": 40, "2": 30, "3": 25, "4": 20, "5": 18,
        "6": 16, "7": 14, "8": 13, "9": 12, "10": 11,
        "11": 10, "12": 9, "13": 8, "14": 7, "15": 6,
        "16": 5, "17": 4, "18": 3, "19": 2, "20": 1
      },
      description: "Women's one-day race finish scoring",
      validFrom,
    },

    // WORLD CHAMPIONSHIP (same as high priority one-day)
    {
      raceType: "world_championship",
      category: "finish",
      rules: {
        "1": 40, "2": 30, "3": 25, "4": 20, "5": 18,
        "6": 16, "7": 14, "8": 13, "9": 12, "10": 11,
        "11": 10, "12": 9, "13": 8, "14": 7, "15": 6,
        "16": 5, "17": 4, "18": 3, "19": 2, "20": 1
      },
      description: "World Championship finish scoring",
      validFrom,
    },
  ]

  console.log(`  Inserting ${scoringEntries.length} scoring config entries...`)
  await db.insert(scoringConfig).values(scoringEntries)

  // ============================================================================
  // ROSTER LIMITS
  // ============================================================================

  const rosterEntries = [
    { raceType: "grand_tour", rosterSize: 8, description: "Grand Tour men's roster" },
    { raceType: "high_priority_one_day", rosterSize: 6, description: "High priority one-day roster" },
    { raceType: "low_priority_one_day", rosterSize: 4, description: "Low priority one-day roster" },
    { raceType: "mini_tour", rosterSize: 5, description: "Mini tour roster" },
    { raceType: "womens_grand_tour", rosterSize: 4, description: "Women's Grand Tour roster" },
    { raceType: "womens_one_day", rosterSize: 3, description: "Women's one-day roster" },
    { raceType: "world_championship", rosterSize: 6, description: "World Championship roster" },
  ]

  console.log(`  Inserting ${rosterEntries.length} roster limit entries...`)
  await db.insert(rosterLimits).values(rosterEntries)

  // ============================================================================
  // ORDER TYPES
  // ============================================================================

  const orderEntries = [
    {
      name: "blodpose_one_day",
      displayName: "Blodpose",
      applicableRaceTypes: ["high_priority_one_day", "low_priority_one_day"],
      effect: {
        type: "multiplier",
        values: { high_priority_one_day: 2, low_priority_one_day: 2.5 },
        target: "own_rider",
      },
      description: "x2.5 on low-pri or x2 on high-pri for one of your riders",
    },
    {
      name: "shimanobil",
      displayName: "Shimanobil",
      applicableRaceTypes: [
        "high_priority_one_day",
        "low_priority_one_day",
        "grand_tour",
        "mini_tour",
        "womens_grand_tour",
        "womens_one_day",
      ],
      effect: { type: "zero_points", target: "opponent_rider" },
      description: "One opponent's rider gets 0 points",
    },
    {
      name: "gammel_venn",
      displayName: "Gammel Venn",
      applicableRaceTypes: ["high_priority_one_day", "low_priority_one_day"],
      effect: {
        type: "multiplier",
        values: { high_priority_one_day: 2, low_priority_one_day: 3 },
        target: "unowned_rider",
      },
      description: "x2 on high-pri or x3 on low-pri for an unowned rider",
    },
    {
      name: "kaptein",
      displayName: "Kaptein / Laginnsats",
      applicableRaceTypes: ["world_championship"],
      effect: {
        type: "choice",
        options: {
          single_rider: { multiplier: 2 },
          country_all: { multiplier: 1.5 },
        },
        target: "own_rider_or_country",
      },
      description: "x2 for one rider OR x1.5 for all riders from a chosen country",
    },
    {
      name: "blodpose_gt",
      displayName: "Blodpose",
      applicableRaceTypes: ["grand_tour", "womens_grand_tour"],
      effect: { type: "multiplier", value: 3, target: "own_rider" },
      description: "x3 for one of your riders",
    },
    {
      name: "etappeseier",
      displayName: "Etappeseier",
      applicableRaceTypes: ["grand_tour", "womens_grand_tour"],
      effect: { type: "double_top10_stage", target: "all_own_riders" },
      description: "All your riders get double top-10 stage finish points",
    },
    {
      name: "hammer",
      displayName: "Hammer",
      applicableRaceTypes: ["grand_tour"],
      effect: {
        type: "gc_position_loss",
        points_per_position: 3,
        max_points: 30,
        restriction: "stage_11_plus",
        target: "unowned_gc_top10",
      },
      description: "Pick a GC top-10 rider not on your team, 3 pts per GC position lost, max 30 (stage 11+)",
    },
    {
      name: "covid",
      displayName: "COVID",
      applicableRaceTypes: ["grand_tour", "womens_grand_tour"],
      effect: { type: "half_points", target: "opponent_all_riders" },
      description: "All riders on one opponent's team get half points",
    },
    {
      name: "innlagt_spurt",
      displayName: "Innlagt spurt",
      applicableRaceTypes: ["grand_tour"],
      effect: {
        type: "team_sprint_points",
        restriction: "giro_only",
        target: "real_team",
      },
      description: "Choose a real team, get their intermediate sprint points (Giro only)",
    },
    {
      name: "bondestreik",
      displayName: "Bondestreik",
      applicableRaceTypes: ["grand_tour"],
      effect: {
        type: "zero_finish_points",
        restriction: "tdf_only",
        target: "opponent_all_riders",
      },
      description: "None of another team's riders score finish points (TdF only)",
    },
    {
      name: "lagtempo",
      displayName: "Lagtempo",
      applicableRaceTypes: ["grand_tour"],
      effect: {
        type: "team_placement_points",
        points_per_top20: 5,
        restriction: "vuelta_only_no_ttt",
        target: "real_team",
      },
      description: "Choose a real team, 5 pts per top-20 placement (Vuelta only, can't play on TTT stage)",
    },
    {
      name: "sponsorens_ritt",
      displayName: "Sponsorens ritt",
      applicableRaceTypes: ["womens_grand_tour"],
      effect: { type: "double_end_tour", target: "all_own_riders" },
      description: "Double end-of-tour points for all your riders",
    },
  ]

  console.log(`  Inserting ${orderEntries.length} order type entries...`)
  await db.insert(orderTypes).values(orderEntries)

  console.log("✅ Scoring configuration seeded successfully!")
  console.log(`   - ${scoringEntries.length} scoring config entries`)
  console.log(`   - ${rosterEntries.length} roster limits`)
  console.log(`   - ${orderEntries.length} order types`)
}

seedScoring()
  .catch((error) => {
    console.error("❌ Error seeding scoring configuration:", error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })

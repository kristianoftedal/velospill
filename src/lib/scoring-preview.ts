import { db } from "@/lib/db"
import { races } from "@/db/schema/races"
import { scoringConfig } from "@/db/schema/config"
import { eq, and, lte, or, isNull, gt } from "drizzle-orm"

/**
 * Strips numeric suffix from a category name to get the base scoring category.
 * e.g. "mountain_hc_2" → "mountain_hc", "mountain_hc" → "mountain_hc"
 */
function getBaseScoringCategory(category: string): string {
  return category.replace(/_\d+$/, "")
}

/**
 * Resolves the correct scoring raceType based on race name.
 * Tour de France races use grand_tour_tdf, other grand tours use grand_tour.
 * @param raceType - The base race type (e.g., "grand_tour")
 * @param raceName - The name of the race
 * @returns The raceType to use for scoring config lookup
 */
function resolveScoringRaceType(raceType: string, raceName: string): string {
  if (raceType === "grand_tour") {
    const lowerName = raceName.toLowerCase()
    if (lowerName.includes("tour de france") || lowerName.includes("tdf")) {
      return "grand_tour_tdf"
    }
  }
  return raceType
}

/**
 * Pure function to calculate points for a single position
 * @param position - The finishing position (1, 2, 3, etc.)
 * @param scoringRules - The rules object from scoringConfig.rules JSONB
 * @returns Points awarded for that position, or 0 if position is not in scoring range
 */
export function calculatePoints(
  position: number,
  scoringRules: Record<string, number>
): number {
  const positionKey = String(position)
  return scoringRules[positionKey] || 0
}

export type ScoringPreviewResult = {
  position: number
  riderId: number
  riderName: string
  pointsAwarded: number
}

export type ScoringPreview = {
  preview: ScoringPreviewResult[]
  totalPointsAwarded: number
  raceType: string
  raceName: string
  category: string
}

/**
 * Preview the scoring impact for a set of race results
 * Reads scoring configuration from the database (data-driven, not hardcoded)
 *
 * @param raceId - The race ID
 * @param results - Array of results with position and riderId
 * @param category - Optional category (sprint, mountain, jersey, etc.). If not provided, auto-detects finish/stage_finish
 * @returns Preview data showing points per rider
 */
export async function previewScoringImpact(
  raceId: number,
  results: Array<{ position: number; riderId: number }>,
  category?: string
): Promise<ScoringPreview> {
  // 1. Fetch the race to get its raceType and parentRaceId
  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
    with: {
      parentRace: true,
    },
  })

  if (!race) {
    throw new Error("Race not found")
  }

  // 2. Determine the scoring category
  // If category is explicitly provided, use it directly (for sprint, mountain, jersey, TTT, end-of-tour)
  // Otherwise, auto-detect based on race type (backward compatibility)
  let raceTypeForScoring: string = race.raceType
  let resolvedCategory: string

  if (category) {
    // Category explicitly provided - use it
    resolvedCategory = category
    // For stages with explicit category, still need to resolve raceType from parent
    if (race.parentRaceId && race.parentRace) {
      raceTypeForScoring = resolveScoringRaceType(
        race.parentRace.raceType,
        race.parentRace.name
      )
    } else {
      raceTypeForScoring = resolveScoringRaceType(race.raceType, race.name)
    }
  } else {
    // No category provided - auto-detect (backward compatibility)
    // For stages (has parentRaceId): use parent's raceType + "stage_finish" category
    // For one-day races: use "finish" category
    if (race.parentRaceId) {
      // This is a stage - use parent's raceType
      if (race.parentRace) {
        raceTypeForScoring = resolveScoringRaceType(
          race.parentRace.raceType,
          race.parentRace.name
        )
      }
      resolvedCategory = "stage_finish"
    } else if (
      race.raceType === "grand_tour" ||
      race.raceType === "mini_tour" ||
      race.raceType === "womens_grand_tour"
    ) {
      // Parent race for a multi-stage event
      // Results should not be entered on parent races, but if they are, use "finish"
      raceTypeForScoring = resolveScoringRaceType(race.raceType, race.name)
      resolvedCategory = "finish"
    } else {
      resolvedCategory = "finish"
    }
  }

  // 3. Fetch the matching scoringConfig entry
  const baseScoringCategory = getBaseScoringCategory(resolvedCategory)
  const now = new Date()
  let scoringRule = await db.query.scoringConfig.findFirst({
    where: and(
      eq(scoringConfig.raceType, raceTypeForScoring),
      eq(scoringConfig.category, baseScoringCategory),
      lte(scoringConfig.validFrom, now),
      or(isNull(scoringConfig.validUntil), gt(scoringConfig.validUntil, now))
    ),
  })

  // Fallback: if TdF-specific config not found, use generic grand_tour
  if (!scoringRule && raceTypeForScoring === "grand_tour_tdf") {
    scoringRule = await db.query.scoringConfig.findFirst({
      where: and(
        eq(scoringConfig.raceType, "grand_tour"),
        eq(scoringConfig.category, baseScoringCategory),
        lte(scoringConfig.validFrom, now),
        or(isNull(scoringConfig.validUntil), gt(scoringConfig.validUntil, now))
      ),
    })
  }

  if (!scoringRule) {
    throw new Error(
      `No scoring config found for raceType: ${raceTypeForScoring}, category: ${resolvedCategory}`
    )
  }

  const scoringRules = scoringRule.rules as Record<string, number>

  // 4. Fetch rider names for all results
  const riderIds = results.map((r) => r.riderId)
  const riderRecords = await db.query.riders.findMany({
    where: (riders, { inArray }) => inArray(riders.id, riderIds),
  })

  const riderMap = new Map(riderRecords.map((r) => [r.id, r.name]))

  // 5. Calculate points for each result
  const preview: ScoringPreviewResult[] = results.map((result) => {
    const pointsAwarded = calculatePoints(result.position, scoringRules)
    const riderName = riderMap.get(result.riderId) || "Unknown Rider"

    return {
      position: result.position,
      riderId: result.riderId,
      riderName,
      pointsAwarded,
    }
  })

  // Sort by position
  preview.sort((a, b) => a.position - b.position)

  const totalPointsAwarded = preview.reduce((sum, r) => sum + r.pointsAwarded, 0)

  return {
    preview,
    totalPointsAwarded,
    raceType: raceTypeForScoring,
    raceName: race.name,
    category: resolvedCategory,
  }
}

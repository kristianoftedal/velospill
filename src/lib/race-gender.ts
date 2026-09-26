/**
 * Which riders a race is contested by.
 *
 * Race gender is not stored on the races row — it is inferred from raceType, which
 * is why these lists exist. The inference has one blind spot: `world_championship`
 * covers both the men's and the women's championship, and resolves to "M" here.
 * Anything that can distinguish the two by other means (see genderForOrder) should
 * do so rather than trusting the race type alone.
 */
export const MENS_RACE_TYPES = [
  "grand_tour",
  "high_priority_one_day",
  "low_priority_one_day",
  "mini_tour",
  "world_championship",
]

export const WOMENS_RACE_TYPES = ["womens_grand_tour", "womens_one_day"]

export type RaceGender = "M" | "F"

/** Gender a race type is contested by, or null when the type says nothing. */
export function genderForRaceType(raceType: string): RaceGender | null {
  if (MENS_RACE_TYPES.includes(raceType)) return "M"
  if (WOMENS_RACE_TYPES.includes(raceType)) return "F"
  return null
}

/**
 * Gender an order's target rider must be.
 *
 * An order type's restriction is more specific than the race type: "Kaptein (Women)"
 * carries `womens_road_race_only` and applies to `world_championship` races, where
 * genderForRaceType would wrongly answer "M". So the restriction wins, and the race
 * type is only the fallback.
 */
export function genderForOrder(
  raceType: string,
  restriction?: string | null,
): RaceGender | null {
  if (restriction === "mens_road_race_only") return "M"
  if (restriction === "womens_road_race_only") return "F"
  return genderForRaceType(raceType)
}

export function genderLabel(gender: RaceGender): string {
  return gender === "M" ? "men's" : "women's"
}

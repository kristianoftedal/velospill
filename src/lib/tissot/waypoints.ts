import type { TissotWaypoint } from "./types";

/**
 * Turns Tissot waypoints into velospill result categories.
 *
 * Tissot is the only source that publishes the order of each intermediate
 * sprint and each classified climb, so this covers exactly the categories the
 * UCI importer has to leave manual. Stage finishes, GC and points standings
 * still come from UCI — the finish waypoint is deliberately discarded here so
 * there is only ever one source per category.
 */

export type ClimbTier = "hc" | "cat1" | "cat2" | "cat3" | "cat4";

const TIER_ORDER: ClimbTier[] = ["hc", "cat1", "cat2", "cat3", "cat4"];

const TIER_LABELS: Record<ClimbTier, string> = {
  hc: "Hors catégorie",
  cat1: "1st category",
  cat2: "2nd category",
  cat3: "3rd category",
  cat4: "4th category",
};

export function climbTierLabel(tier: ClimbTier): string {
  return TIER_LABELS[tier];
}

/**
 * Observed values are SpecialCategoryPass / Category1Pass / Category2Pass /
 * Category3Pass. Category4Pass is included on the same pattern; the Tour
 * reports "Undefined" for everything, which falls through to scale inference.
 */
const CATEGORY_TYPE_TIERS: Record<string, ClimbTier> = {
  SpecialCategoryPass: "hc",
  Category1Pass: "cat1",
  Category2Pass: "cat2",
  Category3Pass: "cat3",
  Category4Pass: "cat4",
};

const isMountain = (w: TissotWaypoint) => w.rankingType === "MountainPoints";
const isSprint = (w: TissotWaypoint) => w.rankingType === "SprintPoints";

/** The winner's points, which identify a climb's scale within one race. */
function topValue(w: TissotWaypoint): number {
  const v = Number(w.results[0]?.value);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Maps each distinct mountain points scale in a competition to a tier.
 *
 * Scales are race-specific — a 1st category climb pays 10-8-6-4-2-1 at the
 * Tour, 10-6-4-2-1 at the Vuelta and 12-8-6-4-2 at the Tour de Suisse — so
 * there is no absolute lookup. Within one race, though, a harder category
 * always pays more, so ranking the distinct scales by their winning value
 * recovers the ladder. The Tour's five scales come out as
 * 20/10/5/2/1 -> HC/Cat1/Cat2/Cat3/Cat4.
 */
export function inferTiersFromScales(
  allWaypoints: TissotWaypoint[],
): Map<number, ClimbTier> {
  const tops = [
    ...new Set(
      allWaypoints
        .filter((w) => isMountain(w) && w.results.length > 0)
        .map(topValue)
        .filter((v) => v > 0),
    ),
  ].sort((a, b) => b - a);

  // More distinct scales than tiers should not happen; keep the hardest five.
  return new Map(
    tops.slice(0, TIER_ORDER.length).map((top, i) => [top, TIER_ORDER[i]]),
  );
}

export function resolveClimbTier(
  waypoint: TissotWaypoint,
  inferred: Map<number, ClimbTier>,
): { tier: ClimbTier | null; inferredFromScale: boolean } {
  const stated = waypoint.categoryType
    ? CATEGORY_TYPE_TIERS[waypoint.categoryType]
    : undefined;
  if (stated) return { tier: stated, inferredFromScale: false };
  return {
    tier: inferred.get(topValue(waypoint)) ?? null,
    inferredFromScale: true,
  };
}

/**
 * The velospill mountain category for a climb, or null when the race type has
 * no category for it (a women's grand tour scores nothing below 2nd category).
 *
 * `tiersInRace` is the hardest-first list of tiers actually used in the race,
 * which is what "highest"/"2nd highest" mean for a mini tour.
 */
export function mountainCategoryFor(
  raceType: string,
  tier: ClimbTier,
  tiersInRace: ClimbTier[],
): string | null {
  if (raceType === "grand_tour" || raceType === "grand_tour_tdf") {
    switch (tier) {
      case "hc":
        return "mountain_hc";
      case "cat1":
        return "mountain_1cat";
      case "cat2":
        return "mountain_2cat";
      default:
        return "mountain_3_4cat";
    }
  }

  if (raceType === "womens_grand_tour") {
    if (tier === "hc") return "mountain_cc_hcx2_af";
    if (tier === "cat1" || tier === "cat2") return "mountain_1_2cat";
    return null;
  }

  if (raceType === "mini_tour") {
    const rank = tiersInRace.indexOf(tier);
    if (rank === 0) return "mountain_highest";
    if (rank === 1) return "mountain_2nd_highest";
    return null;
  }

  return null;
}

/** Hardest-first list of the tiers a competition actually uses. */
export function tiersUsedInRace(
  allWaypoints: TissotWaypoint[],
  inferred: Map<number, ClimbTier>,
): ClimbTier[] {
  const present = new Set<ClimbTier>();
  for (const w of allWaypoints) {
    if (!isMountain(w) || w.results.length === 0) continue;
    const { tier } = resolveClimbTier(w, inferred);
    if (tier) present.add(tier);
  }
  return TIER_ORDER.filter((t) => present.has(t));
}

/**
 * The intermediate sprints on a stage.
 *
 * `categoryType === "IntermediateSprint"` is authoritative where present. When
 * a competition reports "Undefined" throughout (the Tour), the finish is taken
 * to be the furthest sprint waypoint. Matching the stage distance exactly is
 * not reliable — route length and waypoint kilometres disagree by a rounding
 * step on some stages.
 */
export function intermediateSprints(
  stageWaypoints: TissotWaypoint[],
): TissotWaypoint[] {
  const sprints = stageWaypoints.filter(
    (w) => isSprint(w) && w.results.length > 0,
  );
  if (sprints.length === 0) return [];

  const stated = sprints.filter((w) => w.categoryType === "IntermediateSprint");
  if (stated.length > 0) return stated;

  // Everything except the finish.
  const finish = sprints.reduce((furthest, w) =>
    (w.distance ?? 0) > (furthest.distance ?? 0) ? w : furthest,
  );
  return sprints.filter((w) => w !== finish);
}

export function classifiedClimbs(
  stageWaypoints: TissotWaypoint[],
): TissotWaypoint[] {
  return stageWaypoints.filter((w) => isMountain(w) && w.results.length > 0);
}

/** Sprint category for a race type, or null when it scores none. */
export function sprintCategoryFor(raceType: string): string | null {
  switch (raceType) {
    case "grand_tour":
    case "grand_tour_tdf":
    case "womens_grand_tour":
    case "mini_tour":
      return "sprint";
    default:
      return null;
  }
}

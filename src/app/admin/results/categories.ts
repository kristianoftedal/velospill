/** Which result categories apply to a race, shared by the list and detail views. */

/** Categories that can be entered more than once per stage (per climb / per sprint). */
export const MULTI_INSTANCE_CATEGORIES = new Set([
  "sprint",
  "sprint_giro",
  "mountain_cc_hcx2_af",
  "mountain_hc",
  "mountain_1cat",
  "mountain_2cat",
  "mountain_3_4cat",
  "mountain_highest",
  "mountain_2nd_highest",
  "mountain_1_2cat",
]);

/**
 * Categories that record the classification *leader* for a stage, not the full
 * standings — only rank 1 scores. Named after the classification because that is
 * what UCI publishes, so the form spells out the one-rider scope.
 */
export const LEADER_ONLY_CATEGORIES = new Set([
  "jersey_gc",
  "jersey_points",
  "jersey_kom",
  "jersey_combative",
]);

export function resolveScoringRaceType(raceType: string, raceName: string): string {
  if (raceType === "grand_tour") {
    const lower = raceName.toLowerCase();
    if (lower.includes("tour de france") || lower.includes("tdf"))
      return "grand_tour_tdf";
  }
  return raceType;
}

/** Groups used to lay out the category accordion. */
export type CategoryGroup = {
  key: string;
  label: string;
  categories: string[];
};

export function getAvailableCategories(
  raceType: string,
  isStage: boolean,
  isParentRace: boolean,
): string[] {
  // One-day races (no parent, no stages).
  if (!isStage && !isParentRace) {
    return ["finish"];
  }

  if (isStage) {
    const perStage: string[] = ["stage_finish"];

    if (
      raceType === "grand_tour" ||
      raceType === "grand_tour_tdf" ||
      raceType === "womens_grand_tour"
    ) {
      perStage.push("sprint");
      if (raceType === "grand_tour") perStage.push("sprint_giro");
      if (raceType === "grand_tour" || raceType === "grand_tour_tdf") {
        perStage.push(
          "mountain_cc_hcx2_af",
          "mountain_hc",
          "mountain_1cat",
          "mountain_2cat",
          "mountain_3_4cat",
        );
      }
      if (raceType === "womens_grand_tour") {
        perStage.push("mountain_cc_hcx2_af", "mountain_1_2cat");
      }
      perStage.push("jersey_gc", "jersey_points", "jersey_kom", "jersey_combative");
      perStage.push("ttt");
    }

    if (raceType === "mini_tour") {
      perStage.push("sprint", "mountain_highest", "mountain_2nd_highest");
      perStage.push("jersey_gc", "jersey_points", "jersey_kom", "jersey_combative");
      perStage.push("ttt");
    }

    return perStage;
  }

  // Parent races: end-of-tour classifications.
  return [
    "end_gc",
    "end_points",
    "end_kom",
    "end_youth",
    "end_combative",
    "end_team",
    "end_other",
  ];
}

/** Split a category list into labelled groups for the accordion. */
export function groupCategories(categories: string[]): CategoryGroup[] {
  const pick = (pred: (c: string) => boolean) => categories.filter(pred);

  const groups: CategoryGroup[] = [
    {
      key: "result",
      label: "Result",
      categories: pick((c) => c === "finish" || c === "stage_finish" || c === "ttt"),
    },
    {
      key: "sprints",
      label: "Intermediate sprints",
      categories: pick((c) => c.startsWith("sprint")),
    },
    {
      key: "mountains",
      label: "Mountains",
      categories: pick((c) => c.startsWith("mountain")),
    },
    {
      key: "jerseys",
      label: "Classifications",
      categories: pick((c) => c.startsWith("jersey")),
    },
    {
      key: "endOfTour",
      label: "End of tour",
      categories: pick((c) => c.startsWith("end_")),
    },
  ];

  return groups.filter((g) => g.categories.length > 0);
}

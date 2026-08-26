import { describe, expect, it } from "vitest";
import type { TissotWaypoint } from "./types";
import {
  classifiedClimbs,
  inferTiersFromScales,
  intermediateSprints,
  mountainCategoryFor,
  resolveClimbTier,
  sprintCategoryFor,
  tiersUsedInRace,
} from "./waypoints";

/** Minimal waypoint; `scale` is the winner-first points list. */
function wp(
  rankingType: string,
  opts: {
    name?: string;
    distance?: number;
    categoryType?: string | null;
    scale?: number[];
  } = {},
): TissotWaypoint {
  const scale = opts.scale ?? [1];
  return {
    name: opts.name ?? "somewhere",
    distance: opts.distance ?? 0,
    rankingType,
    categoryType: opts.categoryType ?? null,
    results: scale.map((v, i) => ({
      rank: i + 1,
      value: String(v),
      bonif: null,
      rider: {
        name: `RIDER${i} Test`,
        bib: i + 1,
        nation: "NOR",
        teamCode: "TST",
        teamName: "TEST TEAM",
        uciRiderId: `1000000000${i}`,
      },
    })),
  };
}

const mtn = (categoryType: string | null, scale: number[], name = "climb") =>
  wp("MountainPoints", { categoryType, scale, name });

describe("inferTiersFromScales", () => {
  it("recovers the Tour ladder from its five points scales", () => {
    // Observed across tdf2026: 20/10/5/2/1 tops, categoryType "Undefined".
    const all = [
      mtn("Undefined", [20, 15, 12, 10, 8, 6, 4, 2]),
      mtn("Undefined", [10, 8, 6, 4, 2, 1]),
      mtn("Undefined", [5, 3, 2, 1]),
      mtn("Undefined", [2, 1]),
      mtn("Undefined", [1]),
    ];
    const tiers = inferTiersFromScales(all);
    expect(tiers.get(20)).toBe("hc");
    expect(tiers.get(10)).toBe("cat1");
    expect(tiers.get(5)).toBe("cat2");
    expect(tiers.get(2)).toBe("cat3");
    expect(tiers.get(1)).toBe("cat4");
  });

  it("ignores waypoints with no results", () => {
    const all = [mtn("Undefined", [10]), { ...mtn("Undefined", [5]), results: [] }];
    expect([...inferTiersFromScales(all).keys()]).toEqual([10]);
  });
});

describe("resolveClimbTier", () => {
  it("prefers the stated categoryType over the scale", () => {
    // The Vuelta pays 10-6-4-2-1 for a 1st category climb; ranking scales alone
    // would call a top value of 10 the hardest tier in the race.
    const all = [mtn("Category1Pass", [10, 6, 4, 2, 1]), mtn("Category3Pass", [3, 2, 1])];
    const inferred = inferTiersFromScales(all);
    expect(inferred.get(10)).toBe("hc"); // what the scale alone would say

    const resolved = resolveClimbTier(all[0], inferred);
    expect(resolved.tier).toBe("cat1");
    expect(resolved.inferredFromScale).toBe(false);
  });

  it("falls back to the scale when categoryType is Undefined", () => {
    const all = [mtn("Undefined", [10, 8, 6, 4, 2, 1]), mtn("Undefined", [2, 1])];
    const inferred = inferTiersFromScales(all);
    const resolved = resolveClimbTier(all[1], inferred);
    expect(resolved.tier).toBe("cat1"); // second-hardest of two scales
    expect(resolved.inferredFromScale).toBe(true);
  });
});

describe("mountainCategoryFor", () => {
  it("maps grand tour tiers to their own categories", () => {
    const tiers = ["hc", "cat1", "cat2", "cat3"] as const;
    expect(mountainCategoryFor("grand_tour", "hc", [...tiers])).toBe("mountain_hc");
    expect(mountainCategoryFor("grand_tour", "cat1", [...tiers])).toBe("mountain_1cat");
    expect(mountainCategoryFor("grand_tour", "cat2", [...tiers])).toBe("mountain_2cat");
    expect(mountainCategoryFor("grand_tour", "cat3", [...tiers])).toBe("mountain_3_4cat");
    expect(mountainCategoryFor("grand_tour_tdf", "cat4", [...tiers])).toBe("mountain_3_4cat");
  });

  it("collapses a women's grand tour to its two categories and skips the rest", () => {
    expect(mountainCategoryFor("womens_grand_tour", "hc", [])).toBe("mountain_cc_hcx2_af");
    expect(mountainCategoryFor("womens_grand_tour", "cat1", [])).toBe("mountain_1_2cat");
    expect(mountainCategoryFor("womens_grand_tour", "cat2", [])).toBe("mountain_1_2cat");
    expect(mountainCategoryFor("womens_grand_tour", "cat3", [])).toBeNull();
  });

  it("scores a mini tour by the hardest two tiers present in that race", () => {
    // Tour de Suisse used HC/1/2/3; Paris-Nice only 1/2/3.
    const suisse = ["hc", "cat1", "cat2", "cat3"] as const;
    expect(mountainCategoryFor("mini_tour", "hc", [...suisse])).toBe("mountain_highest");
    expect(mountainCategoryFor("mini_tour", "cat1", [...suisse])).toBe("mountain_2nd_highest");
    expect(mountainCategoryFor("mini_tour", "cat2", [...suisse])).toBeNull();

    const parisNice = ["cat1", "cat2", "cat3"] as const;
    expect(mountainCategoryFor("mini_tour", "cat1", [...parisNice])).toBe("mountain_highest");
    expect(mountainCategoryFor("mini_tour", "cat2", [...parisNice])).toBe("mountain_2nd_highest");
    expect(mountainCategoryFor("mini_tour", "cat3", [...parisNice])).toBeNull();
  });

  it("scores nothing for one-day race types", () => {
    expect(mountainCategoryFor("high_priority_one_day", "hc", [])).toBeNull();
  });
});

describe("tiersUsedInRace", () => {
  it("lists tiers hardest first, from stated categories", () => {
    const all = [
      mtn("Category3Pass", [3, 2, 1]),
      mtn("SpecialCategoryPass", [20, 14, 8, 6, 4]),
      mtn("Category2Pass", [6, 4, 3, 2, 1]),
    ];
    expect(tiersUsedInRace(all, inferTiersFromScales(all))).toEqual(["hc", "cat2", "cat3"]);
  });
});

describe("intermediateSprints", () => {
  it("uses categoryType when it is stated", () => {
    const stage = [
      wp("SprintPoints", { name: "Ordino", distance: 68.4, categoryType: "IntermediateSprint", scale: [20, 17, 15] }),
      wp("SprintPoints", { name: "Andorra", distance: 104.8, categoryType: "VeryDifficultyStage", scale: [20, 17, 15] }),
    ];
    expect(intermediateSprints(stage).map((w) => w.name)).toEqual(["Ordino"]);
  });

  it("drops the furthest waypoint when every categoryType is Undefined", () => {
    // The Tour reports "Undefined" throughout, and matching the stage distance
    // exactly is unreliable — route length and waypoint km disagree by a
    // rounding step on some stages.
    const stage = [
      wp("SprintPoints", { name: "QUILLAN", distance: 93.4, categoryType: "Undefined", scale: [25, 20, 16] }),
      wp("SprintPoints", { name: " Foix", distance: 181.9, categoryType: "Undefined", scale: [50, 30, 20] }),
    ];
    expect(intermediateSprints(stage).map((w) => w.name)).toEqual(["QUILLAN"]);
  });

  it("returns nothing when the finish is the only sprint", () => {
    const stage = [wp("SprintPoints", { name: "finish", distance: 9.4, categoryType: "Undefined", scale: [20] })];
    expect(intermediateSprints(stage)).toEqual([]);
  });

  it("ignores sprint waypoints with no results", () => {
    const stage = [{ ...wp("SprintPoints", { name: "empty" }), results: [] }];
    expect(intermediateSprints(stage)).toEqual([]);
  });
});

describe("classifiedClimbs", () => {
  it("takes only mountain waypoints that have results", () => {
    const stage = [
      mtn("Category1Pass", [10, 6, 4], "Col de Ordino"),
      { ...mtn("Category1Pass", [10], "not ridden yet"), results: [] },
      wp("SprintBonus", { name: "bonus", scale: [6] }),
      wp("SprintPoints", { name: "sprint", categoryType: "IntermediateSprint", scale: [20] }),
    ];
    expect(classifiedClimbs(stage).map((w) => w.name)).toEqual(["Col de Ordino"]);
  });
});

describe("sprintCategoryFor", () => {
  it("only stage-race types score intermediate sprints", () => {
    expect(sprintCategoryFor("grand_tour")).toBe("sprint");
    expect(sprintCategoryFor("grand_tour_tdf")).toBe("sprint");
    expect(sprintCategoryFor("womens_grand_tour")).toBe("sprint");
    expect(sprintCategoryFor("mini_tour")).toBe("sprint");
    expect(sprintCategoryFor("high_priority_one_day")).toBeNull();
    expect(sprintCategoryFor("world_championship")).toBeNull();
  });
});

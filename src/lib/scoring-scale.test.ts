import { describe, expect, it } from "vitest";
import { clampToScoringPlaces, scoredPositionLimit } from "./scoring-scale";

describe("scoredPositionLimit", () => {
  it("returns the last scoring position", () => {
    // mini_tour / stage_finish
    expect(scoredPositionLimit({ "1": 6, "2": 5, "3": 4, "4": 3, "5": 2, "6": 1 })).toBe(6);
    // grand_tour / mountain_3_4cat
    expect(scoredPositionLimit({ "1": 1 })).toBe(1);
  });

  it("takes the max key, not the key count, since scales may have gaps", () => {
    expect(scoredPositionLimit({ "1": 5, "3": 2 })).toBe(3);
  });

  it("returns null for an empty scale", () => {
    expect(scoredPositionLimit({})).toBeNull();
  });

  it("ignores non-positional keys", () => {
    expect(scoredPositionLimit({ "1": 3, foo: 9, "0": 1, "-2": 4 })).toBe(1);
  });
});

describe("clampToScoringPlaces", () => {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8].map((position) => ({ position }));

  it("drops rows past the last scoring position", () => {
    // A Tour HC climb ranks 8 riders; grand_tour_tdf/mountain_hc scores 4.
    expect(clampToScoringPlaces(rows, 4).map((r) => r.position)).toEqual([1, 2, 3, 4]);
  });

  it("keeps everything when the scale is deeper than the field", () => {
    expect(clampToScoringPlaces(rows, 20)).toHaveLength(8);
  });

  it("keeps everything when there is no scale, rather than silently emptying", () => {
    expect(clampToScoringPlaces(rows, null)).toHaveLength(8);
  });

  it("respects gaps in the source positions", () => {
    // A skipped rider leaves a gap; the clamp is on position, not index.
    const gapped = [{ position: 1 }, { position: 2 }, { position: 5 }];
    expect(clampToScoringPlaces(gapped, 3).map((r) => r.position)).toEqual([1, 2]);
  });
});

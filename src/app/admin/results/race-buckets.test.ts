import { describe, expect, it } from "vitest";
import {
  bucketFor,
  bucketRaces,
  effectiveEnd,
  isRaceComplete,
  type BucketedRace,
} from "./race-buckets";

const NOW = new Date("2026-08-25T12:00:00Z").getTime();
const day = (offset: number) => new Date(NOW + offset * 86_400_000);

function race(over: Partial<BucketedRace> = {}): BucketedRace {
  return {
    startDate: day(0),
    endDate: null,
    lastStageDate: null,
    hasResults: false,
    stagesTotal: 0,
    stagesWithResults: 0,
    ...over,
  };
}

describe("effectiveEnd", () => {
  it("prefers the last stage, since a tour's endDate is usually null", () => {
    const r = race({ startDate: day(-5), endDate: null, lastStageDate: day(-1) });
    expect(effectiveEnd(r)).toEqual(day(-1));
  });

  it("falls back to endDate, then to startDate", () => {
    expect(effectiveEnd(race({ startDate: day(-5), endDate: day(-2) }))).toEqual(day(-2));
    expect(effectiveEnd(race({ startDate: day(-5) }))).toEqual(day(-5));
  });
});

describe("bucketFor", () => {
  it("puts a race that has not started in the future", () => {
    expect(bucketFor(race({ startDate: day(1) }), NOW)).toBe("future");
  });

  it("treats an underway stage race as current", () => {
    // Started three days ago, two stages still to come.
    expect(
      bucketFor(race({ startDate: day(-3), lastStageDate: day(2) }), NOW),
    ).toBe("current");
  });

  it("keeps a race current for a week after it finishes", () => {
    expect(bucketFor(race({ startDate: day(-8), lastStageDate: day(-6) }), NOW)).toBe("current");
    expect(bucketFor(race({ startDate: day(-9), lastStageDate: day(-7) }), NOW)).toBe("current");
  });

  it("moves it to previous once it is more than a week old", () => {
    expect(bucketFor(race({ startDate: day(-30), lastStageDate: day(-8) }), NOW)).toBe("previous");
    // The months-old races that were cluttering the top of the list.
    expect(bucketFor(race({ startDate: day(-120) }), NOW)).toBe("previous");
  });
});

describe("bucketRaces", () => {
  it("leads with what is underway, then back through the week", () => {
    const underway = race({ startDate: day(-1), lastStageDate: day(3) });
    const yesterday = race({ startDate: day(-2), lastStageDate: day(-1) });
    const sixDaysAgo = race({ startDate: day(-7), lastStageDate: day(-6) });
    const { current } = bucketRaces([sixDaysAgo, yesterday, underway], NOW);
    expect(current).toEqual([underway, yesterday, sixDaysAgo]);
  });

  it("orders previous races newest first and future races soonest first", () => {
    const old = race({ startDate: day(-200) });
    const lessOld = race({ startDate: day(-20) });
    const soon = race({ startDate: day(3) });
    const later = race({ startDate: day(40) });

    const { previous, future } = bucketRaces([old, later, lessOld, soon], NOW);
    expect(previous).toEqual([lessOld, old]);
    expect(future).toEqual([soon, later]);
  });

  it("assigns every race to exactly one group", () => {
    const all = [
      race({ startDate: day(-200) }),
      race({ startDate: day(-2) }),
      race({ startDate: day(5) }),
    ];
    const { current, previous, future } = bucketRaces(all, NOW);
    expect(current.length + previous.length + future.length).toBe(all.length);
  });
});

describe("isRaceComplete", () => {
  it("needs every stage entered for a stage race", () => {
    expect(isRaceComplete(race({ stagesTotal: 5, stagesWithResults: 4 }))).toBe(false);
    expect(isRaceComplete(race({ stagesTotal: 5, stagesWithResults: 5 }))).toBe(true);
  });

  it("uses hasResults for a one-day race", () => {
    expect(isRaceComplete(race({ hasResults: false }))).toBe(false);
    expect(isRaceComplete(race({ hasResults: true }))).toBe(true);
  });

  it("ignores stage counts on a race with no stages", () => {
    expect(isRaceComplete(race({ hasResults: true, stagesTotal: 0 }))).toBe(true);
  });
});

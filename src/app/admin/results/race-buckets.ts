/**
 * Time bucketing for the results race list.
 *
 * Admins enter results for what just happened, so the list leads with races
 * underway or finished within the last week. Anything older is still reachable
 * but folded away, and future races are near-useless here — you cannot enter
 * results for a race nobody has ridden.
 */

export type BucketedRace = {
  startDate: Date;
  endDate: Date | null;
  /** Latest stage date; a tour's own endDate is often null. */
  lastStageDate: Date | null;
  hasResults: boolean;
  stagesTotal: number;
  stagesWithResults: number;
};

export type RaceBucket = "current" | "previous" | "future";

/** How long after finishing a race still counts as current. */
export const RECENT_DAYS = 7;
const DAY_MS = 86_400_000;

/** Last day the race is ridden. */
export function effectiveEnd(race: BucketedRace): Date {
  return race.lastStageDate ?? race.endDate ?? race.startDate;
}

export function isRaceComplete(race: BucketedRace): boolean {
  if (race.stagesTotal > 0) return race.stagesWithResults === race.stagesTotal;
  return race.hasResults;
}

export function bucketFor(race: BucketedRace, now: number): RaceBucket {
  if (race.startDate.getTime() > now) return "future";
  if (effectiveEnd(race).getTime() >= now - RECENT_DAYS * DAY_MS) return "current";
  return "previous";
}

/**
 * Splits races into the three groups, each sorted the way it is read:
 * current and previous newest-first, future soonest-first.
 */
export function bucketRaces<T extends BucketedRace>(
  races: T[],
  now: number,
): { current: T[]; previous: T[]; future: T[] } {
  const current: T[] = [];
  const previous: T[] = [];
  const future: T[] = [];

  for (const race of races) {
    const bucket = bucketFor(race, now);
    if (bucket === "current") current.push(race);
    else if (bucket === "previous") previous.push(race);
    else future.push(race);
  }

  const newestFirst = (a: T, b: T) =>
    effectiveEnd(b).getTime() - effectiveEnd(a).getTime();
  current.sort(newestFirst);
  previous.sort(newestFirst);
  future.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return { current, previous, future };
}

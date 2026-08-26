/**
 * Helpers for reading a scoring scale — the `{ "1": 6, "2": 5, … }` rules blob
 * on scoringConfig, keyed by finishing position.
 */

export type ScoringScale = Record<string, number>;

/**
 * Highest position that awards points, or null when the scale is empty.
 *
 * Takes the maximum key rather than counting them, because a scale is not
 * guaranteed to be contiguous.
 */
export function scoredPositionLimit(scale: ScoringScale): number | null {
  const positions = Object.keys(scale)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return positions.length > 0 ? Math.max(...positions) : null;
}

/** Drops rows past the last scoring position. */
export function clampToScoringPlaces<T extends { position: number }>(
  rows: T[],
  limit: number | null,
): T[] {
  if (limit == null) return rows;
  return rows.filter((r) => r.position <= limit);
}

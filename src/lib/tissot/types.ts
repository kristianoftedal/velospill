/**
 * Shapes returned by the (undocumented, public) Tissot Timing API at
 * prod.server.tissottiming.com. It is the only source found that publishes the
 * order of each intermediate sprint and each individual climb; UCI only ever
 * publishes the per-stage totals.
 */

export type TissotCompetition = {
  /** Competition code without the year, e.g. "vue". */
  code: string;
  /** Code + year, which is what the stage endpoints expect, e.g. "vue2026". */
  competitionCode: string;
  name: string;
  /** "CRD" = road, "MTB", "CTR" (track), … */
  sport: string;
  /** "GrandTour" | "SingleRace" | "MultiEvents" | "Empty" */
  type: string;
  start: string;
  end: string;
  location: string;
  status: string;
};

export type TissotStage = {
  number: number;
  name: string;
  /** "MS" (mass start) | "ITT" | "TTT" */
  type: string;
  /** Stage profile, e.g. "MediumMountainStage" — absent on time trials. */
  category: string | null;
  /** Total stage length in km; the finish waypoint sits at this distance. */
  distance: number | null;
  start: string | null;
};

export type TissotRider = {
  name: string;
  bib: number | null;
  nation: string;
  teamCode: string;
  teamName: string;
  /** 10-digit UCI licence id, stable across seasons. */
  uciRiderId: string | null;
};

export type TissotResultRow = {
  rank: number;
  /** Points for SprintPoints/MountainPoints, or a time gap for SprintBonus. */
  value: string;
  /** Bonus seconds awarded alongside the points, e.g. "10\"". */
  bonif: string | null;
  rider: TissotRider;
};

export type TissotRankingType =
  "SprintPoints" | "MountainPoints" | "SprintBonus" | (string & {});

export type TissotWaypoint = {
  /** Climb or sprint location, e.g. "Col de Ordino". */
  name: string;
  /** Kilometres from the stage start. */
  distance: number | null;
  rankingType: TissotRankingType;
  /**
   * For MountainPoints: "SpecialCategoryPass" | "Category1Pass" | … .
   * For SprintPoints: "IntermediateSprint", or a stage-profile value when the
   * waypoint is the stage finish. "Undefined" on some competitions (the Tour
   * reports it for every waypoint).
   */
  categoryType: string | null;
  results: TissotResultRow[];
};

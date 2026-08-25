import type {
  TissotCompetition,
  TissotResultRow,
  TissotStage,
  TissotWaypoint,
} from "./types";

const ORIGIN = "https://prod.server.tissottiming.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/** Competition codes are code+year concatenated: "vue2026" resolves, "vue" 404s. */
const COMPETITION_CODE = /^[a-z]{2,10}\d{4}$/;

export function isValidCompetitionCode(code: string): boolean {
  return COMPETITION_CODE.test(code);
}

async function tissotFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${ORIGIN}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
    // Results for a finished stage never change; cache for an hour.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Tissot request failed (HTTP ${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Road competitions for a season, newest last. */
export async function fetchTissotCompetitions(
  year: number,
): Promise<TissotCompetition[]> {
  const raw = await tissotFetch<Array<Record<string, unknown>>>(
    `/competitions?year=${year}`,
  );
  return raw
    .filter((c) => c.sport === "CRD")
    .map((c) => ({
      code: String(c.code ?? ""),
      competitionCode: `${String(c.code ?? "")}${year}`,
      name: String(c.name ?? ""),
      sport: String(c.sport ?? ""),
      type: String(c.type ?? ""),
      start: String(c.start ?? ""),
      end: String(c.end ?? ""),
      location: String(c.location ?? ""),
      status: String(c.status ?? ""),
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function fetchTissotStages(
  competitionCode: string,
): Promise<TissotStage[]> {
  if (!isValidCompetitionCode(competitionCode)) {
    throw new Error(`Invalid Tissot competition code: ${competitionCode}`);
  }
  const raw = await tissotFetch<Array<Record<string, unknown>>>(
    `/competitions/${competitionCode}/stages`,
  );
  return raw.map((s) => ({
    number: Number(s.number),
    name: String(s.name ?? ""),
    type: String(s.type ?? ""),
    category: s.category != null ? String(s.category) : null,
    distance: num(s.distance),
    start: s.start != null ? String(s.start) : null,
  }));
}

/**
 * Waypoints along a stage — every intermediate sprint, every classified climb
 * and the finish, each with its own ranking. Tissot returns them finish-first
 * (descending distance); this flattens them into race order.
 */
export async function fetchTissotTimeline(
  competitionCode: string,
  stageNumber: number,
): Promise<TissotWaypoint[]> {
  if (!isValidCompetitionCode(competitionCode)) {
    throw new Error(`Invalid Tissot competition code: ${competitionCode}`);
  }
  const raw = await tissotFetch<Array<Record<string, unknown>>>(
    `/competitions/${competitionCode}/stages/${stageNumber}/timeline`,
  );

  const waypoints: TissotWaypoint[] = [];
  for (const entry of raw) {
    const ranking = entry.ranking as Record<string, unknown> | undefined;
    if (!ranking) continue;

    const rows: TissotResultRow[] = (
      (ranking.results ?? []) as Array<Record<string, unknown>>
    )
      .map((r) => {
        const rider = (r.rider ?? {}) as Record<string, unknown>;
        const rank = Number(r.rank);
        return {
          rank,
          value: String(r.value ?? ""),
          bonif: r.bonif != null ? String(r.bonif) : null,
          rider: {
            name: String(rider.name ?? "").trim(),
            bib: num(rider.bib),
            nation: String(rider.nation ?? ""),
            teamCode: String(rider.teamCode ?? ""),
            teamName: String(rider.teamName ?? "").trim(),
            uciRiderId:
              rider.uciRiderId != null ? String(rider.uciRiderId) : null,
          },
        };
      })
      .filter((r) => Number.isFinite(r.rank) && r.rank > 0)
      .sort((a, b) => a.rank - b.rank);

    waypoints.push({
      name: String(entry.name ?? ranking.name ?? "").trim(),
      distance: num(entry.distance ?? ranking.distance),
      rankingType: String(ranking.rankingType ?? ""),
      categoryType:
        ranking.categoryType != null ? String(ranking.categoryType) : null,
      results: rows,
    });
  }

  // Race order: earliest kilometre first, finish last.
  return waypoints.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

/**
 * Every stage's waypoints. Needed because two mapping decisions are
 * whole-race: which climb tiers count as "highest"/"2nd highest" for a mini
 * tour, and what an "Undefined" categoryType means (the Tour reports nothing,
 * so tiers are recovered by ranking the points scales used across the race).
 */
export async function fetchTissotCompetitionTimelines(
  competitionCode: string,
): Promise<Map<number, TissotWaypoint[]>> {
  const stages = await fetchTissotStages(competitionCode);
  const entries = await Promise.all(
    stages.map(async (s) => {
      try {
        return [
          s.number,
          await fetchTissotTimeline(competitionCode, s.number),
        ] as const;
      } catch {
        // A stage with no timeline tab yet — not an error for our purposes.
        return [s.number, [] as TissotWaypoint[]] as const;
      }
    }),
  );
  return new Map(entries);
}

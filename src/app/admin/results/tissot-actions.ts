"use server";

import { scoringConfig } from "@/db/schema/config";
import { races } from "@/db/schema/races";
import { riders } from "@/db/schema/riders";
import { user } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  fetchTissotCompetitionTimelines,
  fetchTissotCompetitions,
  fetchTissotStages,
  isValidCompetitionCode,
} from "@/lib/tissot/client";
import type { TissotWaypoint } from "@/lib/tissot/types";
import { clampToScoringPlaces, scoredPositionLimit } from "@/lib/scoring-scale";
import {
  classifiedClimbs,
  climbTierLabel,
  inferTiersFromScales,
  intermediateSprints,
  mountainCategoryFor,
  resolveClimbTier,
  sprintCategoryFor,
  tiersUsedInRace,
} from "@/lib/tissot/waypoints";
import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { resolveScoringRaceType } from "./categories";
import { submitRaceResults } from "./actions";

async function checkAdminAuth() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const [dbUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!dbUser || dbUser.role !== "admin") throw new Error("Unauthorized");
  return session;
}

// ---------------------------------------------------------------------------
// Rider matching
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const stripTeamCode = (team: string) =>
  team.replace(/\s*\([A-Z0-9]{2,4}\)\s*$/, "").trim();
const normalizeTeam = (team: string) => normalizeName(stripTeamCode(team));

type RosterRider = { id: number; name: string; team: string };

/**
 * Tissot renders riders "SURNAME Firstname" while the roster is
 * "Firstname SURNAME", and the roster often carries fuller names
 * ("ONLEY Oscar" against "Edgar Oscar ONLEY"), so order is ignored and a
 * subset match counts.
 */
function matchRider(
  tissotName: string,
  tissotTeam: string,
  roster: RosterRider[],
): { rider: RosterRider | null; score: number; alternatives: RosterRider[] } {
  const target = normalizeName(tissotName);
  const targetTokens = target.split(" ").filter(Boolean);
  const targetTeam = normalizeTeam(tissotTeam);

  const scored = roster
    .map((rider) => {
      const name = normalizeName(rider.name);
      const tokens = name.split(" ").filter(Boolean);
      let score = 0;

      if (name === target) {
        score = 1;
      } else if (tokens.slice().reverse().join(" ") === target) {
        score = 0.97;
      } else if (
        targetTokens.length > 0 &&
        targetTokens.every((t) => tokens.includes(t))
      ) {
        score = 0.9;
      } else if (
        tokens.length > 0 &&
        tokens.every((t) => targetTokens.includes(t))
      ) {
        score = 0.88;
      } else {
        const surname = targetTokens[0]; // Tissot puts the surname first
        const riderSurname = tokens[tokens.length - 1];
        if (
          surname &&
          riderSurname &&
          surname === riderSurname &&
          surname.length > 3
        ) {
          score = 0.8;
        } else {
          const overlap = targetTokens.filter((t) => tokens.includes(t)).length;
          score = overlap / Math.max(targetTokens.length, tokens.length);
        }
      }

      if (score < 1 && targetTeam && normalizeTeam(rider.team) === targetTeam) {
        score = Math.min(0.99, score + 0.08);
      }
      return { rider, score };
    })
    .filter((m) => m.score >= 0.55)
    .sort((a, b) => b.score - a.score);

  return {
    rider: scored[0]?.rider ?? null,
    score: scored[0]?.score ?? 0,
    alternatives: scored.slice(1, 4).map((s) => s.rider),
  };
}

// ---------------------------------------------------------------------------
// Linking
// ---------------------------------------------------------------------------

export type TissotCompetitionCandidate = {
  competitionCode: string;
  name: string;
  start: string;
  end: string;
  location: string;
  score: number;
};

/** Resolve the tour a race belongs to; the Tissot link lives there. */
async function resolveRoot(raceId: number) {
  const race = await db.query.races.findFirst({ where: eq(races.id, raceId) });
  if (!race) return null;
  const root = race.parentRaceId
    ? ((await db.query.races.findFirst({
        where: eq(races.id, race.parentRaceId),
      })) ?? race)
    : race;
  return { race, root };
}

export async function searchTissotCompetitions(raceId: number) {
  await checkAdminAuth();

  const resolved = await resolveRoot(raceId);
  if (!resolved) return { success: false as const, error: "Race not found" };
  const { root } = resolved;

  let competitions;
  try {
    competitions = await fetchTissotCompetitions(root.season);
  } catch (e) {
    return {
      success: false as const,
      error: `Could not reach Tissot Timing: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const target = normalizeName(root.name);
  const targetTokens = new Set(target.split(" ").filter((t) => t.length > 2));
  const raceStart = root.startDate.toISOString().slice(0, 10);

  const candidates: TissotCompetitionCandidate[] = competitions
    .map((c) => {
      const name = normalizeName(c.name);
      let score: number;
      if (name === target) {
        score = 1;
      } else if (name.includes(target) || target.includes(name)) {
        score = 0.85;
      } else {
        const tokens = name.split(" ").filter((t) => t.length > 2);
        const overlap = tokens.filter((t) => targetTokens.has(t)).length;
        score = targetTokens.size
          ? overlap / Math.max(targetTokens.size, tokens.length)
          : 0;
      }
      // Races get renamed between seasons — the Critérium du Dauphiné became
      // the Tour Auvergne-Rhône-Alpes — so identical dates carry real weight.
      if (c.start === raceStart) score += 0.3;
      return {
        competitionCode: c.competitionCode,
        name: c.name,
        start: c.start,
        end: c.end,
        location: c.location,
        score: Math.max(0, Math.min(1, score)),
      };
    })
    .filter((c) => c.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  return {
    success: true as const,
    linkedCode: root.tissotCompetitionCode ?? null,
    candidates,
  };
}

export async function linkTissotCompetition(
  raceId: number,
  competitionCode: string | null,
) {
  await checkAdminAuth();

  if (competitionCode && !isValidCompetitionCode(competitionCode)) {
    return {
      success: false as const,
      error: 'Expected a Tissot competition code like "vue2026".',
    };
  }

  const resolved = await resolveRoot(raceId);
  if (!resolved) return { success: false as const, error: "Race not found" };

  await db
    .update(races)
    .set({ tissotCompetitionCode: competitionCode, updatedAt: new Date() })
    .where(eq(races.id, resolved.root.id));

  revalidatePath("/admin/results");
  return { success: true as const };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/**
 * Last scoring position for each category, so an import only writes rows that
 * can actually earn points.
 *
 * Tissot ranks as deep as its own points scale pays, which is consistently
 * deeper than velospill's — a Tour HC climb lists 8 riders where
 * grand_tour_tdf/mountain_hc scores 4, and a Tour intermediate sprint lists 15
 * against 5. Writing the rest would store rows worth zero and make a climb look
 * like it paid more than it did.
 *
 * Mirrors getScoringScale's grand_tour_tdf -> grand_tour fallback.
 */
async function loadScoringLimits(
  scoringRaceType: string,
  categories: string[],
): Promise<Map<string, number | null>> {
  const limits = new Map<string, number | null>();
  if (categories.length === 0) return limits;

  const raceTypes =
    scoringRaceType === "grand_tour_tdf"
      ? ["grand_tour_tdf", "grand_tour"]
      : [scoringRaceType];

  const now = new Date();
  const rows = await db
    .select({
      raceType: scoringConfig.raceType,
      category: scoringConfig.category,
      rules: scoringConfig.rules,
    })
    .from(scoringConfig)
    .where(
      and(
        inArray(scoringConfig.raceType, raceTypes),
        inArray(scoringConfig.category, categories),
        lte(scoringConfig.validFrom, now),
        or(isNull(scoringConfig.validUntil), gt(scoringConfig.validUntil, now)),
      ),
    );

  for (const category of categories) {
    // Prefer the exact race type over the fallback.
    const row =
      rows.find((r) => r.category === category && r.raceType === scoringRaceType) ??
      rows.find((r) => r.category === category);
    limits.set(
      category,
      row ? scoredPositionLimit(row.rules as Record<string, number>) : null,
    );
  }
  return limits;
}

/** Race types whose mountain categories are relative to the rest of the race. */
function scoringRaceTypeUsesRelativeTiers(raceType: string): boolean {
  return raceType === "mini_tour";
}

export type TissotImportRow = {
  position: number;
  /** Points Tissot awarded — informational; velospill scores by position. */
  value: string;
  tissotName: string;
  tissotTeam: string;
  matchedRider: RosterRider | null;
  matchScore: number;
  alternatives: RosterRider[];
};

export type TissotImportGroup = {
  /** Stable key for UI selection state. */
  key: string;
  kind: "sprint" | "mountain";
  /** Velospill category, or null when the race type scores nothing for it. */
  category: string | null;
  /** Suggested instance number within the category, in race order. */
  instance: number;
  /** Climb or sprint name, used as the instance label. */
  label: string;
  distanceKm: number | null;
  /** Climb tier, and whether it came from the points scale rather than Tissot. */
  tier: string | null;
  tierInferred: boolean;
  /** Reason the group cannot be imported, when category is null. */
  skipReason: string | null;
  /** Rows that can score — already clamped to the scoring scale. */
  rows: TissotImportRow[];
  /** Last scoring position for this category, null when none is configured. */
  scoringPlaces: number | null;
  /** How many riders Tissot ranked, before the clamp. */
  rankedByTissot: number;
};

/**
 * Everything importable for one stage: each intermediate sprint and each
 * classified climb, mapped to a velospill category and instance, with riders
 * matched. Reads only — nothing is written.
 */
export async function previewTissotStage(raceId: number) {
  await checkAdminAuth();

  const resolved = await resolveRoot(raceId);
  if (!resolved) return { success: false as const, error: "Race not found" };
  const { race, root } = resolved;

  if (race.parentRaceId == null) {
    return {
      success: false as const,
      error:
        "Sprints and climbs belong to a stage. Pick a stage from the strip above.",
    };
  }

  const competitionCode = root.tissotCompetitionCode;
  if (!competitionCode) {
    return {
      success: false as const,
      error: `${root.name} is not linked to a Tissot competition yet.`,
      needsLink: true as const,
    };
  }

  let timelines: Map<number, TissotWaypoint[]>;
  let stages;
  try {
    [timelines, stages] = await Promise.all([
      fetchTissotCompetitionTimelines(competitionCode),
      fetchTissotStages(competitionCode),
    ]);
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const stageNumber = race.stageNumber;
  if (stageNumber == null) {
    return {
      success: false as const,
      error: `${race.name} has no stage number.`,
    };
  }
  const stageWaypoints = timelines.get(stageNumber);
  if (!stageWaypoints) {
    return {
      success: false as const,
      error: `Tissot has no stage ${stageNumber} for ${competitionCode}. It lists ${stages.length} stages.`,
    };
  }

  // Tier resolution is whole-race: mini tours score by "highest category
  // present", and competitions reporting "Undefined" need the full set of
  // points scales to rank.
  const scoringRaceType = resolveScoringRaceType(root.raceType, root.name);
  const allWaypoints = [...timelines.values()].flat();
  const inferred = inferTiersFromScales(allWaypoints);
  const tiersInRace = tiersUsedInRace(allWaypoints, inferred);

  // A mini tour's "highest category" is relative to the whole race, but only
  // stages already ridden have data. Importing stage 2 of a race whose hardest
  // climb comes on stage 6 would label a lesser climb as the highest, so this
  // says whether the ladder can still move.
  const stagesWithData = [...timelines.values()].filter(
    (w) => w.length > 0,
  ).length;
  const tiersProvisional =
    scoringRaceTypeUsesRelativeTiers(root.raceType) &&
    stagesWithData < stages.length;

  const expectedGender = root.raceType.startsWith("womens_") ? "F" : "M";
  const roster = await db
    .select({ id: riders.id, name: riders.name, team: riders.team })
    .from(riders)
    .where(eq(riders.gender, expectedGender))
    .orderBy(riders.name);

  const toRows = (w: TissotWaypoint): TissotImportRow[] =>
    w.results.map((r) => {
      const m = matchRider(r.rider.name, r.rider.teamName, roster);
      return {
        position: r.rank,
        value: r.value,
        tissotName: r.rider.name,
        tissotTeam: r.rider.teamName,
        matchedRider: m.rider,
        matchScore: m.score,
        alternatives: m.alternatives,
      };
    });

  // Categories are resolved first so every scoring scale can be loaded in one
  // query, then rows are clamped to it.
  type DraftGroup = Omit<TissotImportGroup, "scoringPlaces" | "rankedByTissot"> & {
    waypoint: TissotWaypoint;
  };
  const drafts: DraftGroup[] = [];

  const sprintCategory = sprintCategoryFor(scoringRaceType);
  intermediateSprints(stageWaypoints).forEach((w, i) => {
    drafts.push({
      key: `sprint-${i}`,
      kind: "sprint",
      category: sprintCategory,
      instance: i + 1,
      label: w.name,
      distanceKm: w.distance,
      tier: null,
      tierInferred: false,
      skipReason: sprintCategory
        ? null
        : `${root.raceType.replace(/_/g, " ")} has no intermediate sprint category.`,
      rows: toRows(w),
      waypoint: w,
    });
  });

  const perCategoryCount = new Map<string, number>();
  classifiedClimbs(stageWaypoints).forEach((w, i) => {
    const { tier, inferredFromScale } = resolveClimbTier(w, inferred);
    const category = tier
      ? mountainCategoryFor(scoringRaceType, tier, tiersInRace)
      : null;

    let instance = 1;
    if (category) {
      instance = (perCategoryCount.get(category) ?? 0) + 1;
      perCategoryCount.set(category, instance);
    }

    drafts.push({
      key: `climb-${i}`,
      kind: "mountain",
      category,
      instance,
      label: w.name,
      distanceKm: w.distance,
      tier: tier ? climbTierLabel(tier) : null,
      tierInferred: inferredFromScale,
      skipReason: !tier
        ? "Could not determine the climb category."
        : !category
          ? `${root.raceType.replace(/_/g, " ")} scores no category for ${climbTierLabel(tier)} climbs.`
          : null,
      rows: toRows(w),
      waypoint: w,
    });
  });

  const limits = await loadScoringLimits(
    scoringRaceType,
    [...new Set(drafts.map((d) => d.category).filter((c): c is string => !!c))],
  );

  const groups: TissotImportGroup[] = drafts.map(({ waypoint, ...draft }) => {
    const rankedByTissot = waypoint.results.length;
    if (!draft.category) {
      return { ...draft, scoringPlaces: null, rankedByTissot };
    }

    const scoringPlaces = limits.get(draft.category) ?? null;
    if (scoringPlaces == null) {
      // Without a scale nothing can be awarded, so offering the import would
      // only write rows worth zero.
      return {
        ...draft,
        category: null,
        rows: [],
        scoringPlaces: null,
        rankedByTissot,
        skipReason: `No scoring rules configured for ${draft.category} on a ${root.raceType.replace(/_/g, " ")}.`,
      };
    }

    return {
      ...draft,
      rows: clampToScoringPlaces(draft.rows, scoringPlaces),
      scoringPlaces,
      rankedByTissot,
    };
  });

  return {
    success: true as const,
    competitionCode,
    stageNumber,
    stageName: stages.find((s) => s.number === stageNumber)?.name ?? race.name,
    tiersInRace,
    tiersProvisional,
    stagesWithData,
    stagesTotal: stages.length,
    groups,
  };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

const applySchema = z.object({
  raceId: z.number(),
  groups: z
    .array(
      z.object({
        category: z.string().min(1),
        instance: z.number().min(1),
        instanceLabel: z.string().optional(),
        results: z
          .array(
            z.object({
              position: z.number().min(1),
              riderId: z.number().min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1, "Select at least one sprint or climb to import"),
});

/**
 * Writes the selected sprints and climbs. Each group goes through
 * submitRaceResults so scoring, the unique constraints and the audit trail
 * behave exactly as they do for hand entry; that call replaces any existing
 * rows for the same category and instance, so re-importing is safe.
 */
export async function applyTissotStage(input: z.infer<typeof applySchema>) {
  await checkAdminAuth();

  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const message =
      flat.formErrors[0] ??
      Object.values(flat.fieldErrors).flat().filter(Boolean)[0] ??
      "Invalid selection";
    return {
      success: false as const,
      error: message,
      applied: [] as string[],
      failed: [] as Array<{
        category: string;
        instance: number;
        error: string;
      }>,
    };
  }

  const { raceId, groups } = parsed.data;
  const applied: string[] = [];
  const failed: Array<{ category: string; instance: number; error: string }> =
    [];

  for (const group of groups) {
    const res = await submitRaceResults({
      raceId,
      category: group.category,
      instance: group.instance,
      instanceLabel: group.instanceLabel,
      results: group.results.map((r) => ({
        position: r.position,
        riderId: r.riderId,
        time: "",
      })),
    });

    if (res.success) {
      applied.push(`${group.category} #${group.instance}`);
    } else {
      const err = res.error as Record<string, string[] | undefined> | undefined;
      failed.push({
        category: group.category,
        instance: group.instance,
        error: err?._form?.[0] ?? "Failed to save",
      });
    }
  }

  revalidatePath("/admin/results");
  return { success: failed.length === 0, applied, failed };
}

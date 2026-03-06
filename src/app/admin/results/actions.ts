/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import * as cheerio from "cheerio";
import { scoringConfig } from "@/db/schema/config";
import { races } from "@/db/schema/races";
import { raceResults, resultAudit } from "@/db/schema/results";
import { riders } from "@/db/schema/riders";
import { user } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculatePoints, previewScoringImpact } from "@/lib/scoring-preview";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

async function checkAdminAuth() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }
  const [dbUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!dbUser || dbUser.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session;
}

const resultSchema = z.object({
  raceId: z.number(),
  category: z.string().optional().default("finish"),
  results: z
    .array(
      z.object({
        position: z.number().min(1),
        riderId: z.number().min(1, "Select a rider"),
        time: z.string().optional(),
      }),
    )
    .min(1, "Enter at least one result")
    .refine(
      (results) => {
        const positions = results.map((r) => r.position);
        return positions.length === new Set(positions).size;
      },
      { message: "Positions must be unique" },
    )
    .refine(
      (results) => {
        const riderIds = results.map((r) => r.riderId);
        return riderIds.length === new Set(riderIds).size;
      },
      { message: "Each rider can only appear once" },
    ),
});

type ResultInput = z.infer<typeof resultSchema>;

export async function getRacesForResults() {
  await checkAdminAuth();

  const allRaces = await db
    .select({
      id: races.id,
      name: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      parentRaceId: races.parentRaceId,
      stageNumber: races.stageNumber,
      hasResults: sql<number>`CASE WHEN EXISTS(SELECT 1 FROM race_results WHERE race_results."raceId" = ${races.id}) THEN 1 ELSE 0 END`,
    })
    .from(races)
    .orderBy(asc(races.startDate));

  return allRaces.map(r => ({ ...r, hasResults: r.hasResults === 1 }));
}

export async function getRiders() {
  await checkAdminAuth();

  const allRiders = await db
    .select({
      id: riders.id,
      name: riders.name,
      team: riders.team,
      nationality: riders.nationality,
      gender: riders.gender,
    })
    .from(riders)
    .orderBy(riders.name);

  return allRiders;
}

export async function getResultsForRace(raceId: number) {
  await checkAdminAuth();

  const results = await db
    .select({
      id: raceResults.id,
      position: raceResults.position,
      time: raceResults.time,
      points: raceResults.points,
      category: raceResults.category,
      riderId: raceResults.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
    })
    .from(raceResults)
    .innerJoin(riders, eq(raceResults.riderId, riders.id))
    .where(eq(raceResults.raceId, raceId))
    .orderBy(raceResults.position);

  return results;
}

export async function previewResults(
  raceId: number,
  results: Array<{ position: number; riderId: number }>,
  category?: string,
) {
  await checkAdminAuth();

  try {
    const preview = await previewScoringImpact(raceId, results, category);
    return {
      success: true,
      data: preview,
    };
  } catch (error: any) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function submitRaceResults(formData: ResultInput) {
  const session = await checkAdminAuth();

  const result = resultSchema.safeParse(formData);

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors,
    };
  }

  const { raceId, category, results: resultData } = result.data;

  try {
    // Get the race to check raceType and determine category
    const race = await db.query.races.findFirst({
      where: eq(races.id, raceId),
    });

    if (!race) {
      return {
        success: false,
        error: { _form: ["Race not found"] },
      };
    }

    // For stages without explicit category, default to "stage_finish" (preserve existing behavior)
    let resolvedCategory = category;
    if (!resolvedCategory && race.parentRaceId) {
      resolvedCategory = "stage_finish";
    } else if (!resolvedCategory) {
      resolvedCategory = "finish";
    }

    // Validate end-of-tour categories are only entered on parent races
    if (resolvedCategory.startsWith("end_") && race.parentRaceId) {
      return {
        success: false,
        error: {
          _form: [
            "End-of-tour classifications can only be entered on parent races, not stages.",
          ],
        },
      };
    }

    // Determine expected gender based on race type
    const expectedGender = race.raceType.startsWith("womens_") ? "F" : "M";

    // Fetch all riders to validate gender
    const riderIds = resultData.map((r) => r.riderId);
    const riderRecords = await db.query.riders.findMany({
      where: (riders, { inArray }) => inArray(riders.id, riderIds),
    });

    // Create a map for quick lookup
    const riderMap = new Map(riderRecords.map((r) => [r.id, r]));

    // Validate all riders exist and have correct gender
    for (const resultItem of resultData) {
      const rider = riderMap.get(resultItem.riderId);
      if (!rider) {
        return {
          success: false,
          error: { _form: [`Rider with ID ${resultItem.riderId} not found`] },
        };
      }
      if (rider.gender !== expectedGender) {
        return {
          success: false,
          error: {
            _form: [
              `Invalid gender: ${rider.name} is ${rider.gender === "M" ? "male" : "female"} but this is a ${expectedGender === "M" ? "men's" : "women's"} race`,
            ],
          },
        };
      }
    }

    // Calculate points for all results using the scoring preview logic
    const scoringPreview = await previewScoringImpact(
      raceId,
      resultData,
      resolvedCategory,
    );
    const pointsMap = new Map(
      scoringPreview.preview.map((p) => [p.riderId, p.pointsAwarded]),
    );

    // Replace existing results using raw SQL to avoid Drizzle/Neon query issues
    await db.execute(sql`DELETE FROM result_audit WHERE "resultId" IN (SELECT id FROM race_results WHERE "raceId" = ${raceId} AND category = ${resolvedCategory})`);
    await db.execute(sql`DELETE FROM race_results WHERE "raceId" = ${raceId} AND category = ${resolvedCategory}`);

    // Insert new results and audit entry
    await db.transaction(async (tx) => {
      for (const resultItem of resultData) {
        const points = pointsMap.get(resultItem.riderId) || 0;
        await tx.insert(raceResults).values({
          raceId,
          riderId: resultItem.riderId,
          category: resolvedCategory,
          position: resultItem.position,
          time: resultItem.time || null,
          points,
        });
      }

      await tx.insert(resultAudit).values({
        raceId,
        changeType: "BATCH_INSERT",
        changedBy: session.user.id,
        newData: { category: resolvedCategory, results: resultData } as any,
      });
    });

    revalidatePath("/admin/results");
    return { success: true };
  } catch (error: any) {
    // Handle unique constraint violations
    if (error.code === "23505") {
      return {
        success: false,
        error: {
          _form: [
            "Results already exist for this race. Please edit existing results instead.",
          ],
        },
      };
    }

    return {
      success: false,
      error: { _form: [(error as Error).message] },
    };
  }
}

export async function correctRaceResult(
  resultId: number,
  updates: { position?: number; riderId?: number; time?: string },
  reason: string,
) {
  const session = await checkAdminAuth();

  if (!reason || reason.trim().length === 0) {
    return {
      success: false,
      error: "Reason for correction is required",
    };
  }

  try {
    await db.transaction(async (tx) => {
      // Fetch current state of the result
      const currentResult = await tx.query.raceResults.findFirst({
        where: eq(raceResults.id, resultId),
      });

      if (!currentResult) {
        throw new Error("Result not found");
      }

      // Build the updated data
      const updatedData = {
        position:
          updates.position !== undefined
            ? updates.position
            : currentResult.position,
        riderId:
          updates.riderId !== undefined
            ? updates.riderId
            : currentResult.riderId,
        time: updates.time !== undefined ? updates.time : currentResult.time,
      };

      // Check for position conflicts if position is being changed
      if (
        updates.position !== undefined &&
        updates.position !== currentResult.position
      ) {
        const conflictingResult = await tx.query.raceResults.findFirst({
          where: and(
            eq(raceResults.raceId, currentResult.raceId),
            eq(raceResults.position, updates.position),
          ),
        });

        if (conflictingResult && conflictingResult.id !== resultId) {
          throw new Error(
            `Position ${updates.position} is already taken by another rider`,
          );
        }
      }

      // Recalculate points for the updated result
      const raceId = currentResult.raceId;
      const scoringPreview = await previewScoringImpact(
        raceId,
        [{ position: updatedData.position, riderId: updatedData.riderId }],
        currentResult.category,
      );
      const newPoints = scoringPreview.preview[0]?.pointsAwarded || 0;

      // Insert audit entry
      await tx.insert(resultAudit).values({
        raceId: currentResult.raceId,
        resultId: resultId,
        changeType: "UPDATE",
        changedBy: session.user.id,
        oldData: {
          position: currentResult.position,
          riderId: currentResult.riderId,
          time: currentResult.time,
          points: currentResult.points,
        } as any,
        newData: {
          position: updatedData.position,
          riderId: updatedData.riderId,
          time: updatedData.time,
          points: newPoints,
        } as any,
        reason,
      });

      // Update the result
      await tx
        .update(raceResults)
        .set({
          position: updatedData.position,
          riderId: updatedData.riderId,
          time: updatedData.time || null,
          points: newPoints,
          updatedAt: new Date(),
        })
        .where(eq(raceResults.id, resultId));

      // Update race's updatedAt timestamp
      await tx
        .update(races)
        .set({ updatedAt: new Date() })
        .where(eq(races.id, currentResult.raceId));
    });

    revalidatePath("/admin/results");
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function deleteRaceResult(resultId: number, reason: string) {
  const session = await checkAdminAuth();

  if (!reason || reason.trim().length === 0) {
    return {
      success: false,
      error: "Reason for deletion is required",
    };
  }

  try {
    await db.transaction(async (tx) => {
      // Fetch current state
      const currentResult = await tx.query.raceResults.findFirst({
        where: eq(raceResults.id, resultId),
      });

      if (!currentResult) {
        throw new Error("Result not found");
      }

      // Insert audit entry
      await tx.insert(resultAudit).values({
        raceId: currentResult.raceId,
        resultId: resultId,
        changeType: "DELETE",
        changedBy: session.user.id,
        oldData: {
          position: currentResult.position,
          riderId: currentResult.riderId,
          time: currentResult.time,
          points: currentResult.points,
        } as any,
        reason,
      });

      // Delete the result
      await tx.delete(raceResults).where(eq(raceResults.id, resultId));
    });

    revalidatePath("/admin/results");
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function getAuditTrail(raceId: number) {
  await checkAdminAuth();

  const auditEntries = await db
    .select({
      id: resultAudit.id,
      changeType: resultAudit.changeType,
      changedBy: resultAudit.changedBy,
      changedAt: resultAudit.changedAt,
      oldData: resultAudit.oldData,
      newData: resultAudit.newData,
      reason: resultAudit.reason,
    })
    .from(resultAudit)
    .where(eq(resultAudit.raceId, raceId))
    .orderBy(desc(resultAudit.changedAt));

  return auditEntries;
}

export async function getTeamNames(gender: "M" | "F"): Promise<string[]> {
  await checkAdminAuth();

  const teams = await db
    .selectDistinct({ team: riders.team })
    .from(riders)
    .where(eq(riders.gender, gender))
    .orderBy(riders.team);

  return teams.map((t) => t.team);
}

export async function previewTttResults(
  raceId: number,
  teamPlacements: Array<{ position: number; teamName: string }>,
) {
  await checkAdminAuth();

  try {
    // Get the race to determine raceType for scoring
    const race = await db.query.races.findFirst({
      where: eq(races.id, raceId),
    });

    if (!race) {
      return {
        success: false,
        error: "Race not found",
      };
    }

    // Resolve scoring raceType (detect TdF)
    let raceTypeForScoring: string = race.raceType;
    if (race.raceType === "grand_tour") {
      const lower = race.name.toLowerCase();
      if (lower.includes("tour de france") || lower.includes("tdf")) {
        raceTypeForScoring = "grand_tour_tdf";
      }
    }

    // Fetch scoring config for "ttt" category
    const [scoringRules] = await db
      .select({
        rules: scoringConfig.rules,
      })
      .from(scoringConfig)
      .where(
        and(
          eq(scoringConfig.raceType, raceTypeForScoring),
          eq(scoringConfig.category, "ttt"),
        ),
      )
      .limit(1);

    if (!scoringRules) {
      return {
        success: false,
        error: `No TTT scoring config found for race type: ${raceTypeForScoring}`,
      };
    }

    // For each team, calculate preview data
    const previewData = await Promise.all(
      teamPlacements.map(async ({ position, teamName }) => {
        // Count riders on this team
        const riderCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(riders)
          .where(eq(riders.team, teamName))
          .then((res) => Number(res[0]?.count || 0));

        // Calculate points for this position
        const points = calculatePoints(position, scoringRules.rules as Record<string, number>);

        return {
          teamName,
          position,
          pointsPerRider: points,
          riderCount,
        };
      }),
    );

    return {
      success: true,
      data: previewData,
    };
  } catch (error: any) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function submitTttResults(formData: {
  raceId: number;
  teamPlacements: Array<{ position: number; teamName: string }>;
}) {
  const session = await checkAdminAuth();

  try {
    const { raceId, teamPlacements } = formData;

    // Validate at least one team placement
    if (!teamPlacements || teamPlacements.length === 0) {
      return {
        success: false,
        error: { _form: ["At least one team placement is required"] },
      };
    }

    // Validate unique positions
    const positions = teamPlacements.map((p) => p.position);
    if (positions.length !== new Set(positions).size) {
      return {
        success: false,
        error: { _form: ["Positions must be unique"] },
      };
    }

    // Validate unique team names
    const teamNames = teamPlacements.map((p) => p.teamName);
    if (teamNames.length !== new Set(teamNames).size) {
      return {
        success: false,
        error: { _form: ["Team names must be unique"] },
      };
    }

    // Get the race to determine raceType for scoring
    const race = await db.query.races.findFirst({
      where: eq(races.id, raceId),
    });

    if (!race) {
      return {
        success: false,
        error: { _form: ["Race not found"] },
      };
    }

    // Resolve scoring raceType (detect TdF)
    let raceTypeForScoring: string = race.raceType;
    if (race.raceType === "grand_tour") {
      const lower = race.name.toLowerCase();
      if (lower.includes("tour de france") || lower.includes("tdf")) {
        raceTypeForScoring = "grand_tour_tdf";
      }
    }

    // Fetch scoring config for "ttt" category
    const [scoringRules] = await db
      .select({
        rules: scoringConfig.rules,
      })
      .from(scoringConfig)
      .where(
        and(
          eq(scoringConfig.raceType, raceTypeForScoring),
          eq(scoringConfig.category, "ttt"),
        ),
      )
      .limit(1);

    if (!scoringRules) {
      return {
        success: false,
        error: {
          _form: [
            `No TTT scoring config found for race type: ${raceTypeForScoring}`,
          ],
        },
      };
    }

    // Pre-fetch all riders for all teams (outside transaction — avoids Neon interactive tx limitation)
    const allTeamNames = teamPlacements.map((p) => p.teamName);
    const allTeamRiders = await db
      .select({ id: riders.id, team: riders.team })
      .from(riders)
      .where(inArray(riders.team, allTeamNames));

    // Build lookup map: teamName -> riderId[]
    const teamRiderMap = new Map<string, number[]>();
    for (const rider of allTeamRiders) {
      if (!teamRiderMap.has(rider.team)) teamRiderMap.set(rider.team, []);
      teamRiderMap.get(rider.team)!.push(rider.id);
    }

    // Replace existing TTT results using raw SQL to avoid Drizzle/Neon query issues
    await db.execute(sql`DELETE FROM result_audit WHERE "resultId" IN (SELECT id FROM race_results WHERE "raceId" = ${raceId} AND category = 'ttt')`);
    await db.execute(sql`DELETE FROM race_results WHERE "raceId" = ${raceId} AND category = 'ttt'`);

    // INSERT-only transaction
    await db.transaction(async (tx) => {
      for (const { position, teamName } of teamPlacements) {
        const points = calculatePoints(position, scoringRules.rules as Record<string, number>);
        const riderIds = teamRiderMap.get(teamName) ?? [];

        for (const riderId of riderIds) {
          await tx.insert(raceResults).values({
            raceId,
            riderId,
            category: "ttt",
            position,
            time: null,
            points,
          });
        }
      }

      await tx.insert(resultAudit).values({
        raceId,
        changeType: "BATCH_INSERT",
        changedBy: session.user.id,
        newData: { category: "ttt", teamPlacements } as any,
      });
    });

    revalidatePath("/admin/results");
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: { _form: [(error as Error).message] },
    };
  }
}

// ============================================================================
// FIRSTCYCLING SCRAPING + FUZZY MATCHING
// ============================================================================

function normalizeRiderName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
}

function findBestRiderMatch(
  scrapedName: string,
  ridersList: Array<{ id: number; name: string; team: string }>,
): {
  rider: { id: number; name: string; team: string } | null;
  score: number;
  alternatives: Array<{ id: number; name: string; team: string }>;
} {
  const normalized = normalizeRiderName(scrapedName);
  const parts = normalized.split(/\s+/).filter(Boolean);

  const scored = ridersList
    .map((rider) => {
      const riderNorm = normalizeRiderName(rider.name);
      const riderParts = riderNorm.split(/\s+/).filter(Boolean);

      if (riderNorm === normalized) return { rider, score: 1.0 };

      // PCS often uses "LASTNAME Firstname" — try reversed match
      const reversed = [...parts].reverse().join(" ");
      if (riderNorm === reversed) return { rider, score: 0.99 };

      // All tokens match in any order
      if (
        parts.length > 0 &&
        parts.every((p) =>
          riderParts.some((rp) => rp === p || rp.startsWith(p) || p.startsWith(rp)),
        )
      ) {
        return { rider, score: 0.95 };
      }

      // Last name match (strong signal in cycling)
      const lastScraped = parts[parts.length - 1];
      const lastRider = riderParts[riderParts.length - 1];
      if (lastScraped && lastRider && lastScraped === lastRider && lastScraped.length > 3) {
        return { rider, score: 0.8 };
      }

      // Partial token overlap score
      const matchCount = parts.filter((p) =>
        riderParts.some(
          (rp) => rp === p || (p.length > 3 && (rp.startsWith(p) || p.startsWith(rp))),
        ),
      ).length;
      const score = matchCount / Math.max(parts.length, riderParts.length);
      return { rider, score };
    })
    .filter((m) => m.score > 0.4)
    .sort((a, b) => b.score - a.score);

  return {
    rider: scored[0]?.rider ?? null,
    score: scored[0]?.score ?? 0,
    alternatives: scored.slice(1, 4).map((s) => s.rider),
  };
}

export async function scrapeAndMatchPcsResults(url: string, raceId: number) {
  await checkAdminAuth();

  if (!url.startsWith("https://firstcycling.com/")) {
    return { success: false as const, error: "URL must be from firstcycling.com (e.g. https://firstcycling.com/race.php?r=53&y=2026)" };
  }

  const race = await db.query.races.findFirst({ where: eq(races.id, raceId) });
  if (!race) return { success: false as const, error: "Race not found" };

  const expectedGender = race.raceType.startsWith("womens_") ? "F" : "M";

  const ridersList = await db
    .select({ id: riders.id, name: riders.name, team: riders.team })
    .from(riders)
    .where(eq(riders.gender, expectedGender))
    .orderBy(riders.name);

  let html: string;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return {
        success: false as const,
        error: `Failed to fetch page (HTTP ${response.status}). The page may be behind Cloudflare protection — try opening it in your browser first, then retry.`,
      };
    }
    html = await response.text();
  } catch (e: any) {
    return {
      success: false as const,
      error: `Failed to fetch page: ${(e as Error).message}`,
    };
  }

  const $ = cheerio.load(html);
  const scraped: Array<{ position: number; riderName: string; teamName: string }> = [];

  $("table tbody tr").each((_, row) => {
    const cols = $(row).find("td");
    if (cols.length < 3) return;

    const posText = cols.eq(0).text().trim();
    const position = parseInt(posText, 10);
    if (isNaN(position) || position < 1) return;

    const riderAnchor = $(row).find("a[href*='rider.php']").first();
    const riderName = riderAnchor.text().trim();
    if (!riderName) return;

    const teamAnchor = $(row).find("a[href*='team.php']").first();
    const teamName = teamAnchor.text().trim() || cols.eq(3).text().trim();
    scraped.push({ position, riderName, teamName });
  });

  if (scraped.length === 0) {
    return {
      success: false as const,
      error:
        "No results found on page. Make sure this is a race results page on firstcycling.com.",
    };
  }

  const results = scraped.map(({ position, riderName, teamName }) => {
    const match = findBestRiderMatch(riderName, ridersList);
    return {
      position,
      scrapedName: riderName,
      scrapedTeam: teamName,
      matchedRider: match.rider
        ? { id: match.rider.id, name: match.rider.name, team: match.rider.team }
        : null,
      matchScore: match.score,
      alternatives: match.alternatives.map((r) => ({
        id: r.id,
        name: r.name,
        team: r.team,
      })),
    };
  });

  return { success: true as const, results, totalScraped: scraped.length };
}

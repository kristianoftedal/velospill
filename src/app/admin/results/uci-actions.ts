"use server";

import { races } from "@/db/schema/races";
import { riders } from "@/db/schema/riders";
import { user } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  UCI_CATEGORY_SOURCES,
  UCI_IMPORT_LIMITS,
  UCI_UNSUPPORTED_REASONS,
  matchFinalSection,
  matchStageSection,
  pickResultRef,
} from "@/lib/uci/category-map";
import {
  fetchUciCalendar,
  fetchUciCompetition,
  fetchUciResult,
} from "@/lib/uci/client";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

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
// Name matching
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

/** Strip the trailing team code velospill appends: "COFIDIS (COF)" → "COFIDIS". */
function stripTeamCode(team: string): string {
  return team.replace(/\s*\([A-Z0-9]{2,4}\)\s*$/, "").trim();
}

function normalizeTeam(team: string): string {
  return normalizeName(stripTeamCode(team));
}

type RosterRider = { id: number; name: string; team: string };

type RiderMatch = {
  rider: RosterRider | null;
  score: number;
  alternatives: RosterRider[];
};

/**
 * UCI and velospill share a naming convention ("Jonas ABRAHAMSEN") because the
 * roster was scraped from UCI, so an accent-stripped exact match carries almost
 * everything. Team is used only to break ties between namesakes.
 */
function matchRider(
  uciName: string,
  uciTeam: string,
  roster: RosterRider[],
): RiderMatch {
  const target = normalizeName(uciName);
  const targetTokens = target.split(" ").filter(Boolean);
  const targetTeam = normalizeTeam(uciTeam);

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
        // UCI carries extra given names or a double surname the roster omits.
        score = 0.9;
      } else if (
        tokens.length > 0 &&
        tokens.every((t) => targetTokens.includes(t))
      ) {
        score = 0.88;
      } else {
        const last = targetTokens[targetTokens.length - 1];
        const riderLast = tokens[tokens.length - 1];
        const first = targetTokens[0];
        const riderFirst = tokens[0];
        if (last && riderLast && last === riderLast && last.length > 3) {
          score = first === riderFirst ? 0.85 : 0.6;
        } else {
          const overlap = targetTokens.filter((t) => tokens.includes(t)).length;
          score = overlap / Math.max(targetTokens.length, tokens.length);
        }
      }

      // Same team is a strong confirmation; a different team a weak doubt.
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
// Linking a race to a UCI competition
// ---------------------------------------------------------------------------

export type UciCompetitionCandidate = {
  competitionId: string;
  name: string;
  dates: string;
  country: string;
  startDate: string | null;
  /** 0–1 confidence that this is the race being linked. */
  score: number;
};

/**
 * Search the UCI calendar for competitions matching a race. Both past and
 * upcoming are queried because a race in progress appears in only one of them.
 */
export async function searchUciCompetitions(raceId: number) {
  await checkAdminAuth();

  const race = await db.query.races.findFirst({ where: eq(races.id, raceId) });
  if (!race) return { success: false as const, error: "Race not found" };

  // Always search on the tour, never on a stage: "Stage 1" matches no UCI
  // competition, and the link is stored on the tour anyway.
  const root = race.parentRaceId
    ? ((await db.query.races.findFirst({ where: eq(races.id, race.parentRaceId) })) ??
      race)
    : race;

  const raceCategory = root.raceType.startsWith("womens_") ? "WE" : "ME";

  let events;
  try {
    const [past, upcoming] = await Promise.all([
      fetchUciCalendar({ year: root.season, when: "past", raceCategory }),
      fetchUciCalendar({ year: root.season, when: "upcoming", raceCategory }),
    ]);
    const byId = new Map(past.map((e) => [e.competitionId, e]));
    for (const e of upcoming) if (!byId.has(e.competitionId)) byId.set(e.competitionId, e);
    events = [...byId.values()];
  } catch (e) {
    return {
      success: false as const,
      error: `Could not reach the UCI calendar: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const target = normalizeName(root.name);
  const targetTokens = new Set(target.split(" ").filter((t) => t.length > 2));

  const candidates: UciCompetitionCandidate[] = events
    .map((ev) => {
      const name = normalizeName(ev.name);
      let score: number;
      if (name === target) {
        score = 1;
      } else if (name.includes(target) || target.includes(name)) {
        score = 0.85;
      } else {
        const tokens = name.split(" ").filter((t) => t.length > 2);
        const overlap = tokens.filter((t) => targetTokens.has(t)).length;
        score = targetTokens.size ? overlap / Math.max(targetTokens.size, tokens.length) : 0;
      }
      // Racing on the same date is a strong signal for renamed events.
      const raceStart = root.startDate.toISOString().slice(0, 10);
      if (ev.startDate && ev.startDate === raceStart) score += 0.15;
      // The "upcoming" feed leaks next season's editions into a single-year
      // query, and they match the name just as well — push them down.
      if (!ev.competitionId.startsWith(`${root.season}/`)) score -= 0.35;
      return { ...ev, score: Math.max(0, Math.min(1, score)) };
    })
    .filter((c) => c.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  return {
    success: true as const,
    linked: root.uciCompetitionId ?? null,
    candidates,
  };
}

export async function linkUciCompetition(
  raceId: number,
  competitionId: string | null,
) {
  await checkAdminAuth();

  if (competitionId && !/^\d{4}\/[A-Z]{3}\/\d+$/.test(competitionId)) {
    return {
      success: false as const,
      error: 'Expected a UCI competition id like "2026/ROA/76940".',
    };
  }

  const race = await db.query.races.findFirst({ where: eq(races.id, raceId) });
  if (!race) return { success: false as const, error: "Race not found" };

  // The link lives on the parent so every stage inherits it.
  const targetId = race.parentRaceId ?? race.id;
  await db
    .update(races)
    .set({ uciCompetitionId: competitionId, updatedAt: new Date() })
    .where(eq(races.id, targetId));

  revalidatePath("/admin/results");
  return { success: true as const };
}

/** Preview the stages and classifications a linked competition exposes. */
export async function getUciCompetitionOverview(competitionId: string) {
  await checkAdminAuth();
  try {
    const comp = await fetchUciCompetition(competitionId);
    return {
      success: true as const,
      name: comp.name,
      dates: comp.dates,
      competitionClass: comp.competitionClass,
      sections: comp.accordion.map((s) => ({
        label: s.label,
        titles: s.results.map((r) => r.title),
        isTeamEvent: s.results.some((r) => r.raceType === "T"),
      })),
      schedule: comp.schedule,
    };
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ---------------------------------------------------------------------------
// Importing results
// ---------------------------------------------------------------------------

export type UciImportRow = {
  position: number;
  uciName: string;
  uciTeam: string;
  time: string | null;
  matchedRider: RosterRider | null;
  matchScore: number;
  alternatives: RosterRider[];
};

export type UciImportTeamRow = {
  position: number;
  uciTeam: string;
  matchedTeamName: string | null;
  time: string | null;
  riders: Array<{
    uciName: string;
    matchedRider: RosterRider | null;
    matchScore: number;
  }>;
};

/**
 * Fetch the UCI classification behind a velospill category and match every row
 * to a roster rider. Nothing is written — the caller prefills the entry form.
 */
export async function importUciResults(args: {
  raceId: number;
  category: string;
}) {
  await checkAdminAuth();
  const { raceId, category } = args;

  const source = UCI_CATEGORY_SOURCES[category];
  if (!source) {
    return {
      success: false as const,
      error:
        UCI_UNSUPPORTED_REASONS[category] ??
        "This category has no UCI equivalent — enter it manually.",
    };
  }

  const race = await db.query.races.findFirst({ where: eq(races.id, raceId) });
  if (!race) return { success: false as const, error: "Race not found" };

  const parent = race.parentRaceId
    ? await db.query.races.findFirst({ where: eq(races.id, race.parentRaceId) })
    : null;

  const competitionId = race.uciCompetitionId ?? parent?.uciCompetitionId ?? null;
  if (!competitionId) {
    return {
      success: false as const,
      error: "This race is not linked to a UCI competition yet.",
      needsLink: true as const,
    };
  }

  let comp;
  try {
    comp = await fetchUciCompetition(competitionId);
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const section =
    source.scope === "final"
      ? matchFinalSection(comp.accordion)
      : matchStageSection(comp.accordion, race.stageNumber, race.name);

  if (!section) {
    return {
      success: false as const,
      error:
        source.scope === "final"
          ? "The UCI competition has no final classification section yet."
          : `No UCI results published for ${race.name} yet.`,
    };
  }

  const ref = pickResultRef(section.results, source.titles);
  if (!ref) {
    return {
      success: false as const,
      error: `"${section.label}" has no ${source.titles[0]} on UCI. Available: ${
        section.results.map((r) => r.title).join(", ") || "nothing yet"
      }.`,
    };
  }

  if (source.teamResult && ref.raceType !== "T") {
    return {
      success: false as const,
      error: `UCI lists ${section.label} as an individual event, not a team time trial.`,
    };
  }

  let rows;
  try {
    rows = await fetchUciResult(ref);
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // Rows without a rank are DNS/DNF/DSQ entries.
  const ranked = rows
    .filter((r) => r.rank != null)
    .sort((a, b) => a.rank! - b.rank!);

  if (ranked.length === 0) {
    return {
      success: false as const,
      error: `UCI has published "${ref.title}" for ${section.label} but it contains no ranked riders yet.`,
    };
  }

  const expectedGender = (parent ?? race).raceType.startsWith("womens_") ? "F" : "M";
  const roster = await db
    .select({ id: riders.id, name: riders.name, team: riders.team })
    .from(riders)
    .where(eq(riders.gender, expectedGender))
    .orderBy(riders.name);

  const meta = {
    competitionId,
    competitionName: comp.name,
    sectionLabel: section.label,
    resultTitle: ref.title,
  };

  // TTT: UCI repeats the team's shared rank on each of its riders.
  if (source.teamResult) {
    const teamRoster = new Map<string, string>();
    for (const r of roster) teamRoster.set(normalizeTeam(r.team), r.team);

    const groups = new Map<number, UciImportTeamRow>();
    for (const row of ranked) {
      let group = groups.get(row.rank!);
      if (!group) {
        group = {
          position: row.rank!,
          uciTeam: row.team,
          matchedTeamName: teamRoster.get(normalizeTeam(row.team)) ?? null,
          time: row.result ?? null,
          riders: [],
        };
        groups.set(row.rank!, group);
      }
      const match = matchRider(row.fullName, row.team, roster);
      group.riders.push({
        uciName: row.fullName,
        matchedRider: match.rider,
        matchScore: match.score,
      });
    }

    const limit = UCI_IMPORT_LIMITS[category] ?? 25;
    const teamRows = [...groups.values()]
      .sort((a, b) => a.position - b.position)
      .slice(0, limit);

    return { success: true as const, kind: "ttt" as const, meta, teamRows };
  }

  const limit = source.leaderOnly ? 1 : (UCI_IMPORT_LIMITS[category] ?? 10);

  const importRows: UciImportRow[] = ranked.slice(0, limit).map((row) => {
    const match = matchRider(row.fullName, row.team, roster);
    return {
      position: row.rank!,
      uciName: row.fullName,
      uciTeam: row.team,
      // For classification standings `result` is a points total or a time gap,
      // neither of which belongs in the time field.
      time: /^\d{1,2}(:\d{2}){1,2}([.,]\d+)?$/.test(row.result ?? "")
        ? row.result
        : null,
      matchedRider: match.rider,
      matchScore: match.score,
      alternatives: match.alternatives,
    };
  });

  return {
    success: true as const,
    kind: "individual" as const,
    meta,
    rows: importRows,
    totalRanked: ranked.length,
  };
}

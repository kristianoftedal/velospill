import { bonusRiders } from "@/db/schema/bonus-riders";
import { leagues, teams } from "@/db/schema/leagues";
import { races } from "@/db/schema/races";
import { raceResults } from "@/db/schema/results";
import { riders } from "@/db/schema/riders";
import { rosterEvents } from "@/db/schema/roster-events";
import { db } from "@/lib/db";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ownershipAtRaceTime } from "./roster-ownership";
import {
  makeLineupFilter,
  latestStartEventOnly,
} from "./scoring-queries";

const START_EVENT_TYPES = ["drafted", "transferred_in"] as const;

const parentRaces = alias(races, "parentRaces");

const categoryLabels: Record<string, string> = {
  finish: "Finish",
  stage_finish: "Stage Finish",
  sprint: "Sprint",
  mountain: "Mountain",
  jersey: "Jersey",
  ttt: "TTT",
  end_gc: "GC",
  end_sprint: "Points Jersey",
  end_mountain: "Mountain Jersey",
  end_youth: "Youth Jersey",
};

export type TeamRiderCategoryScore = {
  category: string;
  categoryLabel: string;
  position: number;
  points: number;
};

export type TeamRiderRaceEntry = {
  raceId: number;
  raceName: string;
  raceType: string;
  startDate: Date;
  racePoints: number;       // adjusted points (= base + order delta)
  baseRacePoints: number;   // raw raceResults.points sum
  orderDelta: number;       // racePoints - baseRacePoints (0 when no order applies)
  orderEffect: string | null; // human-readable label, e.g. "etappeseier x2.25 (finish pts)"
  categories: TeamRiderCategoryScore[];
  parentRaceId: number | null;
  parentRaceName: string | null;
};

export type TeamRiderEntry = {
  riderId: number;
  riderName: string;
  riderTeam: string;
  gender: "M" | "F";
  totalPoints: number;
  isBonus: boolean;
  races: TeamRiderRaceEntry[];
};

export type TeamBonusAdjustment = {
  raceId: number;
  points: number;
  description: string;
};

export type TeamSeasonProfile = {
  team: {
    id: number;
    name: string;
    leagueId: number;
    leagueName: string;
  };
  riders: TeamRiderEntry[];
  totalPoints: number;
  teamBonusAdjustments: TeamBonusAdjustment[]; // Hammer, Innlagt Spurt, Lagtempo etc.
};

/**
 * Returns a full season profile for a single fantasy team:
 * - Team metadata and league name
 * - Full roster of drafted riders with per-race scoring breakdown
 * - Bonus riders (Uno-X order picks) merged into the same roster
 * - Order adjustments (etappeseier, blodpose, etc.) applied to match standings
 *
 * Returns null if the team is not found or leagueId does not match.
 */
export async function getTeamSeasonProfile(
  teamId: number,
  leagueId: number,
  season: number,
): Promise<TeamSeasonProfile | null> {
  // ── Query 1: Team metadata + league name ──────────────────────────────────
  const teamRows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      leagueId: leagues.id,
      leagueName: leagues.name,
    })
    .from(teams)
    .innerJoin(leagues, eq(leagues.id, teams.leagueId))
    .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
    .limit(1);

  if (teamRows.length === 0) {
    return null;
  }

  const teamRow = teamRows[0];

  const leagueRaceScope = sql`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}) OR ${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))`;

  // Period-aware lineup filter (matches the filter used by the standings page)
  const lineupFilter = makeLineupFilter(
    sql`${rosterEvents.leagueId}`,
    sql`${rosterEvents.teamId}`,
    sql`${rosterEvents.riderId}`,
  );

  // ── Query 2: Per-rider, per-race scoring breakdown (main roster) ──────────
  const resultsRows = await db
    .select({
      riderId: rosterEvents.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      parentRaceId: races.parentRaceId,
      parentRaceName: parentRaces.name,
      category: raceResults.category,
      position: raceResults.position,
      points: raceResults.points,
    })
    .from(rosterEvents)
    .innerJoin(riders, eq(riders.id, rosterEvents.riderId))
    .innerJoin(raceResults, eq(raceResults.riderId, rosterEvents.riderId))
    .innerJoin(
      races,
      and(
        eq(races.id, raceResults.raceId),
        eq(races.season, season),
        ownershipAtRaceTime(
          leagueId,
          sql`${rosterEvents.teamId}`,
          sql`${rosterEvents.riderId}`,
          sql`${races.startDate}`,
        ),
        leagueRaceScope,
      ),
    )
    .leftJoin(parentRaces, eq(parentRaces.id, races.parentRaceId))
    .where(
      and(
        eq(rosterEvents.teamId, teamId),
        eq(rosterEvents.leagueId, leagueId),
        inArray(rosterEvents.eventType, [...START_EVENT_TYPES]),
        latestStartEventOnly,
        lineupFilter,
      ),
    )
    .orderBy(asc(riders.name), asc(races.startDate));

  // ── Query 3: Bonus riders for this team ───────────────────────────────────
  const bonusResultsRows = await db
    .select({
      riderId: bonusRiders.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      parentRaceId: races.parentRaceId,
      parentRaceName: parentRaces.name,
      category: raceResults.category,
      position: raceResults.position,
      points: raceResults.points,
    })
    .from(bonusRiders)
    .innerJoin(riders, eq(riders.id, bonusRiders.riderId))
    .innerJoin(raceResults, eq(raceResults.riderId, bonusRiders.riderId))
    .innerJoin(races, eq(races.id, raceResults.raceId))
    .leftJoin(parentRaces, eq(parentRaces.id, races.parentRaceId))
    .where(
      and(
        eq(bonusRiders.teamId, teamId),
        eq(bonusRiders.leagueId, leagueId),
        eq(races.season, season),
        or(
          eq(races.id, bonusRiders.raceId),
          eq(races.parentRaceId, bonusRiders.raceId),
        ),
        leagueRaceScope,
      ),
    )
    .orderBy(asc(riders.name), asc(races.startDate));

  // ── Application-side assembly ─────────────────────────────────────────────

  type RaceAccumulator = {
    raceId: number;
    raceName: string;
    raceType: string;
    startDate: Date;
    racePoints: number;
    baseRacePoints: number;
    orderDelta: number;
    orderEffect: string | null;
    categories: TeamRiderCategoryScore[];
    parentRaceId: number | null;
    parentRaceName: string | null;
  };

  type RiderAccumulator = {
    riderId: number;
    riderName: string;
    riderTeam: string;
    gender: "M" | "F";
    totalPoints: number;
    isBonus: boolean;
    raceMap: Map<number, RaceAccumulator>;
  };

  const riderMap = new Map<number, RiderAccumulator>();

  function addResultRow(
    row: {
      riderId: number;
      riderName: string;
      riderTeam: string;
      gender: "M" | "F";
      raceId: number;
      raceName: string;
      raceType: string;
      startDate: Date;
      parentRaceId: number | null;
      parentRaceName: string | null;
      category: string;
      position: number;
      points: number;
    },
    isBonus: boolean,
  ) {
    let riderEntry = riderMap.get(row.riderId);

    if (!riderEntry) {
      riderEntry = {
        riderId: row.riderId,
        riderName: row.riderName,
        riderTeam: row.riderTeam,
        gender: row.gender,
        totalPoints: 0,
        isBonus,
        raceMap: new Map(),
      };
      riderMap.set(row.riderId, riderEntry);
    }

    const categoryEntry: TeamRiderCategoryScore = {
      category: row.category,
      categoryLabel: categoryLabels[row.category] ?? row.category,
      position: row.position,
      points: row.points,
    };

    let raceEntry = riderEntry.raceMap.get(row.raceId);
    if (!raceEntry) {
      raceEntry = {
        raceId: row.raceId,
        raceName: row.raceName,
        raceType: row.raceType,
        startDate: row.startDate,
        racePoints: 0,
        baseRacePoints: 0,
        orderDelta: 0,
        orderEffect: null,
        categories: [],
        parentRaceId: row.parentRaceId,
        parentRaceName: row.parentRaceName,
      };
      riderEntry.raceMap.set(row.raceId, raceEntry);
    }

    raceEntry.categories.push(categoryEntry);
    raceEntry.baseRacePoints += row.points;
    raceEntry.racePoints += row.points;
    riderEntry.totalPoints += row.points;
  }

  for (const row of resultsRows) {
    addResultRow(
      {
        riderId: row.riderId,
        riderName: row.riderName,
        riderTeam: row.riderTeam,
        gender: row.gender as "M" | "F",
        raceId: row.raceId,
        raceName: row.raceName,
        raceType: row.raceType,
        startDate: row.startDate,
        parentRaceId: row.parentRaceId ?? null,
        parentRaceName: row.parentRaceName ?? null,
        category: row.category,
        position: row.position,
        points: row.points,
      },
      false,
    );
  }

  for (const row of bonusResultsRows) {
    addResultRow(
      {
        riderId: row.riderId,
        riderName: row.riderName,
        riderTeam: row.riderTeam,
        gender: row.gender as "M" | "F",
        raceId: row.raceId,
        raceName: row.raceName,
        raceType: row.raceType,
        startDate: row.startDate,
        parentRaceId: row.parentRaceId ?? null,
        parentRaceName: row.parentRaceName ?? null,
        category: row.category,
        position: row.position,
        points: row.points,
      },
      true,
    );
  }

  // ── Apply order adjustments ───────────────────────────────────────────────
  // Import lazily to avoid circular dependency (order-queries → scoring-queries → team-queries)
  const { getSeasonOrderAdjustments } = await import("./order-queries");
  const allAdjustments = await getSeasonOrderAdjustments(leagueId, season);

  const teamBonusAdjustments: TeamBonusAdjustment[] = [];

  for (const adj of allAdjustments) {
    if (adj.teamId !== teamId) continue;
    const delta = adj.adjustedPoints - adj.basePoints;

    if (adj.riderId == null) {
      // Team-level bonus (Hammer, Innlagt Spurt, Lagtempo)
      teamBonusAdjustments.push({
        raceId: adj.raceId,
        points: adj.adjustedPoints,
        description: adj.description,
      });
      continue;
    }

    const riderEntry = riderMap.get(adj.riderId);
    if (!riderEntry) continue;
    const raceEntry = riderEntry.raceMap.get(adj.raceId);
    if (!raceEntry) continue;

    raceEntry.orderDelta += delta;
    raceEntry.racePoints += delta;
    raceEntry.orderEffect = raceEntry.orderEffect
      ? `${raceEntry.orderEffect}, ${adj.description}`
      : adj.description;
    riderEntry.totalPoints += delta;
  }

  // ── Build final output ────────────────────────────────────────────────────
  const riderEntries: TeamRiderEntry[] = Array.from(riderMap.values())
    .map((riderAcc) => {
      const sortedRaces: TeamRiderRaceEntry[] = Array.from(
        riderAcc.raceMap.values(),
      ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      return {
        riderId: riderAcc.riderId,
        riderName: riderAcc.riderName,
        riderTeam: riderAcc.riderTeam,
        gender: riderAcc.gender,
        totalPoints: riderAcc.totalPoints,
        isBonus: riderAcc.isBonus,
        races: sortedRaces,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const riderTotal = riderEntries.reduce(
    (sum, rider) => sum + rider.totalPoints,
    0,
  );
  const bonusTotal = teamBonusAdjustments.reduce(
    (sum, adj) => sum + adj.points,
    0,
  );

  return {
    team: {
      id: teamRow.teamId,
      name: teamRow.teamName,
      leagueId: teamRow.leagueId,
      leagueName: teamRow.leagueName,
    },
    riders: riderEntries,
    totalPoints: riderTotal + bonusTotal,
    teamBonusAdjustments,
  };
}

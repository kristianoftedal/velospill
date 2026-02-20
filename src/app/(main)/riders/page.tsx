import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { raceLineups, raceResults, races, riders } from "@/db/schema";
import { teams } from "@/db/schema/leagues";
import { draftPicks } from "@/db/schema/draft";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "../../../lib/auth";
import RidersPageClient from "./page-client-component";

export default async function RidersPage() {
  // Get current user's teams' riders
  const session = await auth.api.getSession({ headers: await headers() });

  let userTeamRiderIds: number[] = [];
  if (session?.user?.id) {
    // First get the user's team IDs
    const userTeams = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.userId, session.user.id));

    const teamIds = userTeams.map((t) => t.id);

    if (teamIds.length > 0) {
      // Then get riders from those teams
      const userTeamRiders = await db
        .selectDistinct({
          riderId: raceLineups.riderId,
        })
        .from(raceLineups)
        .where(inArray(raceLineups.teamId, teamIds));

      userTeamRiderIds = userTeamRiders
        .map((r) => r.riderId)
        .filter((id): id is number => id !== null && id !== undefined);
    }
  }

  // Get all riders with their total points
  const ridersData = await db
    .select({
      id: riders.id,
      name: riders.name,
      team: riders.team,
      nationality: riders.nationality,
      gender: riders.gender,
      totalPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
    })
    .from(riders)
    .leftJoin(raceResults, sql`${riders.id} = ${raceResults.riderId}`)
    .groupBy(riders.id, riders.name, riders.team, riders.nationality, riders.gender)
    .orderBy(sql`COALESCE(SUM(${raceResults.points}), 0) DESC`);

  // Get all drafted rider IDs across all leagues
  const draftedRiderRows = await db
    .selectDistinct({ riderId: draftPicks.riderId })
    .from(draftPicks);
  const draftedRiderIds = draftedRiderRows.map(r => r.riderId);

  // For each rider, get their race-by-race breakdown
  const riderBreakdowns = await Promise.all(
    ridersData.map(async (rider) => {
      const results = await db
        .select({
          raceName: races.name,
          raceDate: races.startDate,
          position: raceResults.position,
          points: raceResults.points,
          raceType: races.raceType,
        })
        .from(raceResults)
        .innerJoin(races, sql`${raceResults.raceId} = ${races.id}`)
        .where(sql`${raceResults.riderId} = ${rider.id}`)
        .orderBy(sql`${races.startDate} DESC`);

      // Calculate category breakdowns
      const categoryScores = {
        oneDay: results
          .filter(
            (r) =>
              r.raceType === "high_priority_one_day" ||
              r.raceType === "low_priority_one_day",
          )
          .reduce((sum, r) => sum + r.points, 0),
        stage: results
          .filter((r) => r.raceType === "mini_tour")
          .reduce((sum, r) => sum + r.points, 0),
        classic: results
          .filter((r) => r.raceType === "grand_tour")
          .reduce((sum, r) => sum + r.points, 0),
        total: results.reduce((sum, r) => sum + r.points, 0),
      };

      const maxPosition =
        results.length > 0 ? Math.max(...results.map((r) => r.position)) : 0;
      const avgPosition =
        results.length > 0
          ? Math.round(
              results.reduce((sum, r) => sum + r.position, 0) / results.length,
            )
          : 0;

      return {
        ...rider,
        results,
        categoryScores,
        maxPosition,
        avgPosition,
        raceCount: results.length,
      };
    }),
  );

  return <RidersPageClient riders={riderBreakdowns} userTeamRiderIds={userTeamRiderIds} draftedRiderIds={draftedRiderIds} />;
}

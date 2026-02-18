import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { raceLineups, raceResults, races, riders } from "@/db/schema";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "../../../lib/auth";

export default async function RidersPage() {
  // Get current user's teams' riders
  const session = await auth.api.getSession({ headers: await headers() });

  let userTeamRiderIds: string[] = [];
  if (session?.user?.id) {
    const userTeamRiders = await db
      .selectDistinct({
        riderId: raceLineups.riderId,
      })
      .from(raceLineups)
      .where(
        sql`${raceLineups.teamId} IN (SELECT id FROM teams WHERE userId = ${session.user.id})`,
      );

    userTeamRiderIds = userTeamRiders.map((r) => r.riderId?.toString() || "");
  }

  // Get all riders with their total points
  const ridersData = await db
    .select({
      id: riders.id,
      name: riders.name,
      team: riders.team,
      nationality: riders.nationality,
      totalPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
    })
    .from(riders)
    .leftJoin(raceResults, sql`${riders.id} = ${raceResults.riderId}`)
    .groupBy(riders.id, riders.name, riders.team, riders.nationality)
    .orderBy(sql`COALESCE(SUM(${raceResults.points}), 0) DESC`);

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
        gt: results
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

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tighter text-foreground">
            Professional Riders
          </h1>
          <p className="text-lg text-muted-foreground">
            Explore world-class cyclists and their season performance
          </p>
        </div>

        {riderBreakdowns.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No riders available yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-4">
            {riderBreakdowns.map((rider) => (
              <AccordionItem
                key={rider.id}
                value={`rider-${rider.id}`}
                className="border-0 overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-shadow"
              >
                <AccordionTrigger className="hover:no-underline bg-white dark:bg-slate-900 px-6 py-5">
                  <div className="flex items-center justify-between w-full gap-4">
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-green-blue flex items-center justify-center text-white font-bold">
                          {rider.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-lg text-foreground">
                            {rider.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {rider.team}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 mr-4">
                      <div className="text-right">
                        <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-green-blue">
                          {rider.totalPoints}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium">
                          TOTAL POINTS
                        </p>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="bg-gradient-to-b from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 px-6 py-6 space-y-8">
                  {/* Category Breakdown */}
                  {rider.results.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-4">
                        RACE CATEGORIES
                      </h3>
                      <div className="space-y-3">
                        {[
                          {
                            label: "Stage Races",
                            value: rider.categoryScores.stage,
                            color: "from-blue-500 to-blue-600",
                          },
                          {
                            label: "One-Day Events",
                            value: rider.categoryScores.oneDay,
                            color: "from-green-500 to-green-600",
                          },
                          {
                            label: "Classics",
                            value: rider.categoryScores.gt,
                            color: "from-purple-500 to-purple-600",
                          },
                        ].map((category) => (
                          <div key={category.label} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-muted-foreground">
                                {category.label}
                              </span>
                              <span className="text-sm font-bold text-primary">
                                {category.value}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${category.color} rounded-full transition-all duration-500`}
                                style={{
                                  width: `${
                                    rider.totalPoints > 0
                                      ? (category.value / rider.totalPoints) *
                                        100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Performance Metrics */}
                  <div>
                    <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-4">
                      PERFORMANCE
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground font-medium mb-1">
                          Races
                        </p>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {rider.raceCount}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground font-medium mb-1">
                          Avg Position
                        </p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                          #{rider.avgPosition}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground font-medium mb-1">
                          PPR
                        </p>
                        <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                          {rider.raceCount > 0
                            ? (rider.totalPoints / rider.raceCount).toFixed(1)
                            : 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Race Details Table */}
                  {rider.results.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">
                        RACE RESULTS
                      </h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {rider.results.map((result, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary hover:shadow-md transition-all"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-foreground text-sm">
                                {result.raceName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(
                                  new Date(result.raceDate),
                                  "MMM d, yyyy",
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge
                                variant="outline"
                                className="text-xs font-medium"
                              >
                                #{result.position}
                              </Badge>
                              <span className="font-bold text-primary text-lg">
                                {result.points}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}

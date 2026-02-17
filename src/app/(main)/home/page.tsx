import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { leagues, teams } from "@/db/schema/leagues";
import { races } from "@/db/schema/races";
import { raceResults } from "@/db/schema/results";
import { riders } from "@/db/schema/riders";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format, isSameDay } from "date-fns";
import { and, asc, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";

type CompletedRace = {
  raceId: number;
  raceName: string;
  raceType: string;
  startDate: Date | null;
  endDate: Date | null;
};

const raceTypeColors: Record<string, string> = {
  grand_tour: "bg-blue-100 text-blue-800",
  high_priority_one_day: "bg-purple-100 text-purple-800",
  low_priority_one_day: "bg-gray-100 text-gray-800",
  mini_tour: "bg-green-100 text-green-800",
  womens_grand_tour: "bg-pink-100 text-pink-800",
  womens_one_day: "bg-rose-100 text-rose-800",
  world_championship: "bg-amber-100 text-amber-800",
};

const raceTypeLabels: Record<string, string> = {
  grand_tour: "Grand Tour",
  high_priority_one_day: "Major One-Day",
  low_priority_one_day: "One-Day",
  mini_tour: "Mini Tour",
  womens_grand_tour: "Women's Grand Tour",
  womens_one_day: "Women's One-Day",
  world_championship: "World Championship",
};

const statusColors: Record<string, string> = {
  setup: "bg-blue-100 text-blue-800",
  drafting: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  complete: "bg-gray-100 text-gray-800",
};

export default async function HomePage() {
  // Fetch session for user-specific data
  const session = await auth.api.getSession({ headers: await headers() });

  // Fetch user's leagues if logged in
  let myLeagues: {
    id: number;
    name: string;
    status: string;
    teamName: string;
    config: unknown;
  }[] = [];
  if (session) {
    const result = await db
      .select({
        leagueId: leagues.id,
        leagueName: leagues.name,
        status: leagues.status,
        config: leagues.config,
        teamName: teams.name,
      })
      .from(teams)
      .innerJoin(leagues, eq(teams.leagueId, leagues.id))
      .where(eq(teams.userId, session.user.id))
      .orderBy(desc(leagues.createdAt));

    myLeagues = result.map((r) => ({
      id: r.leagueId,
      name: r.leagueName,
      status: r.status,
      teamName: r.teamName,
      config: r.config,
    }));
  }

  // Fetch upcoming races - only parent races (not stages)
  const upcomingRaces = await db.query.races.findMany({
    where: gte(races.startDate, new Date()),
    orderBy: asc(races.startDate),
    limit: 10,
  });

  // Filter to only parent races (parentRaceId is null)
  const parentRaces = upcomingRaces.filter((race) => !race.parentRaceId);

  // Fetch latest completed races with results
  const latestRacesWithResults = (await db
    .select({
      raceId: races.id,
      raceName: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      endDate: races.endDate,
    })
    .from(races)
    .where(
      and(
        lt(races.endDate ?? races.startDate, new Date()),
        isNotNull(races.endDate),
      ),
    )
    .orderBy(desc(races.endDate))
    .limit(5)) as unknown as CompletedRace[];

  // Fetch latest race results with rider info
  const latestResults = await db
    .select({
      position: raceResults.position,
      points: raceResults.points,
      riderName: riders.name,
      riderTeam: riders.team,
      raceName: races.name,
      raceType: races.raceType,
      raceDate: races.startDate,
    })
    .from(raceResults)
    .innerJoin(races, eq(raceResults.raceId, races.id))
    .innerJoin(riders, eq(raceResults.riderId, riders.id))
    .where(
      and(
        lt(races.endDate ?? races.startDate, new Date()),
        isNotNull(races.endDate),
      ),
    )
    .orderBy(desc(races.startDate), desc(raceResults.position))
    .limit(10);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-8">
        {/* League Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-foreground">Your Leagues</h2>
            <Link
              href="/leagues"
              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              View all
            </Link>
          </div>
          {myLeagues.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">
                  You haven&apos;t joined any leagues yet
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/leagues/new"
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Create League
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myLeagues.map((league) => (
                <Card
                  key={league.id}
                  className="border-border bg-card hover:border-primary/30 transition-colors"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/leagues/${league.id}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors"
                          >
                            {league.name}
                          </Link>
                          <Badge
                            className={
                              statusColors[league.status] ??
                              "bg-muted text-muted-foreground"
                            }
                          >
                            {league.status.charAt(0).toUpperCase() +
                              league.status.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Your team: {league.teamName}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {league.status === "drafting" && (
                          <Link
                            href={`/leagues/${league.id}/draft`}
                            className="px-3 py-1.5 rounded-md bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 transition-colors"
                          >
                            Go to Draft
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Latest Races and Results */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Latest Race Results */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-foreground">
                Latest Results
              </h2>
              <Link
                href="/admin/results"
                className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
              >
                View all
              </Link>
            </div>
            {latestResults.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-sm">
                    No race results available yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {latestResults.slice(0, 8).map((result, idx) => (
                  <Card key={idx} className="border-border bg-card">
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {result.riderName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {result.riderTeam}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(result.raceDate, "MMM d")}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            {"🥇🥈🥉"[Math.min(result.position - 1, 2)] ||
                              `#${result.position}`}
                          </div>
                          <p className="text-xs text-accent font-medium">
                            {result.points} pts
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Completed Races */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-foreground">
                Completed Races
              </h2>
              <Link
                href="/admin/races"
                className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
              >
                View all
              </Link>
            </div>
            {latestRacesWithResults.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-sm">
                    No completed races yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {latestRacesWithResults.map((race) => (
                  <Card
                    key={race.raceId}
                    className="border-border bg-card hover:border-primary/30 transition-colors"
                  >
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground text-sm">
                            {race.raceName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {race.startDate
                              ? format(race.startDate, "MMM d, yyyy")
                              : "TBD"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              raceTypeColors[race.raceType] ||
                              raceTypeColors.low_priority_one_day
                            }`}
                          >
                            {raceTypeLabels[race.raceType] || race.raceType}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Upcoming Races Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-foreground">
              Upcoming Races
            </h2>
            <Link
              href="/admin/races"
              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              View all
            </Link>
          </div>
          {parentRaces.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  No upcoming races. Admin can add races from the calendar.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {parentRaces.map((race) => {
                const isMultiDay =
                  race.endDate && !isSameDay(race.startDate, race.endDate);
                const dateDisplay = isMultiDay
                  ? `${format(race.startDate, "MMM d")} - ${format(race.endDate!, "MMM d, yyyy")}`
                  : format(race.startDate, "MMM d, yyyy");

                return (
                  <Card
                    key={race.id}
                    className="border-border bg-card hover:border-primary/30 transition-colors"
                  >
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground text-sm">
                            {race.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {dateDisplay}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                            raceTypeColors[race.raceType] ||
                            raceTypeColors.low_priority_one_day
                          }`}
                        >
                          {raceTypeLabels[race.raceType] || race.raceType}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

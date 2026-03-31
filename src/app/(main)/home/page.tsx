import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { leagues, teams } from "@/db/schema/leagues";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { HomeRedirect } from "./home-redirect";

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

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
      <HomeRedirect leagueIds={myLeagues.map((l) => l.id)} />
      <div className="space-y-12">
        {/* League Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-foreground">Your Leagues</h2>
            <Link
              href="/leagues"
              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              View all
            </Link>
          </div>
          {myLeagues.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-8">
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
            <div className="space-y-4">
              {myLeagues.map((league) => (
                <Card
                  key={league.id}
                  className="border-border bg-card hover:border-primary/30 transition-colors"
                >
                  <CardContent className="py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
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
      </div>
    </div>
  );
}

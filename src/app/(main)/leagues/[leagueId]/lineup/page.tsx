import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getLeagueDetails } from "../actions"
import { getUpcomingRacesForLineup } from "@/lib/lineup-queries"

const raceTypeLabels: Record<string, string> = {
  grand_tour: "Grand Tour",
  high_priority_one_day: "High Priority",
  low_priority_one_day: "Low Priority",
  mini_tour: "Mini Tour",
  womens_grand_tour: "Women's GT",
  womens_one_day: "Women's One Day",
  world_championship: "World Championship",
}

interface PageProps {
  params: Promise<{ leagueId: string }>
}

export default async function LineupPage({ params }: PageProps) {
  const { leagueId: leagueIdStr } = await params
  const leagueId = parseInt(leagueIdStr, 10)

  if (isNaN(leagueId)) {
    notFound()
  }

  let details: Awaited<ReturnType<typeof getLeagueDetails>>
  try {
    details = await getLeagueDetails(leagueId)
  } catch {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-gray-600">
          League not found or you are not a member.{" "}
          <Link href="/leagues" className="text-blue-600 hover:underline">
            Back to Leagues
          </Link>
        </p>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-gray-600">
          League not found.{" "}
          <Link href="/leagues" className="text-blue-600 hover:underline">
            Back to Leagues
          </Link>
        </p>
      </div>
    )
  }

  const { league, userTeamId } = details

  if (league.status !== "active") {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <nav className="text-sm text-gray-500">
          <Link href="/leagues" className="hover:text-gray-700 hover:underline">Leagues</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">{league.name}</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-gray-900">Lineup</span>
        </nav>
        <p className="text-gray-600">
          Lineup selection is available once the league season is active.{" "}
          <Link href={`/leagues/${leagueId}`} className="text-blue-600 hover:underline">
            Back to League
          </Link>
        </p>
      </div>
    )
  }

  if (userTeamId == null) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <nav className="text-sm text-gray-500">
          <Link href="/leagues" className="hover:text-gray-700 hover:underline">Leagues</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">{league.name}</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-gray-900">Lineup</span>
        </nav>
        <p className="text-gray-600">
          You need a team to set lineups.{" "}
          <Link href={`/leagues/${leagueId}`} className="text-blue-600 hover:underline">
            Back to League
          </Link>
        </p>
      </div>
    )
  }

  const upcomingRaces = await getUpcomingRacesForLineup(leagueId, userTeamId)

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <nav className="text-sm text-gray-500">
        <Link href="/leagues" className="hover:text-gray-700 hover:underline">Leagues</Link>
        <span className="mx-2">&rsaquo;</span>
        <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">{league.name}</Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">Lineup</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Race Lineup</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select your starting lineup for upcoming races
        </p>
      </div>

      {upcomingRaces.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-gray-500">No upcoming races found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcomingRaces.map((race) => {
            const lineupCount = Number(race.lineupCount)
            const isSubmitted = lineupCount > 0
            return (
              <Link key={race.raceId} href={`/leagues/${leagueId}/lineup/${race.raceId}`}>
                <Card className={`hover:border-gray-400 transition-colors cursor-pointer ${isSubmitted ? "border-green-200 bg-green-50/50" : ""}`}>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{race.raceName}</p>
                          <Badge variant="outline" className="text-xs">
                            {raceTypeLabels[race.raceType] ?? race.raceType}
                          </Badge>
                          {isSubmitted ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Lineup set ({lineupCount}/{race.rosterSize ?? "?"})
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Not set
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Starts: {new Date(race.startDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {race.rosterSize && (
                            <span> &bull; Lineup size: {race.rosterSize} riders</span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm text-gray-400">&rarr;</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

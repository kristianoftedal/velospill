import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getLeagueDetails } from "./actions"
import { getLeagueStandingsWithOrders, getTeamRiderScores, getLeagueRacesWithScores } from "@/lib/scoring-queries"
import { getUpcomingRacesWithLineups, getRecentRaceResults, UpcomingRaceWithLineups, RecentRaceResult } from "@/lib/league-overview-queries"
import { getEligibleToReturnCount } from "@/lib/ir-queries"
import { StandingsClient } from "./standings/standings-client"
import { LeagueConfig } from "@/db/schema/leagues"

const statusColors: Record<string, string> = {
  setup: "bg-blue-100 text-blue-800",
  drafting: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  complete: "bg-gray-100 text-gray-800",
}

const raceTypeLabels: Record<string, string> = {
  grand_tour: "Grand Tour",
  high_priority_one_day: "Major One-Day",
  low_priority_one_day: "One-Day",
  mini_tour: "Mini Tour",
  womens_grand_tour: "Women's Grand Tour",
  womens_one_day: "Women's One-Day",
  world_championship: "World Championship",
}

const raceTypeColors: Record<string, string> = {
  grand_tour: "bg-blue-100 text-blue-800",
  high_priority_one_day: "bg-purple-100 text-purple-800",
  low_priority_one_day: "bg-gray-100 text-gray-800",
  mini_tour: "bg-green-100 text-green-800",
  womens_grand_tour: "bg-pink-100 text-pink-800",
  womens_one_day: "bg-rose-100 text-rose-800",
  world_championship: "bg-amber-100 text-amber-800",
}

interface PageProps {
  params: Promise<{ leagueId: string }>
}

export default async function LeagueDetailPage({ params }: PageProps) {
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

  const { league, teams, isOwner, userTeamId } = details

  // Fetch standings + overview data if league is active or complete
  let standings = null
  let myTeamRiders = null
  let races = null
  let upcomingRaces: UpcomingRaceWithLineups[] = []
  let recentResults: RecentRaceResult[] = []

  if ((league.status === "active" || league.status === "complete") && league.config) {
    const config = league.config as LeagueConfig
    const seasonYear = config.seasonYear

    ;[standings, myTeamRiders, races] = await Promise.all([
      getLeagueStandingsWithOrders(league.id, seasonYear),
      userTeamId != null
        ? getTeamRiderScores(userTeamId, league.id, seasonYear)
        : Promise.resolve(null),
      getLeagueRacesWithScores(league.id, seasonYear),
    ])
    const [fetchedUpcoming, fetchedRecent] = await Promise.all([
      getUpcomingRacesWithLineups(league.id),
      getRecentRaceResults(league.id),
    ])
    upcomingRaces = fetchedUpcoming
    recentResults = fetchedRecent
  } else if (league.status === "drafting") {
    upcomingRaces = await getUpcomingRacesWithLineups(league.id)
  }

  // Check IR return banner when league is active and user has a team
  let eligibleToReturnCount = 0
  if (league.status === "active" && userTeamId != null) {
    eligibleToReturnCount = await getEligibleToReturnCount(userTeamId, leagueId)
  }

  // Find user's team for standings highlighting
  const userStanding = standings && userTeamId != null
    ? standings.find((s) => s.teamId === userTeamId) ?? null
    : null
  const userTeamName = userStanding?.teamName ?? null

  const showActions = league.status === "active" || league.status === "drafting"

  // Show "View Draft" button only within 5 days of the draft completing
  // updatedAt is set to now() when status transitions, so for active leagues
  // it records when drafting -> active happened
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000
  const showViewDraft =
    league.status === "drafting" ||
    (league.status === "active" &&
      Date.now() - new Date(league.updatedAt).getTime() <= FIVE_DAYS_MS)

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/leagues" className="hover:text-gray-700 hover:underline">
          Leagues
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">{league.name}</span>
      </nav>

      {/* League Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{league.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Badge className={statusColors[league.status]}>
              {league.status.charAt(0).toUpperCase() + league.status.slice(1)}
            </Badge>
            <span className="text-sm text-gray-500">
              {teams.length} team{teams.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Actions — inline row of buttons, first content after header */}
      {showActions && (
        <div className="flex flex-wrap gap-2">
          {showViewDraft && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/leagues/${league.id}/draft`}>
                {league.status === "drafting" ? "Go to Draft" : "View Draft"}
              </Link>
            </Button>
          )}
          {league.status === "active" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/leagues/${league.id}/transfers`}>Transfers</Link>
            </Button>
          )}
          {league.status === "active" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/leagues/${league.id}/lineup`}>Set Lineup</Link>
            </Button>
          )}
          {league.status === "active" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/leagues/${league.id}/orders`}>Orders</Link>
            </Button>
          )}
          {league.status === "active" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/leagues/${league.id}/ir`}>Injured Reserve</Link>
            </Button>
          )}
          {league.status === "active" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/leagues/${league.id}/roster`}>Manage Roster</Link>
            </Button>
          )}
          {isOwner && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/leagues/${league.id}/owner`}>League Settings</Link>
            </Button>
          )}
        </div>
      )}

      {/* IR Return Banner — shown when player has eligible-to-return riders */}
      {league.status === "active" && eligibleToReturnCount > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-semibold text-red-800">Action required: IR return pending</p>
                <p className="text-sm text-red-700 mt-0.5">
                  You have riders eligible to return from IR. Transfers are blocked until resolved.
                </p>
              </div>
              <Button asChild variant="destructive" size="sm" className="shrink-0">
                <Link href={`/leagues/${leagueId}/ir`}>Go to IR page</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standings — show when league is active or complete */}
      {standings && (league.status === "active" || league.status === "complete") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">League Standings</CardTitle>
            <Link
              href={`/leagues/${league.id}/standings/history`}
              className="text-sm text-blue-600 hover:underline"
            >
              Season History →
            </Link>
          </CardHeader>
          <CardContent>
            <StandingsClient
              standings={standings}
              myTeamRiders={myTeamRiders}
              leagueId={league.id}
              userTeamName={userTeamName}
              userTeamId={userTeamId}
              races={races ?? []}
            />
          </CardContent>
        </Card>
      )}

      {/* Owner Settings — show for setup/complete leagues where showActions is false */}
      {!showActions && isOwner && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">League Settings</p>
                <p className="text-sm text-gray-500">
                  Manage races, invitations, and league status
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/leagues/${league.id}/owner`}>
                  Go to Settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Races section — show when active/drafting and there are upcoming races */}
      {(league.status === "active" || league.status === "drafting") && upcomingRaces.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Upcoming Races</h2>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {upcomingRaces.map((race) => (
                <AccordionItem key={race.raceId} value={String(race.raceId)}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <span className="font-medium">{race.raceName}</span>
                      <span className="text-sm text-gray-500">
                        {format(race.startDate, "d MMM yyyy")}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          raceTypeColors[race.raceType] ?? raceTypeColors.low_priority_one_day
                        }`}
                      >
                        {raceTypeLabels[race.raceType] ?? race.raceType}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {race.teams.map((team) => (
                        <div key={team.teamId} className="bg-gray-50 rounded-md p-3">
                          <p className="text-sm font-semibold text-gray-900 mb-1">
                            {team.teamName}
                          </p>
                          {team.riders.length === 0 ? (
                            <p className="text-xs text-muted-foreground">(no lineup set)</p>
                          ) : (
                            <p className="text-xs text-gray-600">
                              {team.riders.map((r) => r.riderName).join(", ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Recent Results section — show when active/complete and there are results */}
      {(league.status === "active" || league.status === "complete") && recentResults.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Recent Results</h2>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {recentResults.map((race) => {
                const totalPoints = race.results.reduce((sum: number, r) => sum + r.points, 0)
                return (
                  <AccordionItem key={race.raceId} value={String(race.raceId)}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <span className="font-medium">{race.raceName}</span>
                        <span className="text-sm text-gray-500">
                          {format(race.startDate, "d MMM yyyy")}
                        </span>
                        <span className="text-xs font-medium text-primary">
                          {totalPoints} pts
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1 pt-2">
                        {race.results.map((result, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 py-1.5 border-b last:border-0 border-gray-100"
                          >
                            <span className="text-sm font-medium text-gray-500 w-6 shrink-0">
                              {result.position}.
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-900">
                                {result.riderName}
                              </span>
                              <span className="text-xs text-gray-500 ml-1.5">
                                {result.riderTeam}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {result.fantasyTeamName}
                            </Badge>
                            <span className="text-xs font-semibold text-primary shrink-0 w-14 text-right">
                              {result.points} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Team Roster */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.userName}</TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {format(new Date(team.createdAt), "d MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    {team.userId === league.ownerId && (
                      <Badge variant="outline" className="text-xs">
                        League Owner
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

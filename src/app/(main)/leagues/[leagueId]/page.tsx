import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { StandingsClient } from "./standings/standings-client"
import { LeagueConfig } from "@/db/schema/leagues"

const statusColors: Record<string, string> = {
  setup: "bg-blue-100 text-blue-800",
  drafting: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  complete: "bg-gray-100 text-gray-800",
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

  // Fetch standings data if league is active or complete
  let standings = null
  let myTeamRiders = null
  let races = null
  
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
  }

  // Find user's team for standings highlighting
  const userStanding = standings && userTeamId != null
    ? standings.find((s) => s.teamId === userTeamId) ?? null
    : null
  const userTeamName = userStanding?.teamName ?? null

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

      {/* Standings — show when league is active or complete */}
      {standings && (league.status === "active" || league.status === "complete") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">League Standings</CardTitle>
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

      {/* Draft Link — show when league is in drafting status or has draft session */}
      {(league.status === "drafting" || league.status === "active") && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {league.status === "drafting" ? "Draft is ready!" : "Draft completed"}
                </p>
                <p className="text-sm text-gray-500">
                  {league.status === "drafting"
                    ? "Join the draft room to pick your riders"
                    : "View your draft picks and team roster"
                  }
                </p>
              </div>
              <Link
                href={`/leagues/${league.id}/draft`}
                className="px-4 py-2 rounded-md bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 transition-colors"
              >
                {league.status === "drafting" ? "Go to Draft" : "View Draft"}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transfers Link — show when league is active */}
      {league.status === "active" && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Transfers</p>
                <p className="text-sm text-gray-500">
                  Browse free agents and submit transfer bids
                </p>
              </div>
              <Link
                href={`/leagues/${league.id}/transfers`}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Transfers
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Race Lineup Link — show when league is active */}
      {league.status === "active" && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Race Lineup</p>
                <p className="text-sm text-gray-500">
                  Set your starting lineup for upcoming races
                </p>
              </div>
              <Link
                href={`/leagues/${league.id}/lineup`}
                className="px-4 py-2 rounded-md bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                Set Lineup
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategic Orders Link — show when league is active */}
      {league.status === "active" && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Strategic Orders</p>
                <p className="text-sm text-gray-500">
                  Deploy orders to boost your riders or sabotage opponents
                </p>
              </div>
              <Link
                href={`/leagues/${league.id}/orders`}
                className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                Go to Orders
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Owner Settings Link — owner only */}
      {isOwner && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">League Settings</p>
                <p className="text-sm text-gray-500">
                  Manage races, invitations, and league status
                </p>
              </div>
              <Link
                href={`/leagues/${league.id}/owner`}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Go to Settings
              </Link>
            </div>
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

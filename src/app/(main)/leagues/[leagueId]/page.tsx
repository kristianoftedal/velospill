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
import { InviteSection, LeagueStatusControl } from "./league-client"
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

  const { league, teams, isOwner } = details
  const config = league.config as LeagueConfig

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
            <span className="text-sm text-gray-500">Season {config.seasonYear}</span>
            {config.draftDate && (
              <span className="text-sm text-gray-500">
                Draft: {format(new Date(config.draftDate), "d MMM yyyy")}
              </span>
            )}
            <span className="text-sm text-gray-500">
              {teams.length}/{config.teamMax} teams
            </span>
          </div>
        </div>
      </div>

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

      {/* Standings Link — show when league is active or complete */}
      {(league.status === "active" || league.status === "complete") && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">League Standings</p>
                <p className="text-sm text-gray-500">
                  View team rankings and race results
                </p>
              </div>
              <Link
                href={`/leagues/${league.id}/standings`}
                className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
              >
                View Standings
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
                  Browse free agents and submit waiver wire bids
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

      {/* Invite Link — owner only */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invite Link</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteSection
              inviteCode={league.inviteCode}
              expiresAt={
                league.inviteExpiresAt
                  ? league.inviteExpiresAt.toISOString()
                  : null
              }
            />
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

      {/* League Management — owner only */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">League Management</CardTitle>
          </CardHeader>
          <CardContent>
            <LeagueStatusControl
              leagueId={league.id}
              currentStatus={league.status}
              teamCount={teams.length}
              teamMin={config.teamMin || 2}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

"use client"

import Link from "next/link"
import { format } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { LeagueStanding, TeamRiderScore, LeagueRaceScore } from "@/lib/scoring-queries"

interface StandingsClientProps {
  standings: LeagueStanding[]
  myTeamRiders: TeamRiderScore[] | null
  leagueId: number
  userTeamName: string | null
  userTeamId: number | null
  races: LeagueRaceScore[]
}

function getRankStyle(rank: number): string {
  if (rank === 1) return "text-yellow-600 font-bold"
  if (rank === 2) return "text-gray-500 font-semibold"
  if (rank === 3) return "text-amber-700 font-semibold"
  return ""
}

function formatRaceType(raceType: string): string {
  return raceType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function StandingsClient({
  standings,
  myTeamRiders,
  userTeamId,
  leagueId,
  races,
}: StandingsClientProps) {
  return (
    <Tabs defaultValue="leaderboard">
      <TabsList>
        <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        <TabsTrigger value="my-team">My Team</TabsTrigger>
        <TabsTrigger value="race-results">Race Results</TabsTrigger>
      </TabsList>

      <TabsContent value="leaderboard">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Team Name</TableHead>
              <TableHead className="text-right">Total Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((standing) => (
              <TableRow
                key={standing.teamId}
                className={
                  standing.teamId === userTeamId ? "bg-blue-50" : undefined
                }
              >
                <TableCell className={getRankStyle(standing.rank)}>
                  {standing.rank}
                </TableCell>
                <TableCell className="font-medium">
                  {standing.teamName}
                </TableCell>
                <TableCell className="text-right">
                  {standing.totalPoints}
                </TableCell>
              </TableRow>
            ))}
            {standings.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-gray-500 py-8"
                >
                  No teams in this league yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="my-team">
        {myTeamRiders === null ? (
          <p className="text-gray-500 py-4">
            You don&apos;t have a team in this league.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rider Name</TableHead>
                <TableHead>Pro Team</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead className="text-right">Total Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myTeamRiders.map((rider) => (
                <TableRow key={rider.riderId}>
                  <TableCell className="font-medium">
                    {rider.riderName}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {rider.riderTeam}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{rider.gender}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {rider.totalPoints}
                  </TableCell>
                </TableRow>
              ))}
              {myTeamRiders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-gray-500 py-8"
                  >
                    No riders drafted yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="race-results">
        {races.length === 0 ? (
          <p className="text-gray-500 py-4">No race results yet this season.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Race Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">League Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {races.map((race) => (
                <TableRow key={race.raceId}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/leagues/${leagueId}/standings/${race.raceId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {race.raceName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {formatRaceType(race.raceType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {format(race.startDate, "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    {race.totalLeaguePoints}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>
    </Tabs>
  )
}

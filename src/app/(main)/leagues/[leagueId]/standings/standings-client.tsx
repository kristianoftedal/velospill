"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ChevronRight, ChevronDown } from "lucide-react"
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
import { LeagueStanding, TeamRiderScore, LeagueRaceScoreGrouped, StageScore } from "@/lib/scoring-queries"

interface StandingsClientProps {
  standings: LeagueStanding[]
  myTeamRiders: TeamRiderScore[] | null
  leagueId: number
  userTeamName: string | null
  userTeamId: number | null
  races: LeagueRaceScoreGrouped[]
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
  const [expandedRaces, setExpandedRaces] = useState<Set<number>>(new Set())

  function toggleRace(raceId: number) {
    setExpandedRaces((prev) => {
      const next = new Set(prev)
      if (next.has(raceId)) next.delete(raceId)
      else next.add(raceId)
      return next
    })
  }

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
                  <Link
                    href={`/leagues/${leagueId}/teams/${standing.teamId}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {standing.teamName}
                  </Link>
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
              {races.map((race) => {
                if (race.isMultiStage) {
                  const isExpanded = expandedRaces.has(race.raceId)
                  return (
                    <>
                      <TableRow
                        key={race.raceId}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleRace(race.raceId)}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                            )}
                            {race.raceName}
                          </span>
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
                      {isExpanded && (
                        <TableRow key={`${race.raceId}-expanded`}>
                          <TableCell colSpan={4} className="p-0 bg-gray-50">
                            <div className="py-2">
                              {race.stages.map((stage: StageScore) => (
                                <div
                                  key={stage.raceId}
                                  className="flex items-center justify-between px-4 py-1.5 hover:bg-gray-100"
                                >
                                  <div className="flex items-center gap-3 pl-8">
                                    {stage.hasResults ? (
                                      <Link
                                        href={`/leagues/${leagueId}/standings/${stage.raceId}`}
                                        className="text-blue-600 hover:underline text-sm"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {stage.raceName}
                                      </Link>
                                    ) : (
                                      <span className="text-gray-400 text-sm">
                                        {stage.raceName}
                                      </span>
                                    )}
                                    {stage.hasResults ? (
                                      <Badge variant="secondary" className="text-xs">Done</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">Pending</Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-700 pr-4">
                                    {stage.totalLeaguePoints}
                                  </div>
                                </div>
                              ))}
                              {race.endOfTourPoints > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <div className="px-4 pl-12 py-1">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-2 pb-1">
                                      Final Classifications
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-between px-4 py-1.5 hover:bg-gray-100">
                                    <div className="pl-8">
                                      <Link
                                        href={`/leagues/${leagueId}/standings/${race.raceId}`}
                                        className="text-blue-600 hover:underline text-sm"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {race.raceName}
                                      </Link>
                                    </div>
                                    <div className="text-sm text-gray-700 pr-4">
                                      {race.endOfTourPoints}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                }

                // One-day race — flat row unchanged
                return (
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
                )
              })}
            </TableBody>
          </Table>
        )}
      </TabsContent>
    </Tabs>
  )
}

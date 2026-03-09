"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StandingsHistory } from "@/lib/scoring-queries"

interface HistoryClientProps {
  history: StandingsHistory
  leagueId: number
  userTeamId: number | null
}

// CSS chart color variables (cycling for teams beyond 5)
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function HistoryClient({ history, userTeamId }: HistoryClientProps) {
  if (history.races.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-gray-500">
            No races have been completed yet. Check back after the first results are posted.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Build chart config: one entry per team
  const chartConfig: ChartConfig = {}
  history.teams.forEach((team, idx) => {
    chartConfig[`team_${team.teamId}`] = {
      label: team.teamName,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }
  })

  // Build chart data: one object per race
  const chartData = history.races.map((race) => {
    const point: Record<string, number | string> = { raceName: race.raceName }
    for (const team of history.teams) {
      point[`team_${team.teamId}`] = team.cumulativeByRace[race.raceId] ?? 0
    }
    return point
  })

  return (
    <div className="space-y-6">
      {/* Line Chart Card */}
      <Card>
        <CardHeader>
          <CardTitle>Points Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[320px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="raceName"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(name: string) => name.split(" ")[0]}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                {history.teams.map((team, idx) => {
                  const isOwnTeam = team.teamId === userTeamId
                  const color = CHART_COLORS[idx % CHART_COLORS.length]
                  return (
                    <Line
                      key={team.teamId}
                      type="monotone"
                      dataKey={`team_${team.teamId}`}
                      name={team.teamName}
                      stroke={color}
                      strokeWidth={isOwnTeam ? 3 : 1.5}
                      dot={isOwnTeam}
                      strokeOpacity={isOwnTeam ? 1 : 0.75}
                    />
                  )
                })}
              </LineChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Race-by-Race Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>Race-by-Race Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 min-w-[140px]">
                    Team
                  </TableHead>
                  {history.races.map((race) => (
                    <TableHead
                      key={race.raceId}
                      className="text-center whitespace-nowrap"
                      title={race.raceName}
                    >
                      {race.raceName.split(" ")[0]}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-semibold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.teams.map((team) => {
                  const isOwnTeam = team.teamId === userTeamId
                  return (
                    <TableRow
                      key={team.teamId}
                      className={isOwnTeam ? "bg-blue-50" : undefined}
                    >
                      <TableCell
                        className="sticky left-0 z-10 font-medium min-w-[140px]"
                        style={{ backgroundColor: isOwnTeam ? "rgb(239 246 255)" : "white" }}
                      >
                        {team.teamName}
                      </TableCell>
                      {history.races.map((race) => {
                        const pts = team.pointsByRace[race.raceId] ?? 0
                        return (
                          <TableCell key={race.raceId} className="text-center">
                            {pts === 0 ? "—" : pts}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-center font-semibold">
                        {team.totalPoints}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

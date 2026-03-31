"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RaceScoreEntryWithOrders, AllRaceResult } from "@/lib/scoring-queries"

type FilterMode = "my-team" | "league" | "all"

interface RaceBreakdownClientProps {
  regularEntries: RaceScoreEntryWithOrders[]
  bonusEntries: RaceScoreEntryWithOrders[]
  allRaceResults: AllRaceResult[]
  hasOrders: boolean
  counterResults: { attackOrderId: number; counterOrderId: number; description: string }[]
  userTeamId: number | null
}

export function RaceBreakdownClient({
  regularEntries,
  bonusEntries,
  allRaceResults,
  hasOrders,
  counterResults,
  userTeamId,
}: RaceBreakdownClientProps) {
  const [filter, setFilter] = useState<FilterMode>("league")

  // Filter entries based on mode
  const filteredRegularEntries = filter === "my-team"
    ? regularEntries.filter((e) => e.teamId === userTeamId)
    : regularEntries

  const filteredBonusEntries = filter === "my-team"
    ? bonusEntries.filter((e) => e.teamId === userTeamId)
    : bonusEntries

  // Compute per-team subtotals from filtered entries
  const allFiltered = [...filteredRegularEntries, ...filteredBonusEntries]
  const teamTotals = new Map<number, { teamName: string; basePoints: number; adjustedPoints: number }>()
  for (const entry of allFiltered) {
    const existing = teamTotals.get(entry.teamId)
    if (existing) {
      existing.basePoints += entry.points
      existing.adjustedPoints += entry.adjustedPoints
    } else {
      teamTotals.set(entry.teamId, {
        teamName: entry.teamName,
        basePoints: entry.points,
        adjustedPoints: entry.adjustedPoints,
      })
    }
  }
  const sortedTeamTotals = Array.from(teamTotals.values()).sort(
    (a, b) => b.adjustedPoints - a.adjustedPoints
  )

  return (
    <div className="space-y-6">
      {/* Filter buttons */}
      <div className="flex gap-2">
        <Button
          variant={filter === "my-team" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("my-team")}
          disabled={userTeamId == null}
        >
          My Team
        </Button>
        <Button
          variant={filter === "league" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("league")}
        >
          Riders in League
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All Riders
        </Button>
      </div>

      {/* "All Riders" mode — show raw race results grouped by category */}
      {filter === "all" ? (
        <AllRidersView results={allRaceResults} />
      ) : (
        <>
          {/* Scored Riders table (league / my-team mode) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {filter === "my-team" ? "My Team's Scored Riders" : "Scored Riders"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Position</TableHead>
                    <TableHead>Rider</TableHead>
                    <TableHead>Pro Team</TableHead>
                    <TableHead>Fantasy Team</TableHead>
                    <TableHead className="text-right">Base Pts</TableHead>
                    {hasOrders && (
                      <TableHead className="text-right">Adjusted Pts</TableHead>
                    )}
                    {hasOrders && (
                      <TableHead>Order Effect</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegularEntries.map((entry) => (
                    <TableRow
                      key={`${entry.riderId}-${entry.position}`}
                      className={entry.isCountered ? "bg-yellow-50" : undefined}
                    >
                      <TableCell className="font-medium">{entry.position}</TableCell>
                      <TableCell className="font-medium">{entry.riderName}</TableCell>
                      <TableCell className="text-gray-600">{entry.riderTeam}</TableCell>
                      <TableCell>{entry.teamName}</TableCell>
                      <TableCell className="text-right">{entry.points}</TableCell>
                      {hasOrders && (
                        <TableCell className="text-right font-medium">
                          {entry.adjustedPoints !== entry.points ? (
                            <span className={entry.adjustedPoints > entry.points ? "text-green-700" : "text-red-600"}>
                              {entry.adjustedPoints}
                            </span>
                          ) : (
                            entry.adjustedPoints
                          )}
                        </TableCell>
                      )}
                      {hasOrders && (
                        <TableCell>
                          {entry.orderEffect && (
                            <OrderEffectBadge effect={entry.orderEffect} isCountered={entry.isCountered} />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filteredRegularEntries.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={hasOrders ? 7 : 5}
                        className="text-center text-gray-500 py-8"
                      >
                        {filter === "my-team"
                          ? "None of your riders scored in this race."
                          : "No drafted riders scored in this race."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Bonus rows */}
          {hasOrders && filteredBonusEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Bonuses</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Fantasy Team</TableHead>
                      <TableHead className="text-right">Bonus Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBonusEntries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <span className="text-sm">{entry.riderName}</span>
                          <Badge variant="secondary" className="ml-2 text-xs bg-amber-100 text-amber-800">
                            Bonus
                          </Badge>
                        </TableCell>
                        <TableCell>{entry.teamName}</TableCell>
                        <TableCell className="text-right font-medium text-green-700">
                          +{entry.adjustedPoints}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Team points summary */}
          {sortedTeamTotals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Team Points Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fantasy Team</TableHead>
                      {hasOrders ? (
                        <>
                          <TableHead className="text-right">Base Points</TableHead>
                          <TableHead className="text-right">Adjusted Points</TableHead>
                        </>
                      ) : (
                        <TableHead className="text-right">Points from this Race</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTeamTotals.map((teamTotal) => (
                      <TableRow key={teamTotal.teamName}>
                        <TableCell className="font-medium">{teamTotal.teamName}</TableCell>
                        {hasOrders ? (
                          <>
                            <TableCell className="text-right text-gray-500">{teamTotal.basePoints}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {teamTotal.adjustedPoints !== teamTotal.basePoints ? (
                                <span className={teamTotal.adjustedPoints > teamTotal.basePoints ? "text-green-700" : "text-red-600"}>
                                  {teamTotal.adjustedPoints}
                                </span>
                              ) : (
                                teamTotal.adjustedPoints
                              )}
                            </TableCell>
                          </>
                        ) : (
                          <TableCell className="text-right">{teamTotal.basePoints}</TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Counter results */}
          {hasOrders && counterResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Counter Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {counterResults.map((cr, idx) => (
                  <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
                    <span className="font-medium text-blue-800">Counter (returned):</span>{" "}
                    <span className="text-blue-700">{cr.description}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ─── "All Riders" view — grouped by category ────────────────────────────────

const categoryDisplayNames: Record<string, string> = {
  "finish": "Race Finish",
  "stage_finish": "Stage Finish",
  "sprint": "Sprint",
  "sprint_giro": "Sprint (Giro)",
  "mountain_cc_hcx2_af": "Mountain: CC/HCx2/AF",
  "mountain_hc": "Mountain: HC",
  "mountain_1cat": "Mountain: 1st Cat",
  "mountain_2cat": "Mountain: 2nd Cat",
  "mountain_3_4cat": "Mountain: 3rd/4th Cat",
  "mountain_highest": "Mountain: Highest",
  "mountain_2nd_highest": "Mountain: 2nd Highest",
  "mountain_1_2cat": "Mountain: 1st/2nd Cat",
  "jersey_gc": "Jersey: GC",
  "jersey_points": "Jersey: Points",
  "jersey_kom": "Jersey: KOM",
  "jersey_combative": "Jersey: Combative",
  "ttt": "Team Time Trial",
  "end_gc": "End: GC",
  "end_points": "End: Points",
  "end_kom": "End: KOM",
  "end_youth": "End: Youth",
  "end_combative": "End: Combative",
  "end_team": "End: Team",
  "end_other": "End: Other",
}

function AllRidersView({ results }: { results: AllRaceResult[] }) {
  // Group by (category, instance)
  type Group = { category: string; instance: number; instanceLabel: string | null; results: AllRaceResult[] }
  const groups: Group[] = []

  for (const r of results) {
    const existing = groups.find((g) => g.category === r.category && g.instance === r.instance)
    if (existing) {
      existing.results.push(r)
    } else {
      groups.push({
        category: r.category,
        instance: r.instance,
        instanceLabel: r.instanceLabel,
        results: [r],
      })
    }
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          No results for this race yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const catName = categoryDisplayNames[group.category] || group.category
        const showInstance = group.instance > 1 || group.instanceLabel
        return (
          <Card key={`${group.category}-${group.instance}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {catName}
                {showInstance && (
                  <>
                    <Badge variant="outline" className="text-xs">#{group.instance}</Badge>
                    {group.instanceLabel && (
                      <span className="text-sm font-normal text-gray-500">{group.instanceLabel}</span>
                    )}
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Pos</TableHead>
                    <TableHead>Rider</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.results.map((r) => (
                    <TableRow key={`${r.riderId}-${r.position}-${group.category}-${group.instance}`}>
                      <TableCell className="font-medium">{r.position}</TableCell>
                      <TableCell className="font-medium">{r.riderName}</TableCell>
                      <TableCell className="text-gray-600">{r.riderTeam}</TableCell>
                      <TableCell className="text-right">{r.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Helper component ──────────────────────────────────────────────────────────

function OrderEffectBadge({ effect, isCountered }: { effect: string; isCountered: boolean }) {
  const isAttack = effect.toLowerCase().includes("0 pts") || effect.toLowerCase().includes("half pts")
  const isBoost = effect.toLowerCase().includes("x2") || effect.toLowerCase().includes("x3") || effect.toLowerCase().includes("x1.5")

  let className = "text-xs "
  if (isCountered) {
    className += "bg-blue-100 text-blue-800 border-blue-300"
  } else if (isAttack) {
    className += "bg-red-100 text-red-800 border-red-300"
  } else if (isBoost) {
    className += "bg-green-100 text-green-800 border-green-300"
  } else {
    className += "bg-purple-100 text-purple-800 border-purple-300"
  }

  return (
    <Badge variant="outline" className={className}>
      {effect}
    </Badge>
  )
}

import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { races } from "@/db/schema/races"
import { eq } from "drizzle-orm"
import { getLeagueDetails } from "../../actions"
import { getRaceScoreBreakdownWithOrders } from "@/lib/scoring-queries"
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

interface PageProps {
  params: Promise<{ leagueId: string; raceId: string }>
}

export default async function RaceBreakdownPage({ params }: PageProps) {
  const { leagueId: leagueIdStr, raceId: raceIdStr } = await params
  const leagueId = parseInt(leagueIdStr, 10)
  const raceId = parseInt(raceIdStr, 10)

  if (isNaN(leagueId) || isNaN(raceId)) {
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

  const { league } = details

  // Guard: breakdown only available for active or complete leagues
  if (league.status !== "active" && league.status !== "complete") {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <nav className="text-sm text-gray-500">
          <Link href="/leagues" className="hover:text-gray-700 hover:underline">
            Leagues
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <Link
            href={`/leagues/${leagueId}`}
            className="hover:text-gray-700 hover:underline"
          >
            {league.name}
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <Link
            href={`/leagues/${leagueId}/standings`}
            className="hover:text-gray-700 hover:underline"
          >
            Standings
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-gray-900">Race Breakdown</span>
        </nav>
        <p className="text-gray-600">
          Standings are available once the season is active.{" "}
          <Link
            href={`/leagues/${leagueId}`}
            className="text-blue-600 hover:underline"
          >
            Back to League
          </Link>
        </p>
      </div>
    )
  }

  // Fetch race info and breakdown results in parallel
  const [raceRows, breakdownResult] = await Promise.all([
    db.select().from(races).where(eq(races.id, raceId)).limit(1),
    getRaceScoreBreakdownWithOrders(raceId, leagueId),
  ])

  const race = raceRows[0]
  if (!race) {
    notFound()
  }

  const { entries: breakdown, counterResults, hasOrders } = breakdownResult

  // Compute per-team subtotals using adjusted points
  const teamTotals = new Map<number, { teamName: string; basePoints: number; adjustedPoints: number }>()
  for (const entry of breakdown) {
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

  // Separate regular entries from bonus rows
  const regularEntries = breakdown.filter((e) => !e.isBonus)
  const bonusEntries = breakdown.filter((e) => e.isBonus)

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/leagues" className="hover:text-gray-700 hover:underline">
          Leagues
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <Link
          href={`/leagues/${leagueId}`}
          className="hover:text-gray-700 hover:underline"
        >
          {league.name}
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <Link
          href={`/leagues/${leagueId}/standings`}
          className="hover:text-gray-700 hover:underline"
        >
          Standings
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">{race.name}</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{race.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Race Score Breakdown</p>
      </div>

      {/* Rider results table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scored Riders</CardTitle>
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
              {regularEntries.map((entry) => (
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
              {regularEntries.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={hasOrders ? 7 : 5}
                    className="text-center text-gray-500 py-8"
                  >
                    No drafted riders scored in this race.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bonus rows (Gammel Venn, admin bonus points) */}
      {hasOrders && bonusEntries.length > 0 && (
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
                {bonusEntries.map((entry, idx) => (
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

      {/* Per-team subtotals */}
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

      {/* Active orders and counter results */}
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

      {/* Back link */}
      <div>
        <Link
          href={`/leagues/${leagueId}/standings`}
          className="text-blue-600 hover:underline text-sm"
        >
          &larr; Back to Standings
        </Link>
      </div>
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

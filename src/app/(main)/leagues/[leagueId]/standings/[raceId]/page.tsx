import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { races } from "@/db/schema/races"
import { eq } from "drizzle-orm"
import { getLeagueDetails } from "../../actions"
import { getRaceScoreBreakdown } from "@/lib/scoring-queries"
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
  const [raceRows, breakdown] = await Promise.all([
    db.select().from(races).where(eq(races.id, raceId)).limit(1),
    getRaceScoreBreakdown(raceId, leagueId),
  ])

  const race = raceRows[0]
  if (!race) {
    notFound()
  }

  // Compute per-team subtotals
  const teamTotals = new Map<number, { teamName: string; totalPoints: number }>()
  for (const entry of breakdown) {
    const existing = teamTotals.get(entry.teamId)
    if (existing) {
      existing.totalPoints += entry.points
    } else {
      teamTotals.set(entry.teamId, {
        teamName: entry.teamName,
        totalPoints: entry.points,
      })
    }
  }
  const sortedTeamTotals = Array.from(teamTotals.values()).sort(
    (a, b) => b.totalPoints - a.totalPoints
  )

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
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.map((entry) => (
                <TableRow key={`${entry.riderId}-${entry.position}`}>
                  <TableCell className="font-medium">{entry.position}</TableCell>
                  <TableCell className="font-medium">{entry.riderName}</TableCell>
                  <TableCell className="text-gray-600">{entry.riderTeam}</TableCell>
                  <TableCell>{entry.teamName}</TableCell>
                  <TableCell className="text-right">{entry.points}</TableCell>
                </TableRow>
              ))}
              {breakdown.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
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
                  <TableHead className="text-right">Points from this Race</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTeamTotals.map((teamTotal) => (
                  <TableRow key={teamTotal.teamName}>
                    <TableCell className="font-medium">{teamTotal.teamName}</TableCell>
                    <TableCell className="text-right">{teamTotal.totalPoints}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

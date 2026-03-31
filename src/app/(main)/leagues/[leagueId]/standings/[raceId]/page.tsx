import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { races } from "@/db/schema/races"
import { eq } from "drizzle-orm"
import { getLeagueDetails } from "../../actions"
import { getRaceScoreBreakdownWithOrders, getAllRaceResults } from "@/lib/scoring-queries"
import { RaceBreakdownClient } from "./race-breakdown-client"

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

  const { league, userTeamId } = details

  if (league.status !== "active" && league.status !== "complete") {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <nav className="text-sm text-gray-500">
          <Link href="/leagues" className="hover:text-gray-700 hover:underline">Leagues</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">{league.name}</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}/standings`} className="hover:text-gray-700 hover:underline">Standings</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-gray-900">Race Breakdown</span>
        </nav>
        <p className="text-gray-600">
          Standings are available once the season is active.{" "}
          <Link href={`/leagues/${leagueId}`} className="text-blue-600 hover:underline">Back to League</Link>
        </p>
      </div>
    )
  }

  const [raceRows, breakdownResult, allResults] = await Promise.all([
    db.select().from(races).where(eq(races.id, raceId)).limit(1),
    getRaceScoreBreakdownWithOrders(raceId, leagueId),
    getAllRaceResults(raceId),
  ])

  const race = raceRows[0]
  if (!race) {
    notFound()
  }

  const { entries: breakdown, counterResults, hasOrders } = breakdownResult
  const regularEntries = breakdown.filter((e) => !e.isBonus)
  const bonusEntries = breakdown.filter((e) => e.isBonus)

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/leagues" className="hover:text-gray-700 hover:underline">Leagues</Link>
        <span className="mx-2">&rsaquo;</span>
        <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">{league.name}</Link>
        <span className="mx-2">&rsaquo;</span>
        <Link href={`/leagues/${leagueId}/standings`} className="hover:text-gray-700 hover:underline">Standings</Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">{race.name}</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{race.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Race Score Breakdown</p>
      </div>

      <RaceBreakdownClient
        regularEntries={regularEntries}
        bonusEntries={bonusEntries}
        allRaceResults={allResults}
        hasOrders={hasOrders}
        counterResults={counterResults}
        userTeamId={userTeamId}
      />

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

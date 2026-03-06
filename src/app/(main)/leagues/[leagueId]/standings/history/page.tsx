import Link from "next/link"
import { notFound } from "next/navigation"
import { getLeagueDetails } from "../../actions"
import { getStandingsHistory } from "@/lib/scoring-queries"
import { LeagueConfig } from "@/db/schema/leagues"
import { HistoryClient } from "./history-client"

interface PageProps {
  params: Promise<{ leagueId: string }>
}

export default async function StandingsHistoryPage({ params }: PageProps) {
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

  const { league, userTeamId } = details

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
          <span className="text-gray-900">Season History</span>
        </nav>
        <p className="text-gray-600">
          Standings history is available once the season is active.{" "}
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

  const config = league.config as LeagueConfig
  const seasonYear = config.seasonYear

  const history = await getStandingsHistory(leagueId, seasonYear)

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
        <span className="text-gray-900">Season History</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Season History</h1>
        <p className="text-sm text-gray-500 mt-1">Season {seasonYear}</p>
      </div>

      <HistoryClient
        history={history}
        leagueId={leagueId}
        userTeamId={userTeamId}
      />
    </div>
  )
}

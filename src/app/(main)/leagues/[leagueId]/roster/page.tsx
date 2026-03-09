import Link from "next/link"
import { notFound } from "next/navigation"
import { getLeagueDetails } from "../actions"
import { getTeamRoster } from "@/lib/transfer-queries"
import { RosterClient } from "./roster-client"

interface PageProps {
  params: Promise<{ leagueId: string }>
}

export default async function RosterPage({ params }: PageProps) {
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

  // Guard: roster management only available for active leagues
  if (league.status !== "active") {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <nav className="text-sm text-gray-500">
          <Link href="/leagues" className="hover:text-gray-700 hover:underline">
            Leagues
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">
            {league.name}
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-gray-900">Manage Roster</span>
        </nav>
        <p className="text-gray-600">
          Roster management is only available for active leagues.{" "}
          <Link href={`/leagues/${leagueId}`} className="text-blue-600 hover:underline">
            Back to League
          </Link>
        </p>
      </div>
    )
  }

  // Guard: user must have a team
  if (userTeamId == null) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <nav className="text-sm text-gray-500">
          <Link href="/leagues" className="hover:text-gray-700 hover:underline">
            Leagues
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">
            {league.name}
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-gray-900">Manage Roster</span>
        </nav>
        <p className="text-gray-600">
          You need a team to manage your roster.{" "}
          <Link href={`/leagues/${leagueId}`} className="text-blue-600 hover:underline">
            Back to League
          </Link>
        </p>
      </div>
    )
  }

  const roster = await getTeamRoster(userTeamId, leagueId)

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/leagues" className="hover:text-gray-700 hover:underline">
          Leagues
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">
          {league.name}
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">Manage Roster</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manage Roster</h1>
        <p className="text-sm text-gray-500 mt-1">
          Drop a rider from your active roster. This is immediate and permanent.
        </p>
      </div>

      <RosterClient roster={roster} leagueId={leagueId} />
    </div>
  )
}

import Link from "next/link"
import { notFound } from "next/navigation"
import { getLeagueDetails } from "../actions"
import {
  getTeamRoster,
  getTeamBids,
  getActiveTransferWindow,
  getFreeAgents,
} from "@/lib/transfer-queries"
import { TransferForm } from "./transfer-form"

interface PageProps {
  params: Promise<{ leagueId: string }>
}

export default async function TransfersPage({ params }: PageProps) {
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

  // Guard: transfers only available for active leagues
  if (league.status !== "active") {
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
          <span className="text-gray-900">Transfers</span>
        </nav>
        <p className="text-gray-600">
          Transfers are available once the league season is active.{" "}
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

  // Guard: user must be a team member to submit bids
  if (userTeamId == null) {
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
          <span className="text-gray-900">Transfers</span>
        </nav>
        <p className="text-gray-600">
          You need a team to submit transfer bids.{" "}
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

  // Parallel data fetch
  const [roster, bids, activeWindow, freeAgentsMen, freeAgentsWomen] = await Promise.all([
    getTeamRoster(userTeamId, leagueId),
    getTeamBids(userTeamId, leagueId),
    getActiveTransferWindow(leagueId),
    getFreeAgents(leagueId, "M"),
    getFreeAgents(leagueId, "F"),
  ])

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
        <span className="text-gray-900">Transfers</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Transfers</h1>
        <p className="text-sm text-gray-500 mt-1">
          Submit waiver wire bids to swap riders on your team
        </p>
      </div>

      <TransferForm
        roster={roster}
        pendingBids={bids}
        activeWindow={activeWindow}
        leagueId={leagueId}
        freeAgentsMen={freeAgentsMen}
        freeAgentsWomen={freeAgentsWomen}
      />
    </div>
  )
}

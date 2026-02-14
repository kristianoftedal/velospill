import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { orderTypes } from "@/db/schema/config"
import { asc } from "drizzle-orm"
import { getLeagueDetails } from "../actions"
import { LeagueConfig } from "@/db/schema/leagues"
import {
  getUpcomingRacesForLeague,
  getTeamOrders,
  getTeamRidersForOrders,
  getOpponentRiders,
  getOpponentTeams,
} from "@/lib/order-queries"
import { OrdersClient } from "./orders-client"
import { submitOrder, cancelOrder } from "./actions"

interface PageProps {
  params: Promise<{ leagueId: string }>
}

export default async function OrdersPage({ params }: PageProps) {
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
  const config = league.config as LeagueConfig

  // Guard: orders only available for active leagues
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
          <span className="text-gray-900">Orders</span>
        </nav>
        <p className="text-gray-600">
          Orders are only available for active leagues.{" "}
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

  if (!userTeamId) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-gray-600">
          You do not have a team in this league.{" "}
          <Link href={`/leagues/${leagueId}`} className="text-blue-600 hover:underline">
            Back to League
          </Link>
        </p>
      </div>
    )
  }

  const seasonYear = config.seasonYear

  // Parallel fetch all needed data
  const [upcomingRaces, teamOrders, allOrderTypes, teamRiders, opponentRiders, opponentTeams] =
    await Promise.all([
      getUpcomingRacesForLeague(leagueId, seasonYear),
      getTeamOrders(userTeamId, leagueId),
      db.select().from(orderTypes).orderBy(asc(orderTypes.displayName)),
      getTeamRidersForOrders(userTeamId, leagueId),
      getOpponentRiders(leagueId, userTeamId),
      getOpponentTeams(leagueId, userTeamId),
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
        <span className="text-gray-900">Orders</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Strategic Orders</h1>
        <p className="text-sm text-gray-500 mt-1">
          Deploy strategic orders to boost your riders or counter your opponents
        </p>
      </div>

      <OrdersClient
        leagueId={leagueId}
        upcomingRaces={upcomingRaces}
        teamOrders={teamOrders}
        allOrderTypes={allOrderTypes}
        teamRiders={teamRiders}
        opponentRiders={opponentRiders}
        opponentTeams={opponentTeams}
        submitOrder={submitOrder}
        cancelOrder={cancelOrder}
      />
    </div>
  )
}

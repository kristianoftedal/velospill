import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { races } from "@/db/schema/races"
import { eq } from "drizzle-orm"
import { getLeagueDetails } from "../../actions"
import { getTeamRoster } from "@/lib/transfer-queries"
import { getLineup, getRosterLimitForRace } from "@/lib/lineup-queries"
import { getLineupPeriods, getEditableLineupPeriods } from "@/lib/lineup-periods"
import { LineupForm } from "./lineup-form"

interface PageProps {
  params: Promise<{ leagueId: string; raceId: string }>
}

export default async function LineupRacePage({ params }: PageProps) {
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

  if (!details || details.userTeamId == null) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-gray-600">
          League not found or you do not have a team.{" "}
          <Link href="/leagues" className="text-blue-600 hover:underline">
            Back to Leagues
          </Link>
        </p>
      </div>
    )
  }

  const { league, userTeamId } = details

  // Fetch race
  const [race] = await db
    .select()
    .from(races)
    .where(eq(races.id, raceId))
    .limit(1)

  if (!race || race.parentRaceId !== null) {
    notFound()
  }

  // Parallel fetch
  const [roster, currentLineup, rosterSize, lineupPeriodInfo, editablePeriods] = await Promise.all([
    getTeamRoster(userTeamId, leagueId),
    getLineup(userTeamId, leagueId, raceId),
    getRosterLimitForRace(raceId),
    getLineupPeriods(raceId),
    getEditableLineupPeriods(raceId),
  ])

  if (rosterSize == null) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <nav className="text-sm text-gray-500">
          <Link href="/leagues" className="hover:text-gray-700 hover:underline">Leagues</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">{league.name}</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}/lineup`} className="hover:text-gray-700 hover:underline">Lineup</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-gray-900">{race.name}</span>
        </nav>
        <p className="text-gray-600">
          No roster size configured for this race type.{" "}
          <Link href={`/leagues/${leagueId}/lineup`} className="text-blue-600 hover:underline">
            Back to Lineup
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <nav className="text-sm text-gray-500">
        <Link href="/leagues" className="hover:text-gray-700 hover:underline">Leagues</Link>
        <span className="mx-2">&rsaquo;</span>
        <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">{league.name}</Link>
        <span className="mx-2">&rsaquo;</span>
        <Link href={`/leagues/${leagueId}/lineup`} className="hover:text-gray-700 hover:underline">Lineup</Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">{race.name}</span>
      </nav>

      <LineupForm
        leagueId={leagueId}
        raceId={raceId}
        raceName={race.name}
        raceType={race.raceType}
        startDate={race.startDate}
        rosterSize={rosterSize}
        roster={roster.map((r) => ({
          riderId: r.riderId,
          riderName: r.riderName,
          riderTeam: r.riderTeam,
          gender: r.gender,
        }))}
        currentLineup={currentLineup.map((r) => ({ riderId: r.riderId, lineupPeriod: r.lineupPeriod }))}
        periods={lineupPeriodInfo ? {
          count: lineupPeriodInfo.periodCount,
          editable: editablePeriods,
        } : null}
      />
    </div>
  )
}

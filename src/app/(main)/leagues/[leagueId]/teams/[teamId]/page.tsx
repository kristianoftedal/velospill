import { notFound } from "next/navigation"
import Link from "next/link"
import { getLeagueDetails } from "../../actions"
import { getTeamSeasonProfile } from "@/lib/team-queries"
import TeamProfileClient from "./team-profile-client"
import { LeagueConfig } from "@/db/schema/leagues"

interface PageProps {
  params: Promise<{ leagueId: string; teamId: string }>
}

export default async function TeamProfilePage({ params }: PageProps) {
  const { leagueId: leagueIdStr, teamId: teamIdStr } = await params
  const leagueId = parseInt(leagueIdStr, 10)
  const teamId = parseInt(teamIdStr, 10)

  if (isNaN(leagueId) || isNaN(teamId)) {
    notFound()
  }

  let details: Awaited<ReturnType<typeof getLeagueDetails>>
  try {
    details = await getLeagueDetails(leagueId)
  } catch {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
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
      <div className="container mx-auto max-w-4xl px-4 py-8">
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
  const config = league.config as LeagueConfig
  const season = config.seasonYear

  const profile = await getTeamSeasonProfile(teamId, leagueId, season)

  if (!profile) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
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
        <span className="text-gray-900">{profile.team.name}</span>
      </nav>
      <TeamProfileClient profile={profile} leagueId={leagueId} />
    </div>
  )
}

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { checkLeagueMembership, checkLeagueOwnership } from "@/lib/league-auth"
import { getDraftState, getAvailableRiders, getEnrichedPicks, getEnrichedTeams } from "@/lib/draft-queries"
import { db } from "@/lib/db"
import { leagues, teams } from "@/db/schema/leagues"
import { eq, asc } from "drizzle-orm"
import { DraftRoom } from "./draft-room"
import { WaitingRoom } from "./waiting-room"
import { startDraft } from "./actions"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface PageProps {
  params: Promise<{ leagueId: string }>
}

export default async function DraftPage({ params }: PageProps) {
  const { leagueId: leagueIdStr } = await params
  const leagueId = parseInt(leagueIdStr, 10)

  if (isNaN(leagueId)) {
    redirect("/leagues")
  }

  // Authenticate user
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    redirect("/login")
  }

  // Check league membership
  const { isMember, team } = await checkLeagueMembership(session.user.id, leagueId)
  if (!isMember) {
    redirect("/leagues")
  }

  // Check league ownership
  const isOwner = await checkLeagueOwnership(session.user.id, leagueId)

  // Load league info
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)

  if (!league) {
    redirect("/leagues")
  }

  // Load draft state
  const draftState = await getDraftState(leagueId)

  // If no draft session or status is pending, show waiting room
  if (!draftState || draftState.session.status === "pending") {
    // Load all teams (basic, no enrichment needed for waiting room)
    const leagueTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.leagueId, leagueId))
      .orderBy(asc(teams.createdAt))

    return (
      <WaitingRoom leagueId={leagueId}>
        <div className="container mx-auto max-w-3xl px-4 py-12">
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500 mb-6">
            <Link href="/leagues" className="hover:text-gray-700 hover:underline">
              Leagues
            </Link>
            <span className="mx-2">&rsaquo;</span>
            <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">
              {league.name}
            </Link>
            <span className="mx-2">&rsaquo;</span>
            <span className="text-gray-900">Draft</span>
          </nav>

          <div className="text-center py-12 space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">{league.name}</h1>
            <p className="text-xl text-gray-500">Waiting for draft to start...</p>

            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                Teams joined ({leagueTeams.length})
              </h2>
              <ul className="space-y-2">
                {leagueTeams.map((t) => (
                  <li key={t.id} className="py-2 px-4 bg-gray-50 rounded-lg text-gray-800">
                    {t.name}
                  </li>
                ))}
              </ul>
            </div>

            {isOwner && (
              <form
                action={async () => {
                  "use server"
                  await startDraft(leagueId)
                }}
                className="mt-8"
              >
                <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Start Draft
                </Button>
                {leagueTeams.length < 2 && (
                  <p className="mt-2 text-sm text-red-600">
                    At least 2 teams are required to start the draft.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </WaitingRoom>
    )
  }

  // Draft session exists — load enriched picks, enriched teams, and available riders
  const [enrichedPicks, enrichedTeams, availableMen, availableWomen] = await Promise.all([
    getEnrichedPicks(leagueId),
    getEnrichedTeams(leagueId),
    getAvailableRiders(leagueId, "M"),
    getAvailableRiders(leagueId, "F"),
  ])

  return (
    <DraftRoom
      leagueId={leagueId}
      leagueName={league.name}
      initialSession={draftState.session}
      initialPicks={enrichedPicks}
      teams={enrichedTeams}
      availableMen={availableMen}
      availableWomen={availableWomen}
      currentUserId={session.user.id}
      currentTeamId={team?.id ?? null}
      isOwner={isOwner}
    />
  )
}

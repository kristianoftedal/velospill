import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { getLeagueDetails, getSeasonRacesForPicker, assignRaceToLeague, removeRaceFromLeague } from "../actions"
import { InviteSection, LeagueStatusControl, RacePickerSection } from "../league-client"
import { LeagueConfig } from "@/db/schema/leagues"

interface PageProps {
  params: Promise<{ leagueId: string }>
}

export default async function LeagueOwnerPage({ params }: PageProps) {
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
          <Link href="/leagues" className="text-primary hover:underline">
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
          <Link href="/leagues" className="text-primary hover:underline">
            Back to Leagues
          </Link>
        </p>
      </div>
    )
  }

  const { league, teams, isOwner } = details

  // Redirect to main page if not owner
  if (!isOwner) {
    notFound()
  }

  const config = league.config as LeagueConfig

  // Fetch season races for the race picker
  const seasonRaces = await getSeasonRacesForPicker(leagueId)

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/leagues" className="hover:text-gray-700 hover:underline">
          Leagues
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <Link href={`/leagues/${league.id}`} className="hover:text-gray-700 hover:underline">
          {league.name}
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">Owner Settings</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Owner Settings</h1>
        <p className="text-sm text-gray-500 mt-2">
          Manage league configuration, invitations, and more
        </p>
      </div>

      {/* Owner-only sections wrapped in accordion */}
      <Accordion type="single" collapsible className="w-full">
        {/* League Management */}
        <AccordionItem value="league-management">
          <AccordionTrigger className="text-lg font-semibold">
            League Management
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6">
                <LeagueStatusControl
                  leagueId={league.id}
                  currentStatus={league.status}
                  teamCount={teams.length}
                  teamMin={config.teamMin || 2}
                />
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Invite Link */}
        <AccordionItem value="invite-link">
          <AccordionTrigger className="text-lg font-semibold">
            Invite Link
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6">
                <InviteSection
                  inviteCode={league.inviteCode}
                  expiresAt={
                    league.inviteExpiresAt
                      ? league.inviteExpiresAt.toISOString()
                      : null
                  }
                />
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Race Calendar */}
        {seasonRaces && (
          <AccordionItem value="race-calendar">
            <AccordionTrigger className="text-lg font-semibold">
              Race Calendar
            </AccordionTrigger>
            <AccordionContent>
              <RacePickerSection
                leagueId={league.id}
                seasonRaces={seasonRaces}
                assignRace={assignRaceToLeague}
                removeRace={removeRaceFromLeague}
              />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Back button */}
      <div className="pt-4">
        <Link
          href={`/leagues/${league.id}`}
          className="text-primary hover:underline text-sm"
        >
          ← Back to League
        </Link>
      </div>
    </div>
  )
}

"use server"

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

export default async function LeagueOwnerPage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  const details = await getLeagueDetails(leagueId)

  if (!details) {
    return notFound()
  }

  const { league, teams, isOwner } = details

  // Only owners can access this page
  if (!isOwner) {
    return notFound()
  }

  // Fetch season races for the race picker
  const seasonRaces = await getSeasonRacesForPicker(leagueId)

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">League Settings</h1>
        <p className="text-gray-500 mt-1">{league.name}</p>
      </div>

      {/* Settings Accordion */}
      <Accordion type="single" collapsible className="space-y-4">
        {/* League Management */}
        <Card>
          <AccordionItem value="management">
            <CardHeader className="cursor-pointer">
              <AccordionTrigger className="px-0 py-0 hover:no-underline">
                <CardTitle className="text-lg">League Management</CardTitle>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="px-0 pt-2">
                <LeagueStatusControl
                  leagueId={league.id}
                  currentStatus={league.status}
                  teamCount={teams.length}
                  teamMin={2}
                />
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* Invite Link */}
        <Card>
          <AccordionItem value="invite">
            <CardHeader className="cursor-pointer">
              <AccordionTrigger className="px-0 py-0 hover:no-underline">
                <CardTitle className="text-lg">Invite Link</CardTitle>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="px-0 pt-2">
                <InviteSection
                  inviteCode={league.inviteCode}
                  expiresAt={
                    league.inviteExpiresAt
                      ? league.inviteExpiresAt.toISOString()
                      : null
                  }
                />
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* Race Calendar */}
        <Card>
          <AccordionItem value="races">
            <CardHeader className="cursor-pointer">
              <AccordionTrigger className="px-0 py-0 hover:no-underline">
                <CardTitle className="text-lg">Race Calendar</CardTitle>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="px-0 pt-2">
                {seasonRaces && (
                  <RacePickerSection
                    leagueId={league.id}
                    seasonRaces={seasonRaces}
                    assignRace={assignRaceToLeague}
                    removeRace={removeRaceFromLeague}
                  />
                )}
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Card>
      </Accordion>
    </div>
  )
}

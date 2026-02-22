"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DraftOrder = {
  teamId: number
  teamName: string
  totalPoints: number
  pickOrder: number
}

type BonusPick = {
  teamId: number
  teamName: string
  riderId: number
  riderName: string
  riderTeam: string
  pickOrder: number
}

type DraftState = {
  draftOrder: DraftOrder[]
  picks: BonusPick[]
  allPicked: boolean
}

type ActivatedDraft = {
  leagueId: number
  leagueName: string
  raceId: number
  raceName: string
  season: number
}

interface BonusRiderDraftProps {
  activatedDrafts: ActivatedDraft[]
  getDraftState: (leagueId: number, raceId: number, season: number) => Promise<DraftState>
}

export function BonusRiderDraft({ activatedDrafts, getDraftState }: BonusRiderDraftProps) {
  const [draftStates, setDraftStates] = useState<Map<string, DraftState>>(new Map())

  useEffect(() => {
    async function loadDraftStates() {
      const states = new Map<string, DraftState>()

      // Group drafts by league+race (deduplicate)
      const uniqueDrafts = new Map<string, ActivatedDraft>()
      for (const draft of activatedDrafts) {
        const key = `${draft.leagueId}-${draft.raceId}`
        if (!uniqueDrafts.has(key)) {
          uniqueDrafts.set(key, draft)
        }
      }

      for (const draft of uniqueDrafts.values()) {
        const key = `${draft.leagueId}-${draft.raceId}`
        const state = await getDraftState(draft.leagueId, draft.raceId, draft.season)
        states.set(key, state)
      }

      setDraftStates(states)
    }

    if (activatedDrafts.length > 0) {
      loadDraftStates()
    }
  }, [activatedDrafts, getDraftState])

  if (activatedDrafts.length === 0) {
    return null
  }

  // Group drafts by league+race for display
  const uniqueDrafts = new Map<string, ActivatedDraft>()
  for (const draft of activatedDrafts) {
    const key = `${draft.leagueId}-${draft.raceId}`
    if (!uniqueDrafts.has(key)) {
      uniqueDrafts.set(key, draft)
    }
  }

  return (
    <div className="space-y-4">
      {Array.from(uniqueDrafts.values()).map((draft) => {
        const key = `${draft.leagueId}-${draft.raceId}`
        const state = draftStates.get(key)

        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-lg">
                {draft.raceName} - {draft.leagueName}
              </CardTitle>
              <CardDescription>
                Bonus Rider Draft (Reverse Standings Order)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!state ? (
                <p className="text-sm text-muted-foreground">Loading draft state...</p>
              ) : (
                <>
                  {state.allPicked && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                      <p className="text-sm font-semibold text-green-800">
                        Draft Complete - All teams have picked their bonus rider
                      </p>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pick #</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Bonus Rider</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.draftOrder.map((team) => {
                        const pick = state.picks.find((p) => p.teamId === team.teamId)
                        return (
                          <TableRow key={team.teamId}>
                            <TableCell className="font-medium">{team.pickOrder}</TableCell>
                            <TableCell>{team.teamName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {team.totalPoints} pts
                            </TableCell>
                            <TableCell>
                              {pick ? (
                                <Badge className="bg-green-600 hover:bg-green-700">Picked</Badge>
                              ) : (
                                <Badge variant="secondary">Waiting</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {pick ? (
                                <div>
                                  <div className="text-sm font-medium">{pick.riderName}</div>
                                  <div className="text-xs text-muted-foreground">{pick.riderTeam}</div>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Check } from "lucide-react"

type DraftOrderEntry = {
  teamId: number
  teamName: string
  pickOrder: number
  totalPoints: number
}

type ExistingPick = {
  teamId: number
  riderName: string
  riderTeam: string
}

type AvailableRider = {
  riderId: number
  riderName: string
  riderTeam: string
  nationality: string
}

interface BonusRiderPickProps {
  leagueId: number
  teamId: number
  raceId: number
  raceName: string
  draftOrder: DraftOrderEntry[]
  existingPicks: ExistingPick[]
  availableRiders: AvailableRider[]
  myPickOrder: number
  isMyTurn: boolean
  alreadyPicked: boolean
  myPickedRider?: ExistingPick
  pickBonusRider: (
    leagueId: number,
    teamId: number,
    riderId: number,
    raceId: number
  ) => Promise<{ success: true } | { success: false; error: string }>
}

export function BonusRiderPick({
  leagueId,
  teamId,
  raceId,
  raceName,
  draftOrder,
  existingPicks,
  availableRiders,
  myPickOrder,
  isMyTurn,
  alreadyPicked,
  myPickedRider,
  pickBonusRider,
}: BonusRiderPickProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isPending, startTransition] = useTransition()

  const filteredRiders = searchQuery.trim()
    ? availableRiders.filter((r) =>
        r.riderName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableRiders

  function handleRiderSelect(riderId: number) {
    startTransition(async () => {
      const result = await pickBonusRider(leagueId, teamId, riderId, raceId)
      if (result.success) {
        toast.success("Bonus rider picked successfully!")
      } else {
        toast.error(result.error)
      }
    })
  }

  // Determine status for each team in draft order
  const draftOrderWithStatus = draftOrder.map((team) => {
    const hasPicked = existingPicks.some((p) => p.teamId === team.teamId)
    const isPending = existingPicks.length + 1 === team.pickOrder && !hasPicked

    let status: "Picked" | "Your Turn" | "Waiting"
    if (hasPicked) {
      status = "Picked"
    } else if (isPending && team.teamId === teamId) {
      status = "Your Turn"
    } else {
      status = "Waiting"
    }

    return { ...team, status }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bonus Rider Draft - {raceName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Draft order mini-table */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Draft Order (Reverse Standings)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pick #</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftOrderWithStatus.map((team) => (
                <TableRow key={team.teamId}>
                  <TableCell className="font-medium">{team.pickOrder}</TableCell>
                  <TableCell>
                    {team.teamName}
                    {team.teamId === teamId && (
                      <Badge variant="outline" className="ml-2">
                        You
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {team.status === "Picked" && (
                      <Badge className="bg-green-600 hover:bg-green-700">Picked</Badge>
                    )}
                    {team.status === "Your Turn" && (
                      <Badge className="bg-purple-600 hover:bg-purple-700">Your Turn</Badge>
                    )}
                    {team.status === "Waiting" && <Badge variant="secondary">Waiting</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Already picked state */}
        {alreadyPicked && myPickedRider && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
            <Check className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">Bonus Rider Picked</p>
              <p className="text-sm text-green-700 mt-1">
                {myPickedRider.riderName} ({myPickedRider.riderTeam})
              </p>
            </div>
          </div>
        )}

        {/* Waiting state */}
        {!alreadyPicked && !isMyTurn && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm text-gray-700">
              It&apos;s not your turn yet. Teams ahead of you still need to pick.
            </p>
            <p className="text-xs text-gray-500 mt-1">Your pick order: #{myPickOrder}</p>
          </div>
        )}

        {/* Rider selection (only shown when it's the team's turn) */}
        {!alreadyPicked && isMyTurn && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Select Your Bonus Rider</h3>
            <p className="text-xs text-gray-500">
              Pick one unowned rider to score for your team during this Grand Tour
            </p>

            {/* Search input */}
            <Input
              type="text"
              placeholder="Search riders by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />

            {/* Rider grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
              {filteredRiders.length === 0 ? (
                <p className="text-sm text-gray-500 col-span-2 p-4 text-center">
                  {searchQuery.trim() ? "No riders found matching your search." : "No riders available."}
                </p>
              ) : (
                filteredRiders.map((rider) => (
                  <button
                    key={rider.riderId}
                    type="button"
                    onClick={() => handleRiderSelect(rider.riderId)}
                    disabled={isPending}
                    className="text-left rounded-lg border px-3 py-2 transition-colors hover:border-purple-500 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className="text-sm font-medium text-gray-900">{rider.riderName}</p>
                    <p className="text-xs text-gray-500">{rider.riderTeam}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

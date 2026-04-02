"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { formatDateTime } from "@/lib/format-date"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { setLineup } from "../actions"

interface RosterRider {
  riderId: number
  riderName: string
  riderTeam: string
  gender: string
}

interface LineupFormProps {
  leagueId: number
  raceId: number
  raceName: string
  raceType: string
  startDate: Date
  rosterSize: number
  roster: RosterRider[]
  currentLineup: number[]
}

const MENS_RACE_TYPES = ["grand_tour", "high_priority_one_day", "low_priority_one_day", "mini_tour", "world_championship"]
const WOMENS_RACE_TYPES = ["womens_grand_tour", "womens_one_day"]

const raceTypeLabels: Record<string, string> = {
  grand_tour: "Grand Tour",
  high_priority_one_day: "High Priority",
  low_priority_one_day: "Low Priority",
  mini_tour: "Mini Tour",
  womens_grand_tour: "Women's GT",
  womens_one_day: "Women's One Day",
  world_championship: "World Championship",
}

export function LineupForm({
  leagueId,
  raceId,
  raceName,
  raceType,
  startDate,
  rosterSize,
  roster,
  currentLineup,
}: LineupFormProps) {
  const rosterIds = new Set(roster.map((r) => r.riderId))
  const [selected, setSelected] = useState<Set<number>>(
    new Set(currentLineup.filter((id) => rosterIds.has(id)))
  )
  const [isPending, startTransition] = useTransition()

  // Filter by gender matching the race type
  const requiredGender = MENS_RACE_TYPES.includes(raceType)
    ? "M"
    : WOMENS_RACE_TYPES.includes(raceType)
    ? "F"
    : null

  const eligibleRiders = requiredGender
    ? roster.filter((r) => r.gender === requiredGender)
    : roster

  function toggleRider(riderId: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(riderId)) {
        next.delete(riderId)
      } else {
        if (next.size < rosterSize) {
          next.add(riderId)
        }
      }
      return next
    })
  }

  function handleSubmit() {
    if (selected.size !== rosterSize) return

    startTransition(async () => {
      const result = await setLineup(leagueId, raceId, Array.from(selected))
      if (result.success) {
        toast.success("Lineup saved successfully")
      } else {
        toast.error(result.error)
      }
    })
  }

  const startDateObj = new Date(startDate)
  const parisDate = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Paris' }).format(startDateObj)
  const noonUtc = new Date(`${parisDate}T12:00:00Z`)
  const noonInParis = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }).format(noonUtc))
  const deadline = new Date(`${parisDate}T${String(13 - (noonInParis - 12)).padStart(2, '0')}:00:00Z`)
  const isExpired = new Date() >= deadline

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">{raceName}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {raceTypeLabels[raceType] ?? raceType}
                </Badge>
                {requiredGender && (
                  <Badge variant="secondary" className="text-xs">
                    {requiredGender === "M" ? "Men" : "Women"} only
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {selected.size} / {rosterSize} selected
              </p>
              <p className="text-xs text-gray-500">
                Deadline: {formatDateTime(deadline)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isExpired ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-red-600 font-medium">
              Lineup deadline has passed. You can no longer modify your lineup for this race.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Your Riders</CardTitle>
            </CardHeader>
            <CardContent>
              {eligibleRiders.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No eligible riders on your roster for this race type.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {eligibleRiders.map((rider) => {
                    const isSelected = selected.has(rider.riderId)
                    const isFull = selected.size >= rosterSize && !isSelected
                    return (
                      <button
                        key={rider.riderId}
                        type="button"
                        onClick={() => toggleRider(rider.riderId)}
                        disabled={isFull}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                          isSelected
                            ? "border-green-500 bg-green-50"
                            : isFull
                            ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{rider.riderName}</p>
                        <p className="text-xs text-gray-500">{rider.riderTeam}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleSubmit}
            disabled={isPending || selected.size !== rosterSize}
            className="w-full bg-gray-900 text-white hover:bg-gray-700"
          >
            {isPending
              ? "Saving..."
              : selected.size === rosterSize
              ? "Save Lineup"
              : `Select ${rosterSize - selected.size} more rider${rosterSize - selected.size !== 1 ? "s" : ""}`}
          </Button>
        </>
      )}
    </div>
  )
}

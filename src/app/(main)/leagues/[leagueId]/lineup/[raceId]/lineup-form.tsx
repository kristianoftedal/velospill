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

interface LineupEntry {
  riderId: number
  lineupPeriod: number | null
}

interface LineupFormProps {
  leagueId: number
  raceId: number
  raceName: string
  raceType: string
  startDate: Date
  rosterSize: number
  roster: RosterRider[]
  currentLineup: LineupEntry[]
  periods: { count: number; editable: number[]; deadlines: Record<number, string> } | null
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
  periods,
}: LineupFormProps) {
  const hasPeriods = periods != null && periods.count > 1

  // For period-based lineups, track selections per period
  // For legacy (no periods), use period = null
  const [activePeriod, setActivePeriod] = useState<number | null>(
    hasPeriods ? (periods.editable[0] ?? 1) : null
  )

  // Build initial selection state per period
  const getInitialSelected = (period: number | null): Set<number> => {
    const rosterIds = new Set(roster.map((r) => r.riderId))
    if (period == null) {
      // Legacy: all lineup entries with null period
      return new Set(
        currentLineup
          .filter((e) => e.lineupPeriod == null)
          .map((e) => e.riderId)
          .filter((id) => rosterIds.has(id))
      )
    }
    return new Set(
      currentLineup
        .filter((e) => e.lineupPeriod === period)
        .map((e) => e.riderId)
        .filter((id) => rosterIds.has(id))
    )
  }

  // Track which periods were pre-filled from a previous period
  const [copiedFromPeriod, setCopiedFromPeriod] = useState<Set<number>>(() => {
    const copied = new Set<number>()
    if (hasPeriods) {
      for (let p = 2; p <= periods.count; p++) {
        const saved = getInitialSelected(p)
        if (saved.size === 0) {
          copied.add(p)
        }
      }
    }
    return copied
  })

  // Store selections per period (keyed by period number or "null")
  // For period N>1 with no saved lineup, copy from the previous period
  const [selectionsByPeriod, setSelectionsByPeriod] = useState<Map<string, Set<number>>>(() => {
    const map = new Map<string, Set<number>>()
    if (hasPeriods) {
      for (let p = 1; p <= periods.count; p++) {
        const saved = getInitialSelected(p)
        if (saved.size > 0 || p === 1) {
          map.set(String(p), saved)
        } else {
          // No lineup for this period yet — copy from previous period
          const prev = map.get(String(p - 1))
          map.set(String(p), prev ? new Set(prev) : new Set())
        }
      }
    } else {
      map.set("null", getInitialSelected(null))
    }
    return map
  })

  const [isPending, startTransition] = useTransition()

  const periodKey = activePeriod != null ? String(activePeriod) : "null"
  const selected = selectionsByPeriod.get(periodKey) ?? new Set<number>()

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
    setSelectionsByPeriod((prev) => {
      const next = new Map(prev)
      const current = new Set(next.get(periodKey) ?? new Set<number>())
      if (current.has(riderId)) {
        current.delete(riderId)
      } else {
        if (current.size < rosterSize) {
          current.add(riderId)
        }
      }
      next.set(periodKey, current)
      return next
    })
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await setLineup(leagueId, raceId, Array.from(selected), activePeriod)
      if (result.success) {
        // Clear "copied" indicator after successful save
        if (activePeriod != null && copiedFromPeriod.has(activePeriod)) {
          setCopiedFromPeriod((prev) => {
            const next = new Set(prev)
            next.delete(activePeriod)
            return next
          })
        }
        toast.success(
          hasPeriods
            ? `Week ${activePeriod} lineup saved`
            : "Lineup saved successfully"
        )
      } else {
        toast.error(result.error)
      }
    })
  }

  // Deadline calculation
  const getDeadlineForDisplay = (): Date | null => {
    if (hasPeriods && activePeriod != null) {
      const iso = periods.deadlines[activePeriod]
      return iso ? new Date(iso) : null
    }
    // Legacy: compute from race start date
    const startDateObj = new Date(startDate)
    const parisDate = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Paris' }).format(startDateObj)
    const noonUtc = new Date(`${parisDate}T12:00:00Z`)
    const noonInParis = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }).format(noonUtc))
    return new Date(`${parisDate}T${String(13 - (noonInParis - 12)).padStart(2, '0')}:00:00Z`)
  }

  const deadline = getDeadlineForDisplay()

  const isCurrentPeriodEditable = hasPeriods
    ? periods.editable.includes(activePeriod!)
    : deadline != null && new Date() < deadline

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
              {deadline && (
                <p className="text-xs text-gray-500">
                  {hasPeriods ? `Week ${activePeriod} deadline` : "Deadline"}: {formatDateTime(deadline)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period tabs for Grand Tours with rest days */}
      {hasPeriods && (
        <div className="flex gap-1 border-b border-gray-200">
          {Array.from({ length: periods.count }, (_, i) => i + 1).map((p) => {
            const isEditable = periods.editable.includes(p)
            const periodSelection = selectionsByPeriod.get(String(p))
            const hasLineup = periodSelection != null && periodSelection.size > 0
            return (
              <button
                key={p}
                type="button"
                onClick={() => setActivePeriod(p)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activePeriod === p
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Week {p}
                {hasLineup && (
                  <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-green-500" />
                )}
                {!isEditable && (
                  <span className="ml-1 text-xs text-gray-400">(locked)</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {hasPeriods && activePeriod != null && copiedFromPeriod.has(activePeriod) && isCurrentPeriodEditable && (
        <p className="text-sm text-blue-600 bg-blue-50 rounded-md px-3 py-2">
          Pre-filled from Week {activePeriod - 1}. Adjust and save when ready.
        </p>
      )}

      {!isCurrentPeriodEditable ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-red-600 font-medium">
              {hasPeriods
                ? `Week ${activePeriod} lineup deadline has passed.`
                : "Lineup deadline has passed. You can no longer modify your lineup for this race."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {hasPeriods ? `Select Riders for Week ${activePeriod}` : "Select Your Riders"}
              </CardTitle>
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
            disabled={isPending}
            className="w-full bg-gray-900 text-white hover:bg-gray-700"
          >
            {isPending
              ? "Saving..."
              : hasPeriods
              ? `Save Week ${activePeriod} Lineup`
              : "Save Lineup"}
          </Button>
        </>
      )}
    </div>
  )
}

"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format-date"
import { setLineupAsAdmin, type AdminLineupData } from "../../actions"

interface Props {
  leagueId: number
  data: AdminLineupData
}

const keyOf = (teamId: number, periodKey: string) => `${teamId}:${periodKey}`

export function AdminLineupEditor({ leagueId, data }: Props) {
  const { race, rosterSize, requiredGender, periods, teams } = data

  const [teamId, setTeamId] = useState<number>(teams[0]?.teamId ?? 0)
  const [periodKey, setPeriodKey] = useState<string>(periods[0]?.key ?? "all")
  const [isPending, startTransition] = useTransition()

  // Seed every team+period selection from the server data once.
  const [selections, setSelections] = useState<Map<string, Set<number>>>(() => {
    const map = new Map<string, Set<number>>()
    for (const t of teams) {
      for (const p of periods) {
        map.set(keyOf(t.teamId, p.key), new Set(t.lineupByPeriodKey[p.key] ?? []))
      }
    }
    return map
  })

  const team = useMemo(() => teams.find((t) => t.teamId === teamId), [teams, teamId])
  const period = useMemo(() => periods.find((p) => p.key === periodKey), [periods, periodKey])
  const selKey = keyOf(teamId, periodKey)
  const selected = selections.get(selKey) ?? new Set<number>()
  const roster = team?.rosterByPeriodKey[periodKey] ?? []

  function toggle(riderId: number) {
    setSelections((prev) => {
      const next = new Map(prev)
      const cur = new Set(next.get(selKey) ?? new Set<number>())
      if (cur.has(riderId)) cur.delete(riderId)
      else if (cur.size < rosterSize) cur.add(riderId)
      next.set(selKey, cur)
      return next
    })
  }

  function save() {
    if (!team || !period) return
    startTransition(async () => {
      const res = await setLineupAsAdmin(
        leagueId,
        team.teamId,
        race.id,
        Array.from(selected),
        period.period,
      )
      if (res.success) {
        toast.success(`Saved ${team.teamName} — ${period.label}`)
      } else {
        toast.error(res.error)
      }
    })
  }

  if (!team) {
    return <p className="text-sm text-muted-foreground">No teams in this league.</p>
  }

  const genderLabel = requiredGender === "M" ? "Men" : requiredGender === "F" ? "Women" : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{race.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatDate(new Date(race.startDate))} · {race.raceType.replace(/_/g, " ")}
          {genderLabel ? ` · ${genderLabel} only` : ""} · lineup size {rosterSize}
        </p>
      </div>

      {/* Team selector */}
      <Card className="p-0">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Team</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-1.5">
            {teams.map((t) => (
              <Button
                key={t.teamId}
                type="button"
                size="sm"
                variant={t.teamId === teamId ? "default" : "outline"}
                onClick={() => setTeamId(t.teamId)}
              >
                {t.teamName.trim()}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Period tabs */}
      {periods.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {periods.map((p) => {
            const count = (selections.get(keyOf(teamId, p.key))?.size ?? 0)
            return (
              <Button
                key={p.key}
                type="button"
                size="sm"
                variant={p.key === periodKey ? "default" : "outline"}
                onClick={() => setPeriodKey(p.key)}
              >
                {p.label}
                {p.stageRange ? <span className="ml-1 opacity-70">({p.stageRange})</span> : null}
                {count > 0 ? (
                  <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />
                ) : null}
              </Button>
            )
          })}
        </div>
      )}

      {/* Roster-at-race-time checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {team.teamName.trim()} — {period?.label}
              {period?.stageRange ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {period.stageRange}
                </span>
              ) : null}
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {selected.size} / {rosterSize}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This team owned no{genderLabel ? ` ${genderLabel.toLowerCase()}` : ""} riders at race time.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roster.map((r) => {
                const isSelected = selected.has(r.riderId)
                const isFull = selected.size >= rosterSize && !isSelected
                return (
                  <button
                    key={r.riderId}
                    type="button"
                    onClick={() => toggle(r.riderId)}
                    disabled={isFull}
                    className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                      isSelected
                        ? "border-green-500 bg-green-50"
                        : isFull
                          ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {r.riderName}
                      {!r.onRosterNow ? (
                        <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700 align-middle">
                          dropped
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500">{r.riderTeam}</p>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={save}
        disabled={isPending || !team}
        className="w-full"
      >
        {isPending ? "Saving…" : `Save ${team.teamName.trim()} — ${period?.label}`}
      </Button>
    </div>
  )
}

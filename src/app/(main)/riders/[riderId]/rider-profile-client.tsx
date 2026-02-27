'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import type { RiderSeasonProfile } from "@/lib/rider-queries"

interface Props {
  profile: RiderSeasonProfile
}

export default function RiderProfileClient({ profile }: Props) {
  const { rider, races, ownership } = profile
  const raceCount = races.length
  const pointsPerRace = raceCount > 0 ? (rider.totalPoints / raceCount).toFixed(1) : "0.0"

  // Build ownership lookup: raceId -> teamName(s) per league
  const ownershipByRaceId = new Map<number, string[]>()
  for (const entry of ownership) {
    const existing = ownershipByRaceId.get(entry.raceId)
    if (existing) {
      existing.push(entry.teamName)
    } else {
      ownershipByRaceId.set(entry.raceId, [entry.teamName])
    }
  }

  return (
    <div className="space-y-8">
      {/* Section 1 — Hero header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 space-y-2">
            <h1 className="text-5xl font-bold tracking-tighter text-foreground">
              {rider.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-sm font-medium">
                {rider.team}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {rider.nationality}
              </Badge>
              <Badge
                className={
                  rider.gender === "M"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs"
                    : "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300 text-xs"
                }
              >
                {rider.gender === "M" ? "Men" : "Women"}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-5xl font-bold text-primary">
              {rider.totalPoints.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground font-medium">season pts</p>
          </div>
        </div>
      </div>

      {/* Section 2 — Season summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground font-medium mb-1">Total Races</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{raceCount}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground font-medium mb-1">Total Points</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {rider.totalPoints.toLocaleString()}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground font-medium mb-1">Pts / Race</p>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{pointsPerRace}</p>
        </div>
      </div>

      {/* Section 3 — Per-race breakdown with category detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-primary">
            Race Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {races.length === 0 ? (
            <p className="text-muted-foreground text-sm">No results yet.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-1">
              {races.map((race) => (
                <AccordionItem
                  key={race.raceId}
                  value={`race-${race.raceId}`}
                  className="border-0 overflow-hidden rounded-lg shadow-sm"
                >
                  <AccordionTrigger className="hover:no-underline bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-sm text-foreground">{race.raceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(race.startDate), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-bold text-primary text-lg">
                          {race.totalRacePoints} pts
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-gradient-to-b from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 px-6 py-4">
                    <div className="space-y-2">
                      {race.categories.map((cat, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{cat.categoryLabel}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs font-medium">
                              #{cat.position}
                            </Badge>
                            <span className="font-bold text-primary text-sm">{cat.points} pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Section 4 — Ownership history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary">
            Ownership History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {races.length === 0 ? (
            <p className="text-muted-foreground text-sm">No races scored yet.</p>
          ) : (
            <div className="space-y-2">
              {races.map((race) => {
                const teams = ownershipByRaceId.get(race.raceId)
                return (
                  <div
                    key={race.raceId}
                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{race.raceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(race.startDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {teams && teams.length > 0 ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          {teams.map((teamName, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {teamName}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Undrafted</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

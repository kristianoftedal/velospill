'use client'

import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import type { TeamSeasonProfile } from "@/lib/team-queries"

interface Props {
  profile: TeamSeasonProfile
  leagueId: number
}

export default function TeamProfileClient({ profile, leagueId }: Props) {
  const { team, riders, totalPoints, teamBonusAdjustments } = profile

  const riderCount = riders.length
  const racesScored = new Set(
    riders.flatMap((rider) => rider.races.map((race) => race.raceId))
  ).size

  return (
    <div className="space-y-8">
      {/* Section 1 — Team header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 space-y-2">
            <h1 className="text-4xl font-bold tracking-tighter text-foreground">
              {team.name}
            </h1>
            <p className="text-muted-foreground text-sm">{team.leagueName}</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-primary">
              {totalPoints.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground font-medium">season pts</p>
          </div>
        </div>
      </div>

      {/* Section 2 — Roster summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground font-medium mb-1">Riders</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{riderCount}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground font-medium mb-1">Total Points</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {totalPoints.toLocaleString()}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground font-medium mb-1">Races Scored</p>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{racesScored}</p>
        </div>
      </div>

      {/* Section 3 — Rider roster with per-race breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-primary">
            Rider Roster
          </CardTitle>
        </CardHeader>
        <CardContent>
          {riders.length === 0 ? (
            <p className="text-muted-foreground text-sm">No riders drafted yet.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-1">
              {riders.map((rider) => (
                <AccordionItem
                  key={rider.riderId}
                  value={`rider-${rider.riderId}`}
                  className="border-0 overflow-hidden rounded-lg shadow-sm"
                >
                  <AccordionTrigger className="hover:no-underline bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/riders/${rider.riderId}`}
                            className="font-semibold text-sm text-foreground hover:text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {rider.riderName}
                          </Link>
                          {rider.isBonus && (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs">
                              Bonus
                            </Badge>
                          )}
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
                        <p className="text-xs text-muted-foreground mt-0.5">{rider.riderTeam}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-bold text-primary text-lg">
                          {rider.totalPoints} pts
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-gradient-to-b from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 px-6 py-4">
                    {rider.races.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No race results yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {rider.races.map((race) => (
                          <div key={race.raceId} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div>
                                {race.parentRaceName && (
                                  <p className="text-xs text-muted-foreground font-medium">{race.parentRaceName}</p>
                                )}
                                <p className="text-sm font-medium text-foreground">{race.raceName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(race.startDate), "MMM d, yyyy")}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="font-bold text-primary text-sm">
                                  {race.racePoints} pts
                                </span>
                                {race.orderDelta !== 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    base {race.baseRacePoints} pts
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 pl-2">
                              {race.categories.map((cat, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1"
                                >
                                  <span className="text-xs text-muted-foreground">{cat.categoryLabel}</span>
                                  <Badge variant="outline" className="text-xs font-medium px-1 py-0">
                                    #{cat.position}
                                  </Badge>
                                  <span className="text-xs font-bold text-primary">{cat.points}p</span>
                                </div>
                              ))}
                              {race.orderEffect && (
                                <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950 rounded-md border border-orange-200 dark:border-orange-800 px-2 py-1">
                                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                                    {race.orderEffect}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Section 4 — Team-level order bonuses (Hammer, Innlagt Spurt, Lagtempo) */}
      {teamBonusAdjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-primary">
              Order Bonuses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teamBonusAdjustments.map((adj, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm text-foreground">{adj.description}</span>
                  <span className="font-bold text-primary text-sm">+{adj.points} pts</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { db } from "@/lib/db"
import { races } from "@/db/schema/races"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format, isSameDay } from "date-fns"
import { isNull, sql, asc } from "drizzle-orm"

const raceTypeColors: Record<string, string> = {
  grand_tour: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  high_priority_one_day: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  low_priority_one_day: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  mini_tour: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  womens_grand_tour: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  womens_one_day: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  world_championship: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
}

const raceTypeLabels: Record<string, string> = {
  grand_tour: "Grand Tour",
  high_priority_one_day: "High Priority One-Day",
  low_priority_one_day: "One-Day",
  mini_tour: "Mini Tour",
  womens_grand_tour: "Women's Grand Tour",
  womens_one_day: "Women's One-Day",
  world_championship: "World Championship",
}

export default async function CalendarPage() {
  // Get all parent races (not stages) sorted by start date
  const allRaces = await db
    .select({
      id: races.id,
      name: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      endDate: races.endDate,
      season: races.season,
      stageCount: sql<number>`count(distinct case when ${races.parentRaceId} = ${races.id} then 1 end)`,
    })
    .from(races)
    .where(isNull(races.parentRaceId))
    .orderBy(asc(races.startDate))
    .groupBy(races.id, races.name, races.raceType, races.startDate, races.endDate, races.season)

  // Group races by season
  const racesByYear: Record<number, typeof allRaces> = {}
  allRaces.forEach((race) => {
    if (!racesByYear[race.season]) {
      racesByYear[race.season] = []
    }
    racesByYear[race.season].push(race)
  })

  const sortedYears = Object.keys(racesByYear)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
      <div className="space-y-12">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-foreground">
            Race Calendar
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            View the complete professional cycling season calendar with all major races and events
          </p>
        </div>

        {allRaces.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="py-16 px-8 text-center">
              <p className="text-lg text-muted-foreground">
                No races scheduled yet. Check back soon for the complete 2026 season calendar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-12">
            {sortedYears.map((year) => (
              <section key={year} className="space-y-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold text-foreground">{year} Season</h2>
                  <Badge className="bg-gradient-green-blue text-white text-sm font-semibold px-3 py-1">
                    {racesByYear[year].length} races
                  </Badge>
                </div>

                <div className="space-y-4">
                  {racesByYear[year].map((race) => {
                    const isMultiDay =
                      race.endDate &&
                      !isSameDay(race.startDate, race.endDate)
                    const dateDisplay = isMultiDay
                      ? `${format(race.startDate, "MMM d")} - ${format(race.endDate!, "MMM d")}`
                      : format(race.startDate, "MMM d")

                    return (
                      <Card
                        key={race.id}
                        className="border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden group"
                      >
                        <div className="h-1 bg-gradient-to-r from-green-500 to-blue-500" />
                        <CardContent className="py-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="space-y-2">
                                <h3 className="font-bold text-lg text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-green-blue transition-all">
                                  {race.name}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span className="font-medium">{dateDisplay}</span>
                                  {race.stageCount > 0 && (
                                    <span className="text-xs bg-muted px-2 py-1 rounded-full">
                                      {race.stageCount} stage{race.stageCount !== 1 ? "s" : ""}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Badge
                              className={`${raceTypeColors[race.raceType] || raceTypeColors.low_priority_one_day} text-xs font-semibold whitespace-nowrap flex-shrink-0`}
                            >
                              {raceTypeLabels[race.raceType] || race.raceType}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

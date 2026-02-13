import Link from "next/link"
import { db } from "@/lib/db"
import { races } from "@/db/schema/races"
import { gte, asc, isNull } from "drizzle-orm"
import { format, isSameDay } from "date-fns"

const raceTypeColors: Record<string, string> = {
  grand_tour: "bg-blue-100 text-blue-800",
  high_priority_one_day: "bg-purple-100 text-purple-800",
  low_priority_one_day: "bg-gray-100 text-gray-800",
  mini_tour: "bg-green-100 text-green-800",
  womens_grand_tour: "bg-pink-100 text-pink-800",
  womens_one_day: "bg-rose-100 text-rose-800",
  world_championship: "bg-amber-100 text-amber-800"
}

const raceTypeLabels: Record<string, string> = {
  grand_tour: "Grand Tour",
  high_priority_one_day: "Major One-Day",
  low_priority_one_day: "One-Day",
  mini_tour: "Mini Tour",
  womens_grand_tour: "Women's Grand Tour",
  womens_one_day: "Women's One-Day",
  world_championship: "World Championship"
}

export default async function HomePage() {
  // Fetch upcoming races - only parent races (not stages)
  const upcomingRaces = await db.query.races.findMany({
    where: gte(races.startDate, new Date()),
    orderBy: asc(races.startDate),
    limit: 10
  })

  // Filter to only parent races (parentRaceId is null)
  const parentRaces = upcomingRaces.filter(race => !race.parentRaceId)

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-8">
        {/* League CTAs Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Your Leagues</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-gray-600 mb-4">You haven&apos;t joined any leagues yet</p>
            <div className="flex gap-3">
              <Link
                href="/leagues/new"
                className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Create League
              </Link>
              <Link
                href="/leagues"
                className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                My Leagues
              </Link>
            </div>
          </div>
        </section>

        {/* Upcoming Races Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Upcoming Races</h2>
          {parentRaces.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <p className="text-gray-600">
                No upcoming races. Admin can add races from the calendar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {parentRaces.map((race) => {
                const isMultiDay = race.endDate && !isSameDay(race.startDate, race.endDate)
                const dateDisplay = isMultiDay
                  ? `${format(race.startDate, "MMM d")} - ${format(race.endDate!, "MMM d, yyyy")}`
                  : format(race.startDate, "MMM d, yyyy")

                return (
                  <div
                    key={race.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{race.name}</h3>
                        <p className="text-sm text-gray-600">{dateDisplay}</p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          raceTypeColors[race.raceType] || raceTypeColors.low_priority_one_day
                        }`}
                      >
                        {raceTypeLabels[race.raceType] || race.raceType}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

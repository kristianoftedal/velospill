"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"

interface ProjectedBreakdown {
  highPriorityOneDay: number
  lowPriorityOneDay: number
  grandTour: number
  grandTourTdf: number
  miniTour: number
}

interface RankingData {
  id: number
  rank: number
  riderName: string
  riderId: number | null
  team: string
  nationality: string
  projectedPoints: number
  breakdown: ProjectedBreakdown
  confirmedRaces: number
  injuryStatus: string
  injuryNote: string | null
  season: number
  lastUpdated: Date
  createdAt: Date
}

type SortOption = "total" | "oneDay" | "grandTour" | "miniTour"

export function RankingsClient({ rankings }: { rankings: RankingData[] }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("total")

  const filteredRankings = useMemo(() => {
    let filtered = rankings.filter((r) => {
      const term = searchTerm.toLowerCase()
      return (
        r.riderName.toLowerCase().includes(term) ||
        r.team.toLowerCase().includes(term) ||
        r.nationality.toLowerCase().includes(term)
      )
    })

    if (sortBy !== "total") {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case "oneDay":
            return (
              b.breakdown.highPriorityOneDay + b.breakdown.lowPriorityOneDay -
              (a.breakdown.highPriorityOneDay + a.breakdown.lowPriorityOneDay)
            )
          case "grandTour":
            return (
              b.breakdown.grandTour + b.breakdown.grandTourTdf -
              (a.breakdown.grandTour + a.breakdown.grandTourTdf)
            )
          case "miniTour":
            return b.breakdown.miniTour - a.breakdown.miniTour
          default:
            return b.projectedPoints - a.projectedPoints
        }
      })
    }

    return filtered
  }, [rankings, searchTerm, sortBy])

  const clearAllFilters = () => {
    setSearchTerm("")
    setSortBy("total")
  }

  const hasActiveFilters = searchTerm !== "" || sortBy !== "total"

  function injuryDot(status: string) {
    if (status === "injured") return "bg-red-500"
    if (status === "doubtful") return "bg-yellow-500"
    return null
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tighter text-foreground">
            2026 Projected Rankings
          </h1>
          <p className="text-lg text-muted-foreground">
            Top 100 riders ranked by projected fantasy points based on 2025 results
          </p>
        </div>

        {rankings.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                No projected rankings available yet. Run the scraping script to generate data.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="space-y-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search by rider, team, or nationality..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700"
                />
              </div>

              {/* Sort Options */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Sort By</h3>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "total", label: "Total Points" },
                    { value: "oneDay", label: "One-Day Races" },
                    { value: "grandTour", label: "Grand Tours" },
                    { value: "miniTour", label: "Mini Tours" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        sortBy === option.value
                          ? "bg-gradient-green-blue text-white ring-2 ring-offset-1 ring-offset-background ring-primary"
                          : "bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 text-foreground hover:border-primary"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Filters */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredRankings.length} of {rankings.length} riders
                  </div>
                  <button
                    onClick={clearAllFilters}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-white dark:hover:bg-slate-700 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {/* Results */}
            {filteredRankings.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    No riders match your search criteria. Try adjusting your filters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="w-full space-y-1">
                {filteredRankings.map((rider) => {
                  const dot = injuryDot(rider.injuryStatus)
                  return (
                    <AccordionItem
                      key={rider.id}
                      value={`ranking-${rider.id}`}
                      className="border-0 overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <AccordionTrigger className="hover:no-underline bg-white dark:bg-slate-900 px-4 py-2">
                        <div className="flex items-center justify-between w-full gap-3">
                          <div className="flex items-center gap-3 flex-1 text-left">
                            <span className="text-sm font-bold text-muted-foreground w-8 text-right flex-shrink-0">
                              #{rider.rank}
                            </span>
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">
                                {rider.riderName}
                              </p>
                              {dot && (
                                <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0`} title={rider.injuryStatus} />
                              )}
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                {rider.team}
                              </span>
                              <span className="text-xs text-muted-foreground hidden md:inline">
                                {rider.nationality}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <p className="text-xl font-bold text-foreground">
                              {rider.projectedPoints}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="bg-gradient-to-b from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 px-6 py-6 space-y-8">
                        {/* Rider Info */}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{rider.team}</Badge>
                          <Badge variant="outline">{rider.nationality}</Badge>
                          <Badge variant="outline">{rider.confirmedRaces} confirmed races</Badge>
                          {rider.injuryStatus !== "healthy" && (
                            <Badge variant={rider.injuryStatus === "injured" ? "destructive" : "secondary"}>
                              {rider.injuryStatus}
                            </Badge>
                          )}
                        </div>

                        {rider.injuryNote && (
                          <p className="text-sm text-muted-foreground italic">
                            {rider.injuryNote}
                          </p>
                        )}

                        {/* Points Breakdown */}
                        <div>
                          <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-4">
                            POINTS BREAKDOWN
                          </h3>
                          <div className="space-y-3">
                            {[
                              {
                                label: "High Priority One-Day",
                                value: rider.breakdown.highPriorityOneDay,
                                color: "from-purple-500 to-purple-600",
                              },
                              {
                                label: "Low Priority One-Day",
                                value: rider.breakdown.lowPriorityOneDay,
                                color: "from-blue-500 to-blue-600",
                              },
                              {
                                label: "Grand Tours (Giro/Vuelta)",
                                value: rider.breakdown.grandTour,
                                color: "from-pink-500 to-pink-600",
                              },
                              {
                                label: "Tour de France",
                                value: rider.breakdown.grandTourTdf,
                                color: "from-yellow-500 to-yellow-600",
                              },
                              {
                                label: "Mini Tours",
                                value: rider.breakdown.miniTour,
                                color: "from-green-500 to-green-600",
                              },
                            ].map((category) => (
                              <div key={category.label} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-muted-foreground">
                                    {category.label}
                                  </span>
                                  <span className="text-sm font-bold text-primary">
                                    {category.value}
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full bg-gradient-to-r ${category.color} rounded-full transition-all duration-500`}
                                    style={{
                                      width: `${
                                        rider.projectedPoints > 0
                                          ? (category.value / rider.projectedPoints) * 100
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Summary Stats */}
                        <div>
                          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-4">
                            PROJECTION DETAILS
                          </h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg">
                              <p className="text-sm text-muted-foreground font-medium mb-1">
                                Total Points
                              </p>
                              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {rider.projectedPoints}
                              </p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg">
                              <p className="text-sm text-muted-foreground font-medium mb-1">
                                Confirmed Races
                              </p>
                              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                {rider.confirmedRaces}
                              </p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-lg">
                              <p className="text-sm text-muted-foreground font-medium mb-1">
                                Rank
                              </p>
                              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                                #{rider.rank}
                              </p>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

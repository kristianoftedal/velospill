'use client'

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
import { format } from "date-fns"
import { Search, X, Star } from "lucide-react"

interface RiderData {
  id: string
  name: string
  team: string
  nationality: string
  totalPoints: number
  results: Array<{
    raceName: string
    raceDate: Date
    position: number
    points: number
    raceType: string
  }>
  categoryScores: {
    oneDay: number
    stage: number
    classic: number
    total: number
  }
  maxPosition: number
  avgPosition: number
  raceCount: number
}

export default function RidersPage({ 
  riders,
  userTeamRiderIds = []
}: { 
  riders: RiderData[]
  userTeamRiderIds?: string[]
}) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [showUnteamedOnly, setShowUnteamedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<"points" | "name" | "avgPosition">("points")

  // Get unique values for filtering
  const uniqueTeams = useMemo(() => {
    const teams = new Set(riders.map((r) => r.team).filter(t => t && t.length > 0))
    return Array.from(teams).sort()
  }, [riders])

  // Filter and sort riders based on search and filters
  const filteredRiders = useMemo(() => {
    let filtered = riders.filter((rider) => {
      const matchesSearch =
        rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rider.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rider.nationality.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesTeam = selectedTeams.length === 0 || selectedTeams.includes(rider.team)

      const matchesUnteamed = !showUnteamedOnly || !rider.team || rider.team.length === 0

      return matchesSearch && matchesTeam && matchesUnteamed
    })

    // Sort based on selected sort option
    if (sortBy === "points") {
      filtered.sort((a, b) => b.totalPoints - a.totalPoints)
    } else if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === "avgPosition") {
      filtered.sort((a, b) => {
        const aAvg = a.raceCount > 0 ? a.avgPosition : 999
        const bAvg = b.raceCount > 0 ? b.avgPosition : 999
        return aAvg - bAvg
      })
    }

    return filtered
  }, [riders, searchTerm, selectedTeams, showUnteamedOnly, sortBy])

  const toggleTeam = (team: string) => {
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    )
  }

  const clearAllFilters = () => {
    setSearchTerm("")
    setSelectedTeams([])
    setShowUnteamedOnly(false)
    setSortBy("points")
  }

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedTeams.length > 0 ||
    showUnteamedOnly ||
    sortBy !== "points"

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tighter text-foreground">Professional Riders</h1>
          <p className="text-lg text-muted-foreground">
            Explore world-class cyclists and their season performance
          </p>
        </div>

        {riders.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No riders available yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Search and Filters Section */}
            <div className="space-y-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search riders, teams, or nationalities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700"
                />
              </div>

              {/* Sort Options */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Sort By</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "points", label: "Total Points" },
                    { value: "name", label: "Name (A-Z)" },
                    { value: "avgPosition", label: "Avg Position" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value as typeof sortBy)}
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

              {/* Team Filter */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">By Team</h3>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {uniqueTeams.map((team) => (
                    <button
                      key={team}
                      onClick={() => toggleTeam(team)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                        selectedTeams.includes(team)
                          ? "bg-gradient-green-blue text-white ring-2 ring-offset-1 ring-offset-background ring-primary"
                          : "bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 text-foreground hover:border-primary"
                      }`}
                    >
                      {team}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unteramed Filter */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Status</h3>
                <button
                  onClick={() => setShowUnteamedOnly(!showUnteamedOnly)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    showUnteamedOnly
                      ? "bg-gradient-green-blue text-white ring-2 ring-offset-1 ring-offset-background ring-primary"
                      : "bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 text-foreground hover:border-primary"
                  }`}
                >
                  Unassigned Riders Only
                </button>
              </div>

              {/* Active Filters and Clear Button */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredRiders.length} of {riders.length} riders
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
            {filteredRiders.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    No riders match your search criteria. Try adjusting your filters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="w-full space-y-1">
                {filteredRiders.map((rider) => {
                  const isOnUserTeam = userTeamRiderIds.includes(rider.id)
                  return (
                    <AccordionItem
                      key={rider.id}
                      value={`rider-${rider.id}`}
                      className="border-0 overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <AccordionTrigger className="hover:no-underline bg-white dark:bg-slate-900 px-4 py-2">
                        <div className="flex items-center justify-between w-full gap-3">
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-md bg-gradient-green-blue flex items-center justify-center text-white text-sm font-bold relative flex-shrink-0">
                                {rider.name.charAt(0)}
                                {isOnUserTeam && (
                                  <Star className="absolute -top-0.5 -right-0.5 h-3 w-3 fill-yellow-400 text-yellow-400" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm text-foreground">
                                  {rider.name}
                                </p>
                                {isOnUserTeam && (
                                  <Badge className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-1.5 py-0">My Team</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-green-blue">
                                {rider.totalPoints}
                              </p>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="bg-gradient-to-b from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 px-6 py-6 space-y-8">
                        {/* Category Breakdown */}
                        {rider.results.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-4">RACE CATEGORIES</h3>
                            <div className="space-y-3">
                              {[
                                {
                                  label: "Stage Races",
                                  value: rider.categoryScores.stage,
                                  color: "from-blue-500 to-blue-600",
                                },
                                {
                                  label: "One-Day Events",
                                  value: rider.categoryScores.oneDay,
                                  color: "from-green-500 to-green-600",
                                },
                                {
                                  label: "Classics",
                                  value: rider.categoryScores.classic,
                                  color: "from-purple-500 to-purple-600",
                                },
                              ].map((category) => (
                                <div key={category.label} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-muted-foreground">{category.label}</span>
                                    <span className="text-sm font-bold text-primary">{category.value}</span>
                                  </div>
                                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full bg-gradient-to-r ${category.color} rounded-full transition-all duration-500`}
                                      style={{
                                        width: `${
                                          rider.totalPoints > 0
                                            ? (category.value / rider.totalPoints) * 100
                                            : 0
                                        }%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Performance Metrics */}
                        <div>
                          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-4">PERFORMANCE</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg">
                              <p className="text-sm text-muted-foreground font-medium mb-1">Races</p>
                              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{rider.raceCount}</p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg">
                              <p className="text-sm text-muted-foreground font-medium mb-1">Avg Position</p>
                              <p className="text-3xl font-bold text-green-600 dark:text-green-400">#{rider.avgPosition}</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-lg">
                              <p className="text-sm text-muted-foreground font-medium mb-1">PPR</p>
                              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                                {rider.raceCount > 0 ? (rider.totalPoints / rider.raceCount).toFixed(1) : 0}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Race Details Table */}
                        {rider.results.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">RACE RESULTS</h3>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {rider.results.map((result, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary hover:shadow-md transition-all"
                                >
                                  <div className="flex-1">
                                    <p className="font-semibold text-foreground text-sm">{result.raceName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(result.raceDate), "MMM d, yyyy")}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="text-xs font-medium">
                                      #{result.position}
                                    </Badge>
                                    <span className="font-bold text-primary text-lg">{result.points}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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

  // Get unique values for filtering
  const uniqueSpecialties = useMemo(() => {
    const specialties = new Set(riders.map((r) => r.specialty))
    return Array.from(specialties).sort()
  }, [riders])

  const uniqueTeams = useMemo(() => {
    const teams = new Set(riders.map((r) => r.team))
    return Array.from(teams).sort()
  }, [riders])

  // Filter riders based on search and filters
  const filteredRiders = useMemo(() => {
    return riders.filter((rider) => {
      const matchesSearch =
        rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rider.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rider.nationality.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesSpecialty =
        selectedSpecialties.length === 0 || selectedSpecialties.includes(rider.specialty)

      const matchesTeam = selectedTeams.length === 0 || selectedTeams.includes(rider.team)

      const matchesPoints = rider.totalPoints >= minPoints

      return matchesSearch && matchesSpecialty && matchesTeam && matchesPoints
    })
  }, [riders, searchTerm, selectedSpecialties, selectedTeams, minPoints])

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty]
    )
  }

  const toggleTeam = (team: string) => {
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    )
  }

  const clearAllFilters = () => {
    setSearchTerm("")
    setSelectedSpecialties([])
    setSelectedTeams([])
    setMinPoints(0)
  }

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedSpecialties.length > 0 ||
    selectedTeams.length > 0 ||
    minPoints > 0

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tighter text-foreground">Professional Riders</h1>
          <p className="text-lg text-muted-foreground">
            Explore world-class cyclists and their season performance
          </p>
        </div>

        {riders.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No riders available yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Search and Filters Section */}
            <div className="space-y-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search riders, teams, or nationalities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700"
                />
              </div>

              {/* Filter Groups */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Specialty Filter */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">By Specialty</h3>
                  <div className="flex flex-wrap gap-2">
                    {uniqueSpecialties.map((specialty) => (
                      <button
                        key={specialty}
                        onClick={() => toggleSpecialty(specialty)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          selectedSpecialties.includes(specialty)
                            ? `${specialtyColors[specialty] || "bg-gray-100 text-gray-700"} ring-2 ring-offset-1 ring-offset-background ring-primary`
                            : "bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 text-foreground hover:border-primary"
                        }`}
                      >
                        {specialtyLabels[specialty] || specialty}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Team Filter */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">By Team</h3>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {uniqueTeams.map((team) => (
                      <button
                        key={team}
                        onClick={() => toggleTeam(team)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                          selectedTeams.includes(team)
                            ? "bg-gradient-green-blue text-white ring-2 ring-offset-1 ring-offset-background ring-primary"
                            : "bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 text-foreground hover:border-primary"
                        }`}
                      >
                        {team}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Points Filter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Minimum Points</h3>
                  <span className="text-sm font-medium text-primary">{minPoints}+</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(...riders.map((r) => r.totalPoints), 100)}
                  step="10"
                  value={minPoints}
                  onChange={(e) => setMinPoints(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
              </div>

              {/* Active Filters and Clear Button */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredRiders.length} of {riders.length} riders
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
            {filteredRiders.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    No riders match your search criteria. Try adjusting your filters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="w-full space-y-4">
                {filteredRiders.map((rider) => (
                  <AccordionItem
                    key={rider.id}
                    value={`rider-${rider.id}`}
                    className="border-0 overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-shadow"
                  >
                    <AccordionTrigger className="hover:no-underline bg-white dark:bg-slate-900 px-6 py-5">
                      <div className="flex items-center justify-between w-full gap-4">
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-gradient-green-blue flex items-center justify-center text-white font-bold">
                              {rider.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-lg text-foreground">{rider.name}</p>
                              <p className="text-sm text-muted-foreground">{rider.team}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 mr-4">
                          <div className="text-right">
                            <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-green-blue">
                              {rider.totalPoints}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">TOTAL POINTS</p>
                          </div>
                          <Badge className={`${specialtyColors[rider.specialty] || "bg-gray-100 text-gray-700"} text-xs font-semibold border-0`}>
                            {specialtyLabels[rider.specialty] || rider.specialty}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="bg-gradient-to-b from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 px-6 py-6 space-y-8">
                      {/* Category Breakdown */}
                      {rider.results.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-4">RACE CATEGORIES</h3>
                          <div className="space-y-3">
                            {[
                              {
                                label: "Stage Races",
                                value: rider.categoryScores.stage,
                                color: "from-blue-500 to-blue-600",
                              },
                              {
                                label: "One-Day Events",
                                value: rider.categoryScores.oneDay,
                                color: "from-green-500 to-green-600",
                              },
                              {
                                label: "Classics",
                                value: rider.categoryScores.classic,
                                color: "from-purple-500 to-purple-600",
                              },
                            ].map((category) => (
                              <div key={category.label} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-muted-foreground">{category.label}</span>
                                  <span className="text-sm font-bold text-primary">{category.value}</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full bg-gradient-to-r ${category.color} rounded-full transition-all duration-500`}
                                    style={{
                                      width: `${
                                        rider.totalPoints > 0
                                          ? (category.value / rider.totalPoints) * 100
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Performance Metrics */}
                      <div>
                        <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-4">PERFORMANCE</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg">
                            <p className="text-sm text-muted-foreground font-medium mb-1">Races</p>
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{rider.raceCount}</p>
                          </div>
                          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg">
                            <p className="text-sm text-muted-foreground font-medium mb-1">Avg Position</p>
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400">#{rider.avgPosition}</p>
                          </div>
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-lg">
                            <p className="text-sm text-muted-foreground font-medium mb-1">PPR</p>
                            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                              {rider.raceCount > 0 ? (rider.totalPoints / rider.raceCount).toFixed(1) : 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Race Details Table */}
                      {rider.results.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">RACE RESULTS</h3>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {rider.results.map((result, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary hover:shadow-md transition-all"
                              >
                                <div className="flex-1">
                                  <p className="font-semibold text-foreground text-sm">{result.raceName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(result.raceDate), "MMM d, yyyy")}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs font-medium">
                                    #{result.position}
                                  </Badge>
                                  <span className="font-bold text-primary text-lg">{result.points}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

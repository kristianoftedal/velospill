"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResultEntryForm, getCategoryDisplayName, getBaseCategory } from "@/components/admin/result-entry-form"
import { ResultCorrectionDialog } from "@/components/admin/result-correction-dialog"
import { ResultAuditTrail } from "@/components/admin/result-audit-trail"
import { getResultsForRace, getAuditTrail, getTeamNames } from "./actions"
import { PencilIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Race = {
  id: number
  name: string
  raceType: string
  startDate: Date
  parentRaceId: number | null
  stageNumber: number | null
  hasResults: boolean
  stagesTotal: number
  stagesWithResults: number
}

type Rider = {
  id: number
  name: string
  team: string
  nationality: string
  gender: string
}

type Props = {
  races: Race[]
  riders: Rider[]
}

function resolveScoringRaceType(raceType: string, raceName: string): string {
  if (raceType === "grand_tour") {
    const lower = raceName.toLowerCase()
    if (lower.includes("tour de france") || lower.includes("tdf")) return "grand_tour_tdf"
  }
  return raceType
}

function getAvailableCategories(raceType: string, isStage: boolean, isParentRace: boolean): string[] {
  // For one-day races (no parent, not multi-stage)
  if (!isStage && !isParentRace) {
    return ["finish"]
  }

  // For stages (has parentRaceId)
  if (isStage) {
    const perStage: string[] = ["stage_finish"]

    if (raceType === "grand_tour" || raceType === "grand_tour_tdf" || raceType === "womens_grand_tour") {
      perStage.push("sprint")
      if (raceType === "grand_tour") perStage.push("sprint_giro")
      // Mountain categories
      if (raceType === "grand_tour" || raceType === "grand_tour_tdf") {
        perStage.push("mountain_cc_hcx2_af", "mountain_hc", "mountain_1cat", "mountain_2cat", "mountain_3_4cat")
      }
      if (raceType === "womens_grand_tour") {
        perStage.push("mountain_cc_hcx2_af", "mountain_1_2cat")
      }
      // Jersey categories
      perStage.push("jersey_gc", "jersey_points", "jersey_kom", "jersey_combative")
      // TTT (only on certain stages, but we let admin decide)
      perStage.push("ttt")
    }

    if (raceType === "mini_tour") {
      perStage.push("sprint", "mountain_highest", "mountain_2nd_highest")
      perStage.push("jersey_gc", "jersey_points", "jersey_kom", "jersey_combative")
      perStage.push("ttt")
    }

    return perStage
  }

  // For parent races (grand_tour, mini_tour, womens_grand_tour) -- end-of-tour
  if (isParentRace) {
    return ["end_gc", "end_points", "end_kom", "end_youth", "end_combative", "end_team", "end_other"]
  }

  return ["finish"]
}

/**
 * Expands base categories to include any existing numbered mountain instances.
 * e.g. if mountain_hc_2 exists in the DB, it will appear after mountain_hc.
 * Does NOT add empty next slots — that's the "Add another" button's job.
 */
function expandExistingMountainInstances(base: string[], existingCats: Set<string>): string[] {
  const result: string[] = []
  for (const cat of base) {
    result.push(cat)
    if (getBaseCategory(cat) === cat && cat.startsWith("mountain_")) {
      let n = 2
      while (existingCats.has(`${cat}_${n}`)) {
        result.push(`${cat}_${n}`)
        n++
      }
    }
  }
  return result
}

/** Returns the next numbered mountain category, e.g. "mountain_hc" → "mountain_hc_2", "mountain_hc_2" → "mountain_hc_3" */
function getNextMountainCategory(category: string): string {
  const base = getBaseCategory(category)
  const match = category.match(/_(\d+)$/)
  const n = match ? parseInt(match[1]) + 1 : 2
  return `${base}_${n}`
}

export function ResultsClient({ races, riders }: Props) {
  const router = useRouter()
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [existingResults, setExistingResults] = useState<any[] | null>(null)
  const [auditTrail, setAuditTrail] = useState<any[] | null>(null)
  const [teamNames, setTeamNames] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [showingStageOverview, setShowingStageOverview] = useState(false)
  const [formIsDirty, setFormIsDirty] = useState(false)

  const selectedRace = races.find((r) => r.id === selectedRaceId)

  // Stage dedup: compute the selected parent race ID
  const selectedParentId = selectedRace?.parentRaceId ?? selectedRaceId

  // Group races by type — computed before handleRaceSelect so the handler can reference stagesByParent
  const parentRaces = races.filter((r) => !r.parentRaceId)
  const stagesByParent = races
    .filter((r) => r.parentRaceId)
    .reduce((acc, stage) => {
      if (!acc[stage.parentRaceId!]) {
        acc[stage.parentRaceId!] = []
      }
      acc[stage.parentRaceId!].push(stage)
      return acc
    }, {} as Record<number, Race[]>)

  // Available categories for current race — used for category navigation
  const currentIsStage = !!selectedRace?.parentRaceId
  const currentParentRace = currentIsStage ? races.find(r => r.id === selectedRace?.parentRaceId) : null
  const currentIsParentRace = selectedRace ? races.some(r => r.parentRaceId === selectedRace.id) : false
  const currentRaceTypeForCategories = currentIsStage && currentParentRace
    ? resolveScoringRaceType(currentParentRace.raceType, currentParentRace.name)
    : selectedRace ? resolveScoringRaceType(selectedRace.raceType, selectedRace.name) : ""
  const existingCategorySet = new Set(existingResults?.map((r) => r.category) ?? [])
  const currentAvailableCategories = selectedRace
    ? expandExistingMountainInstances(
        getAvailableCategories(currentRaceTypeForCategories, currentIsStage, currentIsParentRace),
        existingCategorySet
      )
    : []

  // Prev/next category navigation
  const currentCatIndex = selectedCategory ? currentAvailableCategories.indexOf(selectedCategory) : -1
  const prevCategory = currentCatIndex > 0 ? currentAvailableCategories[currentCatIndex - 1] : null
  const nextCategory = currentCatIndex < currentAvailableCategories.length - 1 ? currentAvailableCategories[currentCatIndex + 1] : null

  const handleCategoryNav = (category: string) => {
    if (formIsDirty && !window.confirm("You have unsaved changes. Navigate away without saving?")) return
    setFormIsDirty(false)
    setSelectedCategory(category)
  }

  const handleRaceSelect = async (raceId: number) => {
    const race = races.find((r) => r.id === raceId)

    // If this is a parent race (has stages), show the stage overview instead of the category picker
    const isParentRace = stagesByParent[raceId] && stagesByParent[raceId].length > 0
    if (isParentRace) {
      setSelectedRaceId(raceId)
      setSelectedCategory(null)
      setExistingResults(null)
      setAuditTrail(null)
      setShowingStageOverview(true)
      setModalOpen(true)
      return
    }

    // Not a parent race (one-day or individual stage) — clear stage overview
    setShowingStageOverview(false)
    setSelectedRaceId(raceId)
    setSelectedCategory(null)  // Reset category when switching races
    setLoading(true)

    const expectedGender = (race?.raceType.startsWith("womens_") ? "F" : "M") as "M" | "F"
    const [results, audit, teams] = await Promise.all([
      getResultsForRace(raceId),
      getAuditTrail(raceId),
      getTeamNames(expectedGender),
    ])
    setExistingResults(results.length > 0 ? results : null)
    setAuditTrail(audit.length > 0 ? audit : null)
    setTeamNames(teams)
    setLoading(false)
    setModalOpen(true)
  }

  const handleSuccess = async () => {
    if (!selectedRaceId) return
    // Stay on the same stage — go to category picker so admin can enter the next category
    setSelectedCategory("__picker__")
    setFormIsDirty(false)
    // Refresh results and audit trail
    const [results, audit] = await Promise.all([
      getResultsForRace(selectedRaceId),
      getAuditTrail(selectedRaceId),
    ])
    setExistingResults(results.length > 0 ? results : null)
    setAuditTrail(audit.length > 0 ? audit : null)
    // Refresh server data (Done badges, stagesWithResults counts) without closing modal
    router.refresh()
  }

  const handleEditResult = (result: any) => {
    setSelectedResult(result)
    setCorrectionDialogOpen(true)
  }

  // Modal content
  const modalContent = showingStageOverview && selectedRace ? (
    // Stage overview for parent race
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {stagesByParent[selectedRace.id]?.length || 0} stages total
      </p>
      <div className="space-y-2">
        {(stagesByParent[selectedRace.id] || [])
          .sort((a, b) => (a.stageNumber || 0) - (b.stageNumber || 0))
          .map((stage) => (
            <button
              key={stage.id}
              onClick={() => handleRaceSelect(stage.id)}
              className="w-full text-left px-4 py-3 rounded-md border hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-sm">{stage.name}</span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(stage.startDate).toLocaleDateString()}
                  </div>
                </div>
                {stage.hasResults ? (
                  <Badge variant="secondary" className="text-xs shrink-0">Done</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs shrink-0">Pending</Badge>
                )}
              </div>
            </button>
          ))}
      </div>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setShowingStageOverview(false)
          setSelectedCategory("__picker__")
        }}
      >
        Enter End-of-Tour Results
      </Button>
    </div>
  ) : loading ? (
    <Card>
      <CardContent className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </CardContent>
    </Card>
  ) : existingResults && !selectedCategory ? (
    <>
      <Tabs defaultValue="results" className="w-full">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="history">Change History</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="mt-4">
          <div className="space-y-6">
            {/* Group results by category */}
            {(() => {
              const groupedResults = existingResults.reduce((acc, result) => {
                const cat = result.category || "finish"
                if (!acc[cat]) acc[cat] = []
                acc[cat].push(result)
                return acc
              }, {} as Record<string, any[]>)

              return (Object.entries(groupedResults) as [string, any[]][]).map(([category, categoryResults]) => (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle>{getCategoryDisplayName(category)}</CardTitle>
                    <CardDescription>
                      Click the edit button to correct any result
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Position</TableHead>
                          <TableHead>Rider</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead className="text-right">Points</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryResults.map((result: any) => (
                          <TableRow key={result.id}>
                            <TableCell className="font-medium">{result.position}</TableCell>
                            <TableCell>{result.riderName}</TableCell>
                            <TableCell>{result.riderTeam}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {result.time || "—"}
                            </TableCell>
                            <TableCell className="text-right">{result.points}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditResult(result)}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            })()}

            {/* Add more results button */}
            {!selectedCategory && (
              <Button
                variant="outline"
                onClick={() => setSelectedCategory("__picker__")}
                className="w-full"
              >
                Add More Results
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {auditTrail && <ResultAuditTrail auditEntries={auditTrail} />}
        </TabsContent>
      </Tabs>

      {selectedResult && (
        <ResultCorrectionDialog
          result={selectedResult}
          riders={riders}
          raceType={selectedRace?.raceType || ""}
          open={correctionDialogOpen}
          onOpenChange={setCorrectionDialogOpen}
          onSuccess={handleSuccess}
        />
      )}
    </>
  ) : selectedCategory && selectedCategory !== "__picker__" ? (
    // Show result entry form for selected category
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={() => setSelectedCategory(null)}
        className="mb-2"
      >
        <ChevronLeftIcon className="h-4 w-4 mr-2" />
        Back to category selection
      </Button>
      <ResultEntryForm
        raceId={selectedRaceId!}
        riders={riders}
        raceType={selectedRace?.raceType || ""}
        category={selectedCategory}
        teams={teamNames}
        onSuccess={handleSuccess}
        onDirtyChange={setFormIsDirty}
      />
      {getBaseCategory(selectedCategory).startsWith("mountain_") && (
        <Button
          variant="outline"
          onClick={() => {
            if (formIsDirty && !window.confirm("You have unsaved changes. Add another without saving?")) return
            setFormIsDirty(false)
            setSelectedCategory(getNextMountainCategory(selectedCategory))
          }}
          className="w-full"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add another {getCategoryDisplayName(getBaseCategory(selectedCategory))}
        </Button>
      )}
    </div>
  ) : (
    // Show category picker
    (() => {
      if (!selectedRace) return null

      // Determine raceType for scoring
      const isStage = !!selectedRace.parentRaceId
      const parentRace = isStage ? races.find(r => r.id === selectedRace.parentRaceId) : null
      const raceTypeForCategories = isStage && parentRace
        ? resolveScoringRaceType(parentRace.raceType, parentRace.name)
        : resolveScoringRaceType(selectedRace.raceType, selectedRace.name)

      // Determine if this is a parent race (has stages)
      const isParentRace = races.some(r => r.parentRaceId === selectedRace.id)

      const availableCategories = expandExistingMountainInstances(
        getAvailableCategories(raceTypeForCategories, isStage, isParentRace),
        existingCategorySet
      )

      return (
        <Card>
          <CardHeader>
            <CardTitle>Select Result Category</CardTitle>
            <CardDescription>
              Choose the type of result you want to enter for {selectedRace.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableCategories.map((category) => (
                <Button
                  key={category}
                  variant="outline"
                  onClick={() => { setFormIsDirty(false); setSelectedCategory(category) }}
                  className="h-auto py-4 px-4 text-left justify-start"
                >
                  <div>
                    <div className="font-medium">
                      {getCategoryDisplayName(category)}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )
    })()
  )

  return (
    <div>
      {/* Race selector — full width */}
      <Card>
        <CardHeader>
          <CardTitle>Select Race</CardTitle>
          <CardDescription>Choose a race to enter or view results</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {parentRaces.map((race) => (
            <div key={race.id} className="space-y-1">
              <button
                onClick={() => handleRaceSelect(race.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors ${
                  selectedRaceId === race.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{race.name}</span>
                  {race.stagesTotal > 0 ? (
                    <Badge
                      variant={race.stagesWithResults === race.stagesTotal && race.stagesTotal > 0 ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {race.stagesWithResults}/{race.stagesTotal} done
                    </Badge>
                  ) : race.hasResults ? (
                    <Badge variant="secondary" className="text-xs">Done</Badge>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(race.startDate).toLocaleDateString()}
                </div>
              </button>

              {/* Show stages only for the currently selected parent or the parent of the selected stage */}
              {stagesByParent[race.id] && race.id === selectedParentId && (
                <div className="ml-4 space-y-1">
                  {stagesByParent[race.id]
                    .sort((a, b) => (a.stageNumber || 0) - (b.stageNumber || 0))
                    .map((stage) => (
                      <button
                        key={stage.id}
                        onClick={() => handleRaceSelect(stage.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-xs hover:bg-accent transition-colors ${
                          selectedRaceId === stage.id ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{stage.name}</span>
                          {stage.hasResults && (
                            <Badge variant="secondary" className="text-xs">
                              Done
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Modal dialog for results area */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[80vw] sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRace?.name}</DialogTitle>
            {selectedCategory && selectedCategory !== "__picker__" && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!prevCategory}
                  onClick={() => prevCategory && handleCategoryNav(prevCategory)}
                  className="text-xs"
                >
                  <ChevronLeftIcon className="h-3 w-3 mr-1" />
                  {prevCategory ? getCategoryDisplayName(prevCategory) : "—"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!nextCategory}
                  onClick={() => nextCategory && handleCategoryNav(nextCategory)}
                  className="text-xs"
                >
                  {nextCategory ? getCategoryDisplayName(nextCategory) : "—"}
                  <ChevronRightIcon className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </DialogHeader>
          {modalContent}
        </DialogContent>
      </Dialog>
    </div>
  )
}

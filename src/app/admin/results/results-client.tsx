"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResultEntryForm, categoryDisplayNames } from "@/components/admin/result-entry-form"
import { ResultCorrectionDialog } from "@/components/admin/result-correction-dialog"
import { ResultAuditTrail } from "@/components/admin/result-audit-trail"
import { getResultsForRace, getAuditTrail, getTeamNames } from "./actions"
import { PencilIcon, ChevronLeftIcon } from "lucide-react"
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

export function ResultsClient({ races, riders }: Props) {
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [existingResults, setExistingResults] = useState<any[] | null>(null)
  const [auditTrail, setAuditTrail] = useState<any[] | null>(null)
  const [teamNames, setTeamNames] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const selectedRace = races.find((r) => r.id === selectedRaceId)

  // Stage dedup: compute the selected parent race ID
  const selectedParentId = selectedRace?.parentRaceId ?? selectedRaceId

  const handleRaceSelect = async (raceId: number) => {
    setSelectedRaceId(raceId)
    setSelectedCategory(null)  // Reset category when switching races
    setLoading(true)

    const race = races.find((r) => r.id === raceId)
    if (race?.hasResults) {
      const [results, audit] = await Promise.all([
        getResultsForRace(raceId),
        getAuditTrail(raceId),
      ])
      setExistingResults(results)
      setAuditTrail(audit)
    } else {
      setExistingResults(null)
      setAuditTrail(null)
    }

    // Load team names for TTT
    const expectedGender = (race?.raceType.startsWith("womens_") ? "F" : "M") as "M" | "F"
    const teams = await getTeamNames(expectedGender)
    setTeamNames(teams)

    setLoading(false)
    setModalOpen(true)
  }

  const handleSuccess = async () => {
    if (!selectedRaceId) return
    setModalOpen(false)
    // Reset category to return to category picker
    setSelectedCategory(null)
    // Refresh results and audit trail
    const [results, audit] = await Promise.all([
      getResultsForRace(selectedRaceId),
      getAuditTrail(selectedRaceId),
    ])
    setExistingResults(results)
    setAuditTrail(audit)
    // Update the races list to mark it as having results
    window.location.reload()
  }

  const handleEditResult = (result: any) => {
    setSelectedResult(result)
    setCorrectionDialogOpen(true)
  }

  // Group races by type
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

  // Modal content
  const modalContent = loading ? (
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
                    <CardTitle>{categoryDisplayNames[category] || category}</CardTitle>
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
      />
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

      const availableCategories = getAvailableCategories(
        raceTypeForCategories,
        isStage,
        isParentRace
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
                  onClick={() => setSelectedCategory(category)}
                  className="h-auto py-4 px-4 text-left justify-start"
                >
                  <div>
                    <div className="font-medium">
                      {categoryDisplayNames[category] || category}
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
                  {race.hasResults && (
                    <Badge variant="secondary" className="text-xs">
                      Done
                    </Badge>
                  )}
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
          </DialogHeader>
          {modalContent}
        </DialogContent>
      </Dialog>
    </div>
  )
}

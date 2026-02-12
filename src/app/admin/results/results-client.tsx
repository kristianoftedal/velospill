"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResultEntryForm } from "@/components/admin/result-entry-form"
import { ResultCorrectionDialog } from "@/components/admin/result-correction-dialog"
import { ResultAuditTrail } from "@/components/admin/result-audit-trail"
import { getResultsForRace, getAuditTrail } from "./actions"
import { PencilIcon } from "lucide-react"
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

export function ResultsClient({ races, riders }: Props) {
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null)
  const [existingResults, setExistingResults] = useState<any[] | null>(null)
  const [auditTrail, setAuditTrail] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<any | null>(null)

  const selectedRace = races.find((r) => r.id === selectedRaceId)

  const handleRaceSelect = async (raceId: number) => {
    setSelectedRaceId(raceId)
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

    setLoading(false)
  }

  const handleSuccess = async () => {
    if (!selectedRaceId) return
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

  return (
    <div className="grid gap-6 md:grid-cols-[300px,1fr]">
      {/* Race selector */}
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

              {/* Show stages if they exist */}
              {stagesByParent[race.id] && (
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

      {/* Results area */}
      <div>
        {!selectedRaceId ? (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Select a race to get started</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : existingResults ? (
          <>
            <Tabs defaultValue="results" className="w-full">
              <TabsList>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="history">Change History</TabsTrigger>
              </TabsList>

              <TabsContent value="results" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedRace?.name} Results</CardTitle>
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
                        {existingResults.map((result) => (
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
        ) : (
          <ResultEntryForm
            raceId={selectedRaceId}
            riders={riders}
            raceType={selectedRace?.raceType || ""}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </div>
  )
}

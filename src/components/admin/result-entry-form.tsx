"use client"

import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { submitRaceResults, previewResults, submitTttResults, previewTttResults, scrapeAndMatchPcsResults } from "@/app/admin/results/actions"
import { Badge } from "@/components/ui/badge"
import { TrashIcon, PlusIcon, DownloadIcon } from "lucide-react"
import { useState } from "react"
import { ScoringPreview } from "@/components/admin/scoring-preview"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const resultSchema = z.object({
  results: z
    .array(
      z.object({
        position: z.number().min(1),
        riderId: z.number().min(1, "Select a rider"),
        time: z.string().optional(),
      })
    )
    .min(1, "Enter at least one result")
    .refine(
      (results) => {
        const positions = results.map((r) => r.position)
        return positions.length === new Set(positions).size
      },
      { message: "Positions must be unique" }
    )
    .refine(
      (results) => {
        const riderIds = results.map((r) => r.riderId)
        return riderIds.length === new Set(riderIds).size
      },
      { message: "Each rider can only appear once" }
    ),
})

const tttSchema = z.object({
  teamPlacements: z
    .array(
      z.object({
        position: z.number().min(1),
        teamName: z.string().min(1, "Select a team"),
      })
    )
    .min(1, "Enter at least one team placement")
    .refine(
      (placements) => {
        const positions = placements.map((p) => p.position)
        return positions.length === new Set(positions).size
      },
      { message: "Positions must be unique" }
    )
    .refine(
      (placements) => {
        const teamNames = placements.map((p) => p.teamName)
        return teamNames.length === new Set(teamNames).size
      },
      { message: "Team names must be unique" }
    ),
})

type ResultFormData = z.infer<typeof resultSchema>
type TttFormData = z.infer<typeof tttSchema>

type Rider = {
  id: number
  name: string
  team: string
  nationality: string
  gender: string
}

type Props = {
  raceId: number
  riders: Rider[]
  raceType: string
  category: string  // NEW
  teams?: string[]  // NEW: distinct team names for TTT
  onSuccess: () => void
}

const categoryDisplayNames: Record<string, string> = {
  "finish": "Race Finish",
  "stage_finish": "Stage Finish",
  "sprint": "Sprint Classification",
  "sprint_giro": "Sprint (Giro double sprint)",
  "mountain_cc_hcx2_af": "Mountain: CC/HCx2/Altitude Finish",
  "mountain_hc": "Mountain: HC",
  "mountain_1cat": "Mountain: 1st Category",
  "mountain_2cat": "Mountain: 2nd Category",
  "mountain_3_4cat": "Mountain: 3rd/4th Category",
  "mountain_highest": "Mountain: Highest Category",
  "mountain_2nd_highest": "Mountain: 2nd Highest Category",
  "mountain_1_2cat": "Mountain: 1st/2nd Category",
  "jersey_gc": "Jersey: GC Leader",
  "jersey_points": "Jersey: Points Leader",
  "jersey_kom": "Jersey: KOM Leader",
  "jersey_combative": "Jersey: Most Combative",
  "ttt": "Team Time Trial",
  "end_gc": "End of Tour: GC",
  "end_points": "End of Tour: Points",
  "end_kom": "End of Tour: KOM",
  "end_youth": "End of Tour: Youth",
  "end_combative": "End of Tour: Combative",
  "end_team": "End of Tour: Team",
  "end_other": "End of Tour: Other",
}

const categoryPrefillCounts: Record<string, number> = {
  "finish": 10,
  "stage_finish": 10,
  "sprint": 3,
  "sprint_giro": 3,
  "mountain_cc_hcx2_af": 5,
  "mountain_hc": 5,
  "mountain_1cat": 5,
  "mountain_2cat": 5,
  "mountain_3_4cat": 5,
  "mountain_highest": 3,
  "mountain_2nd_highest": 3,
  "mountain_1_2cat": 5,
  "jersey_gc": 1,
  "jersey_points": 1,
  "jersey_kom": 1,
  "jersey_combative": 1,
  "end_gc": 10,
  "end_points": 10,
  "end_kom": 10,
  "end_youth": 10,
  "end_combative": 1,
  "end_team": 10,
  "end_other": 5,
}

export { categoryDisplayNames }

function TttEntrySection({ raceId, teams, raceType, onSuccess }: { raceId: number; teams: string[]; raceType: string; onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)

  const form = useForm<TttFormData>({
    resolver: zodResolver(tttSchema),
    defaultValues: {
      teamPlacements: [{ position: 1, teamName: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "teamPlacements",
  })

  const onSubmit = async (data: TttFormData) => {
    setServerError(null)

    const result = await submitTttResults({
      raceId,
      teamPlacements: data.teamPlacements,
    })

    if (result.success) {
      toast.success("TTT results saved successfully!")
      onSuccess()
    } else {
      const error = result.error as any
      if (error?._form) {
        setServerError(error._form[0])
        toast.error(error._form[0])
      } else {
        toast.error("Failed to save TTT results")
      }
    }
  }

  const handleAddPlacement = () => {
    const nextPosition = fields.length + 1
    append({ position: nextPosition, teamName: "" })
  }

  const handlePreview = async () => {
    const isValid = await form.trigger()
    if (!isValid) {
      toast.error("Please fix form errors before previewing")
      return
    }

    const formData = form.getValues()

    setIsPreviewing(true)
    const result = await previewTttResults(raceId, formData.teamPlacements)
    setIsPreviewing(false)

    if (result.success && result.data) {
      setPreviewData(result.data)
      toast.success("Preview loaded!")
    } else {
      toast.error(result.error || "Failed to load preview")
    }
  }

  const expectedGender = raceType.startsWith("womens_") ? "F" : "M"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter TTT Results</CardTitle>
        <CardDescription>
          Team Time Trial ({expectedGender === "M" ? "Men" : "Women"})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Team placements */}
          <div className="space-y-3">
            {fields.map((field, index) => {
              const teamName = form.watch(`teamPlacements.${index}.teamName`)

              return (
                <div key={field.id} className="flex items-start gap-3">
                  {/* Position */}
                  <div className="w-20">
                    <Label htmlFor={`ttt-position-${index}`} className="text-xs">
                      Pos.
                    </Label>
                    <Input
                      id={`ttt-position-${index}`}
                      type="number"
                      min="1"
                      {...form.register(`teamPlacements.${index}.position`, {
                        valueAsNumber: true,
                      })}
                      className="h-9"
                    />
                  </div>

                  {/* Team selector */}
                  <div className="flex-1">
                    <Label htmlFor={`ttt-team-${index}`} className="text-xs">
                      Team
                    </Label>
                    <Combobox
                      value={teamName || undefined}
                      onValueChange={(value) => {
                        if (value) {
                          form.setValue(`teamPlacements.${index}.teamName`, value, {
                            shouldValidate: true,
                          })
                        }
                      }}
                    >
                      <ComboboxInput
                        id={`ttt-team-${index}`}
                        placeholder={teamName || "Select team..."}
                        className="h-9"
                      />
                      <ComboboxContent>
                        <ComboboxList>
                          <ComboboxEmpty>No teams found</ComboboxEmpty>
                          {teams.map((team) => (
                            <ComboboxItem key={team} value={team}>
                              {team}
                            </ComboboxItem>
                          ))}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    {form.formState.errors.teamPlacements?.[index]?.teamName && (
                      <p className="text-xs text-destructive mt-1">
                        {form.formState.errors.teamPlacements[index]?.teamName?.message}
                      </p>
                    )}
                  </div>

                  {/* Remove button */}
                  <div className="pt-5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="h-9 w-9"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Form-level errors */}
          {form.formState.errors.teamPlacements?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.teamPlacements.message}</p>
          )}
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          {/* Add team placement button */}
          <Button type="button" variant="outline" onClick={handleAddPlacement} className="w-full">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Team Placement
          </Button>

          {/* Preview section */}
          {previewData && (
            <div className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">TTT Scoring Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Position</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Points per Rider</TableHead>
                        <TableHead className="text-right">Riders on Team</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.position}</TableCell>
                          <TableCell>{item.teamName}</TableCell>
                          <TableCell className="text-right">{item.pointsPerRider}</TableCell>
                          <TableCell className="text-right">{item.riderCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant={previewData ? "outline" : "default"}
              onClick={handlePreview}
              disabled={isPreviewing || form.formState.isSubmitting}
            >
              {isPreviewing ? "Loading..." : "Preview TTT Scoring"}
            </Button>
            <Button
              type="submit"
              variant={previewData ? "default" : "outline"}
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Saving..." : "Submit TTT Results"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

type ImportMatch = {
  position: number
  scrapedName: string
  scrapedTeam: string
  matchedRider: { id: number; name: string; team: string } | null
  matchScore: number
  alternatives: Array<{ id: number; name: string; team: string }>
  selectedRiderId: number | null
}

export function ResultEntryForm({ raceId, riders, raceType, category, teams, onSuccess }: Props) {
  // --- ALL HOOKS FIRST (rules of hooks: no hooks after conditional returns) ---
  const [serverError, setServerError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [pcsUrl, setPcsUrl] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importMatches, setImportMatches] = useState<ImportMatch[] | null>(null)

  const expectedGender = raceType.startsWith("womens_") ? "F" : "M"
  const filteredRiders = riders.filter((r) => r.gender === expectedGender)
  const prefillCount = categoryPrefillCounts[category] ?? 1

  const form = useForm<ResultFormData>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
      results: Array.from({ length: prefillCount }, (_, i) => ({
        position: i + 1,
        riderId: 0,
        time: "",
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "results",
  })

  // --- TTT early return (after all hooks) ---
  if (category === "ttt") {
    if (!teams || teams.length === 0) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">No teams available for TTT entry</p>
          </CardContent>
        </Card>
      )
    }
    return <TttEntrySection raceId={raceId} teams={teams} raceType={raceType} onSuccess={onSuccess} />
  }

  const onSubmit = async (data: ResultFormData) => {
    setServerError(null)

    const result = await submitRaceResults({
      raceId,
      category,
      results: data.results,
    })

    if (result.success) {
      toast.success("Results saved successfully!")
      onSuccess()
    } else {
      const error = result.error as any
      if (error?._form) {
        setServerError(error._form[0])
        toast.error(error._form[0])
      } else {
        toast.error("Failed to save results")
      }
    }
  }

  const handleAddResult = () => {
    const nextPosition = fields.length + 1
    append({ position: nextPosition, riderId: 0, time: "" })
  }

  const handlePreview = async () => {
    const isValid = await form.trigger()
    if (!isValid) {
      toast.error("Please fix form errors before previewing")
      return
    }

    const formData = form.getValues()
    setIsPreviewing(true)
    const result = await previewResults(raceId, formData.results, category)
    setIsPreviewing(false)

    if (result.success && result.data) {
      setPreviewData(result.data)
      toast.success("Preview loaded!")
    } else {
      toast.error(result.error || "Failed to load preview")
    }
  }

  const handleImport = async () => {
    if (!pcsUrl.trim()) return
    setIsImporting(true)
    setImportError(null)
    setImportMatches(null)

    const result = await scrapeAndMatchPcsResults(pcsUrl.trim(), raceId)
    setIsImporting(false)

    if (!result.success) {
      setImportError(result.error)
      return
    }

    setImportMatches(
      result.results.map((r) => ({
        ...r,
        selectedRiderId: r.matchedRider?.id ?? null,
      })),
    )
  }

  const updateImportMatch = (index: number, riderId: number | null) => {
    setImportMatches((prev) =>
      prev ? prev.map((m, i) => (i === index ? { ...m, selectedRiderId: riderId } : m)) : prev,
    )
  }

  const handleApplyMatches = () => {
    if (!importMatches) return
    const newResults = importMatches
      .filter((m) => m.selectedRiderId)
      .map((m) => ({ position: m.position, riderId: m.selectedRiderId!, time: "" }))
    if (newResults.length === 0) return
    form.setValue("results", newResults, { shouldValidate: false })
    setImportMatches(null)
    setPcsUrl("")
    toast.success(`Applied ${newResults.length} results from PCS`)
  }

  return (
    <div className="space-y-4">
      {/* PCS Import */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DownloadIcon className="h-4 w-4" />
            Import from ProCyclingStats
          </CardTitle>
          <CardDescription>Paste a PCS results URL to auto-fill rider results</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="https://www.procyclingstats.com/race/..."
              value={pcsUrl}
              onChange={(e) => setPcsUrl(e.target.value)}
              className="h-9"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleImport}
              disabled={isImporting || !pcsUrl.trim()}
              className="shrink-0"
            >
              {isImporting ? "Importing..." : "Import"}
            </Button>
          </div>

          {importError && (
            <p className="text-sm text-destructive">{importError}</p>
          )}

          {importMatches && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {importMatches.length} results scraped — review matches and click Apply
              </p>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Pos</TableHead>
                      <TableHead>PCS Name</TableHead>
                      <TableHead>Matched Rider</TableHead>
                      <TableHead className="w-20">Conf.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importMatches.map((match, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{match.position}</TableCell>
                        <TableCell>
                          <div className="text-sm">{match.scrapedName}</div>
                          <div className="text-xs text-muted-foreground">{match.scrapedTeam}</div>
                        </TableCell>
                        <TableCell>
                          <select
                            value={match.selectedRiderId ?? ""}
                            onChange={(e) =>
                              updateImportMatch(i, e.target.value ? Number(e.target.value) : null)
                            }
                            className="text-sm border rounded px-2 py-1 w-full bg-background"
                          >
                            <option value="">— Not matched —</option>
                            {filteredRiders.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          {match.matchedRider ? (
                            <Badge
                              variant={
                                match.matchScore >= 0.9
                                  ? "default"
                                  : match.matchScore >= 0.7
                                    ? "secondary"
                                    : "destructive"
                              }
                              className="text-xs"
                            >
                              {Math.round(match.matchScore * 100)}%
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              No match
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={handleApplyMatches}>
                  Apply {importMatches.filter((m) => m.selectedRiderId).length} Results to Form
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main entry form */}
      <Card>
        <CardHeader>
          <CardTitle>Enter Race Results</CardTitle>
          <CardDescription>
            {categoryDisplayNames[category] || category} ({expectedGender === "M" ? "Men" : "Women"})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Field array */}
            <div className="space-y-3">
              {fields.map((field, index) => {
                const riderId = form.watch(`results.${index}.riderId`)
                const selectedRider = filteredRiders.find((r) => r.id === riderId)

                return (
                  <div key={field.id} className="flex items-start gap-3">
                    {/* Position */}
                    <div className="w-20">
                      <Label htmlFor={`position-${index}`} className="text-xs">
                        Pos.
                      </Label>
                      <Input
                        id={`position-${index}`}
                        type="number"
                        min="1"
                        {...form.register(`results.${index}.position`, {
                          valueAsNumber: true,
                        })}
                        className="h-9"
                      />
                    </div>

                    {/* Rider selector */}
                    <div className="flex-1">
                      <Label htmlFor={`rider-${index}`} className="text-xs">
                        Rider
                      </Label>
                      <Combobox
                        value={selectedRider?.name ?? ""}
                        onValueChange={(name) => {
                          const rider = filteredRiders.find((r) => r.name === name)
                          form.setValue(`results.${index}.riderId`, rider?.id ?? 0, {
                            shouldValidate: true,
                          })
                        }}
                      >
                        <ComboboxInput
                          id={`rider-${index}`}
                          placeholder="Search rider..."
                          className="h-9"
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            <ComboboxEmpty>No riders found</ComboboxEmpty>
                            {filteredRiders.map((rider) => (
                              <ComboboxItem key={rider.id} value={rider.name}>
                                <div className="flex flex-col">
                                  <span>{rider.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {rider.team}
                                  </span>
                                </div>
                              </ComboboxItem>
                            ))}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      {form.formState.errors.results?.[index]?.riderId && (
                        <p className="text-xs text-destructive mt-1">
                          {form.formState.errors.results[index]?.riderId?.message}
                        </p>
                      )}
                    </div>

                    {/* Time */}
                    <div className="w-32">
                      <Label htmlFor={`time-${index}`} className="text-xs">
                        Time (optional)
                      </Label>
                      <Input
                        id={`time-${index}`}
                        placeholder="4h32m10s"
                        {...form.register(`results.${index}.time`)}
                        className="h-9"
                      />
                    </div>

                    {/* Remove button */}
                    <div className="pt-5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="h-9 w-9"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Form-level errors */}
            {form.formState.errors.results?.message && (
              <p className="text-sm text-destructive">{form.formState.errors.results.message}</p>
            )}
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            {/* Add result button */}
            <Button type="button" variant="outline" onClick={handleAddResult} className="w-full">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Result
            </Button>

            {/* Preview section */}
            {previewData && (
              <div className="pt-4">
                <ScoringPreview
                  preview={previewData.preview}
                  totalPointsAwarded={previewData.totalPointsAwarded}
                  raceName={previewData.raceName}
                />
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant={previewData ? "outline" : "default"}
                onClick={handlePreview}
                disabled={isPreviewing || form.formState.isSubmitting}
              >
                {isPreviewing ? "Loading..." : "Preview Scoring"}
              </Button>
              <Button
                type="submit"
                variant={previewData ? "default" : "outline"}
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Saving..." : "Submit Results"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

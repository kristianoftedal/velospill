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
import { submitRaceResults, previewResults, submitTttResults, previewTttResults } from "@/app/admin/results/actions"
import { TrashIcon, PlusIcon } from "lucide-react"
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

export function ResultEntryForm({ raceId, riders, raceType, category, teams, onSuccess }: Props) {
  // If TTT category, render the TTT-specific form
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

  // Regular rider-based entry form
  const [serverError, setServerError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)

  // Filter riders by gender
  const expectedGender = raceType.startsWith("womens_") ? "F" : "M"
  const filteredRiders = riders.filter((r) => r.gender === expectedGender)

  const form = useForm<ResultFormData>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
      results: [{ position: 1, riderId: 0, time: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "results",
  })

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
    // Trigger form validation
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

  return (
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
                      value={riderId ? String(riderId) : undefined}
                      onValueChange={(value) => {
                        if (value) {
                          form.setValue(`results.${index}.riderId`, Number(value), {
                            shouldValidate: true,
                          })
                        }
                      }}
                    >
                      <ComboboxInput
                        id={`rider-${index}`}
                        placeholder={selectedRider?.name || "Select rider..."}
                        className="h-9"
                      />
                      <ComboboxContent>
                        <ComboboxList>
                          <ComboboxEmpty>No riders found</ComboboxEmpty>
                          {filteredRiders.map((rider) => (
                            <ComboboxItem key={rider.id} value={String(rider.id)}>
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
  )
}

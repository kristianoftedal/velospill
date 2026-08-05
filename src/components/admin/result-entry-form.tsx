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
import { submitRaceResults, submitTttResults, getScoringScale, getResultsForRace } from "@/app/admin/results/actions"
import { TrashIcon, PlusIcon } from "lucide-react"
import { useState, useEffect } from "react"

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
  placements: z
    .array(
      z.object({
        position: z.number().min(1),
        riderIds: z.array(z.number().nullable()).max(8),
      })
    )
    .min(1, "Enter at least one placement")
    .refine(
      (placements) => {
        const positions = placements.map((p) => p.position)
        return positions.length === new Set(positions).size
      },
      { message: "Positions must be unique" }
    )
    .refine(
      (placements) => {
        const allRiderIds = placements.flatMap((p) => p.riderIds.filter((id): id is number => id !== null))
        return allRiderIds.length === new Set(allRiderIds).size
      },
      { message: "Each rider can only appear once" }
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
  category: string
  instance?: number
  instanceLabel?: string
  teams?: string[]
  onSuccess: () => void
  onDirtyChange?: (isDirty: boolean) => void
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

function MultiRiderEntrySection({ raceId, raceType, riders, category, onSuccess }: { raceId: number; raceType: string; riders: Rider[]; category: string; onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [riderSearchQueries, setRiderSearchQueries] = useState<Record<string, string>>({})
  const [scoringScale, setScoringScale] = useState<Record<string, number>>({})

  const expectedGender = raceType.startsWith("womens_") ? "F" : "M"
  const filteredRiders = riders.filter((r) => r.gender === expectedGender)

  const form = useForm<TttFormData>({
    resolver: zodResolver(tttSchema),
    defaultValues: {
      placements: [{ position: 1, riderIds: [null, null, null, null, null, null, null, null] }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "placements",
  })

  useEffect(() => {
    getScoringScale(raceId, category).then((scale) => {
      setScoringScale(scale)
      const scoringPositions = Object.keys(scale).length
      if (scoringPositions > 0) {
        const currentPlacements = form.getValues("placements")
        const hasExistingData = currentPlacements.some((p) => p.riderIds.some((id) => id !== null))
        if (!hasExistingData) {
          form.reset({
            placements: Array.from({ length: scoringPositions }, (_, i) => ({
              position: i + 1,
              riderIds: [null, null, null, null, null, null, null, null] as (number | null)[],
            })),
          })
        }
      }
    }).catch(() => {})
  }, [raceId, category]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getResultsForRace(raceId).then((allResults) => {
      const categoryResults = allResults.filter((r) => r.category === category)
      if (categoryResults.length === 0) return

      const positionMap = new Map<number, (number | null)[]>()
      for (const r of categoryResults) {
        if (!positionMap.has(r.position)) {
          positionMap.set(r.position, [])
        }
        positionMap.get(r.position)!.push(r.riderId)
      }

      const placements = Array.from(positionMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([position, riderIds]) => {
          const padded: (number | null)[] = [...riderIds]
          while (padded.length < 8) padded.push(null)
          return { position, riderIds: padded }
        })

      form.reset({ placements })
    }).catch(() => {})
  }, [raceId]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: TttFormData) => {
    setServerError(null)

    const result = await submitTttResults({
      raceId,
      placements: data.placements,
      category,
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

  const handleAddPlacement = () => {
    const nextPosition = fields.length + 1
    append({ position: nextPosition, riderIds: [null, null, null, null, null, null, null, null] })
  }

  const allSelectedRiderIds = new Set(
    form.watch("placements").flatMap((p) => p.riderIds.filter((id): id is number => id !== null))
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter {categoryDisplayNames[category] || category} Results</CardTitle>
        <CardDescription>
          {categoryDisplayNames[category] || category} ({expectedGender === "M" ? "Men" : "Women"}) — Select up to 8 riders per position
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {fields.map((field, posIndex) => (
            <div key={field.id} className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-20">
                    <Label htmlFor={`ttt-position-${posIndex}`} className="text-xs">
                      Pos.
                    </Label>
                    <Input
                      id={`ttt-position-${posIndex}`}
                      type="number"
                      min="1"
                      {...form.register(`placements.${posIndex}.position`, { valueAsNumber: true })}
                      className="h-9"
                    />
                  </div>
                  <div className="w-16">
                    <Label className="text-xs">Pts</Label>
                    <div className="h-9 flex items-center text-sm text-muted-foreground font-mono">
                      {scoringScale[String(form.watch(`placements.${posIndex}.position`))] ?? "—"}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(posIndex)}
                  disabled={fields.length === 1}
                  className="h-9 w-9"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: 8 }, (_, slotIndex) => {
                  const key = `${posIndex}-${slotIndex}`
                  const riderId = form.watch(`placements.${posIndex}.riderIds.${slotIndex}`)
                  const selectedRider = riderId ? filteredRiders.find((r) => r.id === riderId) : null

                  return (
                    <div key={slotIndex}>
                      <Label className="text-xs text-muted-foreground">Rider {slotIndex + 1}</Label>
                      <Combobox
                        value={selectedRider?.name ?? ""}
                        onValueChange={(name) => {
                          if (name === "") {
                            form.setValue(`placements.${posIndex}.riderIds.${slotIndex}`, null, { shouldValidate: true })
                          } else {
                            const rider = filteredRiders.find((r) => r.name === name)
                            form.setValue(`placements.${posIndex}.riderIds.${slotIndex}`, rider?.id ?? null, { shouldValidate: true })
                          }
                          setRiderSearchQueries((prev) => ({ ...prev, [key]: "" }))
                        }}
                        onInputValueChange={(inputValue) => {
                          setRiderSearchQueries((prev) => ({ ...prev, [key]: inputValue }))
                        }}
                      >
                        <ComboboxInput
                          placeholder={selectedRider?.name || "Search rider..."}
                          className="h-8 text-sm"
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            <ComboboxEmpty>No riders found</ComboboxEmpty>
                            {(() => {
                              const q = (riderSearchQueries[key] ?? "").toLowerCase()
                              const available = filteredRiders.filter(
                                (r) => r.id === riderId || !allSelectedRiderIds.has(r.id)
                              )
                              const visible = q
                                ? available.filter((r) => r.name.toLowerCase().includes(q) || r.team.toLowerCase().includes(q))
                                : available
                              return visible.map((rider) => (
                                <ComboboxItem key={rider.id} value={rider.name}>
                                  <div className="flex flex-col">
                                    <span className="text-sm">{rider.name}</span>
                                    <span className="text-xs text-muted-foreground">{rider.team}</span>
                                  </div>
                                </ComboboxItem>
                              ))
                            })()}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>
                  )
                })}
              </div>

              {form.formState.errors.placements?.[posIndex]?.riderIds && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.placements[posIndex]?.riderIds?.message}
                </p>
              )}
            </div>
          ))}

          {form.formState.errors.placements?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.placements.message}</p>
          )}
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <Button type="button" variant="outline" onClick={handleAddPlacement} className="w-full">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Position
          </Button>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Submit Results"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function ResultEntryForm({ raceId, riders, raceType, category, instance, instanceLabel, teams, onSuccess, onDirtyChange }: Props) {
  // --- ALL HOOKS FIRST (rules of hooks: no hooks after conditional returns) ---
  const [serverError, setServerError] = useState<string | null>(null)
  const [riderSearchQueries, setRiderSearchQueries] = useState<Record<number, string>>({})
  const [scoringScale, setScoringScale] = useState<Record<string, number>>({})

  const expectedGender = raceType.startsWith("womens_") ? "F" : "M"
  const filteredRiders = riders.filter((r) => r.gender === expectedGender)
  const prefillCount = categoryPrefillCounts[category] ?? 1

  const form = useForm<ResultFormData>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
      results: Array.from({ length: prefillCount }, (_, i) => ({ position: i + 1, riderId: 0, time: "" })),
    },
  })

  const isDirty = form.formState.isDirty
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    getScoringScale(raceId, category).then((scale) => {
      setScoringScale(scale)
      const scoringPositions = Object.keys(scale).length
      if (scoringPositions > 0) {
        const currentResults = form.getValues("results")
        const hasExistingData = currentResults.some((r) => r.riderId !== 0)
        if (!hasExistingData) {
          form.reset({
            results: Array.from({ length: scoringPositions }, (_, i) => ({ position: i + 1, riderId: 0, time: "" })),
          })
        }
      }
    }).catch(() => {})
  }, [raceId, category]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch existing results for this race+category and pre-fill the form
  useEffect(() => {
    getResultsForRace(raceId).then((allResults: Awaited<ReturnType<typeof getResultsForRace>>) => {
      const categoryResults = allResults.filter((r) => r.category === category && r.instance === (instance ?? 1))
      if (categoryResults.length > 0) {
        form.reset({
          results: categoryResults
            .sort((a, b) => a.position - b.position)
            .map((r) => ({ position: r.position, riderId: r.riderId, time: r.time ?? "" })),
        })
      }
    }).catch(() => {})
  }, [raceId, category, instance]) // eslint-disable-line react-hooks/exhaustive-deps

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "results",
  })

  if (category === "ttt" || category === "end_team") {
    return <MultiRiderEntrySection raceId={raceId} raceType={raceType} riders={riders} category={category} onSuccess={onSuccess} />
  }

  const onSubmit = async (data: ResultFormData) => {
    setServerError(null)

    const result = await submitRaceResults({
      raceId,
      category,
      instance: instance ?? 1,
      instanceLabel,
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

  return (
    <div className="space-y-4">
      {/* Main entry form */}
      <Card>
        <CardHeader>
          <CardTitle>Enter Race Results</CardTitle>
          <CardDescription>
            {categoryDisplayNames[category] || category}
            {instance && instance > 1 ? ` #${instance}` : ""}
            {instanceLabel ? ` — ${instanceLabel}` : ""}
            {" "}({expectedGender === "M" ? "Men" : "Women"})
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
                          setRiderSearchQueries((prev) => ({ ...prev, [index]: "" }))
                        }}
                        onInputValueChange={(inputValue) => {
                          setRiderSearchQueries((prev) => ({ ...prev, [index]: inputValue }))
                        }}
                      >
                        <ComboboxInput
                          id={`rider-${index}`}
                          placeholder={selectedRider?.name || "Search rider..."}
                          className="h-9"
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            <ComboboxEmpty>No riders found</ComboboxEmpty>
                            {(() => {
                              const q = (riderSearchQueries[index] ?? "").toLowerCase()
                              const visibleRiders = q
                                ? filteredRiders.filter((r) => r.name.toLowerCase().includes(q) || r.team.toLowerCase().includes(q))
                                : filteredRiders
                              return visibleRiders.map((rider) => (
                                <ComboboxItem key={rider.id} value={rider.name}>
                                  <div className="flex flex-col">
                                    <span>{rider.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {rider.team}
                                    </span>
                                  </div>
                                </ComboboxItem>
                              ))
                            })()}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      {form.formState.errors.results?.[index]?.riderId && (
                        <p className="text-xs text-destructive mt-1">
                          {form.formState.errors.results[index]?.riderId?.message}
                        </p>
                      )}
                    </div>

                    {/* Points preview */}
                    <div className="w-16">
                      <Label className="text-xs">Pts</Label>
                      <div className="h-9 flex items-center text-sm text-muted-foreground font-mono">
                        {scoringScale[String(form.watch(`results.${index}.position`))] ?? "—"}
                      </div>
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

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="submit"
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

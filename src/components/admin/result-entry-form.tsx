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
import { importUciResults } from "@/app/admin/results/uci-actions"
import { UciImportDialog } from "@/components/admin/uci-import-dialog"
import { LEADER_ONLY_CATEGORIES } from "@/app/admin/results/categories"
import { scoredPositionLimit } from "@/lib/scoring-scale"
import { canImportFromUci, UCI_UNSUPPORTED_REASONS } from "@/lib/uci/category-map"
import { TrashIcon, PlusIcon, DownloadIcon } from "lucide-react"
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
  onSuccess: () => void
  onDirtyChange?: (isDirty: boolean) => void
  /** Opens the UCI competition picker when the race has no link yet. */
  onRequestUciLink?: () => void
  /** When true, an empty category prefills itself from UCI on mount. */
  uciLinked?: boolean
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
  // Scored on the jersey wearer (rank 1) but named for the classification the
  // jersey represents, which is what UCI publishes and what admins look for.
  "jersey_gc": "General Classification",
  "jersey_points": "Points Classification",
  "jersey_kom": "Mountains Classification",
  "jersey_combative": "Most Combative",
  "ttt": "Team Time Trial",
  // Only shown under the "End of tour" heading, so the prefix is redundant.
  "end_gc": "General Classification",
  "end_points": "Points Classification",
  "end_kom": "Mountains Classification",
  "end_youth": "Youth Classification",
  "end_combative": "Most Combative",
  "end_team": "Team Classification",
  "end_other": "Other",
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

/** Rider slots offered per position in the multi-rider categories (TTT, team GC). */
const MULTI_RIDER_SLOTS = 8

const emptyRiderSlots = (): (number | null)[] =>
  Array.from({ length: MULTI_RIDER_SLOTS }, () => null)

function MultiRiderEntrySection({ raceId, raceType, riders, category, onSuccess, onRequestUciLink }: { raceId: number; raceType: string; riders: Rider[]; category: string; onSuccess: () => void; onRequestUciLink?: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [riderSearchQueries, setRiderSearchQueries] = useState<Record<string, string>>({})
  const [scoringScale, setScoringScale] = useState<Record<string, number>>({})
  const [importOpen, setImportOpen] = useState(false)

  const expectedGender = raceType.startsWith("womens_") ? "F" : "M"
  const filteredRiders = riders.filter((r) => r.gender === expectedGender)

  const form = useForm<TttFormData>({
    resolver: zodResolver(tttSchema),
    defaultValues: {
      placements: [{ position: 1, riderIds: emptyRiderSlots() }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "placements",
  })

  // The scale decides how many positions are worth entering and the saved
  // results decide what fills them, so both land in one reset — fetching them
  // separately let two resets race and drop whichever arrived first.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [scale, allResults] = await Promise.all([
        getScoringScale(raceId, category).catch(() => ({}) as Record<string, number>),
        getResultsForRace(raceId).catch(
          () => [] as Awaited<ReturnType<typeof getResultsForRace>>,
        ),
      ])
      if (cancelled) return

      setScoringScale(scale)

      const categoryResults = allResults.filter((r) => r.category === category)
      if (categoryResults.length > 0) {
        const positionMap = new Map<number, number[]>()
        for (const r of categoryResults) {
          if (!positionMap.has(r.position)) positionMap.set(r.position, [])
          positionMap.get(r.position)!.push(r.riderId)
        }

        form.reset({
          placements: Array.from(positionMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([position, riderIds]) => {
              const padded: (number | null)[] = [...riderIds]
              while (padded.length < MULTI_RIDER_SLOTS) padded.push(null)
              return { position, riderIds: padded }
            }),
        })
        return
      }

      const rowLimit = scoredPositionLimit(scale)
      if (rowLimit) {
        form.reset({
          placements: Array.from({ length: rowLimit }, (_, i) => ({
            position: i + 1,
            riderIds: emptyRiderSlots(),
          })),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [raceId, category]) // eslint-disable-line react-hooks/exhaustive-deps

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
    append({ position: nextPosition, riderIds: emptyRiderSlots() })
  }

  const allSelectedRiderIds = new Set(
    form.watch("placements").flatMap((p) => p.riderIds.filter((id): id is number => id !== null))
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Enter {categoryDisplayNames[category] || category} Results</CardTitle>
            <CardDescription>
              {categoryDisplayNames[category] || category} ({expectedGender === "M" ? "Men" : "Women"}) — Select up to {MULTI_RIDER_SLOTS} riders per position
            </CardDescription>
          </div>
          {canImportFromUci(category) ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <DownloadIcon className="h-4 w-4 mr-2" />
              Import from UCI
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground sm:max-w-[16rem] sm:text-right">
              {UCI_UNSUPPORTED_REASONS[category] ?? "No UCI import for this category."}
            </p>
          )}
        </div>
        {canImportFromUci(category) && (
          <UciImportDialog
            raceId={raceId}
            category={category}
            riders={filteredRiders}
            defaultCount={scoredPositionLimit(scoringScale) ?? 25}
            open={importOpen}
            onOpenChange={setImportOpen}
            onNeedsLink={onRequestUciLink}
            onApplyTtt={(imported) => {
              if (imported.length === 0) return
              // The team name is not part of the stored result — a placement is
              // just its riders — so only the rider list carries over.
              form.reset({
                placements: imported.map(({ position, riderIds }) => {
                  const padded: (number | null)[] = riderIds.slice(0, MULTI_RIDER_SLOTS)
                  while (padded.length < MULTI_RIDER_SLOTS) padded.push(null)
                  return { position, riderIds: padded }
                }),
              })
            }}
          />
        )}
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
                {Array.from({ length: MULTI_RIDER_SLOTS }, (_, slotIndex) => {
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

export function ResultEntryForm({ raceId, riders, raceType, category, instance, instanceLabel, onSuccess, onDirtyChange, onRequestUciLink, uciLinked }: Props) {
  // --- ALL HOOKS FIRST (rules of hooks: no hooks after conditional returns) ---
  const [serverError, setServerError] = useState<string | null>(null)
  const [riderSearchQueries, setRiderSearchQueries] = useState<Record<number, string>>({})
  const [scoringScale, setScoringScale] = useState<Record<string, number>>({})
  const [importOpen, setImportOpen] = useState(false)
  const [uciPrefill, setUciPrefill] = useState<{
    sectionLabel: string
    resultTitle: string
    matched: number
    skipped: number
  } | null>(null)

  const expectedGender = raceType.startsWith("womens_") ? "F" : "M"
  const filteredRiders = riders.filter((r) => r.gender === expectedGender)
  // Used until the scoring scale arrives, and when a category has no scale.
  const fallbackCount = categoryPrefillCounts[category] ?? 1

  // Only positions that award points are worth entering, and the scale differs
  // per race type (6 for a mini-tour stage, 10 for a grand tour stage, 20 for a
  // high-priority one-day race), so the form is sized from the scale itself.
  const rowLimit = scoredPositionLimit(scoringScale) ?? fallbackCount

  const form = useForm<ResultFormData>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
      results: Array.from({ length: fallbackCount }, (_, i) => ({ position: i + 1, riderId: 0, time: "" })),
    },
  })

  const isDirty = form.formState.isDirty
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // The scoring scale decides how many positions are worth entering, so it has
  // to land before rows are built — but it does not depend on the saved results,
  // so the two are fetched together.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [scale, allResults] = await Promise.all([
        getScoringScale(raceId, category).catch(() => ({}) as Record<string, number>),
        getResultsForRace(raceId).catch(
          () => [] as Awaited<ReturnType<typeof getResultsForRace>>,
        ),
      ])
      if (cancelled) return
      setScoringScale(scale)

      const limit = scoredPositionLimit(scale) ?? (categoryPrefillCounts[category] ?? 1)

      const categoryResults = allResults.filter(
        (r) => r.category === category && r.instance === (instance ?? 1),
      )
      if (categoryResults.length > 0) {
        form.reset({
          results: categoryResults
            .sort((a, b) => a.position - b.position)
            .map((r) => ({ position: r.position, riderId: r.riderId, time: r.time ?? "" })),
        })
        return
      }

      // Nothing saved yet — prefill from UCI when the tour is linked.
      // TTT and team GC have their own importer inside MultiRiderEntrySection.
      if (uciLinked && category !== "ttt" && canImportFromUci(category)) {
        const res = await importUciResults({ raceId, category })
        if (cancelled) return
        if (res.success && res.kind === "individual") {
          // Only scoring positions matter, and a rider outside the roster
          // forfeits their place rather than promoting whoever came next —
          // so a skip leaves a visible gap the admin can correct.
          const scoring = res.rows.filter((r) => r.position <= limit)
          const matched = scoring.filter((r) => r.matchedRider)
          if (matched.length > 0) {
            form.reset({
              results: matched.map((r) => ({
                position: r.position,
                riderId: r.matchedRider!.id,
                time: "",
              })),
            })
            setUciPrefill({
              sectionLabel: res.meta.sectionLabel,
              resultTitle: res.meta.resultTitle,
              matched: matched.length,
              skipped: scoring.length - matched.length,
            })
            return
          }
        }
      }

      // No prefill: just size the blank rows to the scale, leaving anything the
      // admin has already typed alone.
      if (limit !== fallbackCount && !form.formState.isDirty) {
        form.reset({
          results: Array.from({ length: limit }, (_, i) => ({
            position: i + 1,
            riderId: 0,
            time: "",
          })),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [raceId, category, instance, uciLinked]) // eslint-disable-line react-hooks/exhaustive-deps

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "results",
  })

  // --- multi-rider early return (after all hooks) ---
  if (category === "ttt" || category === "end_team") {
    return <MultiRiderEntrySection raceId={raceId} raceType={raceType} riders={riders} category={category} onSuccess={onSuccess} onRequestUciLink={onRequestUciLink} />
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
      <Card className="gap-4 p-0 sm:gap-6 sm:p-6">
        <CardHeader className="px-0 sm:px-6">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
            <div>
              <CardTitle>Enter Race Results</CardTitle>
              <CardDescription>
                {categoryDisplayNames[category] || category}
                {instance && instance > 1 ? ` #${instance}` : ""}
                {instanceLabel ? ` — ${instanceLabel}` : ""}
                {" "}({expectedGender === "M" ? "Men" : "Women"})
                {LEADER_ONLY_CATEGORIES.has(category)
                  ? " · leader only — the rider who wore the jersey on this stage"
                  : scoredPositionLimit(scoringScale)
                    ? ` · positions 1–${scoredPositionLimit(scoringScale)} score`
                    : ""}
              </CardDescription>
            </div>
            {canImportFromUci(category) ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <DownloadIcon className="h-4 w-4 mr-2" />
                Import from UCI
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground sm:max-w-xs sm:text-right">
                {UCI_UNSUPPORTED_REASONS[category] ?? "No UCI equivalent — enter manually."}
              </p>
            )}
          </div>
          {canImportFromUci(category) && (
            <UciImportDialog
              raceId={raceId}
              category={category}
              riders={filteredRiders}
              defaultCount={rowLimit}
              open={importOpen}
              onOpenChange={setImportOpen}
              onNeedsLink={onRequestUciLink}
              onApplyIndividual={(imported) => {
                if (imported.length === 0) return
                setUciPrefill(null)
                form.reset(
                  { results: imported.map((r) => ({ ...r, time: "" })) },
                  { keepDefaultValues: true },
                )
                // reset() clears the dirty flag; the prefill is unsaved, so re-mark it.
                form.setValue(`results.0.position`, imported[0].position, { shouldDirty: true })
              }}
            />
          )}
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {uciPrefill && (
              <div className="rounded-md border border-blue-500/40 bg-blue-500/5 px-3 py-2 text-sm">
                Prefilled from UCI · {uciPrefill.sectionLabel} ·{" "}
                <span className="font-medium">{uciPrefill.resultTitle}</span> —{" "}
                {uciPrefill.matched} rider{uciPrefill.matched === 1 ? "" : "s"} matched
                {uciPrefill.skipped > 0
                  ? `, ${uciPrefill.skipped} skipped (not on a roster)`
                  : ""}
                . Check it, then submit — nothing is saved yet.
              </div>
            )}
            {/* Field array */}
            <div className="space-y-3 sm:space-y-2">
              {/* Labels once, instead of on every row. */}
              <div className="hidden sm:grid sm:grid-cols-[5rem_1fr_3rem_2.25rem] sm:gap-3">
                <span className="text-xs text-muted-foreground">Pos.</span>
                <span className="text-xs text-muted-foreground">Rider</span>
                <span className="text-xs text-muted-foreground">Pts</span>
                <span />
              </div>
              {fields.map((field, index) => {
                const riderId = form.watch(`results.${index}.riderId`)
                const selectedRider = filteredRiders.find((r) => r.id === riderId)

                return (
                  /* Two rows on a phone — pos/pts/remove, then the rider on its
                     own line — collapsing to a single row from sm up. Explicit
                     cell placement keeps one markup tree for both. */
                  <div
                    key={field.id}
                    className="grid grid-cols-[4.5rem_1fr_2.75rem] items-end gap-2 rounded-md border p-3 sm:grid-cols-[5rem_1fr_3rem_2.25rem] sm:items-center sm:gap-3 sm:rounded-none sm:border-0 sm:p-0"
                  >
                    {/* Position */}
                    <div className="col-start-1 row-start-1">
                      <Label
                        htmlFor={`position-${index}`}
                        className="text-xs sm:sr-only"
                      >
                        Pos.
                      </Label>
                      <Input
                        id={`position-${index}`}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        {...form.register(`results.${index}.position`, {
                          valueAsNumber: true,
                        })}
                        className="h-11 sm:h-9"
                      />
                    </div>

                    {/* Rider selector */}
                    <div className="col-span-3 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                      <Label
                        htmlFor={`rider-${index}`}
                        className="text-xs sm:sr-only"
                      >
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
                          className="h-11 sm:h-9"
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
                    <div className="col-start-2 row-start-1 sm:col-start-3">
                      <Label className="text-xs sm:sr-only">Pts</Label>
                      <div className="flex h-11 items-center font-mono text-sm text-muted-foreground sm:h-9">
                        {scoringScale[String(form.watch(`results.${index}.position`))] ?? "—"}
                      </div>
                    </div>

                    {/* Remove */}
                    <div className="col-start-3 row-start-1 sm:col-start-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label={`Remove position ${index + 1}`}
                        className="size-11 sm:size-9"
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
                className="w-full sm:w-auto"
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

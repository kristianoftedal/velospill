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
import { submitRaceResults, previewResults } from "@/app/admin/results/actions"
import { TrashIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { ScoringPreview } from "@/components/admin/scoring-preview"

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

type ResultFormData = z.infer<typeof resultSchema>

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

export function ResultEntryForm({ raceId, riders, raceType, category, onSuccess }: Props) {
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

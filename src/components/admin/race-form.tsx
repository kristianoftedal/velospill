"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createRace, updateRace } from "@/app/admin/races/actions"
import { useState } from "react"

const raceFormSchema = z.object({
  name: z.string().min(2, "Race name required"),
  raceType: z.enum([
    "grand_tour",
    "high_priority_one_day",
    "low_priority_one_day",
    "mini_tour",
    "womens_grand_tour",
    "womens_one_day",
    "world_championship",
  ]),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().optional(),
  season: z.number().int().min(2020).max(2030),
})

type RaceFormValues = z.infer<typeof raceFormSchema>

type Race = {
  id: number
  name: string
  raceType: string
  startDate: Date
  endDate: Date | null
  season: number
}

interface RaceFormProps {
  initialData?: Race
  onSuccess?: () => void
}

const raceTypeOptions = [
  { value: "grand_tour", label: "Grand Tour (Men)" },
  { value: "high_priority_one_day", label: "High Priority One-Day" },
  { value: "low_priority_one_day", label: "Low Priority One-Day" },
  { value: "mini_tour", label: "Mini Tour" },
  { value: "womens_grand_tour", label: "Women's Grand Tour" },
  { value: "womens_one_day", label: "Women's One-Day" },
  { value: "world_championship", label: "World Championship" },
]

const multiStageRaceTypes = ["grand_tour", "mini_tour", "womens_grand_tour"]

export function RaceForm({ initialData, onSuccess }: RaceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<RaceFormValues>({
    resolver: zodResolver(raceFormSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          raceType: initialData.raceType as any,
          startDate: initialData.startDate.toISOString().split("T")[0],
          endDate: initialData.endDate
            ? initialData.endDate.toISOString().split("T")[0]
            : "",
          season: initialData.season,
        }
      : {
          name: "",
          raceType: "high_priority_one_day",
          startDate: "",
          endDate: "",
          season: new Date().getFullYear(),
        },
  })

  const selectedRaceType = form.watch("raceType")
  const isMultiStage = multiStageRaceTypes.includes(selectedRaceType)

  async function onSubmit(data: RaceFormValues) {
    setIsSubmitting(true)
    setError(null)

    const result = initialData
      ? await updateRace(initialData.id, data as any)
      : await createRace(data as any)

    setIsSubmitting(false)

    if (result.success) {
      onSuccess?.()
    } else {
      if (result.error && "_form" in result.error && Array.isArray(result.error._form)) {
        setError(result.error._form[0])
      } else {
        setError("An error occurred")
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Race Name</FormLabel>
              <FormControl>
                <Input placeholder="Tour de France" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="raceType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Race Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select race type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {raceTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isMultiStage && (
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="season"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Season</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : initialData
              ? "Update Race"
              : "Create Race"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

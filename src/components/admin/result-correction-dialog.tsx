"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { correctRaceResult, deleteRaceResult } from "@/app/admin/results/actions"

const correctionSchema = z.object({
  position: z.number().min(1),
  riderId: z.number().min(1, "Select a rider"),
  time: z.string().optional(),
  reason: z.string().min(1, "Reason is required"),
})

type CorrectionFormData = z.infer<typeof correctionSchema>

type Rider = {
  id: number
  name: string
  team: string
  gender: string
}

type Result = {
  id: number
  position: number
  riderId: number
  riderName: string
  time: string | null
  points: number
}

type Props = {
  result: Result
  riders: Rider[]
  raceType: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ResultCorrectionDialog({
  result,
  riders,
  raceType,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter riders by gender
  const expectedGender = raceType.startsWith("womens_") ? "F" : "M"
  const filteredRiders = riders.filter((r) => r.gender === expectedGender)

  const form = useForm<CorrectionFormData>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      position: result.position,
      riderId: result.riderId,
      time: result.time || "",
      reason: "",
    },
  })

  const onSubmit = async (data: CorrectionFormData) => {
    setIsSubmitting(true)

    const updates: { position?: number; riderId?: number; time?: string } = {}

    if (data.position !== result.position) {
      updates.position = data.position
    }
    if (data.riderId !== result.riderId) {
      updates.riderId = data.riderId
    }
    if (data.time !== (result.time || "")) {
      updates.time = data.time
    }

    // Check if anything changed
    if (Object.keys(updates).length === 0) {
      toast.error("No changes detected")
      setIsSubmitting(false)
      return
    }

    const response = await correctRaceResult(result.id, updates, data.reason)
    setIsSubmitting(false)

    if (response.success) {
      toast.success("Result corrected successfully")
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(response.error || "Failed to correct result")
    }
  }

  const handleDelete = async () => {
    const reason = form.getValues("reason")
    if (!reason || reason.trim().length === 0) {
      toast.error("Please provide a reason for deletion")
      return
    }

    setIsDeleting(true)
    const response = await deleteRaceResult(result.id, reason)
    setIsDeleting(false)

    if (response.success) {
      toast.success("Result deleted successfully")
      onSuccess()
      setShowDeleteConfirm(false)
      onOpenChange(false)
    } else {
      toast.error(response.error || "Failed to delete result")
    }
  }

  const selectedRider = filteredRiders.find((r) => r.id === form.watch("riderId"))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Correct Race Result</DialogTitle>
            <DialogDescription>
              Edit position {result.position} - {result.riderName}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Original values display */}
            <div className="bg-muted/50 p-3 rounded-md text-sm space-y-1">
              <p className="font-medium">Original values:</p>
              <p>
                Position: <span className="font-mono">{result.position}</span> | Rider:{" "}
                <span className="font-mono">{result.riderName}</span> | Time:{" "}
                <span className="font-mono">{result.time || "—"}</span> | Points:{" "}
                <span className="font-mono">{result.points}</span>
              </p>
            </div>

            {/* Position field */}
            <div>
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                type="number"
                min="1"
                {...form.register("position", { valueAsNumber: true })}
              />
              {form.formState.errors.position && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.position.message}
                </p>
              )}
            </div>

            {/* Rider selector */}
            <div>
              <Label htmlFor="rider">Rider</Label>
              <Combobox
                value={form.watch("riderId") ? String(form.watch("riderId")) : undefined}
                onValueChange={(value) => {
                  if (value) {
                    form.setValue("riderId", Number(value), { shouldValidate: true })
                  }
                }}
              >
                <ComboboxInput
                  id="rider"
                  placeholder={selectedRider?.name || "Select rider..."}
                />
                <ComboboxContent>
                  <ComboboxList>
                    <ComboboxEmpty>No riders found</ComboboxEmpty>
                    {filteredRiders.map((rider) => (
                      <ComboboxItem key={rider.id} value={String(rider.id)}>
                        <div className="flex flex-col">
                          <span>{rider.name}</span>
                          <span className="text-xs text-muted-foreground">{rider.team}</span>
                        </div>
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {form.formState.errors.riderId && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.riderId.message}
                </p>
              )}
            </div>

            {/* Time field */}
            <div>
              <Label htmlFor="time">Time (optional)</Label>
              <Input id="time" placeholder="4h32m10s" {...form.register("time")} />
            </div>

            {/* Reason field */}
            <div>
              <Label htmlFor="reason" className="text-destructive">
                Reason for correction *
              </Label>
              <Textarea
                id="reason"
                placeholder="Explain why this correction is needed..."
                {...form.register("reason")}
                className="min-h-[80px]"
              />
              {form.formState.errors.reason && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting}
              >
                Delete Result
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Correction"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Result?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the result for position {result.position} -{" "}
              {result.riderName}. This action cannot be undone, but will be recorded in the
              audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Result"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

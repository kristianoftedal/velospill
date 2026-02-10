"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createStage, deleteStage } from "@/app/admin/races/actions"
import { format } from "date-fns"
import { Trash2 } from "lucide-react"

type Stage = {
  id: number
  name: string
  stageNumber: number
  startDate: Date
}

interface StageManagerProps {
  parentRaceId: number
  parentRaceName: string
  parentStartDate: Date
  parentEndDate: Date | null
  stages: Stage[]
  onClose: () => void
  onUpdate: () => void
}

export function StageManager({
  parentRaceId,
  parentRaceName,
  parentStartDate,
  parentEndDate,
  stages,
  onClose,
  onUpdate,
}: StageManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [showAutoGenerate, setShowAutoGenerate] = useState(false)
  const [deleteStageId, setDeleteStageId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add stage form state
  const [stageName, setStageName] = useState("")
  const [stageNumber, setStageNumber] = useState("")
  const [stageDate, setStageDate] = useState("")

  // Auto-generate state
  const [numStages, setNumStages] = useState("")

  async function handleAddStage() {
    setIsSubmitting(true)

    const result = await createStage(parentRaceId, {
      name: stageName,
      stageNumber,
      startDate: stageDate,
    } as any)

    setIsSubmitting(false)

    if (result.success) {
      setStageName("")
      setStageNumber("")
      setStageDate("")
      setShowAddForm(false)
      onUpdate()
    }
  }

  async function handleAutoGenerate() {
    if (!numStages || !parentEndDate) return

    setIsSubmitting(true)

    const count = parseInt(numStages)
    const startDate = new Date(parentStartDate)
    const endDate = new Date(parentEndDate)
    const totalDays = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Generate stages with evenly distributed dates
    for (let i = 1; i <= count; i++) {
      const daysOffset = Math.floor((totalDays / (count - 1)) * (i - 1))
      const stageDate = new Date(startDate)
      stageDate.setDate(stageDate.getDate() + daysOffset)

      await createStage(parentRaceId, {
        name: `Stage ${i}`,
        stageNumber: i.toString(),
        startDate: stageDate.toISOString().split("T")[0],
      } as any)
    }

    setIsSubmitting(false)
    setShowAutoGenerate(false)
    setNumStages("")
    onUpdate()
  }

  async function handleDeleteStage(stageId: number) {
    setIsSubmitting(true)
    await deleteStage(stageId)
    setIsSubmitting(false)
    setDeleteStageId(null)
    onUpdate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Manage Stages: {parentRaceName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {stages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((stage) => (
                  <TableRow key={stage.id}>
                    <TableCell>{stage.stageNumber}</TableCell>
                    <TableCell>{stage.name}</TableCell>
                    <TableCell>
                      {format(new Date(stage.startDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteStageId(stage.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No stages yet. Add stages individually or auto-generate them.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              variant="outline"
            >
              {showAddForm ? "Cancel" : "Add Stage"}
            </Button>
            <Button
              onClick={() => setShowAutoGenerate(!showAutoGenerate)}
              variant="outline"
            >
              {showAutoGenerate ? "Cancel" : "Auto-Generate Stages"}
            </Button>
          </div>

          {showAddForm && (
            <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold text-sm">Add Individual Stage</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Stage Number</label>
                  <Input
                    type="number"
                    value={stageNumber}
                    onChange={(e) => setStageNumber(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    placeholder="Stage 1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={stageDate}
                    onChange={(e) => setStageDate(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={handleAddStage}
                disabled={isSubmitting || !stageName || !stageNumber || !stageDate}
              >
                {isSubmitting ? "Adding..." : "Add Stage"}
              </Button>
            </div>
          )}

          {showAutoGenerate && (
            <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold text-sm">Auto-Generate Stages</h4>
              <p className="text-xs text-muted-foreground">
                Generates sequential stages evenly distributed between start and end
                dates.
              </p>
              <div>
                <label className="text-sm font-medium">Number of Stages</label>
                <Input
                  type="number"
                  value={numStages}
                  onChange={(e) => setNumStages(e.target.value)}
                  placeholder="21"
                  className="max-w-xs"
                />
              </div>
              <Button
                onClick={handleAutoGenerate}
                disabled={isSubmitting || !numStages || !parentEndDate}
              >
                {isSubmitting ? "Generating..." : "Generate Stages"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteStageId !== null}
        onOpenChange={() => setDeleteStageId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteStageId && handleDeleteStage(deleteStageId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

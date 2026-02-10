"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { DataTable } from "@/components/admin/data-table"
import { columns } from "./columns"
import { RaceForm } from "@/components/admin/race-form"
import { RaceCSVImport } from "@/components/admin/race-csv-import"
import { StageManager } from "@/components/admin/stage-manager"
import { deleteRace, getRaceWithStages } from "./actions"
import { useRouter } from "next/navigation"

type Race = {
  id: number
  name: string
  raceType: string
  startDate: Date
  endDate: Date | null
  season: number
  stageCount: number
}

interface RacesClientProps {
  races: Race[]
}

export function RacesClient({ races }: RacesClientProps) {
  const router = useRouter()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showStageManager, setShowStageManager] = useState(false)
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)
  const [stageData, setStageData] = useState<{
    stages: Array<{
      id: number
      name: string
      stageNumber: number
      startDate: Date
    }>
  } | null>(null)

  function handleEdit(race: Race) {
    setSelectedRace(race)
    setShowEditDialog(true)
  }

  function handleDelete(race: Race) {
    setSelectedRace(race)
    setShowDeleteDialog(true)
  }

  async function handleManageStages(race: Race) {
    setSelectedRace(race)
    const raceWithStages = await getRaceWithStages(race.id)
    setStageData(raceWithStages as any)
    setShowStageManager(true)
  }

  async function confirmDelete() {
    if (!selectedRace) return

    await deleteRace(selectedRace.id)
    setShowDeleteDialog(false)
    setSelectedRace(null)
    router.refresh()
  }

  function handleSuccess() {
    setShowAddDialog(false)
    setShowEditDialog(false)
    setShowImportDialog(false)
    setSelectedRace(null)
    router.refresh()
  }

  function handleStageUpdate() {
    router.refresh()
  }

  return (
    <>
      <div className="flex gap-2 mb-4">
        <Button onClick={() => setShowAddDialog(true)}>Add Race</Button>
        <Button variant="outline" onClick={() => setShowImportDialog(true)}>
          Import CSV
        </Button>
      </div>

      <DataTable
        columns={columns(handleEdit, handleDelete, handleManageStages)}
        data={races}
        searchColumn="name"
        searchPlaceholder="Search races..."
      />

      {/* Add Race Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Race</DialogTitle>
          </DialogHeader>
          <RaceForm onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>

      {/* Edit Race Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Race</DialogTitle>
          </DialogHeader>
          {selectedRace && (
            <RaceForm initialData={selectedRace} onSuccess={handleSuccess} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Race?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedRace?.name}" and all its
              stages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Races</DialogTitle>
          </DialogHeader>
          <RaceCSVImport onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>

      {/* Stage Manager */}
      {showStageManager && selectedRace && stageData && (
        <StageManager
          parentRaceId={selectedRace.id}
          parentRaceName={selectedRace.name}
          parentStartDate={selectedRace.startDate}
          parentEndDate={selectedRace.endDate}
          stages={stageData.stages}
          onClose={() => {
            setShowStageManager(false)
            setSelectedRace(null)
            setStageData(null)
          }}
          onUpdate={handleStageUpdate}
        />
      )}
    </>
  )
}

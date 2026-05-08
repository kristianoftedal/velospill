"use client";

import { DataTable } from "@/components/admin/data-table";
import { RaceCSVImport } from "@/components/admin/race-csv-import";
import { RaceForm } from "@/components/admin/race-form";
import { StageManager } from "@/components/admin/stage-manager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteRace, getRaceWithStages } from "./actions";
import { columns } from "./columns";

type Race = {
  id: number;
  name: string;
  raceType: string;
  startDate: Date;
  endDate: Date | null;
  season: number;
  stageCount: number;
};

type RaceWithStages = NonNullable<Awaited<ReturnType<typeof getRaceWithStages>>>;

interface RacesClientProps {
  races: Race[];
}

export function RacesClient({ races }: RacesClientProps) {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showStageManager, setShowStageManager] = useState(false);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [stageData, setStageData] = useState<RaceWithStages | null>(null);
  const [stageManagerError, setStageManagerError] = useState<string | null>(
    null,
  );

  function handleEdit(race: Race) {
    setSelectedRace(race);
    setShowEditDialog(true);
  }

  function handleDelete(race: Race) {
    setSelectedRace(race);
    setShowDeleteDialog(true);
  }

  async function handleManageStages(race: Race) {
    setSelectedRace(race);
    setStageManagerError(null);
    try {
      const raceWithStages = await getRaceWithStages(race.id);
      if (!raceWithStages) {
        setStageManagerError("Race not found");
        return;
      }
      setStageData(raceWithStages);
      setShowStageManager(true);
    } catch (err) {
      setStageManagerError((err as Error).message);
    }
  }

  async function confirmDelete() {
    if (!selectedRace) return;

    await deleteRace(selectedRace.id);
    setShowDeleteDialog(false);
    setSelectedRace(null);
    router.refresh();
  }

  function handleSuccess() {
    setShowAddDialog(false);
    setShowEditDialog(false);
    setShowImportDialog(false);
    setSelectedRace(null);
    router.refresh();
  }

  async function handleStageUpdate() {
    router.refresh();
    if (selectedRace) {
      const raceWithStages = await getRaceWithStages(selectedRace.id);
      if (raceWithStages) setStageData(raceWithStages);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={() => setShowAddDialog(true)}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          Add Race
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowImportDialog(true)}
          className="gap-2"
        >
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
              This will permanently delete &quot;{selectedRace?.name}&quot; and
              all its stages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
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

      {/* Stage Manager error */}
      {stageManagerError && (
        <p className="text-sm text-red-600">
          Failed to load stages: {stageManagerError}
        </p>
      )}

      {/* Stage Manager */}
      {showStageManager && selectedRace && stageData && (
        <StageManager
          parentRaceId={selectedRace.id}
          parentRaceName={selectedRace.name}
          parentStartDate={selectedRace.startDate}
          parentEndDate={selectedRace.endDate}
          stages={stageData.stages}
          onClose={() => {
            setShowStageManager(false);
            setSelectedRace(null);
            setStageData(null);
          }}
          onUpdate={handleStageUpdate}
        />
      )}
    </div>
  );
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Upload } from "lucide-react"
import { DataTable } from "@/components/admin/data-table"
import { createColumns } from "./columns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { RiderForm } from "@/components/admin/rider-form"
import { CSVImport } from "@/components/admin/csv-import"
import { deleteRider } from "./actions"
import { useRouter } from "next/navigation"

type Rider = {
  id: number
  name: string
  team: string
  nationality: string
  gender: "M" | "F"
  specialty: "sprinter" | "climber" | "gc" | "classics" | "allrounder" | "time_trialist"
  createdAt: Date
  updatedAt: Date
}

interface RidersClientProps {
  riders: Rider[]
}

export function RidersClient({ riders }: RidersClientProps) {
  const router = useRouter()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const handleEdit = (rider: Rider) => {
    setSelectedRider(rider)
    setIsEditOpen(true)
  }

  const handleDelete = (rider: Rider) => {
    setSelectedRider(rider)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedRider) return

    await deleteRider(selectedRider.id)
    setIsDeleteOpen(false)
    setSelectedRider(null)
    router.refresh()
  }

  const columns = createColumns(handleEdit, handleDelete)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-primary">Riders Database</h2>
          <p className="text-sm text-muted-foreground">{riders.length} total riders</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsImportOpen(true)} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add Rider
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={riders}
        searchColumn="name"
        searchPlaceholder="Search riders by name..."
      />

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Rider</DialogTitle>
            <DialogDescription>
              Add a new professional cyclist to the database.
            </DialogDescription>
          </DialogHeader>
          <RiderForm
            onSuccess={() => {
              setIsAddOpen(false)
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Rider</DialogTitle>
            <DialogDescription>Update rider details.</DialogDescription>
          </DialogHeader>
          <RiderForm
            initialData={selectedRider || undefined}
            onSuccess={() => {
              setIsEditOpen(false)
              setSelectedRider(null)
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Riders from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with rider data. Expected format: name, team,
              nationality, gender, specialty
            </DialogDescription>
          </DialogHeader>
          <CSVImport
            onSuccess={() => {
              setIsImportOpen(false)
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedRider?.name}. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

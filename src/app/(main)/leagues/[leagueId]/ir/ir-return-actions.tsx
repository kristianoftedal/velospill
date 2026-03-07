"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { returnRider, dropAndReturnRider } from "./actions"

interface ActiveRosterRider {
  riderId: number
  riderName: string
}

interface IrReturnActionsProps {
  requestId: number
  riderName: string
  leagueId: number
  activeRoster: ActiveRosterRider[]
}

export function IrReturnActions({
  requestId,
  riderName,
  leagueId,
  activeRoster,
}: IrReturnActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDropId, setSelectedDropId] = useState<number | null>(
    activeRoster[0]?.riderId ?? null
  )

  function handleReturn() {
    startTransition(async () => {
      const result = await returnRider(requestId, leagueId)
      if (result.success) {
        toast.success(`${riderName} returned to active roster`)
      } else if (result.error?.includes("full")) {
        // Roster is full — open drop dialog
        setDialogOpen(true)
      } else {
        toast.error("Return failed", { description: result.error ?? "Unknown error" })
      }
    })
  }

  function handleDropAndReturn() {
    if (!selectedDropId) return
    startTransition(async () => {
      const result = await dropAndReturnRider({ requestId, dropRiderId: selectedDropId, leagueId })
      if (result.success) {
        toast.success(`${riderName} returned — dropped rider removed from roster`)
        setDialogOpen(false)
      } else {
        toast.error("Drop & Return failed", { description: result.error ?? "Unknown error" })
      }
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant="default"
        className="bg-green-600 hover:bg-green-700 mt-2"
        onClick={handleReturn}
        disabled={isPending}
      >
        {isPending ? "Returning..." : "Return to Roster"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roster Full — Drop a Rider First</DialogTitle>
            <DialogDescription>
              Your active roster is full. To return <strong>{riderName}</strong>, you must drop one
              active rider. This is permanent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Select rider to drop</label>
            <select
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              value={selectedDropId ?? ""}
              onChange={(e) => setSelectedDropId(e.target.value ? Number(e.target.value) : null)}
              disabled={isPending}
            >
              {activeRoster.map((r) => (
                <option key={r.riderId} value={r.riderId}>
                  {r.riderName}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDropAndReturn}
              disabled={isPending || !selectedDropId}
            >
              {isPending ? "Processing..." : "Drop & Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

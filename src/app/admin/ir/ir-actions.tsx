"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface IrActionsProps {
  requestId: number
  riderName: string
  teamName: string
  approveIrRequest: (id: number) => Promise<{ success: boolean; error?: string }>
  rejectIrRequest: (id: number, note: string) => Promise<{ success: boolean; error?: string }>
}

export function IrActions({
  requestId,
  riderName,
  teamName,
  approveIrRequest,
  rejectIrRequest,
}: IrActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [adminNote, setAdminNote] = useState("")
  const [isRejecting, setIsRejecting] = useState(false)

  function handleApprove() {
    startTransition(async () => {
      const result = await approveIrRequest(requestId)
      if (result.success) {
        toast.success("IR request approved", {
          description: `${riderName} (${teamName}) placed on IR`,
        })
      } else {
        toast.error("Approval failed", {
          description: result.error ?? "Unknown error",
        })
      }
    })
  }

  async function handleReject() {
    if (!adminNote.trim()) {
      toast.error("Admin note is required when rejecting a request")
      return
    }
    setIsRejecting(true)
    try {
      const result = await rejectIrRequest(requestId, adminNote.trim())
      if (result.success) {
        toast.success("IR request rejected", {
          description: "The team has been notified",
        })
        setRejectDialogOpen(false)
        setAdminNote("")
      } else {
        toast.error("Rejection failed", {
          description: result.error ?? "Unknown error",
        })
      }
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="default"
        className="bg-green-600 hover:bg-green-700"
        onClick={handleApprove}
        disabled={isPending || isRejecting}
      >
        {isPending ? "Approving..." : "Approve"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setRejectDialogOpen(true)}
        disabled={isPending || isRejecting}
      >
        Reject
      </Button>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject IR Request</DialogTitle>
            <DialogDescription>
              Rejecting IR request for <strong>{riderName}</strong> ({teamName}).
              Please provide a reason that will be shown to the team manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-note">Rejection reason</Label>
            <Textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. Rider is still active in the race, insufficient injury evidence..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false)
                setAdminNote("")
              }}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || !adminNote.trim()}
            >
              {isRejecting ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface MarkEligibleActionsProps {
  requestId: number
  riderName: string
  teamName: string
  markEligibleToReturn: (id: number) => Promise<{ success: boolean; error?: string }>
}

export function MarkEligibleActions({
  requestId,
  riderName,
  teamName,
  markEligibleToReturn,
}: MarkEligibleActionsProps) {
  const [isPending, startTransition] = useTransition()

  function handleMarkEligible() {
    startTransition(async () => {
      const result = await markEligibleToReturn(requestId)
      if (result.success) {
        toast.success("Rider marked eligible to return", {
          description: `${riderName} (${teamName}) — player will see banner`,
        })
      } else {
        toast.error("Failed to mark eligible", {
          description: result.error ?? "Unknown error",
        })
      }
    })
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-amber-500 text-amber-700 hover:bg-amber-50"
      onClick={handleMarkEligible}
      disabled={isPending}
    >
      {isPending ? "Marking..." : "Mark Eligible to Return"}
    </Button>
  )
}

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

type ApproveBidFn = (bidId: number) => Promise<{ success: boolean; error?: string }>
type RejectBidFn = (bidId: number, adminNote: string) => Promise<{ success: boolean; error?: string }>

interface BidActionsProps {
  bidId: number
  outRiderName: string | null
  inRiderName: string
  approveBid: ApproveBidFn
  rejectBid: RejectBidFn
}

export function BidActions({
  bidId,
  outRiderName,
  inRiderName,
  approveBid,
  rejectBid,
}: BidActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [adminNote, setAdminNote] = useState("")
  const [isRejecting, setIsRejecting] = useState(false)

  function handleApprove() {
    startTransition(async () => {
      const result = await approveBid(bidId)
      if (result.success) {
        toast.success("Transfer approved", {
          description: outRiderName
            ? `${outRiderName} dropped, ${inRiderName} picked up`
            : `${inRiderName} picked up (free slot)`,
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
      toast.error("Admin note is required when rejecting a bid")
      return
    }
    setIsRejecting(true)
    try {
      const result = await rejectBid(bidId, adminNote.trim())
      if (result.success) {
        toast.success("Transfer rejected", {
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
            <DialogTitle>Reject Transfer Bid</DialogTitle>
            <DialogDescription>
              {outRiderName
                ? <>Rejecting: drop <strong>{outRiderName}</strong>, pick up <strong>{inRiderName}</strong>.</>
                : <>Rejecting: pick up <strong>{inRiderName}</strong> (free slot).</>
              }{" "}
              Please provide a reason that will be shown to the team manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-note">Rejection reason</Label>
            <Textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. Transfer window closed, rider already on another team..."
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

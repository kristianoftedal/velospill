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
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

type ApproveOrderFn = (orderId: number) => Promise<{ success: boolean; error?: string }>
type RejectOrderFn = (orderId: number, adminNote: string) => Promise<{ success: boolean; error?: string }>
type SetBonusPointsFn = (orderId: number, bonusPoints: number) => Promise<{ success: boolean; error?: string }>

// Complex order types that require bonus point entry by admin
const COMPLEX_EFFECT_TYPES = ["gc_position_loss", "team_sprint_points", "team_placement_points"]

interface OrderActionsProps {
  orderId: number
  orderTypeEffect: object
  currentBonusPoints: number | null
  approveOrder: ApproveOrderFn
  rejectOrder: RejectOrderFn
  setBonusPoints: SetBonusPointsFn
}

export function OrderActions({
  orderId,
  orderTypeEffect,
  currentBonusPoints,
  approveOrder,
  rejectOrder,
  setBonusPoints,
}: OrderActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [adminNote, setAdminNote] = useState("")
  const [isRejecting, setIsRejecting] = useState(false)
  const [bonusPointsValue, setBonusPointsValue] = useState(currentBonusPoints?.toString() ?? "")
  const [isSavingBonus, setIsSavingBonus] = useState(false)

  const effectType = (orderTypeEffect as { type?: string })?.type ?? ""
  const isComplexOrder = COMPLEX_EFFECT_TYPES.includes(effectType)

  function handleApprove() {
    startTransition(async () => {
      const result = await approveOrder(orderId)
      if (result.success) {
        toast.success("Order approved", {
          description: "Order is now active and will be scored",
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
      toast.error("Admin note is required when rejecting an order")
      return
    }
    setIsRejecting(true)
    try {
      const result = await rejectOrder(orderId, adminNote.trim())
      if (result.success) {
        toast.success("Order rejected", {
          description: "The team manager has been notified",
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

  async function handleSaveBonusPoints() {
    const parsed = parseInt(bonusPointsValue, 10)
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Bonus points must be a non-negative number")
      return
    }
    setIsSavingBonus(true)
    try {
      const result = await setBonusPoints(orderId, parsed)
      if (result.success) {
        toast.success("Bonus points saved")
      } else {
        toast.error("Failed to save bonus points", {
          description: result.error ?? "Unknown error",
        })
      }
    } finally {
      setIsSavingBonus(false)
    }
  }

  return (
    <div className="space-y-2">
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
      </div>

      {isComplexOrder && (
        <div className="flex items-center gap-2 justify-end">
          <Label htmlFor={`bonus-${orderId}`} className="text-xs text-muted-foreground whitespace-nowrap">
            Bonus pts:
          </Label>
          <Input
            id={`bonus-${orderId}`}
            type="number"
            min={0}
            className="w-20 h-7 text-xs"
            value={bonusPointsValue}
            onChange={(e) => setBonusPointsValue(e.target.value)}
            placeholder="0"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2"
            onClick={handleSaveBonusPoints}
            disabled={isSavingBonus}
          >
            {isSavingBonus ? "..." : "Save"}
          </Button>
        </div>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
            <DialogDescription>
              Please provide a rejection reason that will be visible to the team manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-note">Rejection reason</Label>
            <Textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. Order submitted after deadline, invalid target selection..."
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

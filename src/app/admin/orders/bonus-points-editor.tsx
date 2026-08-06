"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

const COMPLEX_EFFECT_TYPES = ["gc_position_loss", "team_sprint_points", "team_placement_points"]

interface BonusPointsEditorProps {
  orderId: number
  orderTypeEffect: object
  currentBonusPoints: number | null
  setBonusPoints: (orderId: number, bonusPoints: number) => Promise<{ success: boolean; error?: string }>
}

export function BonusPointsEditor({
  orderId,
  orderTypeEffect,
  currentBonusPoints,
  setBonusPoints,
}: BonusPointsEditorProps) {
  const effectType = (orderTypeEffect as { type?: string })?.type ?? ""
  const isComplexOrder = COMPLEX_EFFECT_TYPES.includes(effectType)

  const [value, setValue] = useState(currentBonusPoints?.toString() ?? "")
  const [isSaving, setIsSaving] = useState(false)

  if (!isComplexOrder) {
    return <span className="text-muted-foreground">-</span>
  }

  async function handleSave() {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Bonus points must be a non-negative number")
      return
    }
    setIsSaving(true)
    try {
      const result = await setBonusPoints(orderId, parsed)
      if (result.success) {
        toast.success("Bonus points saved")
      } else {
        toast.error("Failed to save", { description: result.error ?? "Unknown error" })
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={0}
        className="w-20 h-7 text-xs"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="0"
      />
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs px-2"
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? "..." : "Save"}
      </Button>
    </div>
  )
}

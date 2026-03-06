"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { submitIrRequest } from "./actions"

interface IrFormProps {
  roster: Array<{ riderId: number; riderName: string; gender: string }>
  leagueId: number
  slotsUsed: number
}

export function IrForm({ roster, leagueId, slotsUsed }: IrFormProps) {
  const [selectedRiderId, setSelectedRiderId] = useState<number | null>(null)
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (slotsUsed >= 2) {
    return (
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="pt-4 pb-4">
          <p className="text-gray-600">
            Both IR slots are in use. A slot opens when a pending request is rejected or you have no
            more approved riders.
          </p>
        </CardContent>
      </Card>
    )
  }

  function handleSubmit() {
    if (!selectedRiderId) return

    setErrorMessage(null)
    startTransition(async () => {
      const result = await submitIrRequest({
        leagueId,
        riderId: selectedRiderId,
        reason: reason.trim() || undefined,
      })

      if (result.success) {
        toast.success("IR request submitted successfully")
        setSelectedRiderId(null)
        setReason("")
      } else {
        setErrorMessage(result.error)
        toast.error(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Request IR Placement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Select rider</label>
          <select
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            value={selectedRiderId ?? ""}
            onChange={(e) => setSelectedRiderId(e.target.value ? Number(e.target.value) : null)}
            disabled={isPending}
          >
            <option value="">-- Choose a rider --</option>
            {roster.map((r) => (
              <option key={r.riderId} value={r.riderId}>
                {r.riderName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Reason <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <Textarea
            placeholder="Brief description of the injury"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="resize-none"
            disabled={isPending}
          />
        </div>

        {errorMessage && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={isPending || !selectedRiderId}
          className="w-full"
        >
          {isPending ? "Submitting..." : "Request IR Placement"}
        </Button>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { submitTransferBid, cancelTransferBid } from "./actions"
import type { TeamRosterEntry, TeamBid, ActiveTransferWindow, FreeAgent } from "@/lib/transfer-queries"

interface TransferFormProps {
  roster: TeamRosterEntry[]
  pendingBids: TeamBid[]
  activeWindow: ActiveTransferWindow
  leagueId: number
  freeAgentsMen: FreeAgent[]
  freeAgentsWomen: FreeAgent[]
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending":
      return "default"
    case "approved":
      return "secondary"
    case "rejected":
      return "destructive"
    case "cancelled":
      return "outline"
    default:
      return "default"
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "approved":
      return "bg-green-100 text-green-800 border-green-200"
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200"
    case "cancelled":
      return "bg-gray-100 text-gray-600 border-gray-200"
    default:
      return ""
  }
}

export function TransferForm({
  roster,
  pendingBids,
  activeWindow,
  leagueId,
  freeAgentsMen,
  freeAgentsWomen,
}: TransferFormProps) {
  const [selectedOutRiderId, setSelectedOutRiderId] = useState<number | null>(null)
  const [selectedInRiderId, setSelectedInRiderId] = useState<number | null>(null)
  const [reason, setReason] = useState("")
  const [freeAgentSearch, setFreeAgentSearch] = useState("")
  const [isPending, startTransition] = useTransition()

  const menRoster = roster.filter((r) => r.gender === "M")
  const womenRoster = roster.filter((r) => r.gender === "F")

  const selectedOutRider = roster.find((r) => r.riderId === selectedOutRiderId)

  // Show free agents matching the gender of the outgoing rider
  const relevantFreeAgents =
    selectedOutRider?.gender === "M"
      ? freeAgentsMen
      : selectedOutRider?.gender === "F"
      ? freeAgentsWomen
      : []

  const filteredFreeAgents = relevantFreeAgents.filter((fa) =>
    fa.name.toLowerCase().includes(freeAgentSearch.toLowerCase()) ||
    fa.team.toLowerCase().includes(freeAgentSearch.toLowerCase())
  )

  function handleSelectOutRider(riderId: number) {
    if (selectedOutRiderId === riderId) {
      setSelectedOutRiderId(null)
    } else {
      setSelectedOutRiderId(riderId)
    }
    setSelectedInRiderId(null)
    setFreeAgentSearch("")
  }

  function handleSelectInRider(riderId: number) {
    setSelectedInRiderId(selectedInRiderId === riderId ? null : riderId)
  }

  function handleSubmit() {
    if (!selectedOutRiderId || !selectedInRiderId) return

    startTransition(async () => {
      const result = await submitTransferBid({
        leagueId,
        outRiderId: selectedOutRiderId,
        inRiderId: selectedInRiderId,
        reason: reason.trim() || undefined,
      })

      if (result.success) {
        toast.success("Transfer bid submitted successfully")
        setSelectedOutRiderId(null)
        setSelectedInRiderId(null)
        setReason("")
        setFreeAgentSearch("")
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleCancel(bidId: number) {
    startTransition(async () => {
      const result = await cancelTransferBid(bidId, leagueId)
      if (result.success) {
        toast.success("Bid cancelled")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Active Window Banner */}
      {activeWindow ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="font-medium text-green-800">Transfer window is open</p>
                {activeWindow.description && (
                  <p className="text-sm text-green-700">{activeWindow.description}</p>
                )}
              </div>
              <p className="text-sm text-green-700">
                Closes: {new Date(activeWindow.closesAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-gray-600">Transfer window is currently closed. No bids can be submitted.</p>
          </CardContent>
        </Card>
      )}

      {/* Pending Bids Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Bids</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingBids.length === 0 ? (
            <p className="text-sm text-gray-500">No pending bids.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingBids.map((bid) => (
                <div key={bid.bidId} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {bid.outRiderName}
                      </span>
                      <span className="text-gray-400">&rarr;</span>
                      <span className="text-sm font-medium text-gray-900">
                        {bid.inRiderName}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(bid.status)}`}
                      >
                        {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Submitted{" "}
                      {new Date(bid.submittedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    {bid.adminNote && (
                      <p className="text-xs text-gray-500 italic">Note: {bid.adminNote}</p>
                    )}
                  </div>
                  {bid.status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleCancel(bid.bidId)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Bid Form - only shown when a transfer window is active */}
      {activeWindow && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit New Bid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Select rider to drop */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Step 1: Select rider to drop
              </h3>

              {menRoster.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Men</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {menRoster.map((r) => (
                      <button
                        key={r.riderId}
                        type="button"
                        onClick={() => handleSelectOutRider(r.riderId)}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                          selectedOutRiderId === r.riderId
                            ? "border-red-500 bg-red-50"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{r.riderName}</p>
                        <p className="text-xs text-gray-500">{r.riderTeam}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {womenRoster.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Women</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {womenRoster.map((r) => (
                      <button
                        key={r.riderId}
                        type="button"
                        onClick={() => handleSelectOutRider(r.riderId)}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                          selectedOutRiderId === r.riderId
                            ? "border-red-500 bg-red-50"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{r.riderName}</p>
                        <p className="text-xs text-gray-500">{r.riderTeam}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Select free agent to pick up */}
            {selectedOutRider && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Step 2: Select free agent to pick up
                  <span className="font-normal text-gray-500 ml-1">
                    (same gender as {selectedOutRider.riderName})
                  </span>
                </h3>

                <input
                  type="text"
                  placeholder="Search by name or team..."
                  value={freeAgentSearch}
                  onChange={(e) => setFreeAgentSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />

                {filteredFreeAgents.length === 0 ? (
                  <p className="text-sm text-gray-500">No free agents found.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                    {filteredFreeAgents.map((fa) => (
                      <button
                        key={fa.id}
                        type="button"
                        onClick={() => handleSelectInRider(fa.id)}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                          selectedInRiderId === fa.id
                            ? "border-green-500 bg-green-50"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{fa.name}</p>
                        <p className="text-xs text-gray-500">{fa.team} &bull; {fa.nationality}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Optional reason */}
            {selectedOutRider && selectedInRiderId && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Reason (optional)
                </label>
                <Textarea
                  placeholder="Why are you making this transfer?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={isPending || !selectedOutRiderId || !selectedInRiderId}
              className="w-full bg-gray-900 text-white hover:bg-gray-700"
            >
              {isPending ? "Submitting..." : "Submit Transfer Bid"}
            </Button>

            {selectedOutRider && selectedInRiderId && (
              <p className="text-xs text-gray-500 text-center">
                Drop{" "}
                <span className="font-medium">{selectedOutRider.riderName}</span>{" "}
                &rarr; Pick up{" "}
                <span className="font-medium">
                  {relevantFreeAgents.find((fa) => fa.id === selectedInRiderId)?.name}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

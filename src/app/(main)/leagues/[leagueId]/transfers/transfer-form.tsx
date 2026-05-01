"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { submitTransferBid, cancelTransferBid } from "./actions"
import { formatDate, formatDateTime } from "@/lib/format-date"
import type { TeamRosterEntry, TeamBid, ActiveTransferWindow, FreeAgent, LeagueTransfer } from "@/lib/transfer-queries"

const MAX_MEN_RIDERS = 18
const MAX_WOMEN_RIDERS = 6

interface TransferFormProps {
  roster: TeamRosterEntry[]
  pendingBids: TeamBid[]
  activeWindow: ActiveTransferWindow
  leagueId: number
  teamBudget: number
  freeAgentsMen: FreeAgent[]
  freeAgentsWomen: FreeAgent[]
  leagueTransfers: LeagueTransfer[]
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
  teamBudget,
  freeAgentsMen,
  freeAgentsWomen,
  leagueTransfers,
}: TransferFormProps) {
  const [selectedOutRiderId, setSelectedOutRiderId] = useState<number | null>(null)
  const [selectedInRiderId, setSelectedInRiderId] = useState<number | null>(null)
  const [bidAmount, setBidAmount] = useState(0)
  const [reason, setReason] = useState("")
  const [freeAgentSearch, setFreeAgentSearch] = useState("")
  const [isPending, startTransition] = useTransition()

  const menRoster = roster.filter((r) => r.gender === "M")
  const womenRoster = roster.filter((r) => r.gender === "F")
  const activeMenRoster = menRoster.filter((r) => !r.isOnIR)
  const activeWomenRoster = womenRoster.filter((r) => !r.isOnIR)

  const hasMenSlot = activeMenRoster.length < MAX_MEN_RIDERS
  const hasWomenSlot = activeWomenRoster.length < MAX_WOMEN_RIDERS
  const hasAnyFreeSlot = hasMenSlot || hasWomenSlot
  const rosterIsFull = !hasAnyFreeSlot

  const selectedOutRider = roster.find((r) => r.riderId === selectedOutRiderId)

  // Determine which free agents to show:
  // - If dropping a rider: show same gender as out rider
  // - If picking up into a free slot: show genders that have free slots
  let relevantFreeAgents: FreeAgent[]
  if (selectedOutRider) {
    relevantFreeAgents =
      selectedOutRider.gender === "M" ? freeAgentsMen : freeAgentsWomen
  } else if (hasMenSlot && hasWomenSlot) {
    relevantFreeAgents = [...freeAgentsMen, ...freeAgentsWomen]
  } else if (hasMenSlot) {
    relevantFreeAgents = freeAgentsMen
  } else {
    relevantFreeAgents = freeAgentsWomen
  }

  const filteredFreeAgents = relevantFreeAgents.filter((fa) =>
    fa.name.toLowerCase().includes(freeAgentSearch.toLowerCase()) ||
    fa.team.toLowerCase().includes(freeAgentSearch.toLowerCase())
  )

  function handleSelectOutRider(riderId: number) {
    const rider = roster.find((r) => r.riderId === riderId)
    if (rider?.isOnIR) return   // IR'd riders cannot be dropped via transfer
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

  // Determine whether the form is ready to submit
  const canSubmit = selectedInRiderId != null && (selectedOutRiderId != null || hasAnyFreeSlot)

  function handleSubmit() {
    if (!selectedInRiderId) return
    if (!selectedOutRiderId && !hasAnyFreeSlot) return

    startTransition(async () => {
      const result = await submitTransferBid({
        leagueId,
        outRiderId: selectedOutRiderId ?? undefined,
        inRiderId: selectedInRiderId,
        bidAmount,
        reason: reason.trim() || undefined,
      })

      if (result.success) {
        toast.success("Transfer bid submitted successfully")
        setSelectedOutRiderId(null)
        setSelectedInRiderId(null)
        setBidAmount(0)
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

  const selectedInRider = relevantFreeAgents.find((fa) => fa.id === selectedInRiderId)

  return (
    <div className="space-y-6">
      {/* Active Window Banner */}
      {activeWindow ? (
        <Card className={activeWindow.windowType === "free_agency" ? "border-blue-200 bg-blue-50" : "border-green-200 bg-green-50"}>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className={`font-medium ${activeWindow.windowType === "free_agency" ? "text-blue-800" : "text-green-800"}`}>
                  {activeWindow.windowType === "free_agency"
                    ? "Free agency — transfers are instant"
                    : "Waiver window — bids resolved when window closes"}
                </p>
                {activeWindow.description && (
                  <p className={`text-sm ${activeWindow.windowType === "free_agency" ? "text-blue-700" : "text-green-700"}`}>{activeWindow.description}</p>
                )}
              </div>
              <div className="text-right space-y-1">
                {activeWindow.windowType !== "free_agency" && (
                  <p className="text-sm font-medium text-green-800">
                    Budget remaining: {teamBudget} EUR
                  </p>
                )}
                <p className={`text-sm ${activeWindow.windowType === "free_agency" ? "text-blue-700" : "text-green-700"}`}>
                  Closes: {formatDateTime(activeWindow.closesAt)}
                </p>
              </div>
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

      {/* Bids & League Transfers — collapsible accordion */}
      <Card>
        <CardContent className="pt-4">
          <Accordion type="multiple" defaultValue={[]}>
            {/* Your Bids */}
            <AccordionItem value="your-bids">
              <AccordionTrigger className="text-lg font-semibold">
                Your Bids
                {pendingBids.filter(b => b.status === "pending").length > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 border border-yellow-200 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    {pendingBids.filter(b => b.status === "pending").length} pending
                  </span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                {pendingBids.length === 0 ? (
                  <p className="text-sm text-gray-500">No bids submitted.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pendingBids.map((bid) => (
                      <div key={bid.bidId} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {bid.outRiderName ? (
                              <>
                                <span className="text-sm font-medium text-gray-900">
                                  {bid.outRiderName}
                                </span>
                                <span className="text-gray-400">&rarr;</span>
                              </>
                            ) : (
                              <span className="text-xs text-blue-600 font-medium">Pickup</span>
                            )}
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
                            Bid: {bid.bidAmount} EUR &bull; Submitted{" "}
                            {formatDate(bid.submittedAt)}
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
              </AccordionContent>
            </AccordionItem>

            {/* League Transfers */}
            <AccordionItem value="league-transfers">
              <AccordionTrigger className="text-lg font-semibold">
                League Transfers
                {leagueTransfers.length > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {leagueTransfers.length}
                  </span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                {leagueTransfers.length === 0 ? (
                  <p className="text-sm text-gray-500">No transfers in this league yet.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {leagueTransfers.map((t) => (
                      <div key={t.bidId} className="py-3 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-gray-500">{t.teamName}</span>
                          <span className="text-gray-300">|</span>
                          {t.outRiderName ? (
                            <>
                              <span className="text-sm text-gray-900">{t.outRiderName}</span>
                              <span className="text-gray-400">&rarr;</span>
                            </>
                          ) : (
                            <span className="text-xs text-blue-600 font-medium">Pickup</span>
                          )}
                          <span className="text-sm font-medium text-gray-900">{t.inRiderName}</span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(t.status)}`}
                          >
                            {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {t.bidAmount > 0 ? `${t.bidAmount} EUR • ` : ""}
                          {formatDate(t.submittedAt)}
                          {t.resolvedAt && (
                            <> &bull; Resolved {formatDate(t.resolvedAt)}</>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* New Bid Form - only shown when a transfer window is active */}
      {activeWindow && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit New Bid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Roster slot availability info */}
            {hasAnyFreeSlot && (
              <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
                {hasMenSlot && hasWomenSlot
                  ? `You have available roster spots (${activeMenRoster.length}/${MAX_MEN_RIDERS} men, ${activeWomenRoster.length}/${MAX_WOMEN_RIDERS} women). You can pick up a rider without dropping one.`
                  : hasMenSlot
                  ? `You have ${MAX_MEN_RIDERS - activeMenRoster.length} available men's roster spot${MAX_MEN_RIDERS - activeMenRoster.length !== 1 ? "s" : ""}. You can pick up a man without dropping one.`
                  : `You have ${MAX_WOMEN_RIDERS - activeWomenRoster.length} available women's roster spot${MAX_WOMEN_RIDERS - activeWomenRoster.length !== 1 ? "s" : ""}. You can pick up a woman without dropping one.`
                }
              </div>
            )}

            {/* Step 1: Select rider to drop (required only when roster is full) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">
                {rosterIsFull ? "Step 1: Select rider to drop" : "Step 1: Select rider to drop (optional)"}
              </h3>

              {menRoster.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Men</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {menRoster.map((r) => (
                      r.isOnIR ? (
                        <div
                          key={r.riderId}
                          className="text-left rounded-lg border px-3 py-2 opacity-60 cursor-not-allowed border-gray-100 bg-gray-50"
                        >
                          <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                            {r.riderName}
                            <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 ml-1">On IR</span>
                          </p>
                          <p className="text-xs text-gray-500">{r.riderTeam}</p>
                        </div>
                      ) : (
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
                      )
                    ))}
                  </div>
                </div>
              )}

              {womenRoster.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Women</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {womenRoster.map((r) => (
                      r.isOnIR ? (
                        <div
                          key={r.riderId}
                          className="text-left rounded-lg border px-3 py-2 opacity-60 cursor-not-allowed border-gray-100 bg-gray-50"
                        >
                          <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                            {r.riderName}
                            <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 ml-1">On IR</span>
                          </p>
                          <p className="text-xs text-gray-500">{r.riderTeam}</p>
                        </div>
                      ) : (
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
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Select free agent to pick up */}
            {(selectedOutRider || hasAnyFreeSlot) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  {selectedOutRider
                    ? <>Step 2: Select free agent to pick up <span className="font-normal text-gray-500">(same gender as {selectedOutRider.riderName})</span></>
                    : "Step 2: Select free agent to pick up"
                  }
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

            {/* Bid amount — waiver window only */}
            {canSubmit && selectedInRiderId && activeWindow.windowType !== "free_agency" && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Bid Amount (EUR)
                </label>
                <input
                  type="number"
                  min={0}
                  max={teamBudget}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <p className="text-xs text-gray-500">
                  Budget remaining: {teamBudget} EUR. Highest bidder wins contested transfers.
                </p>
              </div>
            )}

            {/* Optional reason — waiver window only */}
            {canSubmit && selectedInRiderId && activeWindow.windowType !== "free_agency" && (
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
              disabled={isPending || !canSubmit}
              className="w-full bg-gray-900 text-white hover:bg-gray-700"
            >
              {isPending ? "Submitting..." : activeWindow.windowType === "free_agency" ? "Pick Up Rider" : "Submit Transfer Bid"}
            </Button>

            {canSubmit && selectedInRider && (
              <p className="text-xs text-gray-500 text-center">
                {selectedOutRider ? (
                  <>
                    Drop{" "}
                    <span className="font-medium">{selectedOutRider.riderName}</span>{" "}
                    &rarr; Pick up{" "}
                    <span className="font-medium">{selectedInRider.name}</span>
                  </>
                ) : (
                  <>
                    Pick up{" "}
                    <span className="font-medium">{selectedInRider.name}</span>{" "}
                    (free roster slot)
                  </>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

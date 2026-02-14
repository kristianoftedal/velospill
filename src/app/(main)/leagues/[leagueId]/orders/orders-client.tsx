"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { UpcomingRace, TeamOrder, TeamRiderForOrders, OpponentRider, OpponentTeam } from "@/lib/order-queries"
import type { orderTypes } from "@/db/schema/config"

type AllOrderType = typeof orderTypes.$inferSelect

interface OrdersClientProps {
  leagueId: number
  upcomingRaces: UpcomingRace[]
  teamOrders: TeamOrder[]
  allOrderTypes: AllOrderType[]
  teamRiders: TeamRiderForOrders[]
  opponentRiders: OpponentRider[]
  opponentTeams: OpponentTeam[]
  submitOrder: (data: {
    leagueId: number
    raceId: number
    orderTypeId: number
    targetRiderId?: number
    targetTeamId?: number
    targetProTeam?: string
    targetCountry?: string
    orderConfig?: Record<string, string>
  }) => Promise<{ success: true } | { success: false; error: string }>
  cancelOrder: (
    orderId: number,
    leagueId: number
  ) => Promise<{ success: true } | { success: false; error: string }>
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "active":
      return "bg-green-100 text-green-800 border-green-200"
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200"
    case "countered":
      return "bg-gray-100 text-gray-600 border-gray-200"
    default:
      return "bg-gray-100 text-gray-600 border-gray-200"
  }
}

function formatTarget(order: TeamOrder): string {
  if (order.targetCountry) return `All riders from ${order.targetCountry}`
  if (order.targetProTeam) return order.targetProTeam
  if (order.targetRiderId) return `Rider #${order.targetRiderId}`
  if (order.targetTeamId) return `Team #${order.targetTeamId}`
  return "All own riders"
}

export function OrdersClient({
  leagueId,
  upcomingRaces,
  teamOrders,
  allOrderTypes,
  teamRiders,
  opponentRiders,
  opponentTeams,
  submitOrder,
  cancelOrder,
}: OrdersClientProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null)
  const [selectedOrderTypeId, setSelectedOrderTypeId] = useState<number | null>(null)
  const [targetRiderId, setTargetRiderId] = useState<number | null>(null)
  const [targetTeamId, setTargetTeamId] = useState<number | null>(null)
  const [targetProTeam, setTargetProTeam] = useState("")
  const [targetCountry, setTargetCountry] = useState("")
  const [kapteinChoice, setKapteinChoice] = useState<"single_rider" | "country_all" | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedRace = upcomingRaces.find((r) => r.id === selectedRaceId)
  const selectedOrderType = allOrderTypes.find((ot) => ot.id === selectedOrderTypeId)

  // Filter order types based on the selected race's effective type
  // For stages, use the parent race type
  const effectiveRaceType = selectedRace?.parentRaceId
    ? (upcomingRaces.find((r) => r.id === selectedRace.parentRaceId)?.raceType ?? selectedRace.raceType)
    : selectedRace?.raceType

  const filteredOrderTypes = selectedRace
    ? allOrderTypes.filter((ot) => {
        const applicable = ot.applicableRaceTypes as string[]
        return applicable.includes(effectiveRaceType ?? "")
      })
    : []

  const effect = selectedOrderType ? (selectedOrderType.effect as Record<string, unknown>) : null
  const effectTarget = effect?.target as string | undefined

  function handleRaceSelect(raceId: number) {
    setSelectedRaceId(raceId)
    setSelectedOrderTypeId(null)
    setTargetRiderId(null)
    setTargetTeamId(null)
    setTargetProTeam("")
    setTargetCountry("")
    setKapteinChoice(null)
    setStep(2)
  }

  function handleOrderTypeSelect(orderTypeId: number) {
    setSelectedOrderTypeId(orderTypeId)
    setTargetRiderId(null)
    setTargetTeamId(null)
    setTargetProTeam("")
    setTargetCountry("")
    setKapteinChoice(null)
    setStep(3)
  }

  function resetForm() {
    setStep(1)
    setSelectedRaceId(null)
    setSelectedOrderTypeId(null)
    setTargetRiderId(null)
    setTargetTeamId(null)
    setTargetProTeam("")
    setTargetCountry("")
    setKapteinChoice(null)
  }

  function handleSubmit() {
    if (!selectedRaceId || !selectedOrderTypeId) return

    const formData: {
      leagueId: number
      raceId: number
      orderTypeId: number
      targetRiderId?: number
      targetTeamId?: number
      targetProTeam?: string
      targetCountry?: string
      orderConfig?: Record<string, string>
    } = {
      leagueId,
      raceId: selectedRaceId,
      orderTypeId: selectedOrderTypeId,
    }

    if (targetRiderId) formData.targetRiderId = targetRiderId
    if (targetTeamId) formData.targetTeamId = targetTeamId
    if (targetProTeam.trim()) formData.targetProTeam = targetProTeam.trim()
    if (targetCountry.trim()) formData.targetCountry = targetCountry.trim()
    if (kapteinChoice) formData.orderConfig = { kapteinChoice }

    startTransition(async () => {
      const result = await submitOrder(formData)
      if (result.success) {
        toast.success("Order submitted successfully")
        resetForm()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleCancel(orderId: number) {
    startTransition(async () => {
      const result = await cancelOrder(orderId, leagueId)
      if (result.success) {
        toast.success("Order cancelled")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Submit Order Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submit Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    step === s
                      ? "bg-purple-600 text-white"
                      : step > s
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {s}
                </div>
                {s < 4 && <div className={`h-px w-8 ${step > s ? "bg-purple-300" : "bg-gray-200"}`} />}
              </div>
            ))}
            <span className="ml-2 text-gray-500">
              {step === 1 && "Select race"}
              {step === 2 && "Select order type"}
              {step === 3 && "Configure target"}
              {step === 4 && "Confirm & submit"}
            </span>
          </div>

          {/* Step 1: Select Race */}
          {step >= 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Step 1: Select a race
              </h3>
              {upcomingRaces.length === 0 ? (
                <p className="text-sm text-gray-500">No upcoming races available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {upcomingRaces.map((race) => (
                    <button
                      key={race.id}
                      type="button"
                      onClick={() => handleRaceSelect(race.id)}
                      className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                        selectedRaceId === race.id
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{race.displayName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(race.startDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {" \u00b7 "}
                        {race.raceType.replace(/_/g, " ")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Order Type */}
          {step >= 2 && selectedRace && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Step 2: Select order type{" "}
                <span className="text-gray-400 font-normal">for {selectedRace.displayName}</span>
              </h3>
              {filteredOrderTypes.length === 0 ? (
                <p className="text-sm text-gray-500">No order types available for this race type.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {filteredOrderTypes.map((ot) => (
                    <button
                      key={ot.id}
                      type="button"
                      onClick={() => handleOrderTypeSelect(ot.id)}
                      className={`text-left rounded-lg border px-3 py-3 transition-colors ${
                        selectedOrderTypeId === ot.id
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{ot.displayName}</p>
                      {ot.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{ot.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => { setStep(1); setSelectedOrderTypeId(null) }}>
                Back to races
              </Button>
            </div>
          )}

          {/* Step 3: Configure Target */}
          {step >= 3 && selectedOrderType && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Step 3: Configure target{" "}
                <span className="text-gray-400 font-normal">for {selectedOrderType.displayName}</span>
              </h3>

              {effectTarget === "own_rider" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Select one of your riders</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {teamRiders.map((r) => (
                      <button
                        key={r.riderId}
                        type="button"
                        onClick={() => { setTargetRiderId(r.riderId); setStep(4) }}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                          targetRiderId === r.riderId
                            ? "border-purple-500 bg-purple-50"
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

              {effectTarget === "opponent_rider" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Select an opponent&apos;s rider</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {opponentRiders.map((r) => (
                      <button
                        key={r.riderId}
                        type="button"
                        onClick={() => { setTargetRiderId(r.riderId); setStep(4) }}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                          targetRiderId === r.riderId
                            ? "border-purple-500 bg-purple-50"
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

              {effectTarget === "opponent_all_riders" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Select an opponent team</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {opponentTeams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setTargetTeamId(t.id); setStep(4) }}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                          targetTeamId === t.id
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {effectTarget === "all_own_riders" && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
                  <p className="text-sm text-purple-800">
                    This order applies to <strong>all of your riders</strong> in the selected race. No target selection needed.
                  </p>
                  <Button className="mt-3 bg-purple-600 hover:bg-purple-700 text-white" size="sm" onClick={() => setStep(4)}>
                    Continue to confirm
                  </Button>
                </div>
              )}

              {effectTarget === "own_rider_or_country" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">Choose your Kaptein strategy</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setKapteinChoice("single_rider")}
                      className={`flex-1 rounded-lg border px-3 py-3 text-left transition-colors ${
                        kapteinChoice === "single_rider"
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">Single Rider (x2)</p>
                      <p className="text-xs text-gray-500">Double the points for one rider</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setKapteinChoice("country_all")}
                      className={`flex-1 rounded-lg border px-3 py-3 text-left transition-colors ${
                        kapteinChoice === "country_all"
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">All from Country (x1.5)</p>
                      <p className="text-xs text-gray-500">1.5x points for all riders from a country</p>
                    </button>
                  </div>

                  {kapteinChoice === "single_rider" && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Select your Kaptein rider</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {teamRiders.map((r) => (
                          <button
                            key={r.riderId}
                            type="button"
                            onClick={() => { setTargetRiderId(r.riderId); setStep(4) }}
                            className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                              targetRiderId === r.riderId
                                ? "border-purple-500 bg-purple-50"
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

                  {kapteinChoice === "country_all" && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Country name</label>
                      <input
                        type="text"
                        value={targetCountry}
                        onChange={(e) => setTargetCountry(e.target.value)}
                        placeholder="e.g. Norway"
                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      {targetCountry.trim() && (
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white" size="sm" onClick={() => setStep(4)}>
                          Continue to confirm
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {effectTarget === "unowned_gc_top10" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    Enter the name of a GC top-10 rider not owned by any team in this league
                  </p>
                  <input
                    type="text"
                    value={targetProTeam}
                    onChange={(e) => setTargetProTeam(e.target.value)}
                    placeholder="Rider name..."
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400">
                    Note: The system will validate that this rider is not drafted in your league.
                  </p>
                  {targetProTeam.trim() && (
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white" size="sm" onClick={() => setStep(4)}>
                      Continue to confirm
                    </Button>
                  )}
                </div>
              )}

              {effectTarget === "real_team" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Enter the professional cycling team name</p>
                  <input
                    type="text"
                    value={targetProTeam}
                    onChange={(e) => setTargetProTeam(e.target.value)}
                    placeholder="e.g. Visma-Lease a Bike"
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {targetProTeam.trim() && (
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white" size="sm" onClick={() => setStep(4)}>
                      Continue to confirm
                    </Button>
                  )}
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => { setStep(2); setTargetRiderId(null); setTargetTeamId(null) }}>
                Back to order types
              </Button>
            </div>
          )}

          {/* Step 4: Confirm & Submit */}
          {step === 4 && selectedRace && selectedOrderType && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Step 4: Confirm your order</h3>

              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900">{selectedOrderType.displayName}</p>
                    <p className="text-xs text-gray-600">Race: {selectedRace.displayName}</p>
                    <p className="text-xs text-gray-600">
                      Date:{" "}
                      {new Date(selectedRace.startDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    {targetRiderId && (
                      <p className="text-xs text-gray-600">
                        Target rider:{" "}
                        {
                          [...teamRiders, ...opponentRiders].find((r) => r.riderId === targetRiderId)
                            ?.riderName ?? `Rider #${targetRiderId}`
                        }
                      </p>
                    )}
                    {targetTeamId && (
                      <p className="text-xs text-gray-600">
                        Target team:{" "}
                        {opponentTeams.find((t) => t.id === targetTeamId)?.name ?? `Team #${targetTeamId}`}
                      </p>
                    )}
                    {targetProTeam && (
                      <p className="text-xs text-gray-600">Target: {targetProTeam}</p>
                    )}
                    {targetCountry && (
                      <p className="text-xs text-gray-600">Country: {targetCountry}</p>
                    )}
                    {kapteinChoice && (
                      <p className="text-xs text-gray-600">
                        Strategy: {kapteinChoice === "single_rider" ? "Single Rider (x2)" : "All from Country (x1.5)"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isPending ? "Submitting..." : "Submit Order"}
                </Button>
                <Button variant="outline" onClick={resetForm} disabled={isPending}>
                  Start over
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Orders Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {teamOrders.length === 0 ? (
            <p className="text-sm text-gray-500">No orders submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Race</TableHead>
                    <TableHead>Order Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-sm">{order.raceName}</TableCell>
                      <TableCell className="text-sm">{order.orderTypeDisplayName}</TableCell>
                      <TableCell className="text-sm text-gray-600">{formatTarget(order)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(order.status)}`}
                        >
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {new Date(order.submittedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        {order.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() => handleCancel(order.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

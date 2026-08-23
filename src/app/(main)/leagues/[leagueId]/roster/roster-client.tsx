"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { dropRider } from "./actions"
import { moveToVueltaSlot, moveFromVueltaSlot } from "@/lib/vuelta-slots"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface RosterRider {
  riderId: number
  riderName: string
  riderTeam: string
  gender: string
  isOnIR: boolean
  isVueltaSlot: boolean
}

interface RosterClientProps {
  roster: RosterRider[]
  leagueId: number
  teamId: number
  overGenders: { men: boolean; women: boolean } | null
  vueltaSlotsEnabled: boolean
  vueltaSlotCount: number
  hasDisabledVueltaSlotRiders: boolean
}

export function RosterClient({
  roster,
  leagueId,
  teamId,
  overGenders,
  vueltaSlotsEnabled,
  vueltaSlotCount,
  hasDisabledVueltaSlotRiders,
}: RosterClientProps) {
  const [confirmRiderId, setConfirmRiderId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const regularRoster = roster.filter((r) => !r.isVueltaSlot)
  const vueltaRoster = roster.filter((r) => r.isVueltaSlot)

  const filteredRegular = overGenders
    ? regularRoster.filter((r) =>
        (r.gender === "M" && overGenders.men) || (r.gender === "F" && overGenders.women)
      )
    : regularRoster

  const confirmRider = roster.find((r) => r.riderId === confirmRiderId) ?? null

  function handleDrop(riderId: number) {
    startTransition(async () => {
      const result = await dropRider({ leagueId, riderId })
      if (result.success) {
        toast.success("Rider dropped")
        setConfirmRiderId(null)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleMoveToVuelta(riderId: number) {
    startTransition(async () => {
      const result = await moveToVueltaSlot({ leagueId, teamId, riderId })
      if (result.success) {
        toast.success("Rider moved to Vuelta slot")
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleMoveFromVuelta(riderId: number) {
    startTransition(async () => {
      const result = await moveFromVueltaSlot({ leagueId, teamId, riderId })
      if (result.success) {
        toast.success("Rider moved to regular roster")
      } else {
        toast.error(result.error)
      }
    })
  }

  if (roster.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground text-center">Your roster is empty.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {hasDisabledVueltaSlotRiders && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="pt-4 pb-4">
            <p className="font-semibold text-orange-800">Vuelta slots have been disabled</p>
            <p className="text-sm text-orange-700 mt-0.5">
              You have riders in Vuelta slots that need to be moved back to your regular roster or dropped.
              Lineups and transfers are blocked until resolved.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Roster ({filteredRegular.length} riders)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredRegular.map((r) => (
              <div
                key={r.riderId}
                className={`flex items-center justify-between gap-3 py-2 border-b last:border-0 border-gray-100 ${r.isOnIR ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-medium text-gray-900 truncate">{r.riderName}</span>
                  <span className="text-sm text-gray-500 truncate hidden sm:block">
                    {r.riderTeam}
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {r.gender === "M" ? "Men" : "Women"}
                  </Badge>
                  {r.isOnIR && (
                    <Badge variant="outline" className="text-xs shrink-0 border-orange-200 text-orange-600 bg-orange-50">
                      On IR
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {vueltaSlotsEnabled && !r.isOnIR && vueltaSlotCount < 2 && r.gender === "M" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleMoveToVuelta(r.riderId)}
                      className="text-amber-700 border-amber-300 hover:bg-amber-50"
                    >
                      → Vuelta
                    </Button>
                  )}
                  {r.isOnIR ? (
                    <span className="text-xs text-gray-400">Cannot drop</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => setConfirmRiderId(r.riderId)}
                    >
                      Drop
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {vueltaRoster.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Vuelta Slots ({vueltaRoster.length}/2)
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                Vuelta
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {vueltaRoster.map((r) => (
                <div
                  key={r.riderId}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-0 border-gray-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-medium text-gray-900 truncate">{r.riderName}</span>
                    <span className="text-sm text-gray-500 truncate hidden sm:block">
                      {r.riderTeam}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {r.gender === "M" ? "Men" : "Women"}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                      Vuelta
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleMoveFromVuelta(r.riderId)}
                      className="text-blue-700 border-blue-300 hover:bg-blue-50"
                    >
                      → Roster
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => setConfirmRiderId(r.riderId)}
                    >
                      Drop
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmRiderId !== null} onOpenChange={() => setConfirmRiderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Drop {confirmRider?.riderName}?</DialogTitle>
            <DialogDescription>
              This is permanent. The rider becomes a free agent immediately and cannot be recovered
              without an admin re-draft.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRiderId(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => handleDrop(confirmRiderId!)}
            >
              {isPending ? "Dropping..." : "Drop Rider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

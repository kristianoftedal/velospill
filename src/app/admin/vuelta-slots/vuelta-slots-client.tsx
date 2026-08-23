"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { toggleVueltaSlots } from "@/lib/vuelta-slots"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"

type VueltaSlot = {
  slotId: number
  leagueId: number
  leagueName: string
  teamId: number
  teamName: string
  riderId: number
  riderName: string
  riderTeam: string
  gender: "M" | "F"
  addedAt: Date
}

interface VueltaSlotsClientProps {
  enabled: boolean
  slots: VueltaSlot[]
}

export function VueltaSlotsClient({ enabled, slots }: VueltaSlotsClientProps) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const newValue = !isEnabled
    startTransition(async () => {
      const result = await toggleVueltaSlots(newValue)
      if (result.success) {
        setIsEnabled(newValue)
        toast.success(newValue ? "Vuelta slots enabled" : "Vuelta slots disabled")
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Vuelta Slots Availability</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isEnabled
                  ? "Players can move riders into Vuelta slots (2 per team)."
                  : "Vuelta slots are disabled. Players with riders in slots will be blocked from lineups and transfers."}
              </p>
            </div>
            <Button
              variant={isEnabled ? "destructive" : "default"}
              size="sm"
              disabled={isPending}
              onClick={handleToggle}
            >
              {isPending ? "Updating..." : isEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            All Vuelta Slots ({slots.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No riders in Vuelta slots.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {slots.map((slot) => (
                <div key={slot.slotId} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{slot.riderName}</span>
                      <span className="text-xs text-muted-foreground">{slot.riderTeam}</span>
                      <Badge variant="outline" className="text-xs">
                        {slot.gender === "M" ? "Men" : "Women"}
                      </Badge>
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                        Vuelta
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {slot.teamName} · {slot.leagueName} · Added {format(new Date(slot.addedAt), "d MMM yyyy")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

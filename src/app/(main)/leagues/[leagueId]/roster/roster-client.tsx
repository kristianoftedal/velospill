"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { dropRider } from "./actions"
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
}

interface RosterClientProps {
  roster: RosterRider[]
  leagueId: number
}

export function RosterClient({ roster, leagueId }: RosterClientProps) {
  const [confirmRiderId, setConfirmRiderId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Roster ({roster.length} riders)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {roster.map((r) => (
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
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setConfirmRiderId(r.riderId)}
                  className="shrink-0"
                >
                  Drop
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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

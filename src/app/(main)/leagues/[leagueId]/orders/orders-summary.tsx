"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"

type OrderAdjustmentRow = {
  raceId: number
  raceName: string
  orderTypeName: string
  orderTypeDisplayName: string
  teamName: string
  riderId: number | null
  riderName: string | null
  basePoints: number
  adjustedPoints: number
  delta: number
  description: string
}

interface OrdersSummaryProps {
  adjustments: OrderAdjustmentRow[]
}

export function OrdersSummary({ adjustments }: OrdersSummaryProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (adjustments.length === 0) {
    return null
  }

  const teamTotals = new Map<string, { gained: number; lost: number }>()
  for (const adj of adjustments) {
    const existing = teamTotals.get(adj.teamName) ?? { gained: 0, lost: 0 }
    if (adj.delta > 0) {
      existing.gained += adj.delta
    } else {
      existing.lost += adj.delta
    }
    teamTotals.set(adj.teamName, existing)
  }
  const sortedTeams = Array.from(teamTotals.entries())
    .map(([name, { gained, lost }]) => ({ name, gained, lost, total: gained + lost }))
    .sort((a, b) => b.total - a.total)

  const groupedByRace = new Map<string, OrderAdjustmentRow[]>()
  for (const adj of adjustments) {
    const existing = groupedByRace.get(adj.raceName) ?? []
    existing.push(adj)
    groupedByRace.set(adj.raceName, existing)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Order Points by Team</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Gained</TableHead>
                <TableHead className="text-right">Lost</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTeams.map((team) => (
                <TableRow key={team.name}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">
                    {team.gained > 0 ? `+${team.gained}` : 0}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {team.lost < 0 ? team.lost : 0}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${team.total > 0 ? "text-green-600" : team.total < 0 ? "text-red-600" : ""}`}>
                    {team.total > 0 ? `+${team.total}` : team.total}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setDetailsOpen(!detailsOpen)}
        >
          <div className="flex items-center justify-between">
            <CardTitle>Order Effects Overview</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" tabIndex={-1}>
              {detailsOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {detailsOpen && (
        <CardContent className="space-y-6">
        {Array.from(groupedByRace.entries()).map(([raceName, rows]) => (
          <div key={raceName}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{raceName}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Rider</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Adjusted</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{row.orderTypeDisplayName}</TableCell>
                    <TableCell className="text-sm">{row.teamName}</TableCell>
                    <TableCell className="text-sm">{row.riderName ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{row.basePoints}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{row.adjustedPoints}</TableCell>
                    <TableCell className={`text-right text-sm font-mono font-semibold ${row.delta > 0 ? "text-green-600" : row.delta < 0 ? "text-red-600" : ""}`}>
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </CardContent>
        )}
      </Card>
    </>
  )
}

"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"

type AuditEntry = {
  id: number
  changeType: string
  changedBy: string
  changedAt: Date
  oldData: any
  newData: any
  reason: string | null
}

type Props = {
  auditEntries: AuditEntry[]
}

export function ResultAuditTrail({ auditEntries }: Props) {
  if (auditEntries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No changes recorded</p>
        </CardContent>
      </Card>
    )
  }

  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case "BATCH_INSERT":
      case "INSERT":
        return <Badge className="bg-green-600">INSERT</Badge>
      case "UPDATE":
        return <Badge className="bg-yellow-600">UPDATE</Badge>
      case "DELETE":
        return <Badge className="bg-red-600">DELETE</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const renderChanges = (entry: AuditEntry) => {
    if (entry.changeType === "BATCH_INSERT") {
      const count = Array.isArray(entry.newData) ? entry.newData.length : 0
      return <p className="text-sm">Inserted {count} results</p>
    }

    if (entry.changeType === "DELETE") {
      const old = entry.oldData
      return (
        <p className="text-sm">
          Deleted: Position <span className="font-mono">{old.position}</span> - Rider ID{" "}
          <span className="font-mono">{old.riderId}</span> ({old.points} points)
        </p>
      )
    }

    if (entry.changeType === "UPDATE") {
      const old = entry.oldData
      const updated = entry.newData
      const changes = []

      if (old.position !== updated.position) {
        changes.push(
          `Position: ${old.position} → ${updated.position}`
        )
      }
      if (old.riderId !== updated.riderId) {
        changes.push(
          `Rider: ${old.riderId} → ${updated.riderId}`
        )
      }
      if (old.time !== updated.time) {
        changes.push(
          `Time: ${old.time || "—"} → ${updated.time || "—"}`
        )
      }
      if (old.points !== updated.points) {
        changes.push(
          `Points: ${old.points} → ${updated.points}`
        )
      }

      return (
        <div className="text-sm space-y-1">
          {changes.map((change, i) => (
            <p key={i} className="font-mono text-xs">
              {change}
            </p>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {auditEntries.map((entry) => (
            <div
              key={entry.id}
              className="border-l-2 border-muted pl-4 pb-4 last:pb-0 relative"
            >
              {/* Timeline dot */}
              <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />

              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  {getChangeTypeBadge(entry.changeType)}
                  <span className="text-xs text-muted-foreground">
                    by {entry.changedBy}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.changedAt), { addSuffix: true })}
                </span>
              </div>

              {/* Changes */}
              {renderChanges(entry)}

              {/* Reason */}
              {entry.reason && (
                <p className="text-sm text-muted-foreground mt-2 italic">
                  Reason: {entry.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

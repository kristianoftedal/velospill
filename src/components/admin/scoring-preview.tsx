"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type ScoringPreviewProps = {
  preview: Array<{
    position: number
    riderId: number
    riderName: string
    pointsAwarded: number
  }>
  totalPointsAwarded: number
  raceName: string
}

export function ScoringPreview({ preview, totalPointsAwarded, raceName }: ScoringPreviewProps) {
  const hasAnyPoints = totalPointsAwarded > 0

  return (
    <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Scoring Preview</span>
          <Badge variant="outline" className="bg-white dark:bg-gray-950">
            {totalPointsAwarded} total points
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Position</TableHead>
              <TableHead>Rider</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.map((result) => (
              <TableRow key={result.riderId}>
                <TableCell className="font-medium">{result.position}</TableCell>
                <TableCell>{result.riderName}</TableCell>
                <TableCell className="text-right">
                  {result.pointsAwarded > 0 ? (
                    <span className="font-semibold text-green-700 dark:text-green-400">
                      {result.pointsAwarded}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {!hasAnyPoints && (
          <p className="text-sm text-muted-foreground mt-3 text-center">
            No points will be awarded for these positions based on the current scoring configuration.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

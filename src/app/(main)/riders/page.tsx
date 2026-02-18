import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import { riders, raceResults, races } from "@/db/schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export default async function RidersPage() {
  // Get all riders with their total points
  const ridersData = await db
    .select({
      id: riders.id,
      name: riders.name,
      team: riders.team,
      nationality: riders.nationality,
      specialty: riders.specialty,
      totalPoints: sql<number>`COALESCE(SUM(${raceResults.points}), 0)`,
    })
    .from(riders)
    .leftJoin(raceResults, sql`${riders.id} = ${raceResults.riderId}`)
    .groupBy(riders.id, riders.name, riders.team, riders.nationality, riders.specialty)
    .orderBy(sql`COALESCE(SUM(${raceResults.points}), 0) DESC`)

  // For each rider, get their race-by-race breakdown
  const riderBreakdowns = await Promise.all(
    ridersData.map(async (rider) => {
      const results = await db
        .select({
          raceName: races.name,
          raceDate: races.startDate,
          position: raceResults.position,
          points: raceResults.points,
          raceType: races.raceType,
        })
        .from(raceResults)
        .innerJoin(races, sql`${raceResults.raceId} = ${races.id}`)
        .where(sql`${raceResults.riderId} = ${rider.id}`)
        .orderBy(sql`${races.startDate} DESC`)

      return {
        ...rider,
        results,
      }
    })
  )

  const specialtyLabels: Record<string, string> = {
    sprinter: "Sprinter",
    climber: "Climber",
    gc: "GC",
    classics: "Classics",
    allrounder: "All-rounder",
    time_trialist: "Time Trialist",
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Professional Riders</h1>
          <p className="text-muted-foreground text-lg">
            Browse riders and their season points breakdown
          </p>
        </div>

        {riderBreakdowns.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No riders available yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{riderBreakdowns.length} Riders</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full space-y-2">
                {riderBreakdowns.map((rider) => (
                  <AccordionItem key={rider.id} value={`rider-${rider.id}`} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center justify-between w-full gap-4">
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-semibold text-foreground">{rider.name}</p>
                              <p className="text-sm text-muted-foreground">{rider.team}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mr-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{rider.totalPoints}</p>
                            <p className="text-xs text-muted-foreground">points</p>
                          </div>
                          <Badge variant="outline" className="whitespace-nowrap">
                            {specialtyLabels[rider.specialty] || rider.specialty}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-4">
                      {rider.results.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">No race results yet.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Race</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Position</TableHead>
                              <TableHead className="text-right">Points</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rider.results.map((result, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{result.raceName}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(result.raceDate), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="secondary">#{result.position}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-primary">
                                  {result.points}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

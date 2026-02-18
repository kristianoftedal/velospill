import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import { riders, raceResults, races } from "@/db/schema"
import RidersPageClient from "./page-client-component"

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

      // Calculate category breakdowns
      const categoryScores = {
        oneDay: results.filter((r) => r.raceType === "one_day").reduce((sum, r) => sum + r.points, 0),
        stage: results.filter((r) => r.raceType === "stage_race").reduce((sum, r) => sum + r.points, 0),
        classic: results.filter((r) => r.raceType === "classic").reduce((sum, r) => sum + r.points, 0),
        total: results.reduce((sum, r) => sum + r.points, 0),
      }

      const maxPosition = results.length > 0 ? Math.max(...results.map((r) => r.position)) : 0
      const avgPosition = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.position, 0) / results.length) : 0

      return {
        ...rider,
        results,
        categoryScores,
        maxPosition,
        avgPosition,
        raceCount: results.length,
      }
    })
  )

  return <RidersPageClient riders={riderBreakdowns} />
}

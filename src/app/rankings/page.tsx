import { db } from "@/lib/db"
import { projectedRankings } from "@/db/schema/projected-rankings"
import { asc, eq } from "drizzle-orm"
import { RankingsClient } from "./rankings-client"

export const metadata = {
  title: "2026 Projected Rankings - Velospill",
  description: "Projected 2026 rider rankings based on 2025 results",
}

export default async function RankingsPage() {
  const rankings = await db
    .select()
    .from(projectedRankings)
    .where(eq(projectedRankings.season, 2026))
    .orderBy(asc(projectedRankings.rank))

  return <RankingsClient rankings={rankings} />
}

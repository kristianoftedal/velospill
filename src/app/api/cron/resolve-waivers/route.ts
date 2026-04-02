import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { leagues, LeagueConfig } from "@/db/schema/leagues"
import { eq } from "drizzle-orm"
import { autoResolveExpiredWaivers } from "@/lib/transfer-queries"

/**
 * Vercel Cron handler — runs every 15 minutes.
 * Resolves expired waiver windows for all active leagues.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get all active leagues
    const activeLeagues = await db
      .select({ id: leagues.id, config: leagues.config })
      .from(leagues)
      .where(eq(leagues.status, "active"))

    let totalResolved = 0

    for (const league of activeLeagues) {
      if (!league.config) continue
      const config = league.config as LeagueConfig
      const season = config.seasonYear

      try {
        const result = await autoResolveExpiredWaivers(league.id, season)
        totalResolved += result.resolved
      } catch (err) {
        // Log but don't fail the whole cron for one league
        console.error(`Failed to resolve waivers for league ${league.id}:`, err)
      }
    }

    return NextResponse.json({
      ok: true,
      leaguesChecked: activeLeagues.length,
      totalResolved,
    })
  } catch (err) {
    console.error("Cron resolve-waivers failed:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { leagues, LeagueConfig } from "@/db/schema/leagues"
import { eq } from "drizzle-orm"
import { autoResolveExpiredWaivers } from "@/lib/transfer-queries"

/**
 * Vercel Cron handler — runs at 23:00 UTC daily.
 * Resolves expired waiver windows for all active leagues.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  const invokedAt = new Date().toISOString()

  console.log(`[cron/resolve-waivers] invoked at ${invokedAt}`)

  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn(`[cron/resolve-waivers] unauthorized request — missing or invalid CRON_SECRET`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log(`[cron/resolve-waivers] authorized — starting resolution`)

  try {
    // Get all active leagues
    const activeLeagues = await db
      .select({ id: leagues.id, name: leagues.name, config: leagues.config })
      .from(leagues)
      .where(eq(leagues.status, "active"))

    console.log(`[cron/resolve-waivers] found ${activeLeagues.length} active league(s)`)

    let totalResolved = 0
    const perLeagueResults: Array<{ leagueId: number; leagueName: string; resolved: number; error?: string }> = []

    for (const league of activeLeagues) {
      if (!league.config) {
        console.warn(`[cron/resolve-waivers] league ${league.id} (${league.name}) — no config, skipping`)
        perLeagueResults.push({ leagueId: league.id, leagueName: league.name, resolved: 0, error: "no config" })
        continue
      }
      const config = league.config as LeagueConfig
      const season = config.seasonYear

      try {
        const result = await autoResolveExpiredWaivers(league.id, season)
        totalResolved += result.resolved
        perLeagueResults.push({ leagueId: league.id, leagueName: league.name, resolved: result.resolved })
        console.log(`[cron/resolve-waivers] league ${league.id} (${league.name}) — resolved ${result.resolved} bid(s)`)
      } catch (err) {
        const errMsg = (err as Error).message
        console.error(`[cron/resolve-waivers] league ${league.id} (${league.name}) FAILED:`, errMsg)
        perLeagueResults.push({ leagueId: league.id, leagueName: league.name, resolved: 0, error: errMsg })
      }
    }

    const durationMs = Date.now() - startTime
    console.log(`[cron/resolve-waivers] complete — leagues:${activeLeagues.length} resolved:${totalResolved} duration:${durationMs}ms`)

    return NextResponse.json({
      ok: true,
      invokedAt,
      durationMs,
      leaguesChecked: activeLeagues.length,
      totalResolved,
      perLeague: perLeagueResults,
    })
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error(`[cron/resolve-waivers] fatal error after ${durationMs}ms:`, err)
    return NextResponse.json({ error: "Internal error", message: (err as Error).message }, { status: 500 })
  }
}

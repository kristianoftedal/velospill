import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { leagues, LeagueConfig } from "@/db/schema/leagues"
import { eq } from "drizzle-orm"
import { autoResolvePendingOrders } from "@/lib/order-queries"

/**
 * Vercel Cron handler — runs at 23:00 UTC daily.
 * Auto-activates pending orders whose race start date has passed.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  const invokedAt = new Date().toISOString()

  console.log(`[cron/resolve-orders] invoked at ${invokedAt}`)

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn(`[cron/resolve-orders] unauthorized request — missing or invalid CRON_SECRET`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log(`[cron/resolve-orders] authorized — starting resolution`)

  try {
    const activeLeagues = await db
      .select({ id: leagues.id, name: leagues.name, config: leagues.config })
      .from(leagues)
      .where(eq(leagues.status, "active"))

    console.log(`[cron/resolve-orders] found ${activeLeagues.length} active league(s)`)

    let totalResolved = 0
    const perLeagueResults: Array<{ leagueId: number; leagueName: string; resolved: number; error?: string }> = []

    for (const league of activeLeagues) {
      if (!league.config) {
        console.warn(`[cron/resolve-orders] league ${league.id} (${league.name}) — no config, skipping`)
        perLeagueResults.push({ leagueId: league.id, leagueName: league.name, resolved: 0, error: "no config" })
        continue
      }

      try {
        const result = await autoResolvePendingOrders(league.id)
        totalResolved += result.resolved
        perLeagueResults.push({ leagueId: league.id, leagueName: league.name, resolved: result.resolved })
        console.log(`[cron/resolve-orders] league ${league.id} (${league.name}) — resolved ${result.resolved} order(s)`)
      } catch (err) {
        const errMsg = (err as Error).message
        console.error(`[cron/resolve-orders] league ${league.id} (${league.name}) FAILED:`, errMsg)
        perLeagueResults.push({ leagueId: league.id, leagueName: league.name, resolved: 0, error: errMsg })
      }
    }

    const durationMs = Date.now() - startTime
    console.log(`[cron/resolve-orders] complete — leagues:${activeLeagues.length} resolved:${totalResolved} duration:${durationMs}ms`)

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
    console.error(`[cron/resolve-orders] fatal error after ${durationMs}ms:`, err)
    return NextResponse.json({ error: "Internal error", message: (err as Error).message }, { status: 500 })
  }
}

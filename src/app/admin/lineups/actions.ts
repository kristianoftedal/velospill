"use server"

import { db } from "@/lib/db"
import { user } from "@/db/schema/users"
import { leagues, teams } from "@/db/schema/leagues"
import { races } from "@/db/schema/races"
import { riders } from "@/db/schema/riders"
import { rosterEvents } from "@/db/schema/roster-events"
import { rosterSlots } from "@/db/schema/roster-slots"
import { rosterLimits } from "@/db/schema/config"
import { raceLineups } from "@/db/schema/lineups"
import { auth } from "@/lib/auth"
import { ownershipAtRaceTime } from "@/lib/roster-ownership"
import { getLineupPeriods, getLineupPeriodDeadline } from "@/lib/lineup-periods"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

const MENS_RACE_TYPES = ["grand_tour", "high_priority_one_day", "low_priority_one_day", "mini_tour", "world_championship"]
const WOMENS_RACE_TYPES = ["womens_grand_tour", "womens_one_day"]

async function checkAdminAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthorized")
  const [dbUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!dbUser || dbUser.role !== "admin") throw new Error("Unauthorized")
  return session
}

function requiredGenderFor(raceType: string): "M" | "F" | null {
  if (MENS_RACE_TYPES.includes(raceType)) return "M"
  if (WOMENS_RACE_TYPES.includes(raceType)) return "F"
  return null
}

export type AdminLineupPeriod = {
  /** Stable key for the client; "all" for a single-period (no rest days) race. */
  key: string
  /** The lineupPeriod value stored on race_lineups (null for single-period). */
  period: number | null
  label: string
  stageRange: string | null
}

export type AdminRosterRider = {
  riderId: number
  riderName: string
  riderTeam: string
  gender: string
  /** False when the rider has since been dropped/transferred off the roster. */
  onRosterNow: boolean
}

export type AdminTeamLineup = {
  teamId: number
  teamName: string
  /** Roster owned at the start of each period, keyed by period key ("1","2",…,"all"). */
  rosterByPeriodKey: Record<string, AdminRosterRider[]>
  /** Current selection keyed by period key ("1","2",…,"all"). */
  lineupByPeriodKey: Record<string, number[]>
}

export type AdminLineupData = {
  race: { id: number; name: string; raceType: string; startDate: string }
  rosterSize: number
  requiredGender: "M" | "F" | null
  periods: AdminLineupPeriod[]
  teams: AdminTeamLineup[]
}

/** Grand tours (multi-stage parent races) available to edit, grouped by league. */
export async function getAdminLineupRaces() {
  await checkAdminAuth()

  const leagueRows = await db.select({ id: leagues.id, name: leagues.name }).from(leagues)

  // Lineups live on top-level races (parentRaceId IS NULL); stages are excluded.
  const parentRaces = await db
    .select({ id: races.id, name: races.name, raceType: races.raceType, startDate: races.startDate })
    .from(races)
    .where(sql`${races.parentRaceId} IS NULL`)
    .orderBy(desc(races.startDate))

  return leagueRows.map((lg) => ({
    leagueId: lg.id,
    leagueName: lg.name,
    races: parentRaces.map((r) => ({
      raceId: r.id,
      raceName: r.name,
      raceType: r.raceType,
      startDate: r.startDate.toISOString(),
    })),
  }))
}

function stageRangeForPeriod(
  period: number,
  restDayStageNumbers: number[],
  maxStage: number,
): string {
  const sorted = [...restDayStageNumbers].sort((a, b) => a - b)
  const start = period === 1 ? 1 : sorted[period - 2] + 1
  const end = period <= sorted.length ? sorted[period - 1] - 1 : maxStage
  return start === end ? `stage ${start}` : `stages ${start}-${end}`
}

export async function getAdminLineupData(
  leagueId: number,
  raceId: number,
): Promise<AdminLineupData | null> {
  await checkAdminAuth()

  const [race] = await db.select().from(races).where(eq(races.id, raceId)).limit(1)
  if (!race || race.parentRaceId !== null) return null

  const [limit] = await db
    .select({ rosterSize: rosterLimits.rosterSize })
    .from(rosterLimits)
    .where(eq(rosterLimits.raceType, race.raceType))
    .limit(1)
  const rosterSize = limit?.rosterSize ?? 0
  const requiredGender = requiredGenderFor(race.raceType)

  // Period model (null when the race has no rest days → single lineup).
  const periodInfo = await getLineupPeriods(raceId)
  const stageRows = await db
    .select({ stageNumber: races.stageNumber, isRestDay: races.isRestDay })
    .from(races)
    .where(eq(races.parentRaceId, raceId))
  const maxStage = Math.max(
    0,
    ...stageRows.filter((s) => !s.isRestDay && s.stageNumber != null).map((s) => s.stageNumber!),
  )

  let periods: AdminLineupPeriod[]
  if (periodInfo) {
    periods = Array.from({ length: periodInfo.periodCount }, (_, i) => {
      const p = i + 1
      return {
        key: String(p),
        period: p,
        label: `Week ${p}`,
        stageRange: stageRangeForPeriod(p, periodInfo.restDayStageNumbers, maxStage),
      }
    })
  } else {
    periods = [{ key: "all", period: null, label: "Full race", stageRange: null }]
  }

  const leagueTeams = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.name))

  // As-of date per period: the start of that week's racing (period 1 = race start;
  // later periods = the day racing resumes after the preceding rest day). The
  // eligible squad for a week is exactly who the team owned at that moment.
  const asOfByKey = new Map<string, Date>()
  for (const p of periods) {
    if (p.period == null) {
      asOfByKey.set(p.key, race.startDate)
    } else {
      const d = await getLineupPeriodDeadline(raceId, p.period)
      asOfByKey.set(p.key, d ?? race.startDate)
    }
  }

  const ownedAt = (asOf: Date) =>
    db
      .selectDistinct({
        teamId: rosterEvents.teamId,
        riderId: rosterEvents.riderId,
        riderName: riders.name,
        riderTeam: riders.team,
        gender: riders.gender,
      })
      .from(rosterEvents)
      .innerJoin(riders, eq(riders.id, rosterEvents.riderId))
      .where(
        and(
          eq(rosterEvents.leagueId, leagueId),
          inArray(rosterEvents.eventType, ["drafted", "transferred_in"]),
          ownershipAtRaceTime(
            leagueId,
            sql`${rosterEvents.teamId}`,
            sql`${rosterEvents.riderId}`,
            sql`${asOf}`,
          ),
        ),
      )

  const ownedByKey = new Map<string, Awaited<ReturnType<typeof ownedAt>>>()
  for (const p of periods) ownedByKey.set(p.key, await ownedAt(asOfByKey.get(p.key)!))

  // Current roster — used only to badge riders that have since been dropped.
  const currentRows = await db
    .select({ teamId: rosterSlots.teamId, riderId: rosterSlots.riderId })
    .from(rosterSlots)
    .where(eq(rosterSlots.leagueId, leagueId))
  const currentByTeam = new Map<number, Set<number>>()
  for (const r of currentRows) {
    const s = currentByTeam.get(r.teamId) ?? new Set<number>()
    s.add(r.riderId)
    currentByTeam.set(r.teamId, s)
  }

  const lineupRows = await db
    .select({
      teamId: raceLineups.teamId,
      riderId: raceLineups.riderId,
      lineupPeriod: raceLineups.lineupPeriod,
      riderName: riders.name,
      riderTeam: riders.team,
      gender: riders.gender,
    })
    .from(raceLineups)
    .innerJoin(riders, eq(riders.id, raceLineups.riderId))
    .where(and(eq(raceLineups.leagueId, leagueId), eq(raceLineups.raceId, raceId)))

  const periodKeyFor = (lp: number | null): string =>
    periodInfo ? String(lp ?? 1) : "all"

  const teamsData: AdminTeamLineup[] = leagueTeams.map((t) => {
    const currentSet = currentByTeam.get(t.id) ?? new Set<number>()

    const lineupByPeriodKey: Record<string, number[]> = {}
    for (const p of periods) lineupByPeriodKey[p.key] = []
    for (const l of lineupRows) {
      if (l.teamId !== t.id) continue
      const key = periodKeyFor(l.lineupPeriod)
      if (lineupByPeriodKey[key]) lineupByPeriodKey[key].push(l.riderId)
    }

    const rosterByPeriodKey: Record<string, AdminRosterRider[]> = {}
    for (const p of periods) {
      const pool = new Map<number, AdminRosterRider>()
      const add = (
        r: { riderId: number; riderName: string; riderTeam: string; gender: string },
        force: boolean,
      ) => {
        if (pool.has(r.riderId)) return
        if (!force && requiredGender && r.gender !== requiredGender) return
        pool.set(r.riderId, {
          riderId: r.riderId,
          riderName: r.riderName,
          riderTeam: r.riderTeam,
          gender: r.gender,
          onRosterNow: currentSet.has(r.riderId),
        })
      }
      // This week's owned squad, plus any rider already saved in this week's
      // lineup (covers missing roster events) — the latter is always shown.
      for (const r of lineupRows) {
        if (r.teamId === t.id && periodKeyFor(r.lineupPeriod) === p.key) add(r, true)
      }
      for (const r of ownedByKey.get(p.key)!) if (r.teamId === t.id) add(r, false)
      rosterByPeriodKey[p.key] = [...pool.values()].sort((a, b) =>
        a.riderName.localeCompare(b.riderName),
      )
    }

    return { teamId: t.id, teamName: t.name, rosterByPeriodKey, lineupByPeriodKey }
  })

  return {
    race: {
      id: race.id,
      name: race.name,
      raceType: race.raceType,
      startDate: race.startDate.toISOString(),
    },
    rosterSize,
    requiredGender,
    periods,
    teams: teamsData,
  }
}

/**
 * Admin-only retroactive lineup write. Unlike the manager-facing setLineup, this
 * bypasses the deadline gate. It still enforces roster size, ownership at race
 * time, and gender so an admin cannot enter an impossible lineup.
 */
export async function setLineupAsAdmin(
  leagueId: number,
  teamId: number,
  raceId: number,
  riderIds: number[],
  lineupPeriod: number | null,
): Promise<{ success: true } | { success: false; error: string }> {
  await checkAdminAuth()

  const [race] = await db.select().from(races).where(eq(races.id, raceId)).limit(1)
  if (!race) return { success: false, error: "Race not found" }
  if (race.parentRaceId !== null) {
    return { success: false, error: "Lineups are set on parent races only, not stages" }
  }

  const [teamRow] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
    .limit(1)
  if (!teamRow) return { success: false, error: "Team not found in this league" }

  const [limit] = await db
    .select({ rosterSize: rosterLimits.rosterSize })
    .from(rosterLimits)
    .where(eq(rosterLimits.raceType, race.raceType))
    .limit(1)
  if (!limit) return { success: false, error: "No roster limit configured for this race type" }
  if (riderIds.length > limit.rosterSize) {
    return { success: false, error: `Lineup cannot exceed ${limit.rosterSize} riders (got ${riderIds.length})` }
  }

  if (riderIds.length > 0) {
    // Allowed pool mirrors the editor's per-week roster: owned at THIS week's
    // start ∪ riders already saved in this week's lineup. Blocks arbitrary ids.
    const asOf =
      lineupPeriod != null
        ? ((await getLineupPeriodDeadline(raceId, lineupPeriod)) ?? race.startDate)
        : race.startDate
    const ownedRows = await db
      .selectDistinct({ riderId: rosterEvents.riderId })
      .from(rosterEvents)
      .where(
        and(
          eq(rosterEvents.leagueId, leagueId),
          inArray(rosterEvents.eventType, ["drafted", "transferred_in"]),
          inArray(rosterEvents.riderId, riderIds),
          ownershipAtRaceTime(
            leagueId,
            sql`${teamId}`,
            sql`${rosterEvents.riderId}`,
            sql`${asOf}`,
          ),
        ),
      )
    const priorLineupRows = await db
      .selectDistinct({ riderId: raceLineups.riderId })
      .from(raceLineups)
      .where(
        and(
          eq(raceLineups.leagueId, leagueId),
          eq(raceLineups.teamId, teamId),
          eq(raceLineups.raceId, raceId),
          lineupPeriod != null
            ? eq(raceLineups.lineupPeriod, lineupPeriod)
            : sql`${raceLineups.lineupPeriod} IS NULL`,
        ),
      )
    const allowed = new Set<number>([
      ...ownedRows.map((r) => r.riderId),
      ...priorLineupRows.map((r) => r.riderId),
    ])
    for (const id of riderIds) {
      if (!allowed.has(id)) {
        return { success: false, error: `Rider ${id} was not on this team for this week` }
      }
    }

    const requiredGender = requiredGenderFor(race.raceType)
    if (requiredGender) {
      const selected = await db
        .select({ riderId: riders.id, gender: riders.gender })
        .from(riders)
        .where(inArray(riders.id, riderIds))
      const wrong = selected.find((s) => s.gender !== requiredGender)
      if (wrong) {
        return {
          success: false,
          error: `This race requires ${requiredGender === "M" ? "men's" : "women's"} riders only`,
        }
      }
    }
  }

  await db.transaction(async (tx) => {
    const conditions = [
      eq(raceLineups.leagueId, leagueId),
      eq(raceLineups.teamId, teamId),
      eq(raceLineups.raceId, raceId),
    ]
    if (lineupPeriod != null) conditions.push(eq(raceLineups.lineupPeriod, lineupPeriod))
    else conditions.push(sql`${raceLineups.lineupPeriod} IS NULL`)
    await tx.delete(raceLineups).where(and(...conditions))

    if (riderIds.length > 0) {
      await tx.insert(raceLineups).values(
        riderIds.map((riderId) => ({
          leagueId,
          teamId,
          raceId,
          riderId,
          lineupPeriod: lineupPeriod ?? null,
        })),
      )
    }
  })

  revalidatePath("/admin/lineups")
  revalidatePath(`/admin/lineups/${leagueId}/${raceId}`)
  return { success: true }
}

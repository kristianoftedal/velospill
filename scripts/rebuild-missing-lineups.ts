/**
 * Rebuild lineups for the periods affected by the deletion of the NULL-period rows
 * in league 7 / races 49, 163, 245.
 *
 * The original selections are unrecoverable (Neon PITR window expired), so affected
 * periods are rescored with a hindsight-optimal lineup: the highest-scoring legal
 * lineup from the riders each team owned at the time.
 *
 * UNIFORM TREATMENT: an optimal lineup is a better lineup than anyone actually set.
 * Giving it only to teams with gaps would advantage them, so for every affected
 * (race, period) EVERY team in the league is rescored the same way — including teams
 * whose real lineup for that period survived. Those real lineups are replaced.
 *
 * Nothing is destroyed silently: every row this script would delete is written to a
 * timestamped backup directory as JSON plus a ready-to-run INSERT script, before any
 * write happens. --apply refuses to run if the backup cannot be written.
 *
 * Scoring semantics mirror src/lib/scoring-queries.ts:
 *   - points = SUM(race_results.points) over the stages in the period
 *   - roster = ownershipAtRaceTime per stage (src/lib/roster-ownership.ts), so a rider
 *              only contributes points for the stages they actually owned
 *   - size   = rosterLimits.rosterSize for the race's raceType
 *   - gender = same race-type -> gender mapping as setLineup()
 *
 * The period NULL slot is rebuilt too. After the makeLineupFilter fix a NULL-period
 * row applies only to results attached to the parent race itself (final GC, jerseys)
 * rather than to any stage. Those results currently match no lineup row at all, so
 * every rider on every roster scores on them.
 *
 * Usage (the npm scripts load .env.local via dotenv-cli — plain `npx tsx` will not,
 * and fails with "No database host or connection string was set"):
 *   npm run lineups:rebuild          # dry run, prints full plan
 *   npm run lineups:rebuild:apply    # backs up, then rewrites
 */
import { db } from "../src/lib/db"
import { sql } from "drizzle-orm"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const LEAGUE_ID = 7
const RACE_IDS = [49, 163, 245]
const APPLY = process.argv.includes("--apply")
const BACKUP_ROOT = join(process.cwd(), ".lineup-backups")

const MENS_RACE_TYPES = ["grand_tour", "high_priority_one_day", "low_priority_one_day", "mini_tour", "world_championship"]
const WOMENS_RACE_TYPES = ["womens_grand_tour", "womens_one_day"]

const raceIdList = sql.join(RACE_IDS.map((i) => sql`${i}`), sql`, `)

type Pick = { riderId: number; name: string; points: number }
type Plan = {
  teamId: number; teamName: string; raceId: number; raceName: string
  period: number | null
  hadLineup: boolean
  beforePoints: number | null   // points of the lineup currently stored for this exact period
  afterPoints: number           // points of the hindsight-optimal lineup
  wholeRosterPoints: number     // points if EVERY owned rider scores — i.e. the current
                                // broken behaviour for a gap period. If this equals
                                // afterPoints the lineup cap never bound and the
                                // "optimal" lineup changes nothing.
  picks: Pick[]
}

/** roster_events ownership test for one team/rider at one moment. */
const owned = (teamId: number, dateExpr: string) => sql.raw(`EXISTS (
  SELECT 1 FROM roster_events o
  WHERE o."leagueId" = ${LEAGUE_ID}
    AND o."teamId" = ${teamId}
    AND o."riderId" = rr."riderId"
    AND o."eventType" IN ('drafted','transferred_in')
    AND o."occurredAt" <= ${dateExpr}
    AND NOT EXISTS (
      SELECT 1 FROM roster_events e
      WHERE e."leagueId" = o."leagueId" AND e."teamId" = o."teamId"
        AND e."riderId" = o."riderId"
        AND e."eventType" IN ('dropped','transferred_out')
        AND e."occurredAt" <= ${dateExpr}
        AND e."occurredAt" > o."occurredAt"
    )
)`)

async function main() {
  const races = (await db.execute(sql`
    SELECT r.id, r.name, r."raceType", rl."rosterSize"
    FROM races r
    LEFT JOIN "rosterLimits" rl ON rl."raceType" = r."raceType"::text
    WHERE r.id IN (${raceIdList})
  `)).rows as { id: number; name: string; raceType: string; rosterSize: number | null }[]

  const teams = (await db.execute(sql`
    SELECT id, name FROM teams WHERE "leagueId" = ${LEAGUE_ID} ORDER BY id
  `)).rows as { id: number; name: string }[]

  // Periods per race, derived from rest-day placement (same formula as makeLineupFilter).
  const periods = (await db.execute(sql`
    SELECT s."parentRaceId" AS "raceId",
           1 + (SELECT count(*) FROM races rd
                WHERE rd."parentRaceId" = s."parentRaceId"
                  AND rd."isRestDay" = true
                  AND rd."stageNumber" < s."stageNumber") AS period,
           array_agg(s.id ORDER BY s."stageNumber") AS "stageIds",
           min(s."stageNumber") AS "firstStage",
           max(s."stageNumber") AS "lastStage"
    FROM races s
    WHERE s."parentRaceId" IN (${raceIdList})
      AND s."stageNumber" IS NOT NULL
      AND s."isRestDay" = false
    GROUP BY s."parentRaceId", period
    ORDER BY 1, 2
  `)).rows as { raceId: number; period: number; stageIds: number[]; firstStage: number; lastStage: number }[]

  const existing = (await db.execute(sql`
    SELECT "teamId", "raceId", "lineupPeriod", "riderId" FROM race_lineups
    WHERE "leagueId" = ${LEAGUE_ID} AND "raceId" IN (${raceIdList})
  `)).rows as { teamId: number; raceId: number; lineupPeriod: number | null; riderId: number }[]

  const key = (t: number, r: number, p: number | null) => `${t}:${r}:${p ?? "null"}`
  const have = new Map<string, number[]>()
  for (const e of existing) {
    const k = key(e.teamId, e.raceId, e.lineupPeriod)
    have.set(k, [...(have.get(k) ?? []), e.riderId])
  }

  // Teams holding any lineup for a race — the population the gap check applies to.
  const teamsInRace = new Map<number, number[]>()
  for (const r of RACE_IDS) {
    teamsInRace.set(r, [...new Set(existing.filter((e) => e.raceId === r).map((e) => e.teamId))])
  }

  const parentResults = (await db.execute(sql`
    SELECT "raceId", count(*)::int AS n FROM race_results
    WHERE "raceId" IN (${raceIdList}) GROUP BY 1
  `)).rows as { raceId: number; n: number }[]
  const parentHasResults = new Set(parentResults.filter((r) => r.n > 0).map((r) => r.raceId))

  // An (race, period) is AFFECTED if at least one team that plays that race lacks a
  // lineup for it. Uniform treatment then applies to every team in the league.
  const affected: { raceId: number; period: number | null; stageIds: number[] | null; label: string }[] = []
  for (const raceId of RACE_IDS) {
    const population = teamsInRace.get(raceId) ?? []
    if (population.length === 0) continue
    for (const p of periods.filter((x) => x.raceId === raceId)) {
      const gapTeams = population.filter((t) => !have.has(key(t, raceId, p.period)))
      if (gapTeams.length > 0) {
        affected.push({ raceId, period: p.period, stageIds: p.stageIds, label: `period ${p.period} (stages ${p.firstStage}-${p.lastStage})` })
      }
    }
    if (parentHasResults.has(raceId) && population.some((t) => !have.has(key(t, raceId, null)))) {
      affected.push({ raceId, period: null, stageIds: null, label: "parent race (GC/jerseys)" })
    }
  }

  if (affected.length === 0) {
    console.log("No affected (race, period) combinations — nothing to do.")
    return
  }

  /** Sum points a given rider set scored across a scope, respecting per-stage ownership. */
  async function pointsFor(teamId: number, scope: ReturnType<typeof sql.raw> | ReturnType<typeof sql>, riderIds: number[]) {
    if (riderIds.length === 0) return 0
    const rows = (await db.execute(sql`
      SELECT COALESCE(SUM(rr.points), 0)::int AS points
      FROM race_results rr
      JOIN races s ON s.id = rr."raceId"
      WHERE ${scope}
        AND rr."riderId" IN (${sql.join(riderIds.map((i) => sql`${i}`), sql`, `)})
        AND ${owned(teamId, 's."startDate"')}
    `)).rows as { points: number }[]
    return rows[0]?.points ?? 0
  }

  /** Points if every owned rider scores — the current behaviour when no lineup matches. */
  async function wholeRoster(teamId: number, scope: ReturnType<typeof sql.raw> | ReturnType<typeof sql>, gender: string | null) {
    const rows = (await db.execute(sql`
      SELECT COALESCE(SUM(rr.points), 0)::int AS points
      FROM race_results rr
      JOIN races s   ON s.id = rr."raceId"
      JOIN riders ri ON ri.id = rr."riderId"
      WHERE ${scope}
        AND ${owned(teamId, 's."startDate"')}
        ${gender ? sql`AND ri.gender = ${gender}` : sql``}
    `)).rows as { points: number }[]
    return rows[0]?.points ?? 0
  }

  const plans: Plan[] = []

  for (const a of affected) {
    const race = races.find((r) => r.id === a.raceId)!
    if (race.rosterSize == null) {
      console.log(`SKIP ${race.name} (${race.id}) — no rosterLimits row for raceType "${race.raceType}"`)
      continue
    }
    const size = race.rosterSize
    const gender = MENS_RACE_TYPES.includes(race.raceType) ? "M"
      : WOMENS_RACE_TYPES.includes(race.raceType) ? "F" : null

    const scope = a.stageIds === null
      ? sql`rr."raceId" = ${a.raceId}`
      : sql.raw(`rr."raceId" IN (${a.stageIds.join(",")})`)

    for (const team of teams) {
      const optimal = (await db.execute(sql`
        SELECT rr."riderId", ri.name, SUM(rr.points)::int AS points
        FROM race_results rr
        JOIN races s   ON s.id = rr."raceId"
        JOIN riders ri ON ri.id = rr."riderId"
        WHERE ${scope}
          AND ${owned(team.id, 's."startDate"')}
          ${gender ? sql`AND ri.gender = ${gender}` : sql``}
        GROUP BY rr."riderId", ri.name
        HAVING SUM(rr.points) > 0
        ORDER BY points DESC, rr."riderId"
        LIMIT ${size}
      `)).rows as Pick[]

      if (optimal.length === 0) continue  // team owned nobody who scored; no lineup to write

      const prior = have.get(key(team.id, a.raceId, a.period))
      plans.push({
        teamId: team.id, teamName: team.name,
        raceId: a.raceId, raceName: race.name,
        period: a.period,
        hadLineup: prior != null,
        beforePoints: prior ? await pointsFor(team.id, scope, prior) : null,
        afterPoints: optimal.reduce((s, p) => s + p.points, 0),
        wholeRosterPoints: await wholeRoster(team.id, scope, gender),
        picks: optimal,
      })
    }
  }

  // ---- report ----
  let replaced = 0
  for (const a of affected) {
    const race = races.find((r) => r.id === a.raceId)!
    console.log(`\n=== ${race.name} (${race.id}) — ${a.label}  [lineup cap ${race.rosterSize}] ===`)
    for (const p of plans.filter((x) => x.raceId === a.raceId && x.period === a.period)) {
      if (p.hadLineup) replaced++
      const current = p.beforePoints ?? p.wholeRosterPoints
      const source = p.hadLineup ? "real lineup" : "whole roster (current bug)"
      const noop = p.afterPoints === p.wholeRosterPoints && !p.hadLineup ? "   <-- NO CHANGE: cap never bound" : ""
      console.log(`  team ${p.teamId} ${p.teamName}: ${current} (${source}) -> ${p.afterPoints}` +
        `  [whole roster would be ${p.wholeRosterPoints}, ${p.picks.length}/${race.rosterSize} riders]${noop}`)
      for (const c of p.picks) console.log(`      ${String(c.points).padStart(4)}  ${c.name} (${c.riderId})`)
    }
  }

  const rowsOut = plans.flatMap((p) => p.picks.map((c) => ({ ...p, riderId: c.riderId })))
  console.log(`\n${affected.length} affected (race, period) combos`)
  console.log(`${plans.length} team-period lineups rewritten, of which ${replaced} replace a real submitted lineup`)
  console.log(`${rowsOut.length} race_lineups rows to write`)
  const noops = plans.filter((p) => !p.hadLineup && p.afterPoints === p.wholeRosterPoints)
  const boosts = plans.filter((p) => p.hadLineup && p.afterPoints > (p.beforePoints ?? 0))
  console.log(`${noops.length} gap lineups score identically to the current whole-roster bug (no repair)`)
  console.log(`${boosts.length} real lineups gain points, total +${boosts.reduce((s, p) => s + p.afterPoints - (p.beforePoints ?? 0), 0)}`)

  if (!APPLY) {
    console.log("\nDry run — no backup written, no changes made. Re-run with --apply.")
    return
  }

  // ---- backup, then write ----
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const dir = join(BACKUP_ROOT, stamp)
  mkdirSync(dir, { recursive: true })

  const doomed = existing.filter((e) =>
    plans.some((p) => p.teamId === e.teamId && p.raceId === e.raceId && p.period === e.lineupPeriod))
  writeFileSync(join(dir, "deleted-rows.json"), JSON.stringify(doomed, null, 2))
  writeFileSync(join(dir, "restore.sql"),
    `-- Restores the ${doomed.length} race_lineups rows replaced on ${stamp}.\n` +
    `-- Run this to undo scripts/rebuild-missing-lineups.ts --apply.\nBEGIN;\n` +
    plans.map((p) =>
      `DELETE FROM race_lineups WHERE "leagueId"=${LEAGUE_ID} AND "teamId"=${p.teamId}` +
      ` AND "raceId"=${p.raceId} AND "lineupPeriod" ${p.period === null ? "IS NULL" : `= ${p.period}`};`).join("\n") +
    "\n" +
    doomed.map((d) =>
      `INSERT INTO race_lineups ("leagueId","teamId","raceId","riderId","lineupPeriod") VALUES ` +
      `(${LEAGUE_ID},${d.teamId},${d.raceId},${d.riderId},${d.lineupPeriod ?? "NULL"});`).join("\n") +
    "\nCOMMIT;\n")
  console.log(`\nBackup written: ${dir}  (${doomed.length} rows, restore.sql undoes this run)`)

  await db.transaction(async (tx) => {
    for (const p of plans) {
      await tx.execute(sql`
        DELETE FROM race_lineups
        WHERE "leagueId" = ${LEAGUE_ID} AND "teamId" = ${p.teamId} AND "raceId" = ${p.raceId}
          AND "lineupPeriod" ${p.period === null ? sql`IS NULL` : sql`= ${p.period}`}
      `)
      for (const c of p.picks) {
        await tx.execute(sql`
          INSERT INTO race_lineups ("leagueId","teamId","raceId","riderId","lineupPeriod")
          VALUES (${LEAGUE_ID}, ${p.teamId}, ${p.raceId}, ${c.riderId}, ${p.period})
          ON CONFLICT DO NOTHING
        `)
      }
    }
  })
  console.log(`Applied ${rowsOut.length} rows across ${plans.length} lineups.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

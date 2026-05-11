import { db } from "@/lib/db"
import { races } from "@/db/schema/races"
import { eq, and, asc } from "drizzle-orm"

/**
 * For a Grand Tour with rest days, stages are split into "lineup periods".
 * Period 1: stages before the first rest day
 * Period 2: stages after the first rest day but before the second
 * Period 3: stages after the second rest day
 * ...and so on.
 *
 * If there are no rest days, the entire GT is period 1 (or null for backward compat).
 */

export type LineupPeriodInfo = {
  period: number
  periodCount: number
  /** Stage numbers that start each period (the first non-rest-day stage after a rest day) */
  periodBoundaries: number[]
  /** Rest day stage numbers */
  restDayStageNumbers: number[]
}

/**
 * Get all stages for a parent race, ordered by stageNumber.
 */
async function getStagesForParentRace(parentRaceId: number) {
  return db
    .select({
      id: races.id,
      stageNumber: races.stageNumber,
      isRestDay: races.isRestDay,
      startDate: races.startDate,
      name: races.name,
    })
    .from(races)
    .where(eq(races.parentRaceId, parentRaceId))
    .orderBy(asc(races.stageNumber), asc(races.startDate))
}

/**
 * Compute the lineup period for a given stage based on rest day positions.
 * Returns null if the parent race has no rest days (legacy behavior).
 */
export async function getLineupPeriodForStage(
  stageId: number,
  parentRaceId: number
): Promise<number | null> {
  const stages = await getStagesForParentRace(parentRaceId)
  const restDayNumbers = stages
    .filter((s) => s.isRestDay)
    .map((s) => s.stageNumber!)
    .sort((a, b) => a - b)

  if (restDayNumbers.length === 0) return null

  const stage = stages.find((s) => s.id === stageId)
  if (!stage || stage.stageNumber == null) return null

  return computePeriod(stage.stageNumber, restDayNumbers)
}

/**
 * Pure function: given a stage number and sorted rest day stage numbers,
 * compute which lineup period the stage belongs to.
 */
export function computePeriod(stageNumber: number, restDayStageNumbers: number[]): number {
  let period = 1
  for (const restDay of restDayStageNumbers) {
    if (stageNumber > restDay) {
      period++
    }
  }
  return period
}

/**
 * Get all lineup periods for a Grand Tour (parent race).
 * Returns period info including boundaries and count.
 * Returns null if no rest days exist (legacy single-period behavior).
 */
export async function getLineupPeriods(parentRaceId: number): Promise<LineupPeriodInfo | null> {
  const stages = await getStagesForParentRace(parentRaceId)
  const restDayStageNumbers = stages
    .filter((s) => s.isRestDay)
    .map((s) => s.stageNumber!)
    .sort((a, b) => a - b)

  if (restDayStageNumbers.length === 0) return null

  const periodCount = restDayStageNumbers.length + 1

  // Period boundaries: stage 1 starts period 1, then first non-rest stage after each rest day
  const periodBoundaries: number[] = [1]
  for (const restDay of restDayStageNumbers) {
    // Find the first non-rest stage after this rest day
    const nextStage = stages.find(
      (s) => s.stageNumber != null && s.stageNumber > restDay && !s.isRestDay
    )
    if (nextStage?.stageNumber != null) {
      periodBoundaries.push(nextStage.stageNumber)
    }
  }

  return {
    period: 1, // default; callers use computePeriod for specific stages
    periodCount,
    periodBoundaries,
    restDayStageNumbers,
  }
}

/**
 * Get the deadline date for a lineup period.
 * For period 1: the parent race start date (noon UTC on race day).
 * For period N>1: the startDate of the first stage after the preceding rest day (noon UTC).
 */
export async function getLineupPeriodDeadline(
  parentRaceId: number,
  period: number
): Promise<Date | null> {
  if (period === 1) {
    // Period 1 deadline is the race start (existing logic handles this)
    const [race] = await db
      .select({ startDate: races.startDate })
      .from(races)
      .where(eq(races.id, parentRaceId))
      .limit(1)
    return race?.startDate ?? null
  }

  // Period N>1: deadline is the start of the first race stage after the rest day
  // (noon UTC on the day racing resumes, which is when lineup changes are no longer allowed)
  const stages = await getStagesForParentRace(parentRaceId)
  const restDays = stages
    .filter((s) => s.isRestDay)
    .sort((a, b) => (a.stageNumber ?? 0) - (b.stageNumber ?? 0))

  const restDayForPeriod = restDays[period - 2] // period 2 uses restDays[0], etc.
  if (!restDayForPeriod?.stageNumber) return null

  const firstStageAfterRest = stages.find(
    (s) => !s.isRestDay && (s.stageNumber ?? 0) > restDayForPeriod.stageNumber!
  )
  return firstStageAfterRest?.startDate ?? null
}

/**
 * Get all period deadlines as ISO strings (for passing to client components).
 * Returns a map of period number → deadline ISO string.
 * Returns null if no rest days (legacy single-period behavior).
 */
export async function getAllPeriodDeadlines(parentRaceId: number): Promise<Record<number, string> | null> {
  const periods = await getLineupPeriods(parentRaceId)
  if (!periods) return null

  const deadlines: Record<number, string> = {}
  for (let p = 1; p <= periods.periodCount; p++) {
    const rawDate = await getLineupPeriodDeadline(parentRaceId, p)
    if (rawDate) {
      deadlines[p] = rawDate.toISOString()
    }
  }
  return deadlines
}

/**
 * Determine which lineup periods are currently open for editing.
 * A period is open if we haven't passed its deadline yet.
 */
export async function getEditableLineupPeriods(parentRaceId: number): Promise<number[]> {
  const periods = await getLineupPeriods(parentRaceId)
  if (!periods) return [] // no rest days = use legacy flow

  const now = new Date()
  const editable: number[] = []

  for (let p = 1; p <= periods.periodCount; p++) {
    const deadline = await getLineupPeriodDeadline(parentRaceId, p)
    if (!deadline) continue

    // Deadline is noon UTC on the deadline date (the stage startDate stored in the DB)
    if (now < deadline) {
      editable.push(p)
    }
  }

  return editable
}

"use server"

import { db } from "@/lib/db"
import { races } from "@/db/schema/races"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { eq, isNull, sql } from "drizzle-orm"

const raceSchema = z.object({
  name: z.string().min(2, "Race name required"),
  raceType: z.enum([
    "grand_tour",
    "high_priority_one_day",
    "low_priority_one_day",
    "mini_tour",
    "womens_grand_tour",
    "womens_one_day",
    "world_championship",
  ]),
  startDate: z.string().transform((v) => new Date(v)),
  endDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  season: z.coerce.number().min(2020).max(2030),
})

const stageSchema = z.object({
  name: z.string().min(1, "Stage name required"),
  stageNumber: z.coerce.number().min(1),
  startDate: z.string().transform((v) => new Date(v)),
})

type RaceInput = z.infer<typeof raceSchema>
type StageInput = z.input<typeof stageSchema>

async function checkAdminAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    throw new Error("Unauthorized")
  }
  const [dbUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!dbUser || dbUser.role !== "admin") {
    throw new Error("Unauthorized")
  }
  return session
}

export async function getRaces() {
  await checkAdminAuth()

  // Get parent races only with stage count
  const parentRaces = await db
    .select({
      id: races.id,
      name: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      endDate: races.endDate,
      season: races.season,
      stageCount: sql<number>`(SELECT COUNT(*) FROM ${races} WHERE ${races.parentRaceId} = ${races.id})`.as('stageCount'),
    })
    .from(races)
    .where(isNull(races.parentRaceId))
    .orderBy(races.startDate)

  return parentRaces
}

export async function getRaceWithStages(raceId: number) {
  await checkAdminAuth()

  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
    with: {
      stages: {
        orderBy: (stages, { asc }) => [asc(stages.stageNumber)],
      },
    },
  })

  return race
}

export async function createRace(formData: RaceInput) {
  await checkAdminAuth()

  const result = raceSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors,
    }
  }

  try {
    await db.insert(races).values(result.data)
    revalidatePath("/admin/races")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: { _form: [(error as Error).message] },
    }
  }
}

export async function createStage(
  parentRaceId: number,
  formData: StageInput
) {
  await checkAdminAuth()

  const result = stageSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors,
    }
  }

  try {
    // Get parent race to inherit raceType and season
    const parentRace = await db.query.races.findFirst({
      where: eq(races.id, parentRaceId),
    })

    if (!parentRace) {
      return {
        success: false,
        error: { _form: ["Parent race not found"] },
      }
    }

    await db.insert(races).values({
      ...result.data,
      parentRaceId,
      raceType: parentRace.raceType,
      season: parentRace.season,
    })

    revalidatePath("/admin/races")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: { _form: [(error as Error).message] },
    }
  }
}

export async function updateRace(id: number, formData: RaceInput) {
  await checkAdminAuth()

  const result = raceSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors,
    }
  }

  try {
    await db.update(races).set(result.data).where(eq(races.id, id))
    revalidatePath("/admin/races")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: { _form: [(error as Error).message] },
    }
  }
}

export async function deleteRace(id: number) {
  await checkAdminAuth()

  try {
    // Delete child stages first (if any), then parent
    await db.delete(races).where(eq(races.parentRaceId, id))
    await db.delete(races).where(eq(races.id, id))
    revalidatePath("/admin/races")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}

export async function deleteStage(stageId: number) {
  await checkAdminAuth()

  try {
    await db.delete(races).where(eq(races.id, stageId))
    revalidatePath("/admin/races")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}

export async function toggleRestDay(stageId: number) {
  await checkAdminAuth()

  try {
    const stage = await db.query.races.findFirst({
      where: eq(races.id, stageId),
    })

    if (!stage || !stage.parentRaceId) {
      return { success: false, error: "Stage not found or not a child stage" }
    }

    await db
      .update(races)
      .set({ isRestDay: !stage.isRestDay })
      .where(eq(races.id, stageId))

    revalidatePath("/admin/races")
    return { success: true, isRestDay: !stage.isRestDay }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

export async function addRestDay(parentRaceId: number, formData: { date: string }) {
  await checkAdminAuth()

  try {
    const parentRace = await db.query.races.findFirst({
      where: eq(races.id, parentRaceId),
    })

    if (!parentRace) {
      return { success: false, error: "Parent race not found" }
    }

    // Find the next available stage number for rest days
    const existingStages = await db
      .select({ stageNumber: races.stageNumber })
      .from(races)
      .where(eq(races.parentRaceId, parentRaceId))

    const maxStageNumber = existingStages.reduce(
      (max, s) => Math.max(max, s.stageNumber || 0),
      0
    )

    await db.insert(races).values({
      name: "Rest Day",
      stageNumber: maxStageNumber + 1,
      startDate: new Date(formData.date),
      parentRaceId,
      raceType: parentRace.raceType,
      season: parentRace.season,
      isRestDay: true,
    })

    revalidatePath("/admin/races")
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

export async function importRaces(
  data: Array<{
    name: string
    race_type: string
    start_date: string
    end_date?: string
    season: string
    parent_race_name?: string
    stage_number?: string
  }>
) {
  await checkAdminAuth()

  const errors: Array<{ row: number; field: string; message: string }> = []
  const imported: string[] = []

  try {
    // Detect if this is a stage import (has parent_race_name column)
    const isStageImport = data.some((row) => row.parent_race_name)

    if (isStageImport) {
      // Stage import
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        const rowNum = i + 2 // +2 for header row and 1-indexed

        // Find parent race
        const parentRaces = await db
          .select()
          .from(races)
          .where(eq(races.name, row.parent_race_name!))
          .limit(1)

        if (parentRaces.length === 0) {
          errors.push({
            row: rowNum,
            field: "parent_race_name",
            message: `Parent race "${row.parent_race_name}" not found`,
          })
          continue
        }

        const parentRace = parentRaces[0]

        const stageData = {
          name: row.name,
          stageNumber: row.stage_number || "1",
          startDate: row.start_date,
        }

        const result = stageSchema.safeParse(stageData)

        if (!result.success) {
          result.error.issues.forEach((err) => {
            errors.push({
              row: rowNum,
              field: err.path.join("."),
              message: err.message,
            })
          })
          continue
        }

        await db.insert(races).values({
          ...result.data,
          parentRaceId: parentRace.id,
          raceType: parentRace.raceType,
          season: parentRace.season,
        })

        imported.push(row.name)
      }
    } else {
      // Race import
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        const rowNum = i + 2

        const raceData = {
          name: row.name,
          raceType: row.race_type,
          startDate: row.start_date,
          endDate: row.end_date || undefined,
          season: row.season,
        }

        const result = raceSchema.safeParse(raceData)

        if (!result.success) {
          result.error.issues.forEach((err) => {
            errors.push({
              row: rowNum,
              field: err.path.join("."),
              message: err.message,
            })
          })
          continue
        }

        await db.insert(races).values(result.data)
        imported.push(row.name)
      }
    }

    revalidatePath("/admin/races")

    return {
      success: errors.length === 0,
      imported: imported.length,
      errors,
    }
  } catch (error) {
    return {
      success: false,
      imported: 0,
      errors: [
        {
          row: 0,
          field: "general",
          message: (error as Error).message,
        },
      ],
    }
  }
}

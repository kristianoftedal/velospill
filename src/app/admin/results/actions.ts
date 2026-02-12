"use server"

import { db } from "@/lib/db"
import { races } from "@/db/schema/races"
import { riders } from "@/db/schema/riders"
import { raceResults, resultAudit } from "@/db/schema/results"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { eq, isNull, sql, desc } from "drizzle-orm"

async function checkAdminAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || (session.user as any).role !== "admin") {
    throw new Error("Unauthorized")
  }
  return session
}

const resultSchema = z.object({
  raceId: z.number(),
  results: z
    .array(
      z.object({
        position: z.number().min(1),
        riderId: z.number().min(1, "Select a rider"),
        time: z.string().optional(),
      })
    )
    .min(1, "Enter at least one result")
    .refine(
      (results) => {
        const positions = results.map((r) => r.position)
        return positions.length === new Set(positions).size
      },
      { message: "Positions must be unique" }
    )
    .refine(
      (results) => {
        const riderIds = results.map((r) => r.riderId)
        return riderIds.length === new Set(riderIds).size
      },
      { message: "Each rider can only appear once" }
    ),
})

type ResultInput = z.infer<typeof resultSchema>

export async function getRacesForResults() {
  await checkAdminAuth()

  const allRaces = await db
    .select({
      id: races.id,
      name: races.name,
      raceType: races.raceType,
      startDate: races.startDate,
      parentRaceId: races.parentRaceId,
      stageNumber: races.stageNumber,
      hasResults: sql<boolean>`EXISTS(SELECT 1 FROM ${raceResults} WHERE ${raceResults.raceId} = ${races.id})`.as('hasResults'),
    })
    .from(races)
    .orderBy(desc(races.startDate))

  return allRaces
}

export async function getRiders() {
  await checkAdminAuth()

  const allRiders = await db
    .select({
      id: riders.id,
      name: riders.name,
      team: riders.team,
      nationality: riders.nationality,
      gender: riders.gender,
    })
    .from(riders)
    .orderBy(riders.name)

  return allRiders
}

export async function getResultsForRace(raceId: number) {
  await checkAdminAuth()

  const results = await db
    .select({
      id: raceResults.id,
      position: raceResults.position,
      time: raceResults.time,
      points: raceResults.points,
      riderId: raceResults.riderId,
      riderName: riders.name,
      riderTeam: riders.team,
    })
    .from(raceResults)
    .innerJoin(riders, eq(raceResults.riderId, riders.id))
    .where(eq(raceResults.raceId, raceId))
    .orderBy(raceResults.position)

  return results
}

export async function submitRaceResults(formData: ResultInput) {
  const session = await checkAdminAuth()

  const result = resultSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors,
    }
  }

  const { raceId, results: resultData } = result.data

  try {
    // Get the race to check raceType
    const race = await db.query.races.findFirst({
      where: eq(races.id, raceId),
    })

    if (!race) {
      return {
        success: false,
        error: { _form: ["Race not found"] },
      }
    }

    // Determine expected gender based on race type
    const expectedGender = race.raceType.startsWith("womens_") ? "F" : "M"

    // Fetch all riders to validate gender
    const riderIds = resultData.map((r) => r.riderId)
    const riderRecords = await db.query.riders.findMany({
      where: (riders, { inArray }) => inArray(riders.id, riderIds),
    })

    // Create a map for quick lookup
    const riderMap = new Map(riderRecords.map((r) => [r.id, r]))

    // Validate all riders exist and have correct gender
    for (const resultItem of resultData) {
      const rider = riderMap.get(resultItem.riderId)
      if (!rider) {
        return {
          success: false,
          error: { _form: [`Rider with ID ${resultItem.riderId} not found`] },
        }
      }
      if (rider.gender !== expectedGender) {
        return {
          success: false,
          error: {
            _form: [
              `Invalid gender: ${rider.name} is ${rider.gender === "M" ? "male" : "female"} but this is a ${expectedGender === "M" ? "men's" : "women's"} race`,
            ],
          },
        }
      }
    }

    // Use transaction to insert results and audit entry
    await db.transaction(async (tx) => {
      // Insert all results
      for (const resultItem of resultData) {
        await tx.insert(raceResults).values({
          raceId,
          riderId: resultItem.riderId,
          position: resultItem.position,
          time: resultItem.time || null,
          points: 0, // Will be calculated later
        })
      }

      // Insert audit entry
      await tx.insert(resultAudit).values({
        raceId,
        changeType: "BATCH_INSERT",
        changedBy: session.user.id,
        newData: resultData as any,
      })
    })

    revalidatePath("/admin/results")
    return { success: true }
  } catch (error: any) {
    // Handle unique constraint violations
    if (error.code === "23505") {
      return {
        success: false,
        error: {
          _form: ["Results already exist for this race. Please edit existing results instead."],
        },
      }
    }

    return {
      success: false,
      error: { _form: [(error as Error).message] },
    }
  }
}

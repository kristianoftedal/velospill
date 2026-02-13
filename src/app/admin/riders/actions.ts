"use server"

import { db } from "@/lib/db"
import { riders } from "@/db/schema/riders"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { eq } from "drizzle-orm"

const riderSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  team: z.string().min(1, "Team is required"),
  nationality: z.string().length(3, "Use 3-letter country code (e.g., NOR, FRA)"),
  gender: z.enum(["M", "F"]),
  specialty: z.enum([
    "sprinter",
    "climber",
    "gc",
    "classics",
    "allrounder",
    "time_trialist",
  ]),
})

type RiderInput = z.infer<typeof riderSchema>

async function checkAdminAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    throw new Error("Unauthorized")
  }
  // Read role from DB to avoid stale cookie cache
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

export async function getRiders() {
  await checkAdminAuth()
  return await db.select().from(riders).orderBy(riders.name)
}

export async function createRider(formData: RiderInput) {
  await checkAdminAuth()

  const result = riderSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors,
    }
  }

  try {
    await db.insert(riders).values(result.data)
    revalidatePath("/admin/riders")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: { _form: ["Failed to create rider"] },
    }
  }
}

export async function updateRider(id: number, formData: RiderInput) {
  await checkAdminAuth()

  const result = riderSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors,
    }
  }

  try {
    await db.update(riders).set(result.data).where(eq(riders.id, id))
    revalidatePath("/admin/riders")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: { _form: ["Failed to update rider"] },
    }
  }
}

export async function deleteRider(id: number) {
  await checkAdminAuth()

  try {
    await db.delete(riders).where(eq(riders.id, id))
    revalidatePath("/admin/riders")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: "Failed to delete rider",
    }
  }
}

export async function importRiders(data: unknown[]) {
  await checkAdminAuth()

  const errors: { row: number; errors: string }[] = []
  const validated: RiderInput[] = []

  data.forEach((row, index) => {
    const result = riderSchema.safeParse(row)
    if (!result.success) {
      errors.push({
        row: index + 1,
        errors: result.error.issues.map((i) => `${i.path}: ${i.message}`).join(", "),
      })
    } else {
      validated.push(result.data)
    }
  })

  if (errors.length > 0) {
    return { success: false, errors, imported: 0 }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(riders).values(validated)
    })

    revalidatePath("/admin/riders")
    return { success: true, errors: [], imported: validated.length }
  } catch (error) {
    return {
      success: false,
      errors: [{ row: 0, errors: "Database error during import" }],
      imported: 0,
    }
  }
}

"use server"

import { db } from "@/lib/db"
import { leagues, teams } from "@/db/schema/leagues"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { generateInviteCode } from "@/lib/invite-codes"
import { addDays } from "date-fns"

async function checkAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

const createLeagueSchema = z.object({
  name: z
    .string()
    .min(2, "League name must be at least 2 characters")
    .max(100, "League name must be at most 100 characters"),
  teamName: z
    .string()
    .min(2, "Team name must be at least 2 characters")
    .max(50, "Team name must be at most 50 characters"),
  seasonYear: z
    .number()
    .int()
    .min(2024, "Season year must be 2024 or later")
    .max(2030, "Season year must be 2030 or earlier")
    .default(new Date().getFullYear()),
  draftDate: z.string().optional(),
})

export async function createLeague(formData: {
  name: string
  teamName: string
  seasonYear: number
  draftDate?: string
}) {
  const session = await checkAuth()

  const result = createLeagueSchema.safeParse(formData)
  if (!result.success) {
    return {
      success: false as const,
      error: result.error.flatten().fieldErrors,
    }
  }

  const inviteCode = generateInviteCode()
  const inviteExpiresAt = addDays(new Date(), 7)

  try {
    const [league] = await db
      .insert(leagues)
      .values({
        name: result.data.name,
        inviteCode,
        inviteExpiresAt,
        ownerId: session.user.id,
        status: "setup",
        config: {
          seasonYear: result.data.seasonYear,
          draftDate: result.data.draftDate,
          teamMin: 2,
          teamMax: 10,
        },
      })
      .returning()

    // Add creator as the first team member
    await db.insert(teams).values({
      leagueId: league.id,
      userId: session.user.id,
      name: result.data.teamName,
    })

    // Promote league creator to admin so they can manage riders/races
    await db
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, session.user.id))

    revalidatePath("/leagues")
    return {
      success: true as const,
      leagueId: league.id,
      inviteCode: league.inviteCode,
    }
  } catch {
    return {
      success: false as const,
      error: { _form: ["Failed to create league. Please try again."] },
    }
  }
}

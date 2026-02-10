import { db } from "@/lib/db"
import { user } from "@/db/schema/users"
import { auth } from "@/lib/auth"
import { eq } from "drizzle-orm"

async function seed() {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD env vars required")
    process.exit(1)
  }

  try {
    // Check if admin already exists
    const existing = await db.query.user.findFirst({
      where: eq(user.email, adminEmail)
    })

    if (existing) {
      console.log("Admin already exists, updating role...")
      await db.update(user).set({ role: "admin" }).where(eq(user.email, adminEmail))
      console.log("Admin role updated successfully")
    } else {
      console.log("Creating admin user...")
      // Create via Better Auth API to properly hash password
      await auth.api.signUpEmail({
        body: { email: adminEmail, password: adminPassword, name: "Admin" }
      })
      // Update role to admin
      await db.update(user).set({ role: "admin" }).where(eq(user.email, adminEmail))
      console.log("Admin user created successfully")
    }

    process.exit(0)
  } catch (error) {
    console.error("Error seeding admin:", error)
    process.exit(1)
  }
}

seed()

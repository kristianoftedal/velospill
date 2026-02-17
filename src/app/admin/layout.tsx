import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "@/db/schema/users"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect("/login")
  }

  // Read role from DB to avoid stale cookie cache
  const [dbUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!dbUser || dbUser.role !== "admin") {
    redirect("/home")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="border-b border-border bg-card">
        <div className="container flex items-center h-16 gap-6 px-4">
          <Link href="/admin" className="font-semibold text-sm text-primary hover:text-primary/80 transition-colors">
            Admin
          </Link>
          <nav className="flex gap-6">
            <Link
              href="/admin/riders"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Riders
            </Link>
            <Link
              href="/admin/races"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Races
            </Link>
            <Link
              href="/admin/results"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Results
            </Link>
            <Link
              href="/admin/transfers"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Transfers
            </Link>
            <Link
              href="/admin/orders"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Orders
            </Link>
          </nav>
          <Link
            href="/home"
            className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to App
          </Link>
        </div>
      </div>
      <main className="container px-4 py-8 md:py-10">{children}</main>
    </div>
  )
}

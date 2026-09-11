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
        {/* Seven links plus "Back to App" need ~650px; below that the strip
            scrolls sideways rather than dragging the page with it. */}
        <div className="container flex h-14 items-center gap-4 px-4 sm:h-16 sm:gap-6">
          <Link href="/admin" className="shrink-0 font-semibold text-sm text-primary hover:text-primary/80 transition-colors">
            Admin
          </Link>
          <nav className="-mx-1 flex min-w-0 flex-1 gap-4 overflow-x-auto px-1 [scrollbar-width:none] sm:gap-6 [&::-webkit-scrollbar]:hidden">
            <Link
              href="/admin/riders"
              className="flex shrink-0 items-center whitespace-nowrap py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Riders
            </Link>
            <Link
              href="/admin/races"
              className="flex shrink-0 items-center whitespace-nowrap py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Races
            </Link>
            <Link
              href="/admin/results"
              className="flex shrink-0 items-center whitespace-nowrap py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Results
            </Link>
            <Link
              href="/admin/transfers"
              className="flex shrink-0 items-center whitespace-nowrap py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Transfers
            </Link>
            <Link
              href="/admin/orders"
              className="flex shrink-0 items-center whitespace-nowrap py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Orders
            </Link>
            <Link
              href="/admin/lineups"
              className="flex shrink-0 items-center whitespace-nowrap py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Lineups
            </Link>
            <Link
              href="/admin/ir"
              className="flex shrink-0 items-center whitespace-nowrap py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Injured Reserve
            </Link>
            <Link
              href="/admin/vuelta-slots"
              className="flex shrink-0 items-center whitespace-nowrap py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Vuelta Slots
            </Link>
          </nav>
          <Link
            href="/home"
            className="shrink-0 whitespace-nowrap text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to App
          </Link>
        </div>
      </div>
      <main className="container px-3 py-6 sm:px-4 sm:py-8 md:py-10">{children}</main>
    </div>
  )
}

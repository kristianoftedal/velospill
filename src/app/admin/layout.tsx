import { auth } from "@/lib/auth"
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

  // Check admin role from database user record
  if ((session.user as any).role !== "admin") {
    redirect("/home")
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="border-b bg-white">
        <div className="container flex items-center h-14 gap-6">
          <Link href="/admin" className="font-semibold text-sm">
            Admin
          </Link>
          <nav className="flex gap-4">
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
          </nav>
          <Link
            href="/home"
            className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to App
          </Link>
        </div>
      </div>
      <main className="container py-6">{children}</main>
    </div>
  )
}

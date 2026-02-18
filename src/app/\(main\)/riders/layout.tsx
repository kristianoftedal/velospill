import Link from "next/link"

export default function RidersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <div className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center h-16 gap-6 px-4">
          <Link href="/riders" className="font-semibold text-sm text-primary hover:text-primary/80 transition-colors">
            Riders
          </Link>
          <nav className="flex gap-6">
            <Link
              href="/calendar"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Calendar
            </Link>
            <Link
              href="/leagues"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Leagues
            </Link>
          </nav>
          <Link
            href="/admin"
            className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Admin
          </Link>
        </div>
      </div>
      <main className="container px-4 py-8 md:py-10">{children}</main>
    </div>
  )
}

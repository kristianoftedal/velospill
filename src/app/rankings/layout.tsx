import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { AppNav } from "@/components/nav/app-nav"
import Link from "next/link"

export default async function RankingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {session ? (
        <AppNav user={session.user} />
      ) : (
        <nav className="h-16 bg-gradient-green-blue shadow-lg">
          <div className="container mx-auto flex items-center justify-between px-4 h-full">
            <Link href="/" className="text-xl font-bold text-white hover:opacity-90 transition-opacity">
              Velospill
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-md text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              Log in
            </Link>
          </div>
        </nav>
      )}
      <main className="pb-20 md:pb-0">
        {children}
      </main>
    </div>
  )
}

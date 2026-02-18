import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { AppNav } from "@/components/nav/app-nav"

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <AppNav user={session.user} />
      <main className="pb-20 md:pb-0">
        {children}
      </main>
    </div>
  )
}

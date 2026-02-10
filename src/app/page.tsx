import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { Button } from "@/components/ui/button"

export default async function SplashPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (session) {
    redirect("/home")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center space-y-8 max-w-2xl px-4">
        <h1 className="text-6xl font-bold tracking-tight">Velospill</h1>
        <p className="text-xl text-muted-foreground">
          Build your dream team, make tactical decisions, and compete with friends in the ultimate fantasy cycling experience
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Button asChild size="lg">
            <Link href="/signup">Create Account</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Log In</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

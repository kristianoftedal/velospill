"use client"

import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  const handleLogout = async () => {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome to Velospill</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {session?.user && (
            <p className="text-muted-foreground">
              Logged in as: <span className="font-medium text-foreground">{session.user.email}</span>
            </p>
          )}
          <p>
            Your fantasy cycling dashboard will be available here soon.
          </p>
          <Button onClick={handleLogout} variant="outline">
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

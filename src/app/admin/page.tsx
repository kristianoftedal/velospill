import { db } from "@/lib/db"
import { riders } from "@/db/schema/riders"
import { races } from "@/db/schema/races"
import { count } from "drizzle-orm"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function AdminPage() {
  const [ridersCount, racesCount] = await Promise.all([
    db.select({ count: count() }).from(riders).then((res) => res[0]?.count ?? 0),
    db.select({ count: count() }).from(races).then((res) => res[0]?.count ?? 0),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage riders, races, and system configuration
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Riders</CardTitle>
            <CardDescription>Professional cyclists database</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ridersCount}</div>
            <p className="text-xs text-muted-foreground mt-2">Total riders</p>
            <Button asChild className="mt-4 w-full" variant="outline">
              <Link href="/admin/riders">Manage Riders</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Races</CardTitle>
            <CardDescription>Season calendar and events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{racesCount}</div>
            <p className="text-xs text-muted-foreground mt-2">Total races</p>
            <Button asChild className="mt-4 w-full" variant="outline">
              <Link href="/admin/races">Manage Races</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

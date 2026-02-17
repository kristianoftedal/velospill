import { db } from "@/lib/db"
import { riders } from "@/db/schema/riders"
import { races } from "@/db/schema/races"
import { raceResults } from "@/db/schema/results"
import { orderTypes } from "@/db/schema/config"
import { count } from "drizzle-orm"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function AdminPage() {
  const [ridersCount, racesCount, resultsCount, orderTypesCount] = await Promise.all([
    db.select({ count: count() }).from(riders).then((res) => res[0]?.count ?? 0),
    db.select({ count: count() }).from(races).then((res) => res[0]?.count ?? 0),
    db.select({ count: count() }).from(raceResults).then((res) => res[0]?.count ?? 0),
    db.select({ count: count() }).from(orderTypes).then((res) => res[0]?.count ?? 0),
  ])

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground text-lg">
          Manage riders, races, results, transfers, and orders
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-primary/10 hover:border-primary/20 transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="text-primary">Riders</CardTitle>
            <CardDescription>Professional cyclists database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">{ridersCount}</div>
            <p className="text-xs text-muted-foreground">Total riders in system</p>
            <Button asChild className="w-full bg-primary hover:bg-primary/90">
              <Link href="/admin/riders">Manage Riders</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-accent/10 hover:border-accent/20 transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="text-accent">Races</CardTitle>
            <CardDescription>Season calendar and events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">{racesCount}</div>
            <p className="text-xs text-muted-foreground">Total races scheduled</p>
            <Button asChild className="w-full bg-accent hover:bg-accent/90">
              <Link href="/admin/races">Manage Races</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-secondary/10 hover:border-secondary/20 transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="text-secondary">Results</CardTitle>
            <CardDescription>Race results and scoring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">{resultsCount}</div>
            <p className="text-xs text-muted-foreground">Results entered</p>
            <Button asChild className="w-full bg-secondary hover:bg-secondary/90">
              <Link href="/admin/results">Manage Results</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/10 hover:border-primary/20 transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="text-primary">Transfers</CardTitle>
            <CardDescription>Transfer management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Pending transfers</p>
            <Button asChild className="w-full bg-primary hover:bg-primary/90">
              <Link href="/admin/transfers">View Transfers</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-accent/10 hover:border-accent/20 transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="text-accent">Orders</CardTitle>
            <CardDescription>Strategic order validation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">{orderTypesCount}</div>
            <p className="text-xs text-muted-foreground">Order types configured</p>
            <Button asChild className="w-full bg-accent hover:bg-accent/90">
              <Link href="/admin/orders">View Orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

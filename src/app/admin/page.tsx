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
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-foreground">
          Admin Dashboard
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Manage the Velospill platform, including riders, races, results, transfers, and strategic orders
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Riders Card */}
        <Card className="border-0 shadow-lg hover:shadow-2xl transition-shadow overflow-hidden group">
          <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-600" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-primary text-lg font-bold">Riders</CardTitle>
                <CardDescription className="text-sm">Professional cyclists database</CardDescription>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-100 to-green-200 dark:from-green-950 dark:to-green-900 flex items-center justify-center">
                <span className="text-xl font-bold text-green-700 dark:text-green-300">👤</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-green-blue">
                {ridersCount}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Total riders in system</p>
            </div>
            <Button asChild className="w-full bg-gradient-green-blue hover:opacity-90 text-white font-semibold h-10">
              <Link href="/admin/riders">Manage Riders</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Races Card */}
        <Card className="border-0 shadow-lg hover:shadow-2xl transition-shadow overflow-hidden group">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-secondary text-lg font-bold">Races</CardTitle>
                <CardDescription className="text-sm">Season calendar and events</CardDescription>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-950 dark:to-blue-900 flex items-center justify-center">
                <span className="text-xl font-bold text-blue-700 dark:text-blue-300">🏁</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-blue-green">
                {racesCount}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Total races scheduled</p>
            </div>
            <Button asChild className="w-full bg-gradient-blue-green hover:opacity-90 text-white font-semibold h-10">
              <Link href="/admin/races">Manage Races</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Results Card */}
        <Card className="border-0 shadow-lg hover:shadow-2xl transition-shadow overflow-hidden group">
          <div className="h-1 bg-gradient-to-r from-purple-500 to-purple-600" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-purple-600 dark:text-purple-400 text-lg font-bold">Results</CardTitle>
                <CardDescription className="text-sm">Race results and scoring</CardDescription>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-950 dark:to-purple-900 flex items-center justify-center">
                <span className="text-xl font-bold text-purple-700 dark:text-purple-300">📊</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                {resultsCount}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Results entered</p>
            </div>
            <Button asChild className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:opacity-90 text-white font-semibold h-10">
              <Link href="/admin/results">Manage Results</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Transfers Card */}
        <Card className="border-0 shadow-lg hover:shadow-2xl transition-shadow overflow-hidden group">
          <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-cyan-600 dark:text-cyan-400 text-lg font-bold">Transfers</CardTitle>
                <CardDescription className="text-sm">Transfer management</CardDescription>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-100 to-cyan-200 dark:from-cyan-950 dark:to-cyan-900 flex items-center justify-center">
                <span className="text-xl font-bold text-cyan-700 dark:text-cyan-300">🔄</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-4xl font-bold text-cyan-600 dark:text-cyan-400">
                0
              </p>
              <p className="text-sm text-muted-foreground mt-2">Pending transfers</p>
            </div>
            <Button asChild className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-white font-semibold h-10">
              <Link href="/admin/transfers">View Transfers</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Orders Card */}
        <Card className="border-0 shadow-lg hover:shadow-2xl transition-shadow overflow-hidden group">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-amber-600 dark:text-amber-400 text-lg font-bold">Orders</CardTitle>
                <CardDescription className="text-sm">Strategic order validation</CardDescription>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-950 dark:to-amber-900 flex items-center justify-center">
                <span className="text-xl font-bold text-amber-700 dark:text-amber-300">📋</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                {orderTypesCount}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Order types configured</p>
            </div>
            <Button asChild className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white font-semibold h-10">
              <Link href="/admin/orders">View Orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

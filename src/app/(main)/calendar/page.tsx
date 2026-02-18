import { Card, CardContent } from "@/components/ui/card"
import { Calendar as CalendarIcon } from "lucide-react"

export default function CalendarPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="space-y-10">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-foreground">
            Race Calendar
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            View the complete 2026 cycling season calendar with all major races and events
          </p>
        </div>

        {/* Coming Soon */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-500 via-blue-500 to-green-500" />
          <CardContent className="py-16 px-8">
            <div className="flex flex-col items-center justify-center space-y-6 text-center">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
                <CalendarIcon className="w-12 h-12 text-muted-foreground" />
              </div>
              <div className="space-y-3 max-w-md">
                <h2 className="text-3xl font-bold text-foreground">
                  Coming Soon
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Our interactive race calendar is currently in development. Soon you'll be able to view detailed race information, mark favorites, and get notified about upcoming events.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-4">
                <div className="px-4 py-2 rounded-full bg-gradient-to-r from-green-100 to-green-50 dark:from-green-950 dark:to-green-900 text-sm font-medium text-green-700 dark:text-green-300">
                  Race Schedule
                </div>
                <div className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-950 dark:to-blue-900 text-sm font-medium text-blue-700 dark:text-blue-300">
                  Event Details
                </div>
                <div className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-950 dark:to-purple-900 text-sm font-medium text-purple-700 dark:text-purple-300">
                  Notifications
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
            <CardContent className="pt-6 space-y-3">
              <div className="text-3xl">📅</div>
              <h3 className="font-bold text-lg text-foreground">2026 Season</h3>
              <p className="text-sm text-muted-foreground">
                Complete professional cycling calendar with all major races
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
            <CardContent className="pt-6 space-y-3">
              <div className="text-3xl">🏆</div>
              <h3 className="font-bold text-lg text-foreground">Grand Tours</h3>
              <p className="text-sm text-muted-foreground">
                Tour de France, Giro d'Italia, Vuelta a España, and more
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
            <CardContent className="pt-6 space-y-3">
              <div className="text-3xl">🔔</div>
              <h3 className="font-bold text-lg text-foreground">Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Get alerts for races featuring your favorite riders
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getMyLeagues } from "./[leagueId]/actions"
import { Trophy, Plus, Users } from "lucide-react"

const statusColors: Record<string, string> = {
  setup: "bg-blue-100 text-blue-700 border-blue-200",
  drafting: "bg-amber-100 text-amber-700 border-amber-200",
  active: "bg-green-100 text-green-700 border-green-200",
  complete: "bg-slate-100 text-slate-700 border-slate-200",
}

const statusGradients: Record<string, string> = {
  setup: "from-blue-500 to-blue-600",
  drafting: "from-amber-500 to-amber-600",
  active: "from-green-500 to-emerald-600",
  complete: "from-slate-500 to-slate-600",
}

export default async function LeaguesPage() {
  const myLeagues = await getMyLeagues()

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="space-y-12">
        {/* Header */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-foreground">
              My Leagues
            </h1>
            <p className="text-xl text-muted-foreground">
              Compete with friends and manage your fantasy cycling teams
            </p>
          </div>
          <Button asChild size="lg" className="bg-gradient-green-blue hover:opacity-90 text-white gap-2">
            <Link href="/leagues/new">
              <Plus className="h-5 w-5" />
              Create New League
            </Link>
          </Button>
        </div>

        {/* Leagues Grid or Empty State */}
        {myLeagues.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-12 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-green-blue flex items-center justify-center">
                <Trophy className="h-10 w-10 text-white" />
              </div>
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <p className="text-2xl font-bold text-foreground">
                No leagues yet
              </p>
              <p className="text-muted-foreground text-lg">
                Create a new league to start competing with friends or join one using an invite link.
              </p>
            </div>
            <Button asChild size="lg" className="bg-gradient-green-blue hover:opacity-90 text-white gap-2">
              <Link href="/leagues/new">
                <Plus className="h-5 w-5" />
                Create Your First League
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myLeagues.map((league) => (
              <Link
                key={league.id}
                href={`/leagues/${league.id}`}
                className="group"
              >
                <Card className="h-full transition-all duration-300 hover:shadow-2xl hover:scale-105 border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Status Bar */}
                  <div className={`h-1 bg-gradient-to-r ${statusGradients[league.status] || statusGradients.setup}`} />
                  
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <CardTitle className="text-2xl font-bold text-foreground group-hover:text-transparent group-hover:bg-gradient-green-blue group-hover:bg-clip-text transition-all">
                          {league.name}
                        </CardTitle>
                        <Badge className={`${statusColors[league.status]} border inline-block text-xs font-semibold`}>
                          {league.status.charAt(0).toUpperCase() + league.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Team Info */}
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg p-4 space-y-2">
                      <p className="text-sm text-muted-foreground font-medium">Your Team</p>
                      <p className="text-lg font-bold text-foreground">
                        {league.userTeamName}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {league.teamCount}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium mt-1">
                          Teams
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {league.maxTeams - league.teamCount}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium mt-1">
                          Spots Left
                        </p>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-gray-200 dark:border-gray-700">
                      <Users className="h-4 w-4" />
                      <span>{league.teamCount}/{league.maxTeams} teams</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

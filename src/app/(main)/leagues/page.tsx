import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getMyLeagues } from "./[leagueId]/actions"

const statusColors: Record<string, string> = {
  setup: "bg-blue-100 text-blue-800",
  drafting: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  complete: "bg-gray-100 text-gray-800",
}

export default async function LeaguesPage() {
  const myLeagues = await getMyLeagues()

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Leagues</h1>
        <Button asChild>
          <Link href="/leagues/new">Create League</Link>
        </Button>
      </div>

      {myLeagues.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center space-y-4">
          <p className="text-gray-600 text-lg">
            You&apos;re not in any leagues yet.
          </p>
          <p className="text-gray-400 text-sm">
            Create a new league or join one using an invite link.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild>
              <Link href="/leagues/new">Create League</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myLeagues.map((league) => (
            <Link
              key={league.id}
              href={`/leagues/${league.id}`}
              className="group block"
            >
              <Card className="h-full transition-shadow group-hover:shadow-md border-gray-200 group-hover:border-gray-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                      {league.name}
                    </CardTitle>
                    <Badge className={`${statusColors[league.status]} shrink-0 text-xs`}>
                      {league.status.charAt(0).toUpperCase() + league.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm text-gray-600">
                    Your team:{" "}
                    <span className="font-medium text-gray-800">
                      {league.userTeamName}
                    </span>
                  </p>
                  <p className="text-sm text-gray-400">
                    {league.teamCount}/{league.maxTeams} teams
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

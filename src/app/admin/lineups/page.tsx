import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format-date"
import { getAdminLineupRaces } from "./actions"

const raceTypeLabels: Record<string, string> = {
  grand_tour: "Grand Tour",
  womens_grand_tour: "Women's GT",
  mini_tour: "Mini Tour",
  high_priority_one_day: "High Priority",
  low_priority_one_day: "Low Priority",
  womens_one_day: "Women's One Day",
  world_championship: "World Championship",
}

export default async function AdminLineupsPage() {
  const leagues = await getAdminLineupRaces()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lineups</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Retroactively edit a team&apos;s lineup for a multi-stage race. Deadlines are
          ignored; only the roster the team owned at race time can be selected.
        </p>
      </div>

      {leagues.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">No leagues found.</p>
          </CardContent>
        </Card>
      ) : (
        leagues.map((lg) => (
          <Card key={lg.leagueId}>
            <CardHeader>
              <CardTitle className="text-lg">{lg.leagueName}</CardTitle>
            </CardHeader>
            <CardContent>
              {lg.races.length === 0 ? (
                <p className="text-sm text-muted-foreground">No multi-stage races.</p>
              ) : (
                <div className="space-y-2">
                  {lg.races.map((r) => (
                    <Link
                      key={r.raceId}
                      href={`/admin/lineups/${lg.leagueId}/${r.raceId}`}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{r.raceName}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {raceTypeLabels[r.raceType] ?? r.raceType}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDate(new Date(r.startDate))}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

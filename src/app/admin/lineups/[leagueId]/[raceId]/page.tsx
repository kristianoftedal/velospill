import Link from "next/link"
import { notFound } from "next/navigation"
import { getAdminLineupData } from "../../actions"
import { AdminLineupEditor } from "./admin-lineup-editor"

interface PageProps {
  params: Promise<{ leagueId: string; raceId: string }>
}

export default async function AdminLineupEditPage({ params }: PageProps) {
  const { leagueId: leagueIdStr, raceId: raceIdStr } = await params
  const leagueId = Number(leagueIdStr)
  const raceId = Number(raceIdStr)
  if (!Number.isInteger(leagueId) || !Number.isInteger(raceId)) notFound()

  const data = await getAdminLineupData(leagueId, raceId)
  if (!data) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/lineups"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← All lineups
      </Link>
      <AdminLineupEditor leagueId={leagueId} data={data} />
    </div>
  )
}

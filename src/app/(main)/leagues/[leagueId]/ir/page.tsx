import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getLeagueDetails } from "../actions"
import { getTeamIrSlots } from "@/lib/ir-queries"
import { getTeamRoster } from "@/lib/transfer-queries"
import { IrForm } from "./ir-form"

interface PageProps {
  params: Promise<{ leagueId: string }>
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
}

export default async function IrPage({ params }: PageProps) {
  const { leagueId: leagueIdStr } = await params
  const leagueId = parseInt(leagueIdStr, 10)

  if (isNaN(leagueId)) {
    notFound()
  }

  let details: Awaited<ReturnType<typeof getLeagueDetails>>
  try {
    details = await getLeagueDetails(leagueId)
  } catch {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-gray-600">
          League not found or you are not a member.{" "}
          <Link href="/leagues" className="text-blue-600 hover:underline">
            Back to Leagues
          </Link>
        </p>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-gray-600">
          League not found.{" "}
          <Link href="/leagues" className="text-blue-600 hover:underline">
            Back to Leagues
          </Link>
        </p>
      </div>
    )
  }

  const { league, userTeamId } = details

  // Guard: IR only available for active leagues
  if (league.status !== "active") {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <nav className="text-sm text-gray-500">
          <Link href="/leagues" className="hover:text-gray-700 hover:underline">
            Leagues
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">
            {league.name}
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-gray-900">Injured Reserve</span>
        </nav>
        <p className="text-gray-600">
          IR is only available for active leagues.{" "}
          <Link href={`/leagues/${leagueId}`} className="text-blue-600 hover:underline">
            Back to League
          </Link>
        </p>
      </div>
    )
  }

  // Guard: user must have a team
  if (userTeamId == null) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <nav className="text-sm text-gray-500">
          <Link href="/leagues" className="hover:text-gray-700 hover:underline">
            Leagues
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">
            {league.name}
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-gray-900">Injured Reserve</span>
        </nav>
        <p className="text-gray-600">
          You need a team to use IR.{" "}
          <Link href={`/leagues/${leagueId}`} className="text-blue-600 hover:underline">
            Back to League
          </Link>
        </p>
      </div>
    )
  }

  // Parallel data fetch
  const [irSlots, roster] = await Promise.all([
    getTeamIrSlots(userTeamId, leagueId),
    getTeamRoster(userTeamId, leagueId),
  ])

  // Count occupied slots (pending or approved)
  const slotsUsed = irSlots.filter((s) => s.status === "pending" || s.status === "approved").length

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/leagues" className="hover:text-gray-700 hover:underline">
          Leagues
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">
          {league.name}
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">Injured Reserve</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Injured Reserve</h1>
        <p className="text-sm text-gray-500 mt-1">
          Place an injured rider on IR to free an active roster slot
        </p>
      </div>

      {/* IR Slots section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">IR Slots (2 max)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1].map((slotIndex) => {
              const slot = irSlots[slotIndex]
              return (
                <div
                  key={slotIndex}
                  className="rounded-lg border border-gray-200 p-4 space-y-2"
                >
                  {slot ? (
                    <>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{slot.riderName}</span>
                        <Badge className={statusColors[slot.status] ?? ""}>
                          {slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        Submitted {format(new Date(slot.submittedAt), "d MMM yyyy")}
                      </p>
                      {slot.reason && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Reason:</span> {slot.reason}
                        </p>
                      )}
                      {slot.status === "rejected" && slot.adminNote && (
                        <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">
                          <span className="font-medium">Admin note:</span> {slot.adminNote}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Empty slot</p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* IR Request Form */}
      <IrForm
        roster={roster.map((r) => ({
          riderId: r.riderId,
          riderName: r.riderName,
          gender: r.gender,
        }))}
        leagueId={leagueId}
        slotsUsed={slotsUsed}
      />
    </div>
  )
}

import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { validateInvite } from "./actions"
import { JoinForm } from "./join-form"

interface JoinLeaguePageProps {
  params: Promise<{ inviteCode: string }>
}

export default async function JoinLeaguePage({ params }: JoinLeaguePageProps) {
  const { inviteCode } = await params
  const result = await validateInvite(inviteCode)

  if (!result.valid) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <Card className="border-red-200 bg-white">
          <CardHeader>
            <CardTitle className="text-red-700">Unable to Join League</CardTitle>
            <CardDescription className="text-gray-600">
              This invite link is not valid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{result.reason}</p>
            </div>
            <Link
              href="/leagues"
              className="inline-block text-sm text-gray-600 underline hover:text-gray-900"
            >
              Back to Leagues
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { league } = result

  return (
    <div className="container mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Join League</h1>

      <Card className="border-gray-200 bg-white">
        <CardHeader>
          <CardTitle className="text-gray-900">{league.name}</CardTitle>
          <CardDescription className="text-gray-600">
            Created by {league.ownerName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6 rounded-md bg-gray-50 border border-gray-200 px-4 py-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{league.teamCount}</p>
              <p className="text-xs text-gray-500">teams joined</p>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{league.maxTeams}</p>
              <p className="text-xs text-gray-500">max teams</p>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {league.maxTeams - league.teamCount}
              </p>
              <p className="text-xs text-gray-500">spots left</p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Choose your team name
            </h2>
            <JoinForm inviteCode={inviteCode} leagueName={league.name} />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <Link
              href="/leagues"
              className="text-sm text-gray-500 underline hover:text-gray-700"
            >
              Back to Leagues
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { pusherServer } from "@/lib/pusher-server"
import { checkLeagueMembership } from "@/lib/league-auth"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await req.text()
  const params = new URLSearchParams(body)
  const socketId = params.get("socket_id") ?? ""
  const channelName = params.get("channel_name") ?? ""

  // Extract leagueId from channel name pattern: presence-draft-{leagueId}
  const match = channelName.match(/^presence-draft-(\d+)$/)
  const leagueId = match ? parseInt(match[1], 10) : null

  if (!leagueId) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 })
  }

  const { team } = await checkLeagueMembership(session.user.id, leagueId)

  const presenceData = {
    user_id: session.user.id,
    user_info: {
      name: session.user.name,
      teamId: team?.id ?? null
    }
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData)
  return NextResponse.json(authResponse)
}

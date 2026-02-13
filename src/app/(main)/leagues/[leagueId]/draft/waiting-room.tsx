"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { pusherClient } from "@/lib/pusher-client"

interface WaitingRoomProps {
  leagueId: number
  children: React.ReactNode
}

export function WaitingRoom({ leagueId, children }: WaitingRoomProps) {
  const router = useRouter()

  useEffect(() => {
    const channel = pusherClient.subscribe(`presence-draft-${leagueId}`)

    channel.bind("draft-started", () => {
      router.refresh()
    })

    return () => {
      channel.unbind_all()
      pusherClient.unsubscribe(`presence-draft-${leagueId}`)
    }
  }, [leagueId, router])

  return <>{children}</>
}

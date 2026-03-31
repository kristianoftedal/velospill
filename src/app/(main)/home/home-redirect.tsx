"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function HomeRedirect({ leagueIds }: { leagueIds: number[] }) {
  const router = useRouter()

  useEffect(() => {
    if (leagueIds.length === 0) return

    const saved = localStorage.getItem("velospill_last_league")
    if (saved) {
      const savedId = parseInt(saved, 10)
      // Only redirect if the saved league is one the user belongs to
      if (leagueIds.includes(savedId)) {
        router.replace(`/leagues/${savedId}`)
        return
      }
    }

    // No saved league — redirect to the first league
    router.replace(`/leagues/${leagueIds[0]}`)
  }, [leagueIds, router])

  return null
}

"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { pusherClient } from "@/lib/pusher-client"
import { makePick } from "./actions"
import { DraftBoard } from "./draft-board"
import { RiderPicker } from "./rider-picker"
import { DraftTimer } from "./timer"
import { toast } from "sonner"
import useSound from "use-sound"
import Link from "next/link"

// Types mirroring DB schema
type DraftSession = {
  id: number
  leagueId: number
  status: "pending" | "men" | "women" | "complete" | "paused"
  currentPickIndex: number
  currentTeamId: number | null
  currentGender: "M" | "F" | null
  timerExpiresAt: Date | string | null
  startedAt: Date | string | null
  completedAt: Date | string | null
}

type DraftPick = {
  id: number
  leagueId: number
  teamId: number
  riderId: number
  pickNumber: number
  round: number
  gender: "M" | "F"
  wasAutomatic: boolean
  pickedAt: Date | string
}

type Rider = {
  id: number
  name: string
  team: string
  nationality: string
  gender: "M" | "F"
  specialty: string
  createdAt: Date | string
  updatedAt: Date | string
}

type Team = {
  id: number
  name: string
  leagueId: number
  userId: string
  createdAt: Date | string
}

interface DraftRoomProps {
  leagueId: number
  leagueName: string
  initialSession: DraftSession
  initialPicks: DraftPick[]
  teams: Team[]
  availableMen: Rider[]
  availableWomen: Rider[]
  currentUserId: string
  currentTeamId: number | null
  isOwner: boolean
}

// Pusher event payloads
interface DraftStartedPayload {
  status: "men" | "women"
  currentTeamId: number
  currentPickIndex: number
  timerExpiresAt: string
  teams: Team[]
}

interface PickMadePayload {
  pick: DraftPick
  nextTeamId: number | null
  nextPickIndex: number
  timerExpiresAt: string | null
  status: "men" | "women" | "complete"
  wasAutomatic: boolean
}

export function DraftRoom({
  leagueId,
  leagueName,
  initialSession,
  initialPicks,
  teams,
  availableMen,
  availableWomen,
  currentUserId,
  currentTeamId,
  isOwner,
}: DraftRoomProps) {
  // State
  const [picks, setPicks] = useState<DraftPick[]>(initialPicks)
  const [draftStatus, setDraftStatus] = useState<"pending" | "men" | "women" | "complete">(
    initialSession.status === "paused" ? "pending" : initialSession.status
  )
  const [currentPickIndex, setCurrentPickIndex] = useState(initialSession.currentPickIndex)
  const [currentTurn, setCurrentTurn] = useState<number | null>(initialSession.currentTeamId)
  const [currentGender, setCurrentGender] = useState<"M" | "F">(
    initialSession.currentGender ?? "M"
  )
  const [timerExpiresAt, setTimerExpiresAt] = useState<Date | null>(
    initialSession.timerExpiresAt ? new Date(initialSession.timerExpiresAt) : null
  )
  const [availableMenState, setAvailableMenState] = useState<Rider[]>(availableMen)
  const [availableWomenState, setAvailableWomenState] = useState<Rider[]>(availableWomen)
  const [isPickPending, setIsPickPending] = useState(false)
  const [showYourTurn, setShowYourTurn] = useState(false)
  const yourTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sound (user must place /public/sounds/your-turn.mp3)
  const [playYourTurn] = useSound("/sounds/your-turn.mp3", { volume: 0.5 })

  // Build riderMap from all available riders for DraftBoard display
  const allRiders = [...availableMenState, ...availableWomenState]
  // Also include riders from already-made picks (they won't be in available lists)
  // We track them in a ref to build the full rider map
  const pickedRiderMapRef = useRef<Map<number, { id: number; name: string; team: string }>>(
    new Map()
  )

  // Seed the picked rider map from picks that already exist at load time
  useEffect(() => {
    // We don't have the full rider info for already-picked riders here,
    // so riderMap will show what we have from available lists
    // The picks already made won't be in available lists, so riderMap is built from
    // what we receive from Pusher events
  }, [])

  // Build riderMap: id -> { id, name, team }
  const riderMap = new Map<number, { id: number; name: string; team: string }>()
  for (const r of allRiders) {
    riderMap.set(r.id, { id: r.id, name: r.name, team: r.team })
  }
  // Include any cached rider info from picks we've received
  for (const [id, info] of pickedRiderMapRef.current) {
    riderMap.set(id, info)
  }

  const isMyTurn =
    currentTurn === currentTeamId &&
    currentTeamId !== null &&
    draftStatus !== "complete" &&
    draftStatus !== "pending"

  // Current drafter name
  const currentDrafterTeam = teams.find((t) => t.id === currentTurn)

  // Trigger "your turn" notification
  const triggerYourTurnNotification = useCallback(() => {
    setShowYourTurn(true)
    try {
      playYourTurn()
    } catch {
      // Audio may fail if file is missing or autoplay is blocked
    }
    if (yourTurnTimerRef.current) clearTimeout(yourTurnTimerRef.current)
    yourTurnTimerRef.current = setTimeout(() => setShowYourTurn(false), 8000)
  }, [playYourTurn])

  // Pusher subscription
  useEffect(() => {
    const channel = pusherClient.subscribe(`presence-draft-${leagueId}`)

    channel.bind("draft-started", (data: DraftStartedPayload) => {
      setDraftStatus(data.status)
      setCurrentTurn(data.currentTeamId)
      setCurrentPickIndex(data.currentPickIndex)
      setTimerExpiresAt(new Date(data.timerExpiresAt))
      setCurrentGender("M")

      if (data.currentTeamId === currentTeamId) {
        triggerYourTurnNotification()
      }
    })

    channel.bind("pick-made", (data: PickMadePayload) => {
      const { pick, nextTeamId, nextPickIndex, timerExpiresAt: nextTimer, status } = data

      // Add the pick to our list
      setPicks((prev) => {
        // Avoid duplicates
        if (prev.some((p) => p.id === pick.id)) return prev
        return [...prev, pick]
      })

      // Remove the picked rider from available lists
      if (pick.gender === "M") {
        setAvailableMenState((prev) => prev.filter((r) => r.id !== pick.riderId))
      } else {
        setAvailableWomenState((prev) => prev.filter((r) => r.id !== pick.riderId))
      }

      // Update session state
      setCurrentTurn(nextTeamId)
      setCurrentPickIndex(nextPickIndex)
      setTimerExpiresAt(nextTimer ? new Date(nextTimer) : null)

      // Update gender if transitioning from men to women
      if (status === "women") {
        setCurrentGender("F")
      }
      setDraftStatus(status)

      // Notify if it's now this user's turn
      if (nextTeamId === currentTeamId && status !== "complete") {
        triggerYourTurnNotification()
      }

      // Show who picked
      const pickerTeam = teams.find((t) => t.id === pick.teamId)
      if (pickerTeam && pick.teamId !== currentTeamId) {
        // Another team made a pick
        toast(`${pickerTeam.name} made a pick${pick.wasAutomatic ? " (auto)" : ""}`)
      }
    })

    channel.bind("draft-complete", () => {
      setDraftStatus("complete")
      setCurrentTurn(null)
      setTimerExpiresAt(null)
      toast.success("Draft complete! All picks have been made.")
    })

    return () => {
      channel.unbind_all()
      pusherClient.unsubscribe(`presence-draft-${leagueId}`)
    }
  }, [leagueId, currentTeamId, teams, triggerYourTurnNotification])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (yourTurnTimerRef.current) clearTimeout(yourTurnTimerRef.current)
    }
  }, [])

  // Handle pick
  const handlePick = useCallback(
    async (riderId: number) => {
      setIsPickPending(true)
      try {
        const result = await makePick(leagueId, riderId)
        if (!result.success) {
          toast.error(result.error ?? "Failed to make pick")
        }
      } catch {
        toast.error("An unexpected error occurred")
      } finally {
        setIsPickPending(false)
      }
    },
    [leagueId]
  )

  // Status banner text
  const statusLabel = () => {
    if (draftStatus === "pending") return "Draft Pending"
    if (draftStatus === "complete") return "Draft Complete"
    if (draftStatus === "men") {
      const round = Math.floor(currentPickIndex / teams.length) + 1
      return `Men's Draft — Round ${round} of 18`
    }
    if (draftStatus === "women") {
      const menTotal = teams.length * 18
      const womenPickIndex = currentPickIndex - menTotal
      const round = Math.floor(womenPickIndex / teams.length) + 1
      return `Women's Draft — Round ${round} of 6`
    }
    return ""
  }

  const availableRiders = currentGender === "M" ? availableMenState : availableWomenState

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Your turn notification banner */}
      {showYourTurn && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white text-center py-3 font-bold text-lg animate-pulse shadow-lg">
          It&apos;s your turn to pick!
        </div>
      )}

      <div className="container mx-auto max-w-7xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-4">
          <Link href="/leagues" className="hover:text-gray-700 hover:underline">
            Leagues
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href={`/leagues/${leagueId}`} className="hover:text-gray-700 hover:underline">
            {leagueName}
          </Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-gray-900">Draft</span>
        </nav>

        {/* Header: Status + Timer + Current Drafter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{statusLabel()}</h2>
            {draftStatus !== "complete" && draftStatus !== "pending" && currentDrafterTeam && (
              <p className="text-sm text-gray-500 mt-1">
                Now picking:{" "}
                <span className="font-medium text-gray-800">{currentDrafterTeam.name}</span>
                {currentDrafterTeam.id === currentTeamId && (
                  <span className="ml-2 text-green-600 font-semibold">(You!)</span>
                )}
              </p>
            )}
            {draftStatus === "complete" && (
              <p className="text-sm text-green-600 mt-1">All picks have been made.</p>
            )}
          </div>

          <DraftTimer expiresAt={timerExpiresAt} isMyTurn={isMyTurn} />
        </div>

        {/* Main layout: Board + Picker */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Draft Board — left/main */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-700 mb-2">Draft Board</h3>
            <DraftBoard
              teams={teams}
              picks={picks}
              riderMap={riderMap}
              currentPickIndex={currentPickIndex}
              draftStatus={draftStatus}
              menRounds={18}
              womenRounds={6}
            />
          </div>

          {/* Rider Picker — right/bottom */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
            {draftStatus !== "complete" && draftStatus !== "pending" && (
              <RiderPicker
                availableRiders={availableRiders}
                isMyTurn={isMyTurn}
                onPick={handlePick}
                isPickPending={isPickPending}
                currentGender={currentGender}
                currentDrafterName={currentDrafterTeam?.name}
              />
            )}
            {draftStatus === "complete" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <p className="text-gray-500 text-sm">Draft is complete.</p>
                <Link
                  href={`/leagues/${leagueId}`}
                  className="mt-4 inline-block text-blue-600 hover:underline text-sm"
                >
                  View League
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

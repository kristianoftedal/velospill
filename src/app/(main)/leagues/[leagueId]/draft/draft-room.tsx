"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { pusherClient } from "@/lib/pusher-client"
import { makePick, skipPick, refreshDraftState } from "./actions"
import { DraftBoard } from "./draft-board"
import { RiderPicker } from "./rider-picker"
import { DraftTimer } from "./timer"
import { DraftRecap } from "./draft-recap"
import { toast } from "sonner"
import useSound from "use-sound"
import Link from "next/link"
import { computeNextDraftState } from "@/lib/draft-snake-order"

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

type RiderInfo = {
  name: string
  team: string
  specialty: string
  nationality: string
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
  rider?: RiderInfo | null
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
  userName?: string
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

const TIMER_MS = 60_000

// Pusher event payloads
interface DraftStartedPayload {
  status: "men" | "women"
  currentTeamId: number
  currentPickIndex: number
  timerExpiresAt: string
  teams: Team[]
}

interface PickMadePayload {
  pick: DraftPick & { rider?: RiderInfo | null }
  nextTeamId: number | null
  nextPickIndex: number
  timerExpiresAt: string | null
  status: "men" | "women" | "complete"
  wasAutomatic: boolean
}

interface PickSkippedPayload {
  skippedTeamId: number
  skippedTeamName: string
  skippedPickIndex: number
  nextTeamId: number | null
  nextPickIndex: number
  timerExpiresAt: string | null
  status: "men" | "women" | "complete"
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
  const lastPickIndexRef = useRef<number>(initialSession.currentPickIndex)

  // Sound (user must place /public/sounds/your-turn.mp3)
  const [playYourTurn] = useSound("/sounds/your-turn.mp3", { volume: 0.5 })

  // Build riderMap from all available riders for DraftBoard display
  const allRiders = [...availableMenState, ...availableWomenState]
  // Also include riders from already-made picks (they won't be in available lists)
  const pickedRiderMapRef = useRef<Map<number, { id: number; name: string; team: string }>>(
    // Pre-seed from initial enriched picks
    new Map(
      initialPicks
        .filter((p) => p.rider)
        .map((p) => [p.riderId, { id: p.riderId, name: p.rider!.name, team: p.rider!.team }])
    )
  )

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

  // Reconnection handler: re-sync state from server if picks diverged
  const reconnectAndSync = useCallback(async () => {
    try {
      const result = await refreshDraftState(leagueId)
      if (!result.success) return

      // Reconcile state
      const newSession = result.session
      const newStatus =
        newSession.status === "paused" ? ("pending" as const) : newSession.status
      setPicks(result.picks)
      setDraftStatus(newStatus)
      setCurrentPickIndex(newSession.currentPickIndex)
      setCurrentTurn(newSession.currentTeamId)
      setCurrentGender(newSession.currentGender ?? "M")
      setTimerExpiresAt(newSession.timerExpiresAt ? new Date(newSession.timerExpiresAt) : null)
      setAvailableMenState(result.availableMen)
      setAvailableWomenState(result.availableWomen)
      lastPickIndexRef.current = newSession.currentPickIndex

      // Re-seed picked rider map from fresh enriched picks
      for (const pick of result.picks) {
        if (pick.rider) {
          pickedRiderMapRef.current.set(pick.riderId, {
            id: pick.riderId,
            name: pick.rider.name,
            team: pick.rider.team,
          })
        }
      }
    } catch {
      // Reconnect failed — will retry on next reconnect event
    }
  }, [leagueId])

  // Pusher subscription
  useEffect(() => {
    const channel = pusherClient.subscribe(`presence-draft-${leagueId}`)

    channel.bind("draft-started", (data: DraftStartedPayload) => {
      setDraftStatus(data.status)
      setCurrentTurn(data.currentTeamId)
      setCurrentPickIndex(data.currentPickIndex)
      setTimerExpiresAt(new Date(data.timerExpiresAt))
      setCurrentGender("M")
      lastPickIndexRef.current = data.currentPickIndex

      if (data.currentTeamId === currentTeamId) {
        triggerYourTurnNotification()
      }
    })

    channel.bind("pick-made", (data: PickMadePayload) => {
      const { pick, nextTeamId, nextPickIndex, timerExpiresAt: nextTimer, status } = data

      // Cache rider info for board display
      if (pick.rider) {
        pickedRiderMapRef.current.set(pick.riderId, {
          id: pick.riderId,
          name: pick.rider.name,
          team: pick.rider.team,
        })
      }

      // Add the pick to our list (avoid duplicates)
      setPicks((prev) => {
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
      lastPickIndexRef.current = nextPickIndex

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
        toast(`${pickerTeam.name} made a pick${pick.wasAutomatic ? " (auto)" : ""}`)
      }
    })

    channel.bind("pick-skipped", (data: PickSkippedPayload) => {
      const { skippedTeamName, nextTeamId, nextPickIndex, timerExpiresAt: nextTimer, status } = data

      setCurrentTurn(nextTeamId)
      setCurrentPickIndex(nextPickIndex)
      setTimerExpiresAt(nextTimer ? new Date(nextTimer) : null)
      lastPickIndexRef.current = nextPickIndex

      if (status === "women") {
        setCurrentGender("F")
      }
      setDraftStatus(status)

      if (nextTeamId === currentTeamId && status !== "complete") {
        triggerYourTurnNotification()
      }

      toast(`${skippedTeamName} ran out of time — turn skipped`)
    })

    channel.bind("draft-complete", () => {
      setDraftStatus("complete")
      setCurrentTurn(null)
      setTimerExpiresAt(null)
      toast.success("Draft complete! All picks have been made.")
      // Sync full state to ensure recap has all enriched picks
      void reconnectAndSync()
    })

    // Reconnect on Pusher connection restored
    const pusherConnection = pusherClient.connection
    const handleReconnected = () => {
      void reconnectAndSync()
    }
    pusherConnection.bind("connected", handleReconnected)

    return () => {
      channel.unbind_all()
      pusherClient.unsubscribe(`presence-draft-${leagueId}`)
      pusherConnection.unbind("connected", handleReconnected)
    }
  }, [leagueId, currentTeamId, teams, triggerYourTurnNotification, reconnectAndSync])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (yourTurnTimerRef.current) clearTimeout(yourTurnTimerRef.current)
    }
  }, [])

  // Handle timer expiry — skip the current pick and advance to next team
  const skipInProgressRef = useRef(false)
  const handleTimerExpired = useCallback(async () => {
    if (skipInProgressRef.current) return
    if (draftStatus === "complete" || draftStatus === "pending") return
    skipInProgressRef.current = true
    try {
      const result = await skipPick(leagueId)
      if (result.success) {
        // Optimistic update (Pusher event will also arrive)
        setCurrentTurn(result.nextTeamId ?? null)
        setCurrentPickIndex(result.nextPickIndex ?? currentPickIndex + 1)
        setTimerExpiresAt(new Date(Date.now() + TIMER_MS))
        if (result.status === "women") setCurrentGender("F")
        if (result.status === "complete") setDraftStatus("complete")
      }
    } catch {
      // Will be resolved by Pusher event or next tick
    } finally {
      skipInProgressRef.current = false
    }
  }, [leagueId, draftStatus, currentPickIndex])

  // Handle pick with optimistic updates
  const handlePick = useCallback(
    async (riderId: number) => {
      setIsPickPending(true)
      try {
        const result = await makePick(leagueId, riderId)
        if (!result.success) {
          toast.error(result.error ?? "Failed to make pick")
        } else {
          // Optimistic update: compute next state immediately
          // so timer/turn updates without waiting for Pusher event
          const teamCount = teams.length
          const next = computeNextDraftState(currentPickIndex, teamCount, 18, 6)
          const nextTeamId = next.isComplete ? null : teams[next.nextTeamIndex]?.id ?? null

          setCurrentPickIndex(next.nextPickIndex)
          setCurrentTurn(nextTeamId)
          setTimerExpiresAt(next.isComplete ? null : new Date(Date.now() + 60_000))
          if (next.isMenComplete) setCurrentGender("F")
          if (next.isComplete) setDraftStatus("complete")

          // Remove picked rider from available list
          const rider = (currentGender === "M" ? availableMenState : availableWomenState).find(r => r.id === riderId)
          if (rider) {
            if (currentGender === "M") {
              setAvailableMenState(prev => prev.filter(r => r.id !== riderId))
            } else {
              setAvailableWomenState(prev => prev.filter(r => r.id !== riderId))
            }
            pickedRiderMapRef.current.set(riderId, { id: riderId, name: rider.name, team: rider.team })
          }

          // Add to picks list optimistically
          if (result.pick) {
            setPicks(prev => {
              if (prev.some(p => p.pickNumber === currentPickIndex)) return prev
              return [...prev, {
                ...result.pick,
                rider: rider ? { name: rider.name, team: rider.team, specialty: rider.specialty, nationality: rider.nationality } : null,
              }]
            })
          }

          lastPickIndexRef.current = next.nextPickIndex
        }
      } catch {
        toast.error("An unexpected error occurred")
      } finally {
        setIsPickPending(false)
      }
    },
    [leagueId, teams, currentPickIndex, currentGender, availableMenState, availableWomenState]
  )

  // Status banner text (only called when draftStatus !== "complete")
  const statusLabel = () => {
    if (draftStatus === "pending") return "Draft Pending"
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

  // When draft is complete, show the recap
  if (draftStatus === "complete") {
    const recapTeams = teams.map((t) => ({
      id: t.id,
      name: t.name,
      userName: t.userName ?? t.userId,
    }))
    const recapPicks = picks.map((p) => ({
      id: p.id,
      teamId: p.teamId,
      riderId: p.riderId,
      pickNumber: p.pickNumber,
      round: p.round,
      gender: p.gender,
      wasAutomatic: p.wasAutomatic,
      rider: p.rider ?? null,
    }))

    return <DraftRecap teams={recapTeams} picks={recapPicks} leagueId={leagueId} />
  }

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
            {draftStatus !== "pending" && currentDrafterTeam && (
              <p className="text-sm text-gray-500 mt-1">
                Now picking:{" "}
                <span className="font-medium text-gray-800">{currentDrafterTeam.name}</span>
                {currentDrafterTeam.id === currentTeamId && (
                  <span className="ml-2 text-green-600 font-semibold">(You!)</span>
                )}
              </p>
            )}
          </div>

          <DraftTimer expiresAt={timerExpiresAt} isMyTurn={isMyTurn} onExpired={handleTimerExpired} />
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
            {draftStatus !== "pending" && (
              <RiderPicker
                availableRiders={availableRiders}
                isMyTurn={isMyTurn}
                onPick={handlePick}
                isPickPending={isPickPending}
                currentGender={currentGender}
                currentDrafterName={currentDrafterTeam?.name}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

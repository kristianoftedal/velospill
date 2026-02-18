"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { transitionLeagueStatus } from "./actions"

// -----------------------------------------------
// InviteSection
// -----------------------------------------------

interface InviteSectionProps {
  inviteCode: string
  expiresAt: string | null
}

export function InviteSection({ inviteCode, expiresAt }: InviteSectionProps) {
  const [copied, setCopied] = useState(false)

  const fullUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/leagues/join/${inviteCode}`
      : `/leagues/join/${inviteCode}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the input text
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input readOnly value={fullUrl} className="font-mono text-sm" />
        <Button variant="outline" onClick={handleCopy} className="shrink-0">
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      {expiresAt && (
        <p className="text-sm text-gray-500">
          Invite expires: {new Date(expiresAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  )
}

// -----------------------------------------------
// LeagueStatusControl
// -----------------------------------------------

const nextStatusMap: Record<string, { status: "setup" | "drafting" | "active" | "complete"; label: string } | null> = {
  setup: { status: "drafting", label: "Start Draft" },
  drafting: { status: "active", label: "Start Season" },
  active: { status: "complete", label: "End Season" },
  complete: null,
}

const statusColors: Record<string, string> = {
  setup: "bg-blue-100 text-blue-800",
  drafting: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  complete: "bg-gray-100 text-gray-800",
}

interface LeagueStatusControlProps {
  leagueId: number
  currentStatus: string
  teamCount: number
  teamMin: number
}

export function LeagueStatusControl({
  leagueId,
  currentStatus,
  teamCount,
  teamMin,
}: LeagueStatusControlProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next = nextStatusMap[currentStatus]

  async function handleTransition() {
    if (!next) return
    setLoading(true)
    setError(null)
    try {
      const result = await transitionLeagueStatus(leagueId, next.status)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error ?? "Transition failed")
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Current status:</span>
        <Badge className={statusColors[currentStatus]}>
          {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
        </Badge>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {next ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={loading}>
              {loading ? "Processing..." : next.label}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm status change</AlertDialogTitle>
              <AlertDialogDescription>
                {currentStatus === "setup" && next.status === "drafting" ? (
                  <>
                    This will move the league to <strong>Drafting</strong> mode.
                    {teamCount < teamMin ? (
                      <span className="block mt-2 text-red-600">
                        Warning: you only have {teamCount} team{teamCount !== 1 ? "s" : ""} but need
                        at least {teamMin}.
                      </span>
                    ) : (
                      <span className="block mt-2">
                        {teamCount} team{teamCount !== 1 ? "s" : ""} are ready (minimum: {teamMin}).
                      </span>
                    )}
                  </>
                ) : currentStatus === "drafting" && next.status === "active" ? (
                  <>
                    This will start the <strong>Active Season</strong>. Drafting
                    will be closed.
                  </>
                ) : currentStatus === "active" && next.status === "complete" ? (
                  <>
                    This will mark the season as <strong>Complete</strong>. This
                    action cannot be undone.
                  </>
                ) : (
                  <>
                    Are you sure you want to transition from{" "}
                    <strong>{currentStatus}</strong> to{" "}
                    <strong>{next.status}</strong>?
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleTransition} disabled={loading}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <p className="text-sm text-gray-500 italic">Season complete — no further transitions.</p>
      )}
    </div>
  )
}

// -----------------------------------------------
// RacePickerSection
// -----------------------------------------------

function formatRaceType(raceType: string): string {
  return raceType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function formatRaceDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

interface SeasonRace {
  id: number
  name: string
  raceType: string
  startDate: string
  assigned: boolean
}

interface RacePickerSectionProps {
  leagueId: number
  seasonRaces: SeasonRace[]
  assignRace: (leagueId: number, raceId: number) => Promise<{ success: boolean; error?: string }>
  removeRace: (leagueId: number, raceId: number) => Promise<{ success: boolean; error?: string; hadOrders?: boolean }>
}

export function RacePickerSection({
  leagueId,
  seasonRaces,
  assignRace,
  removeRace,
}: RacePickerSectionProps) {
  const router = useRouter()
  const [togglingRaceId, setTogglingRaceId] = useState<number | null>(null)
  const [isSelectingAll, setIsSelectingAll] = useState(false)

  const assignedCount = seasonRaces.filter((r) => r.assigned).length
  const allSelected = assignedCount === seasonRaces.length && seasonRaces.length > 0

  async function handleToggle(race: SeasonRace) {
    setTogglingRaceId(race.id)
    try {
      if (race.assigned) {
        const result = await removeRace(leagueId, race.id)
        if (!result.success) {
          toast.error(result.error ?? "Failed to remove race")
        } else {
          if (result.hadOrders) {
            toast.warning(
              "Race removed. Note: existing orders for this race are still in the system."
            )
          } else {
            toast.success(`${race.name} removed from league`)
          }
          router.refresh()
        }
      } else {
        const result = await assignRace(leagueId, race.id)
        if (!result.success) {
          toast.error(result.error ?? "Failed to assign race")
        } else {
          toast.success(`${race.name} added to league`)
          router.refresh()
        }
      }
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setTogglingRaceId(null)
    }
  }

  async function handleSelectAll() {
    setIsSelectingAll(true)
    try {
      const racesToToggle = allSelected
        ? seasonRaces.filter((r) => r.assigned)
        : seasonRaces.filter((r) => !r.assigned)

      for (const race of racesToToggle) {
        if (allSelected) {
          await removeRace(leagueId, race.id)
        } else {
          await assignRace(leagueId, race.id)
        }
      }

      toast.success(allSelected ? "All races deselected" : "All races selected")
      router.refresh()
    } catch {
      toast.error("Failed to update all races")
    } finally {
      setIsSelectingAll(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Race Calendar</CardTitle>
            <p className="text-sm text-gray-500">
              {assignedCount} of {seasonRaces.length} races assigned to this league
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={isSelectingAll || seasonRaces.length === 0}
          >
            {isSelectingAll ? "Processing..." : allSelected ? "Deselect All" : "Select All"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 pl-6"></TableHead>
              <TableHead>Race Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Start Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seasonRaces.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-6 pl-6">
                  No races found for this season.
                </TableCell>
              </TableRow>
            ) : (
              seasonRaces.map((race) => (
                <TableRow key={race.id}>
                  <TableCell className="pl-6">
                    <Checkbox
                      checked={race.assigned}
                      disabled={togglingRaceId === race.id}
                      onCheckedChange={() => handleToggle(race)}
                      aria-label={`${race.assigned ? "Remove" : "Add"} ${race.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{race.name}</TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {formatRaceType(race.raceType)}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {formatRaceDate(race.startDate)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

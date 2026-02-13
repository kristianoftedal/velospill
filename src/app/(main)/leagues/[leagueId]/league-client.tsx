"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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

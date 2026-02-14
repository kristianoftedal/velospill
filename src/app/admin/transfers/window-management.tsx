"use client"

import { useState, useTransition } from "react"
import {
  resolveWaiverWire,
  generateWindowsForLeague,
  createTransferWindow,
  closeTransferWindow,
  getActiveLeagues,
  getTransferWindows,
} from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ActiveLeague = Awaited<ReturnType<typeof getActiveLeagues>>[number]
type TransferWindow = Awaited<ReturnType<typeof getTransferWindows>>[number]

interface WindowManagementProps {
  activeLeagues: ActiveLeague[]
  initialWindows: TransferWindow[]
  initialLeagueId: number | null
}

function getWindowStatus(opensAt: Date, closesAt: Date): "open" | "upcoming" | "closed" {
  const now = new Date()
  if (now >= new Date(opensAt) && now <= new Date(closesAt)) return "open"
  if (now < new Date(opensAt)) return "upcoming"
  return "closed"
}

function WindowStatusBadge({ opensAt, closesAt }: { opensAt: Date; closesAt: Date }) {
  const status = getWindowStatus(opensAt, closesAt)
  if (status === "open") {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Open</Badge>
  }
  if (status === "upcoming") {
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Upcoming</Badge>
  }
  return <Badge variant="secondary">Closed</Badge>
}

export function WaiverWireResolution({ activeLeagues }: { activeLeagues: ActiveLeague[] }) {
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(
    activeLeagues[0]?.id ?? null
  )
  const [result, setResult] = useState<{ approved: number; rejected: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleResolve() {
    if (!selectedLeagueId) return
    setResult(null)
    setError(null)
    startTransition(async () => {
      const res = await resolveWaiverWire(selectedLeagueId)
      if (res.success) {
        setResult({ approved: res.approved ?? 0, rejected: res.rejected ?? 0 })
      } else {
        setError((res as any).error ?? "Unknown error")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waiver Wire Resolution</CardTitle>
        <CardDescription>
          Batch-resolve all pending bids for a league using standings priority (lowest points wins)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="waiver-league-select">League</Label>
            <Select
              value={selectedLeagueId?.toString() ?? ""}
              onValueChange={(val) => {
                setSelectedLeagueId(Number(val))
                setResult(null)
                setError(null)
              }}
            >
              <SelectTrigger id="waiver-league-select">
                <SelectValue placeholder="Select a league" />
              </SelectTrigger>
              <SelectContent>
                {activeLeagues.map((league) => (
                  <SelectItem key={league.id} value={league.id.toString()}>
                    {league.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleResolve}
            disabled={!selectedLeagueId || isPending}
          >
            {isPending ? "Resolving..." : "Resolve Waiver Wire"}
          </Button>
        </div>

        {result && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            Resolution complete: {result.approved} approved, {result.rejected} rejected by priority
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            Error: {error}
          </p>
        )}

        {activeLeagues.length === 0 && (
          <p className="text-sm text-muted-foreground">No active leagues found.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function TransferWindowManagement({
  activeLeagues,
  initialWindows,
  initialLeagueId,
}: WindowManagementProps) {
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(initialLeagueId)
  const [windows, setWindows] = useState<TransferWindow[]>(initialWindows)
  const [generateResult, setGenerateResult] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    raceId: "",
    maxTransfers: "",
    opensAt: "",
    closesAt: "",
    description: "",
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, startSubmitTransition] = useTransition()
  const [isClosing, startCloseTransition] = useTransition()

  async function refreshWindows(leagueId: number) {
    // We use a server action to get updated windows after mutations
    // Since we can't call getTransferWindows directly (it's server only from client context),
    // we reload the page data by triggering re-render. In Next.js App Router,
    // revalidatePath is called in the action, so after transitions the server re-renders.
    // We'll just reload the local windows state by calling a reload approach.
    // For simplicity, reload the page after state-changing operations.
    window.location.reload()
  }

  function handleLeagueChange(val: string) {
    const id = Number(val)
    setSelectedLeagueId(id)
    setGenerateResult(null)
    setGenerateError(null)
    // Find the windows for this league from the full list (if re-loaded)
    startTransition(async () => {
      // Reload page to get fresh window data for selected league
      window.location.href = `/admin/transfers?leagueId=${id}`
    })
  }

  function handleGenerate() {
    if (!selectedLeagueId) return
    setGenerateResult(null)
    setGenerateError(null)
    startTransition(async () => {
      const res = await generateWindowsForLeague(selectedLeagueId)
      if (res.success) {
        setGenerateResult(`Generated ${res.windowsCreated} transfer windows from race calendar`)
        await refreshWindows(selectedLeagueId)
      } else {
        setGenerateError((res as any).error ?? "Unknown error")
      }
    })
  }

  function handleCloseWindow(windowId: number) {
    startCloseTransition(async () => {
      await closeTransferWindow(windowId)
      await refreshWindows(selectedLeagueId!)
    })
  }

  function handleOpenDialog() {
    setFormData({ raceId: "", maxTransfers: "", opensAt: "", closesAt: "", description: "" })
    setFormError(null)
    setIsDialogOpen(true)
  }

  function handleSubmitWindow() {
    if (!selectedLeagueId) return
    if (!formData.opensAt || !formData.closesAt) {
      setFormError("Opens At and Closes At are required")
      return
    }
    setFormError(null)
    startSubmitTransition(async () => {
      const res = await createTransferWindow({
        leagueId: selectedLeagueId,
        raceId: formData.raceId ? Number(formData.raceId) : undefined,
        maxTransfers: formData.maxTransfers ? Number(formData.maxTransfers) : undefined,
        opensAt: new Date(formData.opensAt).toISOString(),
        closesAt: new Date(formData.closesAt).toISOString(),
        description: formData.description || undefined,
      })
      if (res.success) {
        setIsDialogOpen(false)
        await refreshWindows(selectedLeagueId)
      } else {
        setFormError((res as any).error ?? "Failed to create window")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transfer Windows</CardTitle>
            <CardDescription>
              Manage transfer windows for active leagues. Auto-generate from race calendar or create
              manually.
            </CardDescription>
          </div>
          {selectedLeagueId && (
            <Button variant="outline" size="sm" onClick={handleOpenDialog}>
              Create Manual Window
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="window-league-select">League</Label>
            <Select
              value={selectedLeagueId?.toString() ?? ""}
              onValueChange={handleLeagueChange}
            >
              <SelectTrigger id="window-league-select">
                <SelectValue placeholder="Select a league" />
              </SelectTrigger>
              <SelectContent>
                {activeLeagues.map((league) => (
                  <SelectItem key={league.id} value={league.id.toString()}>
                    {league.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="secondary"
            onClick={handleGenerate}
            disabled={!selectedLeagueId || isPending}
          >
            {isPending ? "Generating..." : "Auto-Generate Windows"}
          </Button>
        </div>

        {generateResult && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            {generateResult}
          </p>
        )}
        {generateError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            Error: {generateError}
          </p>
        )}

        {activeLeagues.length === 0 && (
          <p className="text-sm text-muted-foreground">No active leagues found.</p>
        )}

        {selectedLeagueId && windows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No transfer windows for this league. Use &quot;Auto-Generate Windows&quot; to create
            windows from the race calendar.
          </p>
        )}

        {windows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Race / Description</TableHead>
                <TableHead>Opens At</TableHead>
                <TableHead>Closes At</TableHead>
                <TableHead>Max Transfers</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {windows.map((w) => {
                const status = getWindowStatus(w.opensAt, w.closesAt)
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">
                      {w.raceName ?? w.description ?? "Season-wide"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(w.opensAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(w.closesAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      {w.maxTransfers != null ? w.maxTransfers : (
                        <span className="text-muted-foreground">Unlimited</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {w.isAutoGenerated ? (
                        <Badge variant="outline" className="text-xs">Auto</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <WindowStatusBadge opensAt={w.opensAt} closesAt={w.closesAt} />
                    </TableCell>
                    <TableCell className="text-right">
                      {status === "open" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCloseWindow(w.id)}
                          disabled={isClosing}
                        >
                          Close Early
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create Manual Window Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Manual Transfer Window</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="opens-at">Opens At *</Label>
              <Input
                id="opens-at"
                type="datetime-local"
                value={formData.opensAt}
                onChange={(e) => setFormData((f) => ({ ...f, opensAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="closes-at">Closes At *</Label>
              <Input
                id="closes-at"
                type="datetime-local"
                value={formData.closesAt}
                onChange={(e) => setFormData((f) => ({ ...f, closesAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="max-transfers">Max Transfers (leave empty for unlimited)</Label>
              <Input
                id="max-transfers"
                type="number"
                min={1}
                placeholder="e.g. 4"
                value={formData.maxTransfers}
                onChange={(e) => setFormData((f) => ({ ...f, maxTransfers: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                type="text"
                placeholder="e.g. Special window for Tour de France"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitWindow} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Window"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

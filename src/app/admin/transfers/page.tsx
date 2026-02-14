import { getPendingBids, getBidHistory, approveBid, rejectBid, getActiveLeagues, getTransferWindows } from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BidActions } from "./bid-actions"
import { WaiverWireResolution, TransferWindowManagement } from "./window-management"

interface PageProps {
  searchParams: Promise<{ leagueId?: string }>
}

export default async function TransfersPage({ searchParams }: PageProps) {
  const { leagueId: leagueIdParam } = await searchParams
  const selectedLeagueId = leagueIdParam ? parseInt(leagueIdParam, 10) : null

  const [pendingBids, bidHistory, activeLeagues] = await Promise.all([
    getPendingBids(),
    getBidHistory(50),
    getActiveLeagues(),
  ])

  // Load windows for the selected league (or first active league by default)
  const windowLeagueId = selectedLeagueId ?? activeLeagues[0]?.id ?? null
  const windows = windowLeagueId ? await getTransferWindows(windowLeagueId) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transfer Management</h1>
        <p className="text-muted-foreground mt-2">
          Review and manage transfer bids across all leagues
        </p>
      </div>

      {/* Waiver Wire Resolution */}
      <WaiverWireResolution activeLeagues={activeLeagues} />

      {/* Pending Transfers */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Pending Transfers</CardTitle>
            <Badge variant="secondary">{pendingBids.length}</Badge>
          </div>
          <CardDescription>Active transfer bids awaiting approval or rejection</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingBids.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No pending transfer bids
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>League</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Drops</TableHead>
                  <TableHead>Picks Up</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingBids.map((bid) => (
                  <TableRow key={bid.bidId}>
                    <TableCell className="font-medium">{bid.leagueName}</TableCell>
                    <TableCell>{bid.teamName}</TableCell>
                    <TableCell className="text-red-600">{bid.outRiderName}</TableCell>
                    <TableCell className="text-green-600">{bid.inRiderName}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {bid.reason ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {bid.submittedAt
                        ? new Date(bid.submittedAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <BidActions
                        bidId={bid.bidId}
                        outRiderName={bid.outRiderName}
                        inRiderName={bid.inRiderName}
                        approveBid={approveBid}
                        rejectBid={rejectBid}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Transfer History */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
          <CardDescription>All resolved transfer bids (last 50)</CardDescription>
        </CardHeader>
        <CardContent>
          {bidHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No transfer history yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>League</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Out Rider</TableHead>
                  <TableHead>In Rider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admin Note</TableHead>
                  <TableHead>Resolved At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bidHistory.map((bid) => (
                  <TableRow key={bid.bidId}>
                    <TableCell className="font-medium">{bid.leagueName}</TableCell>
                    <TableCell>{bid.teamName}</TableCell>
                    <TableCell>{bid.outRiderName}</TableCell>
                    <TableCell>{bid.inRiderName}</TableCell>
                    <TableCell>
                      <StatusBadge status={bid.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {bid.adminNote ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {bid.resolvedAt
                        ? new Date(bid.resolvedAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Transfer Windows */}
      <TransferWindowManagement
        activeLeagues={activeLeagues}
        initialWindows={windows}
        initialLeagueId={windowLeagueId}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "approved") {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
  }
  if (status === "rejected") {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>
  }
  if (status === "cancelled") {
    return <Badge variant="secondary">Cancelled</Badge>
  }
  return <Badge variant="outline">{status ?? "Unknown"}</Badge>
}

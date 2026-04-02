import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatDateTime } from "@/lib/format-date"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getPendingIrRequestsAction,
  approveIrRequest,
  rejectIrRequest,
  getApprovedIrRequestsAction,
  markEligibleToReturn,
} from "./actions"
import { IrActions, MarkEligibleActions } from "./ir-actions"

export default async function AdminIrPage() {
  const [pendingRequests, approvedRequests] = await Promise.all([
    getPendingIrRequestsAction(),
    getApprovedIrRequestsAction(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Injured Reserve Requests</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve IR placement requests
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Pending Requests</CardTitle>
            <Badge variant="secondary">{pendingRequests.length}</Badge>
          </div>
          <CardDescription>IR placement requests awaiting approval or rejection</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No pending IR requests
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>League</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Rider</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.leagueName}</TableCell>
                    <TableCell>{request.teamName}</TableCell>
                    <TableCell>{request.riderName}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {request.reason ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(request.submittedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <IrActions
                        requestId={request.id}
                        riderName={request.riderName}
                        teamName={request.teamName}
                        approveIrRequest={approveIrRequest}
                        rejectIrRequest={rejectIrRequest}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Approved Riders (on IR)</CardTitle>
            <Badge variant="secondary">{approvedRequests.length}</Badge>
          </div>
          <CardDescription>
            Riders currently on IR — mark eligible when they should return to their team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvedRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No riders currently on IR
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>League</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Rider</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.leagueName}</TableCell>
                    <TableCell>{request.teamName}</TableCell>
                    <TableCell>{request.riderName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.resolvedAt
                        ? formatDate(request.resolvedAt)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <MarkEligibleActions
                        requestId={request.id}
                        riderName={request.riderName}
                        teamName={request.teamName}
                        markEligibleToReturn={markEligibleToReturn}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

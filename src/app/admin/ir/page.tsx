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
import { getPendingIrRequestsAction, approveIrRequest, rejectIrRequest } from "./actions"
import { IrActions } from "./ir-actions"

export default async function AdminIrPage() {
  const pendingRequests = await getPendingIrRequestsAction()

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
                      {new Date(request.submittedAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
    </div>
  )
}

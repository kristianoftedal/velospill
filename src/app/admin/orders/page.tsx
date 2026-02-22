import { db } from "@/lib/db"
import { orderTypes } from "@/db/schema/config"
import { getPendingOrders, getOrderHistory, approveOrder, rejectOrder, setBonusPoints, getActivatedUnoXOrders, getBonusRiderDraftState } from "./actions"
import { OrderActions } from "./order-actions"
import { BonusRiderDraft } from "./bonus-rider-draft"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"

function renderTarget(order: {
  targetRiderName: string | null
  targetTeamName: string | null
  targetProTeam: string | null
  targetCountry: string | null
}) {
  if (order.targetRiderName) return order.targetRiderName
  if (order.targetTeamName) return `Team: ${order.targetTeamName}`
  if (order.targetProTeam) return `Pro team: ${order.targetProTeam}`
  if (order.targetCountry) return `Country: ${order.targetCountry}`
  return "All own riders"
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>
  if (status === "countered") return <Badge variant="secondary">Countered</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

export default async function OrdersPage() {
  const [pendingOrders, orderHistory, allOrderTypes, activatedUnoXOrders] = await Promise.all([
    getPendingOrders(),
    getOrderHistory(),
    db.select().from(orderTypes).orderBy(orderTypes.name),
    getActivatedUnoXOrders(),
  ])

  // Group activated Uno-X orders by league+race for display
  const uniqueUnoXDrafts = Array.from(
    new Map(
      activatedUnoXOrders.map((o) => [
        `${o.leagueId}-${o.raceId}`,
        {
          leagueId: o.leagueId,
          leagueName: o.leagueName,
          raceId: o.raceId,
          raceName: o.raceName,
          season: o.season,
        },
      ])
    ).values()
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Order Validation</h1>
        <p className="text-muted-foreground mt-2">
          Review strategic orders submitted by team managers
        </p>
      </div>

      <div className="grid gap-6">
        {/* Pending Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Orders</CardTitle>
            <CardDescription>
              {pendingOrders.length === 0
                ? "No pending orders"
                : `${pendingOrders.length} order${pendingOrders.length === 1 ? "" : "s"} awaiting review`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending orders to review.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>League</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Race</TableHead>
                    <TableHead>Order Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingOrders.map((order) => (
                    <TableRow key={order.orderId}>
                      <TableCell className="font-medium">{order.leagueName}</TableCell>
                      <TableCell>{order.teamName}</TableCell>
                      <TableCell>
                        <div>
                          <div>{order.raceName}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(order.raceStartDate), "d MMM yyyy")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.orderTypeDisplayName}</div>
                          <div className="text-xs text-muted-foreground">{order.orderTypeName}</div>
                        </div>
                      </TableCell>
                      <TableCell>{renderTarget(order)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(order.submittedAt), "d MMM yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <OrderActions
                          orderId={order.orderId}
                          orderTypeEffect={order.orderTypeEffect as object}
                          currentBonusPoints={order.bonusPoints}
                          approveOrder={approveOrder}
                          rejectOrder={rejectOrder}
                          setBonusPoints={setBonusPoints}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Bonus Rider Draft Section */}
        {uniqueUnoXDrafts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Bonus Rider Draft</CardTitle>
              <CardDescription>
                {uniqueUnoXDrafts.length === 1
                  ? "1 active bonus rider draft"
                  : `${uniqueUnoXDrafts.length} active bonus rider drafts`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BonusRiderDraft
                activatedDrafts={uniqueUnoXDrafts}
                getDraftState={getBonusRiderDraftState}
              />
            </CardContent>
          </Card>
        )}

        {/* Order History */}
        <Card>
          <CardHeader>
            <CardTitle>Order History</CardTitle>
            <CardDescription>
              {orderHistory.length === 0
                ? "No order history yet"
                : `Last ${orderHistory.length} resolved orders`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orderHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No order history yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>League</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Race</TableHead>
                    <TableHead>Order Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Admin Note</TableHead>
                    <TableHead>Bonus Pts</TableHead>
                    <TableHead>Resolved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderHistory.map((order) => (
                    <TableRow key={order.orderId}>
                      <TableCell className="font-medium">{order.leagueName}</TableCell>
                      <TableCell>{order.teamName}</TableCell>
                      <TableCell>{order.raceName}</TableCell>
                      <TableCell>{order.orderTypeDisplayName}</TableCell>
                      <TableCell>{renderTarget(order)}</TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {order.adminNote ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.bonusPoints != null ? order.bonusPoints : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.resolvedAt
                          ? format(new Date(order.resolvedAt), "d MMM yyyy")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Order Types Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Order Types Reference</CardTitle>
            <CardDescription>{allOrderTypes.length} order types configured</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allOrderTypes.map((orderType) => {
                const raceTypes = (orderType.applicableRaceTypes as string[]) || []
                return (
                  <div key={orderType.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{orderType.displayName}</h3>
                        <p className="text-sm text-muted-foreground">{orderType.name}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {raceTypes.map((raceType) => (
                          <Badge key={raceType} variant="secondary">
                            {raceType}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {orderType.description && (
                      <p className="text-sm text-muted-foreground">{orderType.description}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

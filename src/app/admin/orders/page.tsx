import { db } from "@/lib/db"
import { orderTypes } from "@/db/schema/config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default async function OrdersPage() {
  const allOrderTypes = await db.select().from(orderTypes).orderBy(orderTypes.name)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Order Validation</h1>
        <p className="text-muted-foreground mt-2">
          Review strategic orders and validate their effects
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Orders</CardTitle>
            <CardDescription>Submitted orders awaiting review</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Coming in Phase 7</AlertTitle>
              <AlertDescription>
                Submitted orders will appear here for review. You will be able to verify order legality and see their scoring effects.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle>Order History</CardTitle>
            <CardDescription>Applied orders and their effects</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Coming in Phase 7</AlertTitle>
              <AlertDescription>
                Applied orders and their effects will be logged here.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

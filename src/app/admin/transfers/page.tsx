import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

export default async function TransfersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transfer Management</h1>
        <p className="text-muted-foreground mt-2">
          Review and manage transfer bids across all leagues
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending Transfers</CardTitle>
            <CardDescription>Active transfer bids awaiting approval</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Coming in Phase 5</AlertTitle>
              <AlertDescription>
                Transfer bids will appear here when the transfer system is active. You will be able to approve, reject, and monitor bids.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transfer Windows</CardTitle>
            <CardDescription>Window status and deadlines</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Coming in Phase 5</AlertTitle>
              <AlertDescription>
                Transfer window status and deadlines will be displayed here. Windows are determined by race calendar dates.
              </AlertDescription>
            </Alert>
            <div className="mt-4 p-4 bg-muted rounded-lg text-sm space-y-2">
              <p className="font-semibold">Transfer Window Rules:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Grand Tours:</strong> Unlimited transfers before race start</li>
                <li>• <strong>High Priority Races:</strong> Up to 4 transfers allowed</li>
                <li>• <strong>Low Priority/Mini Tours:</strong> Up to 2 transfers allowed</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Transfer History</CardTitle>
            <CardDescription>Completed transfers log</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Coming in Phase 5</AlertTitle>
              <AlertDescription>
                Completed transfers will be logged here with timestamps and details.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

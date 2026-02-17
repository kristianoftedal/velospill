import { getRiders } from "./actions"
import { RidersClient } from "./riders-client"

export default async function RidersPage() {
  const riders = await getRiders()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Riders Database</h1>
          <p className="text-muted-foreground mt-1">
            {riders.length} rider{riders.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <RidersClient riders={riders} />
    </div>
  )
}

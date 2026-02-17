import { getRiders } from "./actions"
import { RidersClient } from "./riders-client"

export default async function RidersPage() {
  const riders = await getRiders()

  return (
    <div className="space-y-6">
      <RidersClient riders={riders} />
    </div>
  )
}

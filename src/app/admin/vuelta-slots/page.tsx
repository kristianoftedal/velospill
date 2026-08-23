import { getVueltaSlotsEnabled } from "@/lib/roster-limits"
import { getAllVueltaSlots } from "@/lib/vuelta-slots"
import { VueltaSlotsClient } from "./vuelta-slots-client"

export default async function VueltaSlotsPage() {
  const [enabled, slots] = await Promise.all([
    getVueltaSlotsEnabled(),
    getAllVueltaSlots(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vuelta Slots</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage temporary Vuelta roster slots across all leagues.
        </p>
      </div>
      <VueltaSlotsClient enabled={enabled} slots={slots} />
    </div>
  )
}

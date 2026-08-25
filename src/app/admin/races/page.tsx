import { getRaces } from "./actions"
import { RacesClient } from "./races-client"

export default async function RacesPage() {
  const races = await getRaces()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Race Calendar</h1>
          <p className="text-muted-foreground mt-1">
            {races.length} race{races.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <RacesClient races={races} />
    </div>
  )
}

import { getRacesForResults, getRiders } from "./actions"
import { ResultsClient } from "./results-client"

export default async function ResultsPage() {
  const [races, riders] = await Promise.all([getRacesForResults(), getRiders()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Race Results</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter race results and manage finishing positions
        </p>
      </div>
      <ResultsClient races={races} riders={riders} />
    </div>
  )
}

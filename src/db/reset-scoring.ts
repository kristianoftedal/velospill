import { db } from "@/lib/db"
import { scoringConfig, rosterLimits, orderTypes } from "./schema/config"

async function resetScoring() {
  console.log("🗑️  Clearing scoring tables...")
  await db.delete(scoringConfig)
  await db.delete(rosterLimits)
  await db.delete(orderTypes)
  console.log("✅ Tables cleared")
  process.exit(0)
}

resetScoring().catch((error) => {
  console.error("❌ Error:", error)
  process.exit(1)
})

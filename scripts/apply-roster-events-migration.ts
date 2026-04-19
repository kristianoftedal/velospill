/**
 * Apply roster_events migration directly via SQL.
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/apply-roster-events-migration.ts
 */
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

async function main() {
  console.log("Checking if roster_events table already exists...")

  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'roster_events'
    ) as "exists"
  `)

  const rows = result as unknown as { exists: boolean }[]
  if (rows[0]?.exists) {
    console.log("roster_events table already exists — skipping migration.")
    process.exit(0)
  }

  console.log("Creating roster_event_type enum...")
  await db.execute(sql`
    CREATE TYPE "public"."roster_event_type" AS ENUM(
      'drafted', 'transferred_in', 'transferred_out', 'dropped', 'ir_placed', 'ir_returned'
    )
  `)

  console.log("Creating roster_events table...")
  await db.execute(sql`
    CREATE TABLE "roster_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "leagueId" integer NOT NULL,
      "teamId" integer NOT NULL,
      "riderId" integer NOT NULL,
      "eventType" "roster_event_type" NOT NULL,
      "occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
      "relatedEventId" integer,
      "metadata" jsonb
    )
  `)

  console.log("Adding foreign keys...")
  await db.execute(sql`
    ALTER TABLE "roster_events"
      ADD CONSTRAINT "roster_events_leagueId_leagues_id_fk"
      FOREIGN KEY ("leagueId") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action
  `)
  await db.execute(sql`
    ALTER TABLE "roster_events"
      ADD CONSTRAINT "roster_events_teamId_teams_id_fk"
      FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action
  `)
  await db.execute(sql`
    ALTER TABLE "roster_events"
      ADD CONSTRAINT "roster_events_riderId_riders_id_fk"
      FOREIGN KEY ("riderId") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action
  `)

  console.log("Creating indexes...")
  await db.execute(sql`CREATE INDEX "roster_events_league_rider_idx" ON "roster_events" USING btree ("leagueId","riderId")`)
  await db.execute(sql`CREATE INDEX "roster_events_league_team_idx" ON "roster_events" USING btree ("leagueId","teamId")`)
  await db.execute(sql`CREATE INDEX "roster_events_event_type_idx" ON "roster_events" USING btree ("eventType")`)

  console.log("✅ Migration complete — roster_events table created.")
  process.exit(0)
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})

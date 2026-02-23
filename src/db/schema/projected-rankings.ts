import { pgTable, serial, integer, text, real, jsonb, timestamp, index } from "drizzle-orm/pg-core"
import { riders } from "./riders"

export interface ProjectedBreakdown {
  highPriorityOneDay: number
  lowPriorityOneDay: number
  grandTour: number
  grandTourTdf: number
  miniTour: number
}

export const projectedRankings = pgTable("projected_rankings", {
  id: serial("id").primaryKey(),
  rank: integer("rank").notNull(),
  riderName: text("riderName").notNull(),
  riderId: integer("riderId").references(() => riders.id),
  team: text("team").notNull(),
  nationality: text("nationality").notNull(),
  projectedPoints: real("projectedPoints").notNull(),
  breakdown: jsonb("breakdown").notNull().$type<ProjectedBreakdown>(),
  confirmedRaces: integer("confirmedRaces").notNull().default(0),
  injuryStatus: text("injuryStatus").notNull().default("healthy"),
  injuryNote: text("injuryNote"),
  season: integer("season").notNull().default(2026),
  lastUpdated: timestamp("lastUpdated", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  rankIdx: index("projected_rankings_rank_idx").on(table.rank),
  seasonIdx: index("projected_rankings_season_idx").on(table.season),
  riderIdIdx: index("projected_rankings_rider_id_idx").on(table.riderId),
}))

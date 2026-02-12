import { pgTable, serial, text, timestamp, integer, jsonb, index, unique } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { races } from "./races"
import { riders } from "./riders"
import { user } from "./users"

export const raceResults = pgTable("race_results", {
  id: serial("id").primaryKey(),
  raceId: integer("raceId").notNull().references(() => races.id),
  riderId: integer("riderId").notNull().references(() => riders.id),
  position: integer("position").notNull(),
  time: text("time"),
  points: integer("points").notNull().default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  raceIdIdx: index("race_results_race_id_idx").on(table.raceId),
  riderIdIdx: index("race_results_rider_id_idx").on(table.riderId),
  uniqueRaceRider: unique("race_results_race_rider_unique").on(table.raceId, table.riderId),
  uniqueRacePosition: unique("race_results_race_position_unique").on(table.raceId, table.position),
}))

export const resultAudit = pgTable("result_audit", {
  id: serial("id").primaryKey(),
  raceId: integer("raceId").notNull().references(() => races.id),
  resultId: integer("resultId").references(() => raceResults.id),
  changeType: text("changeType").notNull(), // "INSERT" | "UPDATE" | "DELETE" | "BATCH_INSERT"
  changedBy: text("changedBy").notNull().references(() => user.id),
  changedAt: timestamp("changedAt", { withTimezone: true }).notNull().defaultNow(),
  oldData: jsonb("oldData"),
  newData: jsonb("newData"),
  reason: text("reason"),
})

export const raceResultsRelations = relations(raceResults, ({ one }) => ({
  race: one(races, {
    fields: [raceResults.raceId],
    references: [races.id],
  }),
  rider: one(riders, {
    fields: [raceResults.riderId],
    references: [riders.id],
  }),
}))

export const resultAuditRelations = relations(resultAudit, ({ one }) => ({
  race: one(races, {
    fields: [resultAudit.raceId],
    references: [races.id],
  }),
}))

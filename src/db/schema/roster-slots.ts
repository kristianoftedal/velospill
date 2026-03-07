import { pgTable, serial, integer, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { leagues, teams } from "./leagues"
import { riders } from "./riders"

export const rosterSlotStatusEnum = pgEnum("roster_slot_status", [
  "active",
  "on_ir",
  "return_eligible"
])

export const rosterSlots = pgTable("roster_slots", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  riderId: integer("riderId").notNull().references(() => riders.id),
  status: rosterSlotStatusEnum("status").notNull().default("active"),
  addedAt: timestamp("addedAt", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  riderLeagueUnique: uniqueIndex("roster_slots_rider_league_unique").on(table.leagueId, table.riderId),
  leagueIdx: index("roster_slots_league_idx").on(table.leagueId),
  teamIdx: index("roster_slots_team_idx").on(table.teamId)
}))

export const rosterSlotsRelations = relations(rosterSlots, ({ one }) => ({
  league: one(leagues, {
    fields: [rosterSlots.leagueId],
    references: [leagues.id]
  }),
  team: one(teams, {
    fields: [rosterSlots.teamId],
    references: [teams.id]
  }),
  rider: one(riders, {
    fields: [rosterSlots.riderId],
    references: [riders.id]
  })
}))

export type RosterSlot = typeof rosterSlots.$inferSelect

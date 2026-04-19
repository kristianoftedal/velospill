import { pgTable, serial, integer, timestamp, pgEnum, index, jsonb } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { leagues, teams } from "./leagues"
import { riders } from "./riders"

export const rosterEventTypeEnum = pgEnum("roster_event_type", [
  "drafted",
  "transferred_in",
  "transferred_out",
  "dropped",
  "ir_placed",
  "ir_returned"
])

export const rosterEvents = pgTable("roster_events", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  riderId: integer("riderId").notNull().references(() => riders.id),
  eventType: rosterEventTypeEnum("eventType").notNull(),
  occurredAt: timestamp("occurredAt", { withTimezone: true }).notNull().defaultNow(),
  relatedEventId: integer("relatedEventId"),
  metadata: jsonb("metadata"),
}, (table) => ({
  leagueRiderIdx: index("roster_events_league_rider_idx").on(table.leagueId, table.riderId),
  leagueTeamIdx: index("roster_events_league_team_idx").on(table.leagueId, table.teamId),
  eventTypeIdx: index("roster_events_event_type_idx").on(table.eventType),
}))

export const rosterEventsRelations = relations(rosterEvents, ({ one }) => ({
  league: one(leagues, {
    fields: [rosterEvents.leagueId],
    references: [leagues.id]
  }),
  team: one(teams, {
    fields: [rosterEvents.teamId],
    references: [teams.id]
  }),
  rider: one(riders, {
    fields: [rosterEvents.riderId],
    references: [riders.id]
  }),
}))

export type RosterEvent = typeof rosterEvents.$inferSelect

import { pgTable, serial, text, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { leagues, teams } from "./leagues"
import { riders } from "./riders"
import { user } from "./users"

export const irStatusEnum = pgEnum("ir_status", ["pending", "approved", "rejected"])

export const irRequests = pgTable("ir_requests", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  riderId: integer("riderId").notNull().references(() => riders.id),
  status: irStatusEnum("status").notNull().default("pending"),
  reason: text("reason"),
  adminNote: text("adminNote"),
  submittedAt: timestamp("submittedAt", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  resolvedBy: text("resolvedBy").references(() => user.id),
}, (table) => ({
  leagueIdx: index("ir_requests_league_idx").on(table.leagueId),
  teamIdx: index("ir_requests_team_idx").on(table.teamId),
  statusIdx: index("ir_requests_status_idx").on(table.status),
}))

export const irRequestsRelations = relations(irRequests, ({ one }) => ({
  league: one(leagues, {
    fields: [irRequests.leagueId],
    references: [leagues.id]
  }),
  team: one(teams, {
    fields: [irRequests.teamId],
    references: [teams.id]
  }),
  rider: one(riders, {
    fields: [irRequests.riderId],
    references: [riders.id]
  }),
  resolvedByUser: one(user, {
    fields: [irRequests.resolvedBy],
    references: [user.id]
  }),
}))

export type IrRequest = typeof irRequests.$inferSelect

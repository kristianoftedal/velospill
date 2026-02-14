import { pgTable, serial, text, timestamp, integer, jsonb, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { leagues, teams } from "./leagues"
import { riders } from "./riders"
import { races } from "./races"
import { orderTypes } from "./config"
import { user } from "./users"

export type OrderConfig = {
  kapteinChoice?: "single_rider" | "country_all"
}

export const orderStatusEnum = pgEnum("order_status", ["pending", "active", "rejected", "countered"])

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  raceId: integer("raceId").notNull().references(() => races.id),
  orderTypeId: integer("orderTypeId").notNull().references(() => orderTypes.id),
  status: orderStatusEnum("status").notNull().default("pending"),
  targetRiderId: integer("targetRiderId").references(() => riders.id),
  targetTeamId: integer("targetTeamId").references(() => teams.id),
  targetProTeam: text("targetProTeam"),
  targetCountry: text("targetCountry"),
  orderConfig: jsonb("orderConfig").$type<OrderConfig>(),
  bonusPoints: integer("bonusPoints"),
  adminNote: text("adminNote"),
  submittedAt: timestamp("submittedAt", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  resolvedBy: text("resolvedBy").references(() => user.id),
}, (table) => ({
  leagueIdx: index("orders_league_idx").on(table.leagueId),
  teamIdx: index("orders_team_idx").on(table.teamId),
  raceIdx: index("orders_race_idx").on(table.raceId),
  teamRaceUnique: uniqueIndex("orders_team_race_unique").on(table.teamId, table.raceId),
}))

export const ordersRelations = relations(orders, ({ one }) => ({
  league: one(leagues, {
    fields: [orders.leagueId],
    references: [leagues.id]
  }),
  team: one(teams, {
    fields: [orders.teamId],
    references: [teams.id]
  }),
  race: one(races, {
    fields: [orders.raceId],
    references: [races.id]
  }),
  orderType: one(orderTypes, {
    fields: [orders.orderTypeId],
    references: [orderTypes.id]
  }),
  targetRider: one(riders, {
    fields: [orders.targetRiderId],
    references: [riders.id],
    relationName: "targetRider"
  }),
  targetTeam: one(teams, {
    fields: [orders.targetTeamId],
    references: [teams.id],
    relationName: "targetTeam"
  }),
  resolvedByUser: one(user, {
    fields: [orders.resolvedBy],
    references: [user.id]
  }),
}))

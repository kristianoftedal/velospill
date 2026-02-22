import { pgTable, serial, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { leagues, teams } from "./leagues"
import { riders } from "./riders"
import { races } from "./races"
import { orders } from "./orders"

export const bonusRiders = pgTable("bonus_riders", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  riderId: integer("riderId").notNull().references(() => riders.id),
  raceId: integer("raceId").notNull().references(() => races.id),
  orderId: integer("orderId").references(() => orders.id),
  pickOrder: integer("pickOrder").notNull(),
  pickedAt: timestamp("pickedAt", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  leagueIdx: index("bonus_riders_league_idx").on(table.leagueId),
  teamIdx: index("bonus_riders_team_idx").on(table.teamId),
  raceIdx: index("bonus_riders_race_idx").on(table.raceId),
  leagueRaceTeamUnique: uniqueIndex("bonus_riders_league_race_team_unique").on(table.leagueId, table.raceId, table.teamId)
}))

export const bonusRidersRelations = relations(bonusRiders, ({ one }) => ({
  league: one(leagues, {
    fields: [bonusRiders.leagueId],
    references: [leagues.id]
  }),
  team: one(teams, {
    fields: [bonusRiders.teamId],
    references: [teams.id]
  }),
  rider: one(riders, {
    fields: [bonusRiders.riderId],
    references: [riders.id]
  }),
  race: one(races, {
    fields: [bonusRiders.raceId],
    references: [races.id]
  }),
  order: one(orders, {
    fields: [bonusRiders.orderId],
    references: [orders.id]
  })
}))

import { pgTable, serial, timestamp, integer, uniqueIndex, index } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { leagues, teams } from "./leagues"
import { races } from "./races"
import { riders } from "./riders"

export const raceLineups = pgTable("race_lineups", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  raceId: integer("raceId").notNull().references(() => races.id),
  riderId: integer("riderId").notNull().references(() => riders.id),
  lineupPeriod: integer("lineupPeriod"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  lineupUnique: uniqueIndex("race_lineups_unique").on(table.leagueId, table.teamId, table.raceId, table.riderId, table.lineupPeriod),
  leagueIdx: index("race_lineups_league_idx").on(table.leagueId),
  teamRaceIdx: index("race_lineups_team_race_idx").on(table.teamId, table.raceId),
}))

export const raceLineupsRelations = relations(raceLineups, ({ one }) => ({
  league: one(leagues, {
    fields: [raceLineups.leagueId],
    references: [leagues.id]
  }),
  team: one(teams, {
    fields: [raceLineups.teamId],
    references: [teams.id]
  }),
  race: one(races, {
    fields: [raceLineups.raceId],
    references: [races.id]
  }),
  rider: one(riders, {
    fields: [raceLineups.riderId],
    references: [riders.id]
  }),
}))

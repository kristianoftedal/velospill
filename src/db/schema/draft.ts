import { pgTable, serial, text, timestamp, integer, pgEnum, index, boolean, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { leagues, teams } from "./leagues"
import { riders } from "./riders"

export const draftStatusEnum = pgEnum("draft_status", [
  "pending",
  "men",
  "women",
  "complete",
  "paused"
])

export const draftSessions = pgTable("draft_sessions", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().unique().references(() => leagues.id, { onDelete: "cascade" }),
  status: draftStatusEnum("status").notNull().default("pending"),
  currentPickIndex: integer("currentPickIndex").notNull().default(0),
  currentTeamId: integer("currentTeamId").references(() => teams.id),
  currentGender: text("currentGender").$type<'M' | 'F'>(),
  timerExpiresAt: timestamp("timerExpiresAt", { withTimezone: true }),
  startedAt: timestamp("startedAt", { withTimezone: true }),
  completedAt: timestamp("completedAt", { withTimezone: true })
}, (table) => ({
  leagueIdx: index("draft_sessions_league_idx").on(table.leagueId)
}))

export const draftPicks = pgTable("draft_picks", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  riderId: integer("riderId").notNull().references(() => riders.id),
  pickNumber: integer("pickNumber").notNull(),
  round: integer("round").notNull(),
  gender: text("gender").notNull().$type<'M' | 'F'>(),
  wasAutomatic: boolean("wasAutomatic").notNull().default(false),
  pickedAt: timestamp("pickedAt", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  riderLeagueUnique: uniqueIndex("draft_picks_rider_league_unique").on(table.leagueId, table.riderId),
  pickNumberUnique: uniqueIndex("draft_picks_pick_number_unique").on(table.leagueId, table.pickNumber),
  leagueIdx: index("draft_picks_league_idx").on(table.leagueId),
  teamIdx: index("draft_picks_team_idx").on(table.teamId)
}))

export const draftSessionsRelations = relations(draftSessions, ({ one }) => ({
  league: one(leagues, {
    fields: [draftSessions.leagueId],
    references: [leagues.id]
  }),
  currentTeam: one(teams, {
    fields: [draftSessions.currentTeamId],
    references: [teams.id]
  })
}))

export const draftPicksRelations = relations(draftPicks, ({ one }) => ({
  league: one(leagues, {
    fields: [draftPicks.leagueId],
    references: [leagues.id]
  }),
  team: one(teams, {
    fields: [draftPicks.teamId],
    references: [teams.id]
  }),
  rider: one(riders, {
    fields: [draftPicks.riderId],
    references: [riders.id]
  })
}))

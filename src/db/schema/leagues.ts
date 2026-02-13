import { pgTable, serial, text, timestamp, integer, pgEnum, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from "./users"

export const leagueStatusEnum = pgEnum("league_status", [
  "setup",
  "drafting",
  "active",
  "complete"
])

export interface LeagueConfig {
  draftDate?: string
  seasonYear: number
  teamMin: number
  teamMax: number
  scoringConfigId?: number
}

export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("inviteCode").notNull().unique(),
  inviteExpiresAt: timestamp("inviteExpiresAt", { withTimezone: true }),
  status: leagueStatusEnum("status").notNull().default("setup"),
  ownerId: text("ownerId").notNull().references(() => user.id),
  config: jsonb("config").notNull().$type<LeagueConfig>(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  ownerIdx: index("leagues_owner_idx").on(table.ownerId)
}))

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  userId: text("userId").notNull().references(() => user.id),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  leagueUserUnique: uniqueIndex("teams_league_user_unique").on(table.leagueId, table.userId),
  leagueNameUnique: uniqueIndex("teams_league_name_unique").on(table.leagueId, table.name),
  leagueIdx: index("teams_league_idx").on(table.leagueId),
  userIdx: index("teams_user_idx").on(table.userId)
}))

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  owner: one(user, {
    fields: [leagues.ownerId],
    references: [user.id]
  }),
  teams: many(teams)
}))

export const teamsRelations = relations(teams, ({ one }) => ({
  league: one(leagues, {
    fields: [teams.leagueId],
    references: [leagues.id]
  }),
  user: one(user, {
    fields: [teams.userId],
    references: [user.id]
  })
}))

import { pgTable, serial, text, timestamp, integer, pgEnum, index, AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

export const raceTypeEnum = pgEnum("race_type", [
  "grand_tour",
  "high_priority_one_day",
  "low_priority_one_day",
  "mini_tour",
  "womens_grand_tour",
  "womens_one_day",
  "world_championship"
])

export const races = pgTable("races", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  raceType: raceTypeEnum("raceType").notNull(),
  startDate: timestamp("startDate", { withTimezone: true }).notNull(),
  endDate: timestamp("endDate", { withTimezone: true }),
  parentRaceId: integer("parentRaceId").references((): AnyPgColumn => races.id),
  stageNumber: integer("stageNumber"),
  season: integer("season").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  parentRaceIdx: index("races_parent_race_idx").on(table.parentRaceId),
  raceTypeIdx: index("races_race_type_idx").on(table.raceType),
  seasonIdx: index("races_season_idx").on(table.season),
  startDateIdx: index("races_start_date_idx").on(table.startDate)
}))

export const racesRelations = relations(races, ({ one, many }) => ({
  parentRace: one(races, {
    fields: [races.parentRaceId],
    references: [races.id],
    relationName: "stages"
  }),
  stages: many(races, {
    relationName: "stages"
  })
}))

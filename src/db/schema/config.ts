import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core"

export const scoringConfig = pgTable("scoringConfig", {
  id: serial("id").primaryKey(),
  raceType: text("raceType").notNull(),
  category: text("category").notNull(),
  rules: jsonb("rules").notNull(),
  description: text("description"),
  validFrom: timestamp("validFrom").notNull(),
  validUntil: timestamp("validUntil")
})

export const rosterLimits = pgTable("rosterLimits", {
  id: serial("id").primaryKey(),
  raceType: text("raceType").notNull().unique(),
  rosterSize: integer("rosterSize").notNull(),
  description: text("description")
})

export const orderTypes = pgTable("orderTypes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("displayName").notNull(),
  applicableRaceTypes: jsonb("applicableRaceTypes").notNull(),
  effect: jsonb("effect").notNull(),
  description: text("description")
})

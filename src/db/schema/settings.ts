import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core"

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
})

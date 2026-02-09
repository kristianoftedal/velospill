import { pgTable, serial, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core"

export const genderEnum = pgEnum("gender", ["M", "F"])
export const specialtyEnum = pgEnum("specialty", [
  "sprinter",
  "climber",
  "gc",
  "classics",
  "allrounder",
  "time_trialist"
])

export const riders = pgTable("riders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  team: text("team").notNull(),
  nationality: text("nationality").notNull(),
  gender: genderEnum("gender").notNull(),
  specialty: specialtyEnum("specialty").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  nameIdx: index("riders_name_idx").on(table.name),
  teamIdx: index("riders_team_idx").on(table.team),
  nationalityIdx: index("riders_nationality_idx").on(table.nationality)
}))

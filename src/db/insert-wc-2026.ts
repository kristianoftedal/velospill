import { db } from "@/lib/db";
import { races } from "@/db/schema/races";

async function main() {
  const wcRaces = [
    {
      name: "World Championship - Men Elite ITT",
      raceType: "world_championship" as const,
      startDate: new Date("2026-09-20T12:30:00-04:00"),
      season: 2026,
    },
    {
      name: "World Championship - Women Elite Road Race",
      raceType: "world_championship" as const,
      startDate: new Date("2026-09-26T09:00:00-04:00"),
      season: 2026,
    },
    {
      name: "World Championship - Men Elite Road Race",
      raceType: "world_championship" as const,
      startDate: new Date("2026-09-27T09:00:00-04:00"),
      season: 2026,
    },
  ];

  for (const race of wcRaces) {
    const [inserted] = await db.insert(races).values(race).returning({ id: races.id, name: races.name });
    console.log("Inserted:", inserted.id, inserted.name);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

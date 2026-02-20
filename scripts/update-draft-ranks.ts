import { Pool } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

// Pre-draft ranking list with rider names and points
const preDraftRanking = [
  { name: "Tadej Pogacar", points: 613 },
  { name: "Mads Pedersen", points: 366 },
  { name: "Jonas Vingegaard", points: 356 },
  { name: "Mathieu Van Der Poel", points: 227 },
  { name: "Joao Almeida", points: 208 },
  { name: "Tom Pidcock", points: 203 },
  { name: "Isaac del Toro", points: 190 },
  { name: "Wout Van Aert", points: 181 },
  { name: "Remco Evenepoel", points: 170 },
  { name: "Jonathan Milan", points: 166 },
  { name: "Jay Vine", points: 163 },
  { name: "Ben Healy", points: 157 },
  { name: "Giulio Ciccone", points: 138 },
  { name: "Juan Ayuso", points: 119 },
  { name: "Lorenzo Fortunato", points: 114 },
  { name: "Matteo Jorgenson", points: 111 },
  { name: "Olav Kooij", points: 111 },
  { name: "Oscar Onley", points: 111 },
  { name: "Jasper Philipsen", points: 101 },
  { name: "Filippo Ganna", points: 98 },
  { name: "Lenny Martinez", points: 96 },
  { name: "Felix Gall", points: 94 },
  { name: "Florian Lipowitz", points: 94 },
  { name: "Arnaud de Lie", points: 93 },
  { name: "Kaden Groves", points: 93 },
  { name: "Simon Yates", points: 91 },
  { name: "Michael Matthews", points: 90 },
  { name: "Kevin Vauquelin", points: 86 },
  { name: "Tim Merlier", points: 86 },
  { name: "Tiesj Benoot", points: 79 },
  { name: "Michael Storer", points: 77 },
  { name: "Thymen Arensman", points: 77 },
  { name: "Egan Bernal", points: 76 },
  { name: "Richard Carapaz", points: 76 },
  { name: "Biniyam Ghirmay", points: 74 },
  { name: "Primoz Roglic", points: 74 },
  { name: "Neilson Powless", points: 73 },
  { name: "Jai Hindley", points: 72 },
  { name: "Tim Wellens", points: 72 },
  { name: "Giulio Pellizzari", points: 71 },
  { name: "Marianne Vos", points: 71 },
  { name: "Orlius Aular", points: 71 },
  { name: "Quinn Simmons", points: 71 },
  { name: "Demi Vollering", points: 67 },
  { name: "Lorena Wiebes", points: 67 },
  { name: "Mattias Skjelmose", points: 65 },
  { name: "Pauline Ferrand-Prevot", points: 65 },
  { name: "Christian Scaroni", points: 63 },
  { name: "Romain Gregoire", points: 62 },
  { name: "Marlen Reusser", points: 60 },
  { name: "Brandon Mcnulty", points: 55 },
  { name: "Magnus Cort", points: 52 },
  { name: "Sepp Kuss", points: 52 },
  { name: "Julian Alaphilippe", points: 50 },
  { name: "Elise Chabbey", points: 49 },
  { name: "Paul Magnier", points: 49 },
  { name: "Stefan Küng", points: 49 },
  { name: "Bruno Armirail", points: 45 },
  { name: "Davide Ballerini", points: 45 },
  { name: "Luke Plapp", points: 45 },
  { name: "Søren Wærenskjold", points: 45 },
  { name: "Adam Yates", points: 44 },
  { name: "Marc Soler", points: 43 },
  { name: "Nicolas Prodhomme", points: 43 },
  { name: "Antonio Tiberi", points: 42 },
  { name: "Ben O'Connor", points: 41 },
  { name: "Dries de Bondt", points: 41 },
  { name: "Jasper Stuyven", points: 41 },
  { name: "Manuele Tarozzi", points: 40 },
  { name: "Santiago Buitrago", points: 40 },
  { name: "Fred Wright", points: 39 },
  { name: "Kimberly Pienaar", points: 39 },
  { name: "Lotte Kopecky", points: 38 },
  { name: "Derek Gee", points: 37 },
  { name: "Corbin Strong", points: 36 },
  { name: "Matthew Ricciletto", points: 36 },
  { name: "Nico Denz", points: 36 },
  { name: "Anna van der Breggen", points: 35 },
  { name: "Damiano Caruso", points: 35 },
  { name: "Liane Lippert", points: 35 },
  { name: "Sarah Gigante", points: 35 },
  { name: "Jonas Abrahamsen", points: 34 },
  { name: "Madis Mihkels", points: 34 },
  { name: "Mauro Schmid", points: 34 },
  { name: "Simone Velasco", points: 34 },
  { name: "Victor Campenaerts", points: 34 },
  { name: "Edoardo Affini", points: 33 },
  { name: "Ethan Vernon", points: 33 },
  { name: "Letizia Borghesi", points: 33 },
  { name: "Mikel Landa", points: 33 },
  { name: "Ben Turner", points: 32 },
  { name: "Mike Teunissen", points: 32 },
  { name: "Niamh Fisher-Black", points: 32 },
  { name: "Pavel Bittner", points: 32 },
  { name: "Tobias Halland Johannessen", points: 32 },
  { name: "Toms Skujins", points: 32 },
  { name: "Matteo Trentin", points: 31 },
  { name: "Pavel Sivakov", points: 31 },
  { name: "Thibau Nys", points: 31 },
  { name: "Axel Laurance", points: 30 },
  { name: "Juan Sebastian Molano", points: 30 },
  { name: "Torstein Træen", points: 30 },
  { name: "Jordi Meeus", points: 29 },
  { name: "Joshua Tarling", points: 29 },
  { name: "Louise Barre", points: 29 },
  { name: "Marco Frigo", points: 29 },
  { name: "Daan Hoole", points: 28 },
  { name: "Elisa Longo Borghini", points: 28 },
  { name: "Laurenz Rex", points: 28 },
  { name: "Alberto Bettiol", points: 27 },
  { name: "Carlos Verona", points: 27 },
  { name: "Edoardo Zambanini", points: 27 },
  { name: "Pello Bilbao", points: 27 },
  { name: "Javier Romo", points: 26 },
  { name: "Katarzyna Niewiadoma", points: 26 },
  { name: "Max Kanter", points: 26 },
  { name: "David Gaudu", points: 25 },
  { name: "Emilien Jeanniere", points: 25 },
  { name: "Harold Tejada", points: 25 },
  { name: "Magdeleine Vallieres", points: 25 },
  { name: "Phil Bauhaus", points: 25 },
  { name: "Sam Watson", points: 25 },
  { name: "Andrea Bagioli", points: 24 },
  { name: "Anna Henderson", points: 24 },
  { name: "Anthony Turgis", points: 24 },
  { name: "Ben Tulett", points: 24 },
  { name: "Ilan van Wilder", points: 24 },
  { name: "Ivo Oliveira", points: 24 },
  { name: "Quinten Hermans", points: 24 },
  { name: "Romain Bardet", points: 24 },
  { name: "Gianni Vermeersch", points: 23 },
  { name: "Jan Christen", points: 23 },
  { name: "Louis Vervaeke", points: 23 },
  { name: "Pablo Castrillo", points: 23 },
  { name: "Aleksandr Vlasov", points: 22 },
  { name: "Alessandro Tonelli", points: 22 },
  { name: "Brieuc Rolland", points: 22 },
  { name: "Casper van Uden", points: 22 },
  { name: "Einer Rubio", points: 22 },
  { name: "Ivan Romeo", points: 22 },
  { name: "Kasper Asgreen", points: 22 },
  { name: "Maeva Squiban", points: 22 },
  { name: "Matej Mohoric", points: 22 },
  { name: "Mavi Garcia", points: 22 },
  { name: "Micro Maestri", points: 22 },
  { name: "Paul Penhoet", points: 22 },
  { name: "Paul Seixas", points: 22 },
  { name: "Valentin Paret-Peitrin", points: 22 },
  { name: "Alessandro Verre", points: 21 },
  { name: "Alex Aranburu", points: 21 },
  { name: "Andrea Vendrame", points: 21 },
  { name: "Florian Vermeersch", points: 21 },
  { name: "Tobias Lund Andresen", points: 21 },
  { name: "Wilco Kelderman", points: 21 },
  { name: "Andreas Leknessund", points: 20 },
  { name: "Diego Ulissi", points: 20 },
  { name: "Dorian Godon", points: 20 },
  { name: "Ivan Garcia Cortina", points: 20 },
  { name: "Markus Hoelgaard", points: 20 },
  { name: "Stefano Oldani", points: 20 },
  { name: "Fabio Christen", points: 19 },
  { name: "Gianmarco Garofoli", points: 19 },
  { name: "Lennert van Eetvelt", points: 19 },
  { name: "Ben Zwiehoff", points: 18 },
  { name: "Chris Harper", points: 18 },
  { name: "Cian Uijdtebroeks", points: 18 },
  { name: "Joel Nicolau", points: 18 },
  { name: "Jonas Rutsch", points: 18 },
  { name: "Magnus Sheffield", points: 18 },
  { name: "Maikel Zijlaard", points: 18 },
  { name: "Max Poole", points: 18 },
  { name: "Maxim Van Gils", points: 18 },
  { name: "Rick Pluimers", points: 18 },
  { name: "Sean Quinn", points: 18 },
  { name: "Stefan Bissegger", points: 18 },
  { name: "Vincenzo Albanese", points: 18 },
  { name: "Antonia Niedermaier", points: 17 },
  { name: "Jake Stewart", points: 17 },
  { name: "Jhonatan Narvaez", points: 17 },
  { name: "Jon Barrenetxea", points: 17 },
  { name: "Rafal Majka", points: 17 },
  { name: "Afonso Eulalio", points: 16 },
  { name: "Aurelien Paret-Peintre", points: 16 },
  { name: "Edward Planchaert", points: 16 },
  { name: "Felix Grossschartner", points: 16 },
  { name: "Jordan Jegat", points: 16 },
  { name: "Junior Lecerf", points: 16 },
  { name: "Milan Fretin", points: 16 },
  { name: "Roger Adria", points: 16 },
  { name: "Tibor del Grosso", points: 16 },
  { name: "Martin Marcellusi", points: 15 },
  { name: "Michael Valgren", points: 15 },
  { name: "Raul Garcia Pierna", points: 15 },
  { name: "Alexander Kristoff", points: 14 },
  { name: "Daniel Felipe Martínez", points: 14 },
  { name: "Edward Dunbar", points: 14 },
  { name: "Laurence Pithie", points: 14 },
  { name: "Lewis Askey", points: 14 },
  { name: "Mathias Vacek", points: 14 },
  { name: "Mikkel Frølich Honoré", points: 14 },
  { name: "Riejanne Markus", points: 14 },
  { name: "Alison Jackson", points: 13 },
  { name: "Brent Van Moer", points: 13 },
  { name: "Igor Arrieta", points: 13 },
  { name: "Jenthe Biermans", points: 13 },
  { name: "Juliette Labous", points: 13 },
  { name: "Mikkel Bjerg", points: 13 },
  { name: "Remy Rochas", points: 13 },
  { name: "Alberto Dainese", points: 12 },
  { name: "Alex Baudin", points: 12 },
  { name: "Archie Ryan", points: 12 },
  { name: "Bob Jungels", points: 12 },
  { name: "Casper Pedersen", points: 12 },
  { name: "Domen Novak", points: 12 },
  { name: "Ellen van Dijk", points: 12 },
  { name: "Femke Gerritse", points: 12 },
  { name: "Filippo Fiorelli", points: 12 },
  { name: "Frank van den Broek", points: 12 },
  { name: "Jordan Labrosse", points: 12 },
  { name: "Pascal Eenkhoorn", points: 12 },
  { name: "Alexis Renard", points: 11 },
  { name: "Brandon Smith Rivera", points: 11 },
  { name: "Cedrine Kerbaol", points: 11 },
  { name: "Erlend Blikra", points: 11 },
  { name: "Filippo Magli", points: 11 },
  { name: "Frederik Wandahl", points: 11 },
  { name: "Georg Steinhauser", points: 11 },
  { name: "Hugo Hofstetter", points: 11 },
  { name: "Ion Izagurre Insausti", points: 11 },
  { name: "Joseph Blackmore", points: 11 },
  { name: "Julien Bernard", points: 11 },
  { name: "Kevin Vermearke", points: 11 },
  { name: "Marc Hirschi", points: 11 },
  { name: "Marco Haller", points: 11 },
  { name: "Matteo Moschetti", points: 11 },
];

// Fuzzy matching helper functions
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ñ]/g, "n")
    .replace(/[ç]/g, "c")
    .replace(/[ø]/g, "o")
    .replace(/[æ]/g, "ae")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);

  // Exact match
  if (s1 === s2) return 1.0;

  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9;
  }

  // Check for similar first name / last name combinations
  const parts1 = s1.split(" ");
  const parts2 = s2.split(" ");

  if (parts1.length > 0 && parts2.length > 0) {
    // Check if last names match
    const lastName1 = parts1[parts1.length - 1];
    const lastName2 = parts2[parts2.length - 1];
    if (lastName1 === lastName2) return 0.85;

    // Check if first names match
    const firstName1 = parts1[0];
    const firstName2 = parts2[0];
    if (firstName1 === firstName2) return 0.8;
  }

  // Levenshtein distance-based similarity
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

interface RiderRow {
  id: number;
  name: string;
}

async function findRiderByName(
  client: any,
  name: string,
): Promise<RiderRow | null> {
  // First try exact match (case-sensitive)
  const exactMatch = await client.query(
    "SELECT id, name FROM riders WHERE name = $1 LIMIT 1",
    [name],
  );

  if (exactMatch.rows.length > 0) {
    return exactMatch.rows[0];
  }

  // Try case-insensitive exact match
  const caseInsensitiveMatch = await client.query(
    "SELECT id, name FROM riders WHERE LOWER(name) = LOWER($1) LIMIT 1",
    [name],
  );

  if (caseInsensitiveMatch.rows.length > 0) {
    return caseInsensitiveMatch.rows[0];
  }

  // Get all riders for fuzzy matching
  const allRiders = await client.query("SELECT id, name FROM riders");

  // Find best match using fuzzy matching
  let bestMatch: RiderRow | null = null;
  let bestSimilarity = 0;

  for (const rider of allRiders.rows) {
    const similarity = calculateSimilarity(name, rider.name);
    if (similarity > bestSimilarity && similarity >= 0.6) {
      bestSimilarity = similarity;
      bestMatch = rider;
    }
  }

  if (bestMatch) {
    console.log(
      `  Fuzzy match: "${name}" -> "${bestMatch.name}" (similarity: ${bestSimilarity.toFixed(2)})`,
    );
  } else {
    console.log(`  No match found for: "${name}"`);
  }

  return bestMatch;
}

async function updateDraftRanks() {
  const client = await pool.connect();

  try {
    // First ensure the draft_ranking column exists
    console.log("Ensuring draft_ranking column exists...");
    try {
      await client.query(
        `ALTER TABLE riders ADD COLUMN IF NOT EXISTS draft_ranking INTEGER DEFAULT 9999`,
      );
    } catch {
      // Column might already exist, that's fine
    }

    // Create index if not exists
    try {
      await client.query(
        `CREATE INDEX IF NOT EXISTS riders_draft_ranking_idx ON riders (draft_ranking)`,
      );
    } catch {
      // Index might already exist, that's fine
    }

    console.log("\nStarting draft rank update...\n");

    const updates: { id: number; rank: number; name: string }[] = [];
    const notFound: string[] = [];

    for (let i = 0; i < preDraftRanking.length; i++) {
      const { name, points } = preDraftRanking[i];
      const rank = i + 1;

      console.log(
        `Processing [${rank}/${preDraftRanking.length}]: ${name} (${points} pts)`,
      );

      const rider = await findRiderByName(client, name);

      if (rider) {
        updates.push({ id: rider.id, rank, name: rider.name });
      } else {
        notFound.push(name);
      }
    }

    console.log("\n--- Summary ---");
    console.log(`Matched: ${updates.length}`);
    console.log(`Not found: ${notFound.length}`);

    if (notFound.length > 0) {
      console.log("\nRiders not found in database:");
      notFound.forEach((n) => console.log(`  - ${n}`));
    }

    // Perform batch update
    console.log("\nUpdating database...");

    for (const update of updates) {
      await client.query("UPDATE riders SET draft_ranking = $1 WHERE id = $2", [
        update.rank,
        update.id,
      ]);
    }

    console.log(`Successfully updated ${updates.length} rider ranks!`);

    // Show the updated top 10
    console.log("\n--- Top 10 by Draft Rank ---");
    const top10 = await client.query(
      "SELECT name, draft_ranking FROM riders WHERE draft_ranking <= 10 ORDER BY draft_ranking",
    );
    top10.rows.forEach((row: any) => {
      console.log(`  #${row.draft_ranking}: ${row.name}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

updateDraftRanks()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

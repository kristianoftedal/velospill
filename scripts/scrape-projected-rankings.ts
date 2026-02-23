import * as cheerio from "cheerio"
import * as fs from "fs"
import * as path from "path"

// ============================================================================
// TYPES
// ============================================================================

interface RaceResult {
  riderName: string
  team: string
  nationality: string
  position: number
  raceSlug: string
  raceType: GameRaceType
  category: string
  date: string // YYYY-MM-DD
}

interface RiderProjection {
  rank: number
  riderName: string
  team: string
  nationality: string
  projectedPoints: number
  breakdown: {
    highPriorityOneDay: number
    lowPriorityOneDay: number
    grandTour: number
    grandTourTdf: number
    miniTour: number
  }
  confirmedRaces: number
  injuryStatus: "healthy" | "injured" | "doubtful"
  injuryNote: string | null
  season: number
  lastUpdated: string
}

type GameRaceType =
  | "high_priority_one_day"
  | "low_priority_one_day"
  | "grand_tour"
  | "grand_tour_tdf"
  | "mini_tour"

interface GameRace {
  name: string
  pcsSlug: string
  type: GameRaceType
  isStageRace: boolean
  stages?: number
}

interface InjuredRider {
  name: string
  status: "injured" | "doubtful"
  note: string
}

// ============================================================================
// CONFIGURATION: Game races mapped to PCS slugs
// ============================================================================

const GAME_RACES: GameRace[] = [
  // HIGH PRIORITY ONE-DAY
  { name: "Strade Bianche", pcsSlug: "strade-bianche", type: "high_priority_one_day", isStageRace: false },
  { name: "Milano-Sanremo", pcsSlug: "milano-sanremo", type: "high_priority_one_day", isStageRace: false },
  { name: "Ronde van Vlaanderen", pcsSlug: "ronde-van-vlaanderen", type: "high_priority_one_day", isStageRace: false },
  { name: "Paris-Roubaix", pcsSlug: "paris-roubaix", type: "high_priority_one_day", isStageRace: false },
  { name: "Liege-Bastogne-Liege", pcsSlug: "liege-bastogne-liege", type: "high_priority_one_day", isStageRace: false },
  { name: "Il Lombardia", pcsSlug: "il-lombardia", type: "high_priority_one_day", isStageRace: false },

  // LOW PRIORITY ONE-DAY
  { name: "Omloop Het Nieuwsblad", pcsSlug: "omloop-het-nieuwsblad", type: "low_priority_one_day", isStageRace: false },
  { name: "Kuurne-Brussel-Kuurne", pcsSlug: "kuurne-brussel-kuurne", type: "low_priority_one_day", isStageRace: false },
  { name: "GP Industria & Artigianato", pcsSlug: "gp-industria-artigianato-larciano", type: "low_priority_one_day", isStageRace: false },
  { name: "Clasica de Almeria", pcsSlug: "clasica-de-almeria", type: "low_priority_one_day", isStageRace: false },
  { name: "Dwars door Vlaanderen", pcsSlug: "dwars-door-vlaanderen", type: "low_priority_one_day", isStageRace: false },
  { name: "E3 Saxo Classic", pcsSlug: "e3-harelbeke", type: "low_priority_one_day", isStageRace: false },
  { name: "Gent-Wevelgem", pcsSlug: "gent-wevelgem", type: "low_priority_one_day", isStageRace: false },
  { name: "Amstel Gold Race", pcsSlug: "amstel-gold-race", type: "low_priority_one_day", isStageRace: false },
  { name: "La Fleche Wallonne", pcsSlug: "la-fleche-wallonne", type: "low_priority_one_day", isStageRace: false },
  { name: "Eschborn-Frankfurt", pcsSlug: "eschborn-frankfurt", type: "low_priority_one_day", isStageRace: false },
  { name: "Bretagne Classic", pcsSlug: "gp-ouest-france-plouay", type: "low_priority_one_day", isStageRace: false },
  { name: "San Sebastian", pcsSlug: "san-sebastian", type: "low_priority_one_day", isStageRace: false },
  { name: "GP Quebec", pcsSlug: "gp-quebec", type: "low_priority_one_day", isStageRace: false },
  { name: "GP Montreal", pcsSlug: "gp-montreal", type: "low_priority_one_day", isStageRace: false },

  // GRAND TOURS
  { name: "Giro d'Italia", pcsSlug: "giro-d-italia", type: "grand_tour", isStageRace: true, stages: 21 },
  { name: "Tour de France", pcsSlug: "tour-de-france", type: "grand_tour_tdf", isStageRace: true, stages: 21 },
  { name: "Vuelta a Espana", pcsSlug: "vuelta-a-espana", type: "grand_tour", isStageRace: true, stages: 21 },

  // MINI TOURS
  { name: "UAE Tour", pcsSlug: "uae-tour", type: "mini_tour", isStageRace: true, stages: 7 },
  { name: "Paris-Nice", pcsSlug: "paris-nice", type: "mini_tour", isStageRace: true, stages: 8 },
  { name: "Tirreno-Adriatico", pcsSlug: "tirreno-adriatico", type: "mini_tour", isStageRace: true, stages: 7 },
  { name: "Volta a Catalunya", pcsSlug: "volta-a-catalunya", type: "mini_tour", isStageRace: true, stages: 7 },
  { name: "Tour de Romandie", pcsSlug: "tour-de-romandie", type: "mini_tour", isStageRace: true, stages: 6 },
  { name: "Criterium du Dauphine", pcsSlug: "criterium-du-dauphine", type: "mini_tour", isStageRace: true, stages: 8 },
]

// ============================================================================
// SCORING RULES (from seed-scoring.ts)
// ============================================================================

const SCORING: Record<string, Record<string, Record<string, number>>> = {
  high_priority_one_day: {
    finish: {
      "1": 50, "2": 40, "3": 35, "4": 30, "5": 25,
      "6": 20, "7": 18, "8": 16, "9": 14, "10": 12,
      "11": 10, "12": 9, "13": 8, "14": 7, "15": 6,
      "16": 5, "17": 4, "18": 3, "19": 2, "20": 1,
    },
  },
  low_priority_one_day: {
    finish: {
      "1": 30, "2": 25, "3": 20, "4": 16, "5": 14,
      "6": 12, "7": 10, "8": 8, "9": 7, "10": 6,
      "11": 5, "12": 4, "13": 3, "14": 2, "15": 1,
    },
  },
  grand_tour: {
    stage_finish: {
      "1": 12, "2": 10, "3": 8, "4": 7, "5": 6,
      "6": 5, "7": 4, "8": 3, "9": 2, "10": 1,
    },
    end_gc: {
      "1": 25, "2": 20, "3": 16, "4": 14, "5": 12,
      "6": 10, "7": 8, "8": 6, "9": 4, "10": 3,
      "11": 2, "12": 1,
    },
    end_points: { "1": 12, "2": 8, "3": 6, "4": 4, "5": 2 },
    end_kom: { "1": 12, "2": 8, "3": 6, "4": 4, "5": 2 },
    end_youth: { "1": 5, "2": 3, "3": 1 },
    end_combative: { "1": 5 },
    end_team: { "1": 5, "2": 3, "3": 1 },
  },
  grand_tour_tdf: {
    stage_finish: {
      "1": 15, "2": 12, "3": 10, "4": 9, "5": 8,
      "6": 7, "7": 6, "8": 5, "9": 4, "10": 3,
      "11": 2, "12": 1,
    },
    end_gc: {
      "1": 30, "2": 25, "3": 20, "4": 16, "5": 14,
      "6": 12, "7": 10, "8": 8, "9": 7, "10": 6,
      "11": 5, "12": 4, "13": 3, "14": 2, "15": 1,
    },
    end_points: { "1": 15, "2": 10, "3": 8, "4": 6, "5": 4, "6": 2 },
    end_kom: { "1": 15, "2": 10, "3": 8, "4": 6, "5": 4, "6": 2 },
    end_youth: { "1": 6, "2": 4, "3": 2 },
    end_combative: { "1": 5 },
    end_team: { "1": 6, "2": 4, "3": 2 },
  },
  mini_tour: {
    stage_finish: { "1": 6, "2": 5, "3": 3, "4": 2, "5": 1 },
    end_gc: { "1": 8, "2": 6, "3": 4, "4": 3, "5": 2, "6": 2, "7": 1, "8": 1 },
    end_points: { "1": 4, "2": 2, "3": 1 },
    end_kom: { "1": 4, "2": 2, "3": 1 },
    end_youth: { "1": 2 },
    end_combative: { "1": 2 },
    end_team: { "1": 2 },
  },
}

// ============================================================================
// CACHE & HTTP HELPERS
// ============================================================================

const CACHE_DIR = path.join(process.cwd(), "data", "pcs-cache")
const OUTPUT_FILE = path.join(process.cwd(), "data", "projected-rankings.json")

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function cacheKey(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, "_") + ".html"
}

async function fetchWithCache(url: string): Promise<string> {
  ensureDir(CACHE_DIR)
  const key = cacheKey(url)
  const cachePath = path.join(CACHE_DIR, key)

  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, "utf-8")
  }

  // Rate limiting: wait 1-2 seconds
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))

  console.log(`  Fetching: ${url}`)
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  })

  if (!response.ok) {
    console.warn(`  Warning: ${response.status} for ${url}`)
    return ""
  }

  const html = await response.text()
  fs.writeFileSync(cachePath, html, "utf-8")
  return html
}

// ============================================================================
// SCRAPING FUNCTIONS
// ============================================================================

function parseOneDayResults(html: string, raceSlug: string, raceType: GameRaceType, date: string): RaceResult[] {
  if (!html) return []
  const $ = cheerio.load(html)
  const results: RaceResult[] = []

  $("table.results tbody tr").each((_, row) => {
    const cols = $(row).find("td")
    const posText = cols.eq(0).text().trim()
    const position = parseInt(posText, 10)
    if (isNaN(position) || position < 1) return

    const riderLink = cols.eq(3).find("a").first()
    const riderName = riderLink.text().trim() || cols.eq(3).text().trim()
    if (!riderName) return

    const team = cols.eq(4).find("a").first().text().trim() || cols.eq(4).text().trim()
    // Nationality from flag image
    const flagImg = cols.eq(2).find("img, span.flag").first()
    const nationality = flagImg.attr("alt") || flagImg.attr("title") || ""

    results.push({
      riderName,
      team,
      nationality: nationality.toUpperCase(),
      position,
      raceSlug,
      raceType,
      category: "finish",
      date,
    })
  })

  return results
}

function parseStageResults(html: string, raceSlug: string, raceType: GameRaceType, stageNum: number, date: string): RaceResult[] {
  if (!html) return []
  const $ = cheerio.load(html)
  const results: RaceResult[] = []

  $("table.results tbody tr").each((_, row) => {
    const cols = $(row).find("td")
    const posText = cols.eq(0).text().trim()
    const position = parseInt(posText, 10)
    if (isNaN(position) || position < 1) return

    const riderLink = cols.eq(3).find("a").first()
    const riderName = riderLink.text().trim() || cols.eq(3).text().trim()
    if (!riderName) return

    const team = cols.eq(4).find("a").first().text().trim() || cols.eq(4).text().trim()
    const flagImg = cols.eq(2).find("img, span.flag").first()
    const nationality = flagImg.attr("alt") || flagImg.attr("title") || ""

    results.push({
      riderName,
      team,
      nationality: nationality.toUpperCase(),
      position,
      raceSlug: `${raceSlug}/stage-${stageNum}`,
      raceType,
      category: "stage_finish",
      date,
    })
  })

  return results
}

function parseGCResults(html: string, raceSlug: string, raceType: GameRaceType, classification: string, date: string): RaceResult[] {
  if (!html) return []
  const $ = cheerio.load(html)
  const results: RaceResult[] = []

  $("table.results tbody tr").each((_, row) => {
    const cols = $(row).find("td")
    const posText = cols.eq(0).text().trim()
    const position = parseInt(posText, 10)
    if (isNaN(position) || position < 1) return

    const riderLink = cols.eq(3).find("a").first()
    const riderName = riderLink.text().trim() || cols.eq(3).text().trim()
    if (!riderName) return

    const team = cols.eq(4).find("a").first().text().trim() || cols.eq(4).text().trim()
    const flagImg = cols.eq(2).find("img, span.flag").first()
    const nationality = flagImg.attr("alt") || flagImg.attr("title") || ""

    results.push({
      riderName,
      team,
      nationality: nationality.toUpperCase(),
      position,
      raceSlug: `${raceSlug}/${classification}`,
      raceType,
      category: `end_${classification}`,
      date,
    })
  })

  return results
}

function parseStartlist(html: string): Set<string> {
  if (!html) return new Set()
  const $ = cheerio.load(html)
  const riders = new Set<string>()

  // PCS startlists have rider names in links
  $("a[href*='/rider/']").each((_, el) => {
    const name = $(el).text().trim()
    if (name) riders.add(normalizeName(name))
  })

  // Also try the startlist table format
  $("ul.startlist_v4 li a, .ridersCont a").each((_, el) => {
    const name = $(el).text().trim()
    if (name) riders.add(normalizeName(name))
  })

  return riders
}

function parseInjuries(html: string): InjuredRider[] {
  if (!html) return []
  const $ = cheerio.load(html)
  const injuries: InjuredRider[] = []

  $("table tbody tr").each((_, row) => {
    const cols = $(row).find("td")
    const riderName = cols.eq(1).find("a").first().text().trim() || cols.eq(1).text().trim()
    if (!riderName) return

    const statusText = cols.eq(3).text().trim().toLowerCase()
    const note = cols.eq(2).text().trim()

    const status: "injured" | "doubtful" = statusText.includes("doubtful") ? "doubtful" : "injured"

    injuries.push({ name: riderName, status, note })
  })

  return injuries
}

function extractDateFromPage(html: string): string {
  if (!html) return "2025-06-01"
  const $ = cheerio.load(html)
  const dateText = $(".infolist li").filter((_, el) => {
    return $(el).text().includes("Date:")
  }).text()

  const match = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (match) {
    const months: Record<string, string> = {
      January: "01", February: "02", March: "03", April: "04",
      May: "05", June: "06", July: "07", August: "08",
      September: "09", October: "10", November: "11", December: "12",
    }
    const month = months[match[2]] || "06"
    return `${match[3]}-${month}-${match[1].padStart(2, "0")}`
  }
  return "2025-06-01"
}

// ============================================================================
// NAME NORMALIZATION
// ============================================================================

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

// ============================================================================
// RECENCY WEIGHTING
// ============================================================================

function getRecencyWeight(dateStr: string): number {
  const month = parseInt(dateStr.split("-")[1], 10)
  if (month >= 8) return 1.0   // Aug-Dec: full weight
  if (month >= 4) return 0.85  // Apr-Jul: 85%
  return 0.7                   // Jan-Mar: 70%
}

// ============================================================================
// MAIN SCRAPING LOGIC
// ============================================================================

async function scrapeAllRaces(): Promise<RaceResult[]> {
  console.log("Step 1: Scraping PCS 2025 race results...\n")
  const allResults: RaceResult[] = []

  for (const race of GAME_RACES) {
    console.log(`Processing: ${race.name} (${race.type})`)

    if (!race.isStageRace) {
      // One-day race
      const url = `https://www.procyclingstats.com/race/${race.pcsSlug}/2025/result`
      const html = await fetchWithCache(url)
      const date = extractDateFromPage(html)
      const results = parseOneDayResults(html, race.pcsSlug, race.type, date)
      console.log(`  Found ${results.length} results`)
      allResults.push(...results)
    } else {
      // Stage race: scrape each stage + GC + classifications
      const stages = race.stages || 7
      for (let i = 1; i <= stages; i++) {
        const url = `https://www.procyclingstats.com/race/${race.pcsSlug}/2025/stage-${i}`
        const html = await fetchWithCache(url)
        const date = extractDateFromPage(html)
        const results = parseStageResults(html, race.pcsSlug, race.type, i, date)
        allResults.push(...results)
      }

      // GC classification
      const gcUrl = `https://www.procyclingstats.com/race/${race.pcsSlug}/2025/gc`
      const gcHtml = await fetchWithCache(gcUrl)
      const gcDate = extractDateFromPage(gcHtml)
      allResults.push(...parseGCResults(gcHtml, race.pcsSlug, race.type, "gc", gcDate))

      // Points classification
      const pointsUrl = `https://www.procyclingstats.com/race/${race.pcsSlug}/2025/points`
      const pointsHtml = await fetchWithCache(pointsUrl)
      allResults.push(...parseGCResults(pointsHtml, race.pcsSlug, race.type, "points", gcDate))

      // KOM classification
      const komUrl = `https://www.procyclingstats.com/race/${race.pcsSlug}/2025/kom`
      const komHtml = await fetchWithCache(komUrl)
      allResults.push(...parseGCResults(komHtml, race.pcsSlug, race.type, "kom", gcDate))

      // Youth classification
      const youthUrl = `https://www.procyclingstats.com/race/${race.pcsSlug}/2025/youth`
      const youthHtml = await fetchWithCache(youthUrl)
      allResults.push(...parseGCResults(youthHtml, race.pcsSlug, race.type, "youth", gcDate))

      console.log(`  Scraped ${stages} stages + classifications`)
    }
  }

  console.log(`\nTotal results scraped: ${allResults.length}\n`)
  return allResults
}

async function scrapeStartlists(): Promise<Map<string, Set<string>>> {
  console.log("Scraping 2026 startlists...\n")
  const startlists = new Map<string, Set<string>>()

  for (const race of GAME_RACES) {
    const slug = race.isStageRace ? race.pcsSlug : race.pcsSlug
    const url = `https://www.procyclingstats.com/race/${slug}/2026/startlist`
    const html = await fetchWithCache(url)
    const riders = parseStartlist(html)
    if (riders.size > 0) {
      startlists.set(race.pcsSlug, riders)
      console.log(`  ${race.name}: ${riders.size} confirmed riders`)
    }
  }

  console.log("")
  return startlists
}

async function scrapeInjuries(): Promise<Map<string, InjuredRider>> {
  console.log("Scraping injury data...\n")
  const url = "https://www.procyclingstats.com/statistics/start/latest-injuries"
  const html = await fetchWithCache(url)
  const injuries = parseInjuries(html)
  console.log(`  Found ${injuries.length} injured riders\n`)

  const injuryMap = new Map<string, InjuredRider>()
  for (const injury of injuries) {
    injuryMap.set(normalizeName(injury.name), injury)
  }
  return injuryMap
}

// ============================================================================
// SCORING CALCULATION
// ============================================================================

function calculatePoints(result: RaceResult): number {
  const raceTypeScoring = SCORING[result.raceType]
  if (!raceTypeScoring) return 0

  const categoryScoring = raceTypeScoring[result.category]
  if (!categoryScoring) return 0

  return categoryScoring[String(result.position)] || 0
}

function getBreakdownCategory(raceType: GameRaceType): keyof RiderProjection["breakdown"] {
  switch (raceType) {
    case "high_priority_one_day": return "highPriorityOneDay"
    case "low_priority_one_day": return "lowPriorityOneDay"
    case "grand_tour": return "grandTour"
    case "grand_tour_tdf": return "grandTourTdf"
    case "mini_tour": return "miniTour"
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("=".repeat(60))
  console.log("Velospill 2026 Projected Rankings Generator")
  console.log("=".repeat(60) + "\n")

  // Step 1: Scrape all 2025 race results
  const allResults = await scrapeAllRaces()

  // Step 2: Scrape 2026 startlists
  const startlists = await scrapeStartlists()

  // Step 3: Scrape injuries
  const injuries = await scrapeInjuries()

  // Step 4: Aggregate per rider
  console.log("Step 2: Mapping results to game scoring...\n")

  // Build per-rider data
  const riderData = new Map<string, {
    name: string
    team: string
    nationality: string
    results: Array<{ points: number; raceType: GameRaceType; raceSlug: string; date: string }>
  }>()

  for (const result of allResults) {
    const key = normalizeName(result.riderName)
    if (!riderData.has(key)) {
      riderData.set(key, {
        name: result.riderName,
        team: result.team,
        nationality: result.nationality,
        results: [],
      })
    }

    const points = calculatePoints(result)
    if (points > 0) {
      riderData.get(key)!.results.push({
        points,
        raceType: result.raceType,
        raceSlug: result.raceSlug,
        date: result.date,
      })
    }
  }

  // Step 5: Calculate projected points with adjustments
  console.log("Step 3: Applying adjustments...\n")

  const projections: Array<{
    riderName: string
    team: string
    nationality: string
    projectedPoints: number
    breakdown: RiderProjection["breakdown"]
    confirmedRaces: number
    injuryStatus: "healthy" | "injured" | "doubtful"
    injuryNote: string | null
  }> = []

  for (const [normalizedName, data] of riderData) {
    const breakdown = {
      highPriorityOneDay: 0,
      lowPriorityOneDay: 0,
      grandTour: 0,
      grandTourTdf: 0,
      miniTour: 0,
    }

    let confirmedRaces = 0

    // Group results by parent race to apply startlist confirmation
    const raceGroups = new Map<string, typeof data.results>()
    for (const r of data.results) {
      const parentSlug = r.raceSlug.split("/")[0]
      if (!raceGroups.has(parentSlug)) raceGroups.set(parentSlug, [])
      raceGroups.get(parentSlug)!.push(r)
    }

    for (const [parentSlug, results] of raceGroups) {
      // Check if rider is on 2026 startlist
      const startlist = startlists.get(parentSlug)
      const isConfirmed = startlist?.has(normalizedName) || false

      if (isConfirmed) confirmedRaces++

      // Confirmation multiplier: confirmed = 1.0, rode in 2025 but not confirmed = 0.7
      const confirmationMultiplier = isConfirmed ? 1.0 : 0.7

      for (const r of results) {
        const recencyWeight = getRecencyWeight(r.date)
        const adjustedPoints = r.points * recencyWeight * confirmationMultiplier
        const category = getBreakdownCategory(r.raceType)
        breakdown[category] += adjustedPoints
      }
    }

    // Apply 10% bonus to GT/mini-tour riders for supplementary points (sprints, mountains, jerseys)
    const gtBonus = (breakdown.grandTour + breakdown.grandTourTdf + breakdown.miniTour) * 0.10
    breakdown.grandTour += breakdown.grandTour > 0 ? (breakdown.grandTour / (breakdown.grandTour + breakdown.grandTourTdf + breakdown.miniTour || 1)) * gtBonus : 0
    breakdown.grandTourTdf += breakdown.grandTourTdf > 0 ? (breakdown.grandTourTdf / (breakdown.grandTour + breakdown.grandTourTdf + breakdown.miniTour || 1)) * gtBonus : 0
    breakdown.miniTour += breakdown.miniTour > 0 ? (breakdown.miniTour / (breakdown.grandTour + breakdown.grandTourTdf + breakdown.miniTour || 1)) * gtBonus : 0

    let totalPoints = breakdown.highPriorityOneDay + breakdown.lowPriorityOneDay +
      breakdown.grandTour + breakdown.grandTourTdf + breakdown.miniTour

    // Injury adjustment
    const injury = injuries.get(normalizedName)
    let injuryStatus: "healthy" | "injured" | "doubtful" = "healthy"
    let injuryNote: string | null = null

    if (injury) {
      injuryStatus = injury.status
      injuryNote = injury.note

      // Determine severity from note
      const noteLower = injury.note.toLowerCase()
      if (noteLower.includes("season") || noteLower.includes("september") || noteLower.includes("october") || noteLower.includes("november") || noteLower.includes("december")) {
        totalPoints *= 0.25 // -75% for late/season-ending
      } else if (noteLower.includes("june") || noteLower.includes("july") || noteLower.includes("august") || noteLower.includes("unknown")) {
        totalPoints *= 0.50 // -50% for mid-season return
      } else {
        totalPoints *= 0.85 // -15% for early return
      }
    }

    // Round breakdown values
    breakdown.highPriorityOneDay = Math.round(breakdown.highPriorityOneDay * 10) / 10
    breakdown.lowPriorityOneDay = Math.round(breakdown.lowPriorityOneDay * 10) / 10
    breakdown.grandTour = Math.round(breakdown.grandTour * 10) / 10
    breakdown.grandTourTdf = Math.round(breakdown.grandTourTdf * 10) / 10
    breakdown.miniTour = Math.round(breakdown.miniTour * 10) / 10

    if (totalPoints > 0) {
      projections.push({
        riderName: data.name,
        team: data.team,
        nationality: data.nationality,
        projectedPoints: Math.round(totalPoints * 10) / 10,
        breakdown,
        confirmedRaces,
        injuryStatus,
        injuryNote,
      })
    }
  }

  // Step 6: Sort, rank, and output
  console.log("Step 4: Generating output...\n")

  projections.sort((a, b) => b.projectedPoints - a.projectedPoints)
  const top100 = projections.slice(0, 100)

  const output: RiderProjection[] = top100.map((p, i) => ({
    rank: i + 1,
    riderName: p.riderName,
    team: p.team,
    nationality: p.nationality,
    projectedPoints: p.projectedPoints,
    breakdown: p.breakdown,
    confirmedRaces: p.confirmedRaces,
    injuryStatus: p.injuryStatus,
    injuryNote: p.injuryNote,
    season: 2026,
    lastUpdated: new Date().toISOString(),
  }))

  ensureDir(path.dirname(OUTPUT_FILE))
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8")

  console.log(`Written ${output.length} rankings to ${OUTPUT_FILE}`)
  console.log("\nTop 10:")
  for (const r of output.slice(0, 10)) {
    console.log(`  #${r.rank} ${r.riderName} (${r.team}) - ${r.projectedPoints} pts`)
  }
  console.log("\nDone!")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})

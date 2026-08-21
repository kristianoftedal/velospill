import * as cheerio from "cheerio";
import type {
  UciAccordionSection,
  UciCalendarEvent,
  UciCompetition,
  UciResultRow,
  UciScheduledRace,
} from "./types";

const UCI_ORIGIN = "https://www.uci.org";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

async function uciFetch(path: string, accept: string): Promise<string> {
  const res = await fetch(`${UCI_ORIGIN}${path}`, {
    headers: { "User-Agent": UA, Accept: accept },
    signal: AbortSignal.timeout(15000),
    // UCI data for a finished race never changes; cache for an hour.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`UCI request failed (HTTP ${res.status}) for ${path}`);
  }
  return res.text();
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse a UCI date range: "19 Aug - 23 Aug 2026" or "06 Apr 2025".
 * The year only appears at the end, so the start date borrows it.
 */
export function parseUciDateRange(dates: string): {
  startDate: string | null;
  endDate: string | null;
} {
  const parts = dates.split("-").map((p) => p.trim());
  const year = parts[parts.length - 1]?.match(/(\d{4})$/)?.[1];
  if (!year) return { startDate: null, endDate: null };

  const toIso = (chunk: string): string | null => {
    const m = chunk.match(/^(\d{1,2})\s+([A-Za-z]{3})/);
    if (!m) return null;
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) return null;
    return `${year}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  };

  const startDate = toIso(parts[0]);
  const endDate = parts.length > 1 ? toIso(parts[parts.length - 1]) : startDate;
  return { startDate, endDate };
}

/** "20 Aug 2025" → "2025-08-20" */
export function parseUciDate(date: string): string | null {
  const m = date.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

type CalendarNode = {
  items?: CalendarNode[];
  name?: string;
  country?: string;
  dates?: string;
  detailsLink?: { url?: string };
};

/**
 * Fetch the UCI road calendar. A stage race is repeated once per racing day,
 * so events are deduped on competition id.
 */
export async function fetchUciCalendar(opts: {
  year?: number;
  when?: "past" | "upcoming";
  raceCategory?: string;
  raceClass?: string;
  country?: string;
}): Promise<UciCalendarEvent[]> {
  const params = new URLSearchParams({ discipline: "ROA" });
  if (opts.year) params.set("year", String(opts.year));
  if (opts.raceCategory) params.set("raceCategory", opts.raceCategory);
  if (opts.raceClass) params.set("raceClass", opts.raceClass);
  if (opts.country) params.set("country", opts.country);

  const body = await uciFetch(
    `/api/calendar/${opts.when ?? "past"}?${params}`,
    "application/json",
  );
  const data = JSON.parse(body) as { items?: CalendarNode[] };

  const byId = new Map<string, UciCalendarEvent>();
  for (const month of data.items ?? []) {
    for (const day of month.items ?? []) {
      for (const ev of day.items ?? []) {
        const url = ev.detailsLink?.url;
        if (!url) continue;
        const competitionId = url.replace(/^\/competition-details\//, "");
        if (byId.has(competitionId)) continue;
        byId.set(competitionId, {
          competitionId,
          name: ev.name ?? "",
          country: ev.country ?? "",
          dates: ev.dates ?? "",
          ...parseUciDateRange(ev.dates ?? ""),
        });
      }
    }
  }
  return [...byId.values()].sort((a, b) =>
    (a.startDate ?? "").localeCompare(b.startDate ?? ""),
  );
}

type CompetitionProps = {
  competitionName?: string;
  competitionDetails?: { name?: string; dates?: string; country?: string; competitionClass?: string };
  schedule?: { items?: Array<{ date?: string; races?: Array<Record<string, string>> }> };
  results?: { accordion?: Array<Record<string, unknown>> };
};

/**
 * Competition details have no JSON endpoint — the payload is embedded in the
 * page as a `data-props` attribute on the CompetitionDetailsModule element.
 */
export async function fetchUciCompetition(
  competitionId: string,
): Promise<UciCompetition> {
  if (!/^\d{4}\/[A-Z]{3}\/\d+$/.test(competitionId)) {
    throw new Error(`Invalid UCI competition id: ${competitionId}`);
  }

  const html = await uciFetch(`/competition-details/${competitionId}`, "text/html");
  const $ = cheerio.load(html);
  const raw = $('[data-component="CompetitionDetailsModule"]').attr("data-props");
  if (!raw) {
    throw new Error(
      "Could not find competition data on the UCI page — the page layout may have changed.",
    );
  }

  let props: CompetitionProps;
  try {
    props = JSON.parse(raw) as CompetitionProps;
  } catch {
    throw new Error("Could not parse competition data from the UCI page.");
  }

  const schedule: UciScheduledRace[] = [];
  for (const item of props.schedule?.items ?? []) {
    for (const race of item.races ?? []) {
      schedule.push({
        raceName: race.raceName ?? "",
        raceType: race.raceType ?? "",
        raceClass: race.raceClass ?? "",
        category: race.category ?? "",
        date: item.date ?? "",
      });
    }
  }

  const accordion: UciAccordionSection[] = (props.results?.accordion ?? []).map(
    (section) => ({
      label: String(section.label ?? ""),
      results: ((section.results ?? []) as Array<Record<string, string>>).map((r) => ({
        title: r.title ?? "",
        eventCode: r.eventCode ?? "",
        raceType: r.raceType ?? "A",
      })),
    }),
  );

  return {
    competitionId,
    name: props.competitionDetails?.name ?? props.competitionName ?? "",
    dates: props.competitionDetails?.dates ?? "",
    country: props.competitionDetails?.country ?? "",
    competitionClass: props.competitionDetails?.competitionClass ?? "",
    schedule,
    accordion,
  };
}

/** Fetch one classification. Rows without a rank are DNS/DNF/DSQ entries. */
export async function fetchUciResult(ref: {
  eventCode: string;
  raceType: string;
  title: string;
}): Promise<UciResultRow[]> {
  const params = new URLSearchParams({
    discipline: "ROA",
    raceType: ref.raceType,
    raceName: ref.title,
  });
  const body = await uciFetch(
    `/api/calendar/results/${encodeURIComponent(ref.eventCode)}?${params}`,
    "application/json",
  );
  const data = JSON.parse(body) as {
    results?: Array<{ headerType?: string; values?: Record<string, unknown> }>;
  };

  return (data.results ?? [])
    .filter((r) => r.headerType === "rider" && r.values)
    .map((r) => {
      const v = r.values as Record<string, unknown>;
      const firstname = String(v.firstname ?? "").trim();
      const lastname = String(v.lastname ?? "").trim();
      const rank = v.rank != null ? Number(v.rank) : NaN;
      return {
        rank: Number.isFinite(rank) ? rank : null,
        firstname,
        lastname,
        fullName: `${firstname} ${lastname}`.trim(),
        team: String(v.team ?? "").trim(),
        nationality: String(v.nationality ?? "").trim(),
        result: v.result != null ? String(v.result) : null,
      } satisfies UciResultRow;
    });
}

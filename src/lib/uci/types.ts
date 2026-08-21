/** Shapes returned by the (undocumented, public) uci.org web API. */

export type UciCalendarEvent = {
  /** "2026/ROA/76940" — parsed out of detailsLink.url */
  competitionId: string;
  name: string;
  country: string;
  /** Raw UCI range string, e.g. "19 Aug - 23 Aug 2026" */
  dates: string;
  startDate: string | null;
  endDate: string | null;
};

export type UciScheduledRace = {
  /** "Stage 1", "Final Result", "Prologue" … */
  raceName: string;
  /** "Individual Road Race" | "Individual Time Trial" | "Team Time Trial" */
  raceType: string;
  raceClass: string;
  category: string;
  date: string;
};

export type UciResultRef = {
  /** "Stage Classification", "Overall Points Classification" … */
  title: string;
  eventCode: string;
  /** "A" = individual, "T" = team (TTT) */
  raceType: string;
};

export type UciAccordionSection = {
  /** "Stage 1" … "Final Result" */
  label: string;
  results: UciResultRef[];
};

export type UciCompetition = {
  competitionId: string;
  name: string;
  dates: string;
  country: string;
  /** e.g. "2.UWT - Stages - UCI WorldTour" */
  competitionClass: string;
  schedule: UciScheduledRace[];
  accordion: UciAccordionSection[];
};

export type UciResultRow = {
  rank: number | null;
  firstname: string;
  lastname: string;
  fullName: string;
  team: string;
  nationality: string;
  /** Finish time, gap ("+4:24"), classification points ("63"), or "DNS"/"DNF"/"DSQ" */
  result: string | null;
};
